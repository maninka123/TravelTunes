import {
  deepSeekErrorMessage,
  isSameOrigin,
  json,
  parseJsonText,
  qwenApiKey,
  qwenErrorMessage,
} from "./_shared.js";

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
      const model = env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-flash";
      if (!env.DEEPSEEK_API_KEY) return json({ songs: demoSongs(body), resolvedModel: model, demo: true });
      return json({ songs: normalizeSongs(await callDeepSeekSongs(env, body, model)), resolvedModel: model, demo: false });
    }

    if (provider === "qwen") {
      const model = env.QWEN_TEXT_MODEL || env.QWEN_MODEL || "qwen3.5-flash";
      if (!qwenApiKey(env)) return json({ songs: demoSongs(body), resolvedModel: model, demo: true });
      return json({ songs: normalizeSongs(await callQwenSongs(env, body, model)), resolvedModel: model, demo: false });
    }

    const model = env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
    if (!env.GEMINI_API_KEY) return json({ songs: demoSongs(body), resolvedModel: model, demo: true });
    return json({ songs: normalizeSongs(await callGeminiSongs(env, body, model)), resolvedModel: model, demo: false });
  } catch (error) {
    return json({ error: error.message || "Song request failed." }, 500);
  }
}

async function callGeminiSongs(env, body, model) {
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

async function callQwenSongs(env, body, model) {
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
  if (!response.ok) throw new Error(qwenErrorMessage(data, "Qwen song call failed.", model));
  return parseJsonText(data.choices?.[0]?.message?.content)?.songs;
}

async function callDeepSeekSongs(env, body, model) {
  // The song call is text only — it receives the mood JSON from the vision call,
  // never the images. Do not fallback to DEEPSEEK_VISION_MODEL because the vision model
  // carries an "-exp" suffix and may be withdrawn without notice. Keeping the song call
  // on the stable model ensures a withdrawal breaks the mood read only.
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
  if (!response.ok) throw new Error(deepSeekErrorMessage(data, "DeepSeek song call failed.", model));
  return parseJsonText(data.choices?.[0]?.message?.content)?.songs;
}

function songPrompt(body) {
  const rawCountries = Array.isArray(body.musicCountries) ? body.musicCountries : [];
  const validCountries = rawCountries.filter((c) => c && c.name && Number(c.count) > 0);
  const total = 8;
  const photoCountry = body.country || "unknown";
  const imageNotes = String(body.imageNotes || "").trim().slice(0, 240);

  let originInstruction;
  if (validCountries.length > 0) {
    const pairs = validCountries.map((c) => `${c.name}: ${c.count}`).join(", ");
    originInstruction = `Choose ${total} real songs with this split by country of origin: ${pairs}. The photos were taken in ${photoCountry}; match the scene mood but do not let the photo location change the split. Where a country has several major music languages, choose whichever best fits the mood.`;
  } else {
    originInstruction = `Choose ${total} well-known international songs.`;
  }

  return `Return JSON only with {"songs":[...]}.
Suggest ${total} real songs for travel photos.
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
  const primaryCountry = rawCountries[0]?.name || body.country || "Sri Lanka";
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
      language: "Local",
      reason: "Use as a local search seed when a provider key is missing.",
    },
  ];
}
