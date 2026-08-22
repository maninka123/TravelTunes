export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export function parseJsonText(text) {
  if (!text) return null;
  if (typeof text === "object") return text;
  const cleaned = String(text).replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

export function qwenApiKey(env) {
  return env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;
}

export function qwenErrorMessage(data, fallback, defaultModel = "qwen3.5-flash") {
  const message = data.error?.message || data.message || fallback;
  const code = data.error?.code || data.code || "";
  if (/invalid_api_key|api key|apikey/i.test(`${code} ${message}`)) {
    return "Qwen/DashScope rejected the configured API key. Check QWEN_API_KEY or DASHSCOPE_API_KEY in .dev.vars and Cloudflare Pages environment variables.";
  }
  if (/AccessDenied|Unpurchased|eligible|model denied/i.test(`${code} ${message}`)) {
    return `Qwen/DashScope accepted the key but denied access to the selected model. Enable access for ${data.model || defaultModel} in Alibaba Model Studio, or set QWEN_VISION_MODEL / QWEN_TEXT_MODEL to a model your account can use.`;
  }
  return message;
}

export function deepSeekErrorMessage(data, fallback, defaultModel = "deepseek-v4-flash") {
  const message = data.error?.message || data.message || fallback;
  const code = data.error?.code || data.code || "";
  if (/invalid_api_key|api key|apikey|authentication_error|unauthorized/i.test(`${code} ${message}`)) {
    return "DeepSeek rejected the configured API key. Check DEEPSEEK_API_KEY in .dev.vars and Cloudflare Pages environment variables.";
  }
  if (/model_not_found|not found|unknown model|denied|permission/i.test(`${code} ${message}`)) {
    return `DeepSeek could not access the requested model (${data.model || defaultModel}). The model may have changed or expired; set DEEPSEEK_VISION_MODEL or DEEPSEEK_TEXT_MODEL in .dev.vars.`;
  }
  return message;
}

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
