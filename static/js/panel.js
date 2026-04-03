const output = document.getElementById("output");
const chatLog = document.getElementById("chat-log");

function setOutput(title, data) {
  output.textContent = `${title}\n\n${JSON.stringify(data, null, 2)}`;
}

function setStatus(elementId, label, ok, detail = "") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const css = ok ? "ok" : "fail";
  el.className = `status-card ${css}`;
  el.textContent = `${label}: ${ok ? "online" : "offline"}${detail ? ` (${detail})` : ""}`;
}

function addChat(role, text) {
  const item = document.createElement("div");
  item.className = "chat-item";
  item.innerHTML = `<strong>${role}</strong><div>${text.replace(/</g, "&lt;")}</div>`;
  chatLog.appendChild(item);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({ success: false, error: "Invalid JSON response" }));
  if (!res.ok || data.success === false) {
    const detail = data.details ? `: ${data.details}` : "";
    const message = `${data.error || `Request failed with status ${res.status}`}${detail}`;
    throw new Error(message);
  }
  return data;
}

async function refreshStatus() {
  try {
    const [healthRes, aiHealthRes] = await Promise.all([
      fetch("/health"),
      fetch("/api/ai/health"),
    ]);

    const health = await healthRes.json();
    const aiHealth = await aiHealthRes.json();

    const controlPlaneOnline = health.success === true || health.status === "healthy";
    const ollamaReachable = !!aiHealth.ollama?.success;
    const modelReady = !!aiHealth.ollama?.model_ready;
    const ollamaOnline = !!aiHealth.success && ollamaReachable && modelReady;

    let ollamaDetail = aiHealth.model || "minimax-m2.5:cloud";
    if (ollamaReachable && !modelReady) {
      const availableModels = aiHealth.ollama?.available_models || [];
      if (Array.isArray(availableModels) && availableModels.length > 0) {
        ollamaDetail = `model not ready, available: ${availableModels.slice(0, 3).join(", ")}`;
      } else {
        ollamaDetail = "model not ready";
      }
    }

    setStatus("control-plane-status", "Control Plane", controlPlaneOnline, health.version || "runtime");
    setStatus("ollama-status", "Ollama", ollamaOnline, ollamaDetail);
  } catch (err) {
    setStatus("control-plane-status", "Control Plane", false, "unreachable");
    setStatus("ollama-status", "Ollama", false, "unreachable");
  }
}

function withLoading(form, fn) {
  const button = form.querySelector("button[type='submit']") || form.querySelector("button");
  if (!button) return fn();

  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Working...";

  return Promise.resolve(fn()).finally(() => {
    button.disabled = false;
    button.textContent = original;
  });
}

document.getElementById("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("chat-message").value.trim();
  if (!message) return;

  withLoading(form, async () => {
    addChat("Operator", message);
    document.getElementById("chat-message").value = "";

    try {
      const result = await apiPost("/api/ai/chat", { message });
      addChat("Ollama", result.response || "No response");
      setOutput("AI Chat Response", result);
    } catch (err) {
      addChat("System", `Error: ${err.message}`);
      setOutput("AI Chat Error", { error: err.message });
    }
  });
});

document.getElementById("analyze-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.getElementById("analyze-target").value.trim();
  if (!target) return;

  withLoading(form, async () => {
    try {
      const result = await apiPost("/api/intelligence/analyze-target", { target });
      setOutput("Target Intelligence", result);
    } catch (err) {
      setOutput("Target Intelligence Error", { error: err.message });
    }
  });
});

document.getElementById("scan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.getElementById("scan-target").value.trim();
  const objective = document.getElementById("scan-objective").value;
  const maxTools = Number(document.getElementById("scan-max-tools").value || 5);

  if (!target) return;

  withLoading(form, async () => {
    try {
      const result = await apiPost("/api/intelligence/smart-scan", {
        target,
        objective,
        max_tools: maxTools,
      });
      setOutput("Smart Scan Results", result);
    } catch (err) {
      setOutput("Smart Scan Error", { error: err.message });
    }
  });
});

document.getElementById("payload-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const attackType = document.getElementById("payload-attack-type").value;
  const complexity = document.getElementById("payload-complexity").value;
  const technology = document.getElementById("payload-technology").value.trim();

  withLoading(form, async () => {
    try {
      const result = await apiPost("/api/ai/generate_payload", {
        attack_type: attackType,
        complexity,
        technology,
      });
      setOutput("AI Payload Generation", result);
    } catch (err) {
      setOutput("AI Payload Error", { error: err.message });
    }
  });
});

refreshStatus();
setInterval(refreshStatus, 30000);
