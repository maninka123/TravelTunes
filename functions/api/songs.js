const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { headers: jsonHeaders });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const provider = body.model === "qwen" ? "qwen" : "gemini";

    if (provider === "qwen") {
      if (!env.QWEN_API_KEY) return json({ songs: demoSongs(body), demo: true });
      return json({ songs: normalizeSongs(await callQwenSongs(env, body)), demo: false });
    }

    if (!env.GEMINI_API_KEY) return json({ songs: demoSongs(body), demo: true });
    return json({ songs: normalizeSongs(await callGeminiSongs(env, body)), demo: false });
  } catch (error) {
    return json({ error: error.message || "Song request failed." }, 500);
  }
}

async function callGeminiSongs(env, body) {
  const model = env.GEMINI_TEXT_MODEL || env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";
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
  const model = env.QWEN_TEXT_MODEL || env.QWEN_VISION_MODEL || "qwen3-vl-flash";
  const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.QWEN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: songPrompt(body) }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Qwen song call failed.");
  return parseJsonText(data.choices?.[0]?.message?.content)?.songs;
}

function songPrompt(body) {
  const languages = Array.isArray(body.languages) ? body.languages.join(", ") : "English, Sinhala, local language";
  return `Return JSON only with {"songs":[...]}.
Suggest 8 real songs for travel photos.
Country: ${body.country || "unknown"}
Energy slider 0 quiet to 100 energetic: ${body.energy}
Style slider 0 traditional to 100 mainstream: ${body.style}
Tier-1 languages/countries: ${languages}
Preferred tier-1 count: ${body.tierOneCount || 5}
Mood read: ${JSON.stringify(body.mood || {})}
Each song object must be {"title": string, "artist": string, "language": string, "tier": 1 or 2, "reason": string}.
Prioritize English, Sinhala, and the country's local music before wider global picks. Avoid made-up songs.`;
}

function normalizeSongs(songs) {
  const clean = Array.isArray(songs) ? songs : [];
  return clean
    .filter((song) => song?.title && song?.artist)
    .slice(0, 8)
    .map((song, index) => ({
      title: String(song.title).trim(),
      artist: String(song.artist).trim(),
      language: String(song.language || "Music").trim(),
      tier: Number(song.tier) === 1 || index < 5 ? 1 : 2,
      reason: String(song.reason || "Fits the selected travel mood.").trim(),
    }));
}

function demoSongs(body) {
  const country = body.country || "Sri Lanka";
  const local = Array.isArray(body.languages) ? body.languages[0] || "Local" : "Local";
  return [
    {
      title: "Manike Mage Hithe",
      artist: "Yohani",
      language: "Sinhala",
      tier: 1,
      reason: "Bright Sinhala pop for warm travel clips.",
    },
    {
      title: "Paradise",
      artist: "Coldplay",
      language: "English",
      tier: 1,
      reason: "Open, scenic, and easy to pair with landscapes.",
    },
    {
      title: "Sunflower",
      artist: "Post Malone and Swae Lee",
      language: "English",
      tier: 1,
      reason: "Soft mainstream energy for relaxed footage.",
    },
    {
      title: "A Sky Full of Stars",
      artist: "Coldplay",
      language: "English",
      tier: 1,
      reason: "Builds energy without losing the travel feel.",
    },
    {
      title: "Shape of You",
      artist: "Ed Sheeran",
      language: "English",
      tier: 1,
      reason: "Mainstream rhythm for lively photo batches.",
    },
    {
      title: `${country} travel music`,
      artist: "Local artists",
      language: local,
      tier: 2,
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
