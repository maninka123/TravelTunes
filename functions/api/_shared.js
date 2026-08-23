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

/**
 * Log a run record to Cloudflare D1 for model and prompt quality debugging.
 *
 * EXCLUSION LIST (deliberate and must not be widened):
 * - Image bytes, base64 data, and filenames
 * - EXIF metadata and GPS coordinates
 * - The country detected from photo EXIF
 * - The user's image notes free-text field
 * - Raw IP addresses or request.cf fields on the runs table
 * - Any user tracking identifiers, cookies, or fingerprints
 */
export async function logRun(env, record) {
  if (!env?.RUN_LOG) return;
  try {
    const id = record.id;
    if (!id) return;

    const createdAt = record.created_at || new Date().toISOString();
    const provider = record.provider ?? null;
    const visionModel = record.vision_model ?? null;
    const songsModel = record.songs_model ?? null;
    const countries = record.countries !== undefined
      ? (typeof record.countries === "string" ? record.countries : JSON.stringify(record.countries))
      : null;
    const energy = record.energy !== undefined && record.energy !== null ? Number(record.energy) : null;
    const style = record.style !== undefined && record.style !== null ? Number(record.style) : null;
    const moodJson = record.mood_json !== undefined
      ? (typeof record.mood_json === "string" ? record.mood_json : JSON.stringify(record.mood_json))
      : null;
    const songsJson = record.songs_json !== undefined
      ? (typeof record.songs_json === "string" ? record.songs_json : JSON.stringify(record.songs_json))
      : null;
    const visionMs = record.vision_ms !== undefined && record.vision_ms !== null ? Number(record.vision_ms) : null;
    const songsMs = record.songs_ms !== undefined && record.songs_ms !== null ? Number(record.songs_ms) : null;
    const error = record.error ?? null;

    const query = `INSERT INTO runs (
      id, created_at, provider, vision_model, songs_model,
      countries, energy, style, mood_json, songs_json,
      vision_ms, songs_ms, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      created_at = COALESCE(runs.created_at, excluded.created_at),
      provider = COALESCE(excluded.provider, runs.provider),
      vision_model = COALESCE(excluded.vision_model, runs.vision_model),
      songs_model = COALESCE(excluded.songs_model, runs.songs_model),
      countries = COALESCE(excluded.countries, runs.countries),
      energy = COALESCE(excluded.energy, runs.energy),
      style = COALESCE(excluded.style, runs.style),
      mood_json = COALESCE(excluded.mood_json, runs.mood_json),
      songs_json = COALESCE(excluded.songs_json, runs.songs_json),
      vision_ms = COALESCE(excluded.vision_ms, runs.vision_ms),
      songs_ms = COALESCE(excluded.songs_ms, runs.songs_ms),
      error = COALESCE(excluded.error, runs.error);`;

    await env.RUN_LOG.prepare(query)
      .bind(
        id,
        createdAt,
        provider,
        visionModel,
        songsModel,
        countries,
        energy,
        style,
        moodJson,
        songsJson,
        visionMs,
        songsMs,
        error
      )
      .run();
  } catch {
    // Logging failures must never surface to the user or alter responses
  }
}

/**
 * Increment daily aggregate usage counters by coarse geography.
 *
 * PRIVACY & UNLINKABILITY GUARANTEE:
 * usage_geo must contain nothing that can be joined back to the runs table.
 * It stores NO run IDs, NO timestamps finer than the UTC day (YYYY-MM-DD),
 * NO IP addresses, and NO session or request identifiers. The two tables
 * are completely unlinkable.
 */
export async function bumpGeo(env, request) {
  if (!env?.RUN_LOG) return;
  try {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const country = String(request?.cf?.country || "unknown").trim() || "unknown";
    const city = String(request?.cf?.city || "unknown").trim() || "unknown";

    const query = `INSERT INTO usage_geo (day, country, city, runs) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, country, city) DO UPDATE SET runs = runs + 1;`;

    await env.RUN_LOG.prepare(query).bind(day, country, city).run();
  } catch {
    // Counter failures must never surface or disrupt API handling
  }
}
