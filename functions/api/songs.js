function isSameOrigin(request) {
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

export async function onRequestOptions({ request }) {
  if (!isSameOrigin(request)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) {
    return json({ error: "Forbidden" }, 403);
  }
  try {
    const body = await request.json();
    const provider = body.model === "deepseek" ? "deepseek" : body.model === "qwen" ? "qwen" : "gemini";

    if (provider === "deepseek") {
      if (!env.DEEPSEEK_API_KEY) return json({ songs: demoSongs(body), demo: true });
      return json({ songs: normalizeSongs(await callDeepSeekSongs(env, body)), demo: false });
    }

    if (provider === "qwen") {
      if (!qwenApiKey(env)) return json({ songs: demoSongs(body), demo: true });
      return json({ songs: normalizeSongs(await callQwenSongs(env, body)), demo: false });
    }

    if (!env.GEMINI_API_KEY) return json({ songs: demoSongs(body), demo: true });
    return json({ songs: normalizeSongs(await callGeminiSongs(env, body)), demo: false });
  } catch (error) {
    return json({ error: error.message || "Song request failed." }, 500);
  }
}

async function callGeminiSongs(env, body) {
  const model = env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: songPrompt(body) }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini song call failed.");
  return parseJsonText(data.candidates?.[0]?.content?.parts?.[0]?.text)?.songs;
}

async function callQwenSongs(env, body) {
  const model = env.QWEN_TEXT_MODEL || "qwen3.5-flash";
  const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${qwenApiKey(env)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      enable_thinking: false,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: songPrompt(body) }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(qwenErrorMessage(data, "Qwen song call failed."));
  return parseJsonText(data.choices?.[0]?.message?.content)?.songs;
}

async function callDeepSeekSongs(env, body) {
  // The song call is text only — it receives the mood JSON from the vision call,
  // never the images. Do not fallback to DEEPSEEK_VISION_MODEL because the vision model
  // carries an "-exp" suffix and may be withdrawn without notice. Keeping the song call
  // on the stable model ensures a withdrawal breaks the mood read only.
  const model = env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-flash";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: songPrompt(body) }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(deepSeekErrorMessage(data, "DeepSeek song call failed."));
  return parseJsonText(data.choices?.[0]?.message?.content)?.songs;
}

function songPrompt(body) {
  const rawCountries = Array.isArray(body.musicCountries) ? body.musicCountries : [];
  const countryNames = rawCountries
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
  const languagesList = Array.isArray(body.languages) && body.languages.length > 0
    ? body.languages
    : ["English", "local music"];
  const languagesStr = languagesList.join(", ");
  const photoCountry = body.country || "unknown";
  const imageNotes = String(body.imageNotes || "").trim().slice(0, 240);

  const originInstruction = countryNames.length > 0
    ? `Choose songs that originate from: ${countryNames.join(", ")}. Preferred languages: ${languagesStr}. The photos were taken in ${photoCountry}; match the scene mood but do not let the photo location drive the song origin.`
    : `Choose well-known international songs. Preferred languages: ${languagesStr}.`;

  return `Return JSON only with {"songs":[...]}.
Suggest 8 real songs for travel photos.
${originInstruction}
Energy: ${body.energy} (15 Calm, 40 Easy, 65 Lively, 90 High)
Style: ${body.style} (20 Traditional, 50 Mixed, 80 Modern)
User image notes: ${imageNotes || "none"}
Mood read: ${JSON.stringify(body.mood || {})}
Each song object must be {"title": string, "artist": string, "language": string, "reason": string}.
Avoid made-up songs.`;
}

function normalizeSongs(songs) {
  const clean = Array.isArray(songs) ? songs : [];
  return clean
    .filter((song) => song?.title && song?.artist)
    .slice(0, 8)
    .map((song) => ({
      title: String(song.title).trim(),
      artist: String(song.artist).trim(),
      language: String(song.language || "Music").trim(),
      reason: String(song.reason || "Fits the selected travel mood.").trim(),
    }));
}

function demoSongs(body) {
  const rawCountries = Array.isArray(body.musicCountries) ? body.musicCountries : [];
  const countryNames = rawCountries
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
  const primaryCountry = countryNames[0] || body.country || "Sri Lanka";
  const local = Array.isArray(body.languages) && body.languages[0] ? body.languages[0] : "Local";
  return [
    {
      title: "Manike Mage Hithe",
      artist: "Yohani",
      language: "Sinhala",
      reason: "Bright Sinhala pop for warm travel clips.",
    },
    {
      title: "Paradise",
      artist: "Coldplay",
      language: "English",
      reason: "Open, scenic, and easy to pair with landscapes.",
    },
    {
      title: "Sunflower",
      artist: "Post Malone and Swae Lee",
      language: "English",
      reason: "Soft mainstream energy for relaxed footage.",
    },
    {
      title: "A Sky Full of Stars",
      artist: "Coldplay",
      language: "English",
      reason: "Builds energy without losing the travel feel.",
    },
    {
      title: "Shape of You",
      artist: "Ed Sheeran",
      language: "English",
      reason: "Mainstream rhythm for lively photo batches.",
    },
    {
      title: `${primaryCountry} travel music`,
      artist: "Local artists",
      language: local,
      reason: "Use as a local search seed when a provider key is missing.",
    },
  ];
}

function parseJsonText(text) {
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

function qwenApiKey(env) {
  return env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;
}

function qwenErrorMessage(data, fallback) {
  const message = data.error?.message || data.message || fallback;
  const code = data.error?.code || data.code || "";
  if (/invalid_api_key|api key|apikey/i.test(`${code} ${message}`)) {
    return "Qwen/DashScope rejected the configured API key. Check QWEN_API_KEY or DASHSCOPE_API_KEY in .dev.vars and Cloudflare Pages environment variables.";
  }
  if (/AccessDenied|Unpurchased|eligible|model denied/i.test(`${code} ${message}`)) {
    return `Qwen/DashScope accepted the key but denied access to the selected model. Enable access for ${data.model || "qwen3.5-flash"} in Alibaba Model Studio, or set QWEN_TEXT_MODEL to a model your account can use.`;
  }
  return message;
}

function deepSeekErrorMessage(data, fallback) {
  const message = data.error?.message || data.message || fallback;
  const code = data.error?.code || data.code || "";
  if (/invalid_api_key|api key|apikey|authentication_error|unauthorized/i.test(`${code} ${message}`)) {
    return "DeepSeek rejected the configured API key. Check DEEPSEEK_API_KEY in .dev.vars and Cloudflare Pages environment variables.";
  }
  if (/model_not_found|not found|unknown model|denied|permission/i.test(`${code} ${message}`)) {
    return `DeepSeek could not access the requested model (${data.model || "deepseek-v4-flash"}). The model may have changed or expired; set DEEPSEEK_TEXT_MODEL in .dev.vars.`;
  }
  return message;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
