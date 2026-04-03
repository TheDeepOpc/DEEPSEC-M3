#!/usr/bin/env python3
"""
DeepSec Ollama Runtime
Centralized AI runtime adapter for consistent model usage across all AI endpoints.
"""

import json
import re
import requests
from typing import Any, Dict, Optional


class DeepSecOllamaRuntime:
    """Single gateway for all Ollama model interactions."""

    def __init__(self, base_url: str, model: str, timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.session = requests.Session()

    def health(self) -> Dict[str, Any]:
        """Check Ollama availability and whether configured model exists."""
        try:
            response = self.session.get(f"{self.base_url}/api/tags", timeout=10)
            response.raise_for_status()
            payload = response.json()
            models = [item.get("name", "") for item in payload.get("models", [])]
            model_ready = any(name == self.model or name.startswith(f"{self.model}:") for name in models)
            return {
                "success": True,
                "base_url": self.base_url,
                "model": self.model,
                "model_ready": model_ready,
                "available_models": models,
            }
        except Exception as exc:
            return {
                "success": False,
                "base_url": self.base_url,
                "model": self.model,
                "error": str(exc),
            }

    def generate_text(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.2,
        num_predict: int = 800,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate plain text output from the configured model."""
        merged_prompt = prompt
        if system_prompt:
            merged_prompt = f"{system_prompt}\n\n{prompt}"

        if context:
            merged_prompt = f"{merged_prompt}\n\nInput JSON:\n{json.dumps(context, ensure_ascii=True, indent=2)}"

        body = {
            "model": self.model,
            "prompt": merged_prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": num_predict,
            },
        }

        try:
            response = self.session.post(
                f"{self.base_url}/api/generate",
                json=body,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "success": True,
                "model": self.model,
                "response": data.get("response", "").strip(),
                "raw": data,
            }
        except Exception as exc:
            return {
                "success": False,
                "model": self.model,
                "error": str(exc),
            }

    def generate_json(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.1,
        num_predict: int = 900,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate strict JSON output from the configured model."""
        merged_prompt = prompt
        if system_prompt:
            merged_prompt = f"{system_prompt}\n\n{prompt}"

        if context:
            merged_prompt = f"{merged_prompt}\n\nInput JSON:\n{json.dumps(context, ensure_ascii=True, indent=2)}"

        body = {
            "model": self.model,
            "prompt": merged_prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": num_predict,
            },
        }

        try:
            response = self.session.post(
                f"{self.base_url}/api/generate",
                json=body,
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
            raw_text = (payload.get("response", "") or "").strip()

            parsed = self._safe_parse_json(raw_text)
            if parsed is None:
                parsed = self._repair_json_response(raw_text)

            if parsed is None:
                # Do not hard-fail on formatting-only issues. Endpoints can continue
                # with deterministic fallback logic based on an empty JSON object.
                return {
                    "success": True,
                    "model": self.model,
                    "json": {},
                    "raw": payload,
                    "warning": "Model response was not valid JSON; fallback empty JSON applied",
                    "parse_error": True,
                    "raw_response": raw_text,
                }

            return {
                "success": True,
                "model": self.model,
                "json": parsed,
                "raw": payload,
            }
        except Exception as exc:
            return {
                "success": False,
                "model": self.model,
                "error": str(exc),
            }

    def _repair_json_response(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Run a strict JSON repair pass if the primary JSON parse fails."""
        if not raw_text:
            return None

        repair_prompt = (
            "Convert the following content into a strict JSON object. "
            "Return only valid JSON with no markdown, no explanations, and no comments.\n\n"
            f"CONTENT:\n{raw_text}"
        )

        body = {
            "model": self.model,
            "prompt": repair_prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 700,
            },
        }

        try:
            response = self.session.post(
                f"{self.base_url}/api/generate",
                json=body,
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
            repaired_text = (payload.get("response", "") or "").strip()
            return self._safe_parse_json(repaired_text)
        except Exception:
            return None

    @staticmethod
    def _safe_parse_json(text: str) -> Optional[Dict[str, Any]]:
        """Parse JSON robustly, including JSON embedded in markdown blocks."""
        if not text:
            return None

        try:
            value = json.loads(text)
            if isinstance(value, dict):
                return value
            return {"value": value}
        except Exception:
            pass

        fenced = re.search(r"```json\s*(\{.*?\})\s*```", text, re.S)
        if fenced:
            try:
                return json.loads(fenced.group(1))
            except Exception:
                pass

        bracketed = re.search(r"(\{.*\})", text, re.S)
        if bracketed:
            try:
                return json.loads(bracketed.group(1))
            except Exception:
                pass

        balanced = DeepSecOllamaRuntime._extract_first_json_object(text)
        if balanced:
            try:
                return json.loads(balanced)
            except Exception:
                return None

        return None

    @staticmethod
    def _extract_first_json_object(text: str) -> Optional[str]:
        """Extract the first balanced JSON object from arbitrary text."""
        start = text.find("{")
        if start < 0:
            return None

        depth = 0
        in_string = False
        escape = False

        for idx in range(start, len(text)):
            ch = text[idx]

            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start:idx + 1]

        return None
