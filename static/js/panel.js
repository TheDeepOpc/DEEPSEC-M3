const output = document.getElementById("output");
const chatLog = document.getElementById("chat-log");

let livePollTimer = null;
let liveTraceId = "";
let liveSinceId = 0;
let liveStoryLines = [];

function formatSimpleValue(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return Object.keys(value).join(", ") || "object";
  return String(value);
}

function setOutput(title, content) {
  const lines = [title, ""];

  if (Array.isArray(content)) {
    lines.push(...content.map((item) => String(item)));
  } else if (typeof content === "string") {
    lines.push(content);
  } else if (content && typeof content === "object") {
    for (const [key, value] of Object.entries(content)) {
      lines.push(`${key}: ${formatSimpleValue(value)}`);
    }
  } else {
    lines.push("No output.");
  }

  output.textContent = lines.join("\n");
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
    const error = new Error(message);
    error.response = data;
    error.status = res.status;
    throw error;
  }
  return data;
}

function createTraceId() {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatEventTime(isoTime) {
  if (!isoTime) return new Date().toLocaleTimeString();
  const dt = new Date(isoTime);
  if (Number.isNaN(dt.getTime())) return new Date().toLocaleTimeString();
  return dt.toLocaleTimeString();
}

function appendStoryLine(line) {
  liveStoryLines.push(line);
  if (liveStoryLines.length > 1200) {
    liveStoryLines = liveStoryLines.slice(-1200);
  }
  output.textContent = liveStoryLines.join("\n");
}

function resetStory(target, objective, maxTools, traceId) {
  liveStoryLines = [];
  appendStoryLine("AI PENTEST LIVE STORY");
  appendStoryLine("");
  appendStoryLine(`Target: ${target}`);
  appendStoryLine(`Objective: ${objective}`);
  appendStoryLine(`Max tools: ${maxTools}`);
  appendStoryLine(`Trace ID: ${traceId}`);
  appendStoryLine("");
  appendStoryLine("AI kuzatuv boshlandi...");
}

function formatLiveEventLine(event) {
  const at = formatEventTime(event.timestamp);
  const tool = event.data?.tool ? ` (${event.data.tool})` : "";

  if (event.category === "ai-thought") {
    return `[${at}] AI o'yladi${tool}: ${event.message}`;
  }
  if (event.category === "tool-start") {
    return `[${at}] AI bajarishni boshladi${tool}: ${event.message}`;
  }
  if (event.category === "tool-result") {
    return `[${at}] Tool natijasi${tool}: ${event.message}`;
  }
  if (event.category === "scan-error") {
    return `[${at}] Xatolik: ${event.message}`;
  }
  if (event.category === "scan-status") {
    return `[${at}] Status: ${event.message}`;
  }
  return `[${at}] ${event.message}`;
}

async function pollLiveTraceOnce() {
  if (!liveTraceId) return;
  const params = new URLSearchParams({
    trace_id: liveTraceId,
    since_id: String(liveSinceId),
    limit: "250",
  });

  try {
    const res = await fetch(`/api/live/events?${params.toString()}`);
    const data = await res.json().catch(() => ({ success: false, events: [] }));
    if (!res.ok || data.success === false) return;

    const events = Array.isArray(data.events) ? data.events : [];
    for (const event of events) {
      const eventId = Number(event.id || 0);
      if (eventId > liveSinceId) {
        liveSinceId = eventId;
      }
      appendStoryLine(formatLiveEventLine(event));
    }
  } catch (err) {
    // Keep polling resilient for transient frontend-network errors.
  }
}

function startLiveTrace(target, objective, maxTools, traceId) {
  stopLiveTrace();
  liveTraceId = traceId;
  liveSinceId = 0;
  resetStory(target, objective, maxTools, traceId);
  void pollLiveTraceOnce();
  livePollTimer = setInterval(() => {
    void pollLiveTraceOnce();
  }, 1200);
}

function stopLiveTrace() {
  if (livePollTimer) {
    clearInterval(livePollTimer);
    livePollTimer = null;
  }
}

function renderAnalyzeNarrative(result, target) {
  const profile = result.target_profile || {};
  const ai = result.ai_insights || {};
  const lines = [];

  lines.push(`Nishon: ${target}`);
  lines.push(`Target turi: ${formatSimpleValue(profile.target_type)}`);
  lines.push(`Risk darajasi: ${formatSimpleValue(profile.risk_level)}`);

  if (ai.risk_summary) {
    lines.push("");
    lines.push(`AI bahosi: ${ai.risk_summary}`);
  }

  if (Array.isArray(ai.priority_actions) && ai.priority_actions.length > 0) {
    lines.push("");
    lines.push("AI tavsiya qilgan birinchi qadamlari:");
    ai.priority_actions.slice(0, 6).forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
  }

  return lines;
}

function renderPayloadNarrative(result, attackType) {
  const payloadData = result.ai_payload_generation || {};
  const payloads = Array.isArray(payloadData.payloads) ? payloadData.payloads : [];
  const recommendations = Array.isArray(payloadData.recommendations) ? payloadData.recommendations : [];
  const lines = [];

  lines.push(`Attack turi: ${attackType}`);
  lines.push(`Yaratilgan payloadlar soni: ${payloadData.payload_count || payloads.length || 0}`);

  if (payloads.length > 0) {
    lines.push("");
    lines.push("AI eng foydali deb hisoblagan payloadlar:");
    payloads.slice(0, 5).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.payload || "payload"} (risk: ${item.risk_level || "unknown"})`);
    });
  }

  if (recommendations.length > 0) {
    lines.push("");
    lines.push("AI tavsiyalari:");
    recommendations.slice(0, 6).forEach((tip, idx) => {
      lines.push(`${idx + 1}. ${tip}`);
    });
  }

  if (payloadData.ai_model_notes) {
    lines.push("");
    lines.push(`AI izohi: ${payloadData.ai_model_notes}`);
  }

  return lines;
}

function appendFinalSmartScanNarrative(result, fallbackTarget) {
  const summary = result.ai_scan_summary || {};
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const commandReplay = Array.isArray(result.command_replay) ? result.command_replay : [];
  const execution = result.scan_results?.execution_summary || {};
  const target = result.scan_results?.target || fallbackTarget;

  appendStoryLine("");
  appendStoryLine("YAKUNIY HISOBOT");
  appendStoryLine(`Nishon: ${target}`);
  appendStoryLine(`Bajarilgan toollar: ${execution.successful_tools || 0}/${execution.total_tools || 0}`);
  appendStoryLine(`Topilgan potensial zaifliklar: ${result.scan_results?.total_vulnerabilities || 0}`);

  if (summary.executive_summary) {
    appendStoryLine("");
    appendStoryLine(`AI yakuniy xulosa: ${summary.executive_summary}`);
  }

  if (Array.isArray(summary.key_findings) && summary.key_findings.length > 0) {
    appendStoryLine("");
    appendStoryLine("Muhim topilmalar:");
    summary.key_findings.slice(0, 8).forEach((finding, idx) => {
      appendStoryLine(`${idx + 1}. ${finding}`);
    });
  }

  if (Array.isArray(summary.recommended_next_steps) && summary.recommended_next_steps.length > 0) {
    appendStoryLine("");
    appendStoryLine("AI keyingi qadamlarni shunday tavsiya qildi:");
    summary.recommended_next_steps.slice(0, 8).forEach((step, idx) => {
      appendStoryLine(`${idx + 1}. ${step}`);
    });
  }

  if (warnings.length > 0) {
    appendStoryLine("");
    appendStoryLine("Ogohlantirishlar:");
    warnings.forEach((warn, idx) => {
      appendStoryLine(`${idx + 1}. ${warn}`);
    });
  }

  if (commandReplay.length > 0) {
    appendStoryLine("");
    appendStoryLine("AI nima ishlatdi:");
    commandReplay.forEach((item, idx) => {
      appendStoryLine(`${idx + 1}. ${item.tool || "tool"} -> ${item.status || "unknown"}`);
      appendStoryLine(`   target: ${item.effective_target || "n/a"}`);
      appendStoryLine(`   cmd: ${item.command || "n/a"}`);
      if (item.error) {
        appendStoryLine(`   sabab: ${item.error}`);
      }
    });
  }
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
      setOutput("AI Chat Response", [
        `Siz yuborgan prompt: ${message}`,
        "",
        `AI javobi: ${result.response || "No response"}`,
      ]);
    } catch (err) {
      addChat("System", `Error: ${err.message}`);
      setOutput("AI Chat Error", [`Xatolik: ${err.message}`]);
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
      setOutput("Target Intelligence", renderAnalyzeNarrative(result, target));
    } catch (err) {
      setOutput("Target Intelligence Error", [`Xatolik: ${err.message}`]);
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
    const traceId = createTraceId();
    startLiveTrace(target, objective, maxTools, traceId);

    try {
      const result = await apiPost("/api/intelligence/smart-scan", {
        target,
        objective,
        max_tools: maxTools,
        trace_id: traceId,
      });

      await pollLiveTraceOnce();
      appendFinalSmartScanNarrative(result, target);
    } catch (err) {
      await pollLiveTraceOnce();
      appendStoryLine(`[${new Date().toLocaleTimeString()}] Smart scan xatolik bilan to'xtadi: ${err.message}`);
      const responseTraceId = err.response?.trace_id;
      if (responseTraceId && responseTraceId !== traceId) {
        appendStoryLine(`Server trace id: ${responseTraceId}`);
      }
    } finally {
      stopLiveTrace();
      liveTraceId = "";
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
      setOutput("AI Payload Generation", renderPayloadNarrative(result, attackType));
    } catch (err) {
      setOutput("AI Payload Error", [`Xatolik: ${err.message}`]);
    }
  });
});

refreshStatus();
setInterval(refreshStatus, 30000);
