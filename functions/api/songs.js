import {
  bumpGeo,
  deepSeekErrorMessage,
  isSameOrigin,
  json,
  logRun,
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
  let runId = null;
  const createdAt = new Date().toISOString();
  let provider = "gemini";
  let resolvedModel = "gemini-3.1-flash-lite";
  let selectedCountries = [];
  let energy = null;
  let style = null;

  try {
    const body = await request.json();
    runId = body.runId || crypto.randomUUID();
    provider = body.model === "deepseek" ? "deepseek" : body.model === "qwen" ? "qwen" : "gemini";
    selectedCountries = Array.isArray(body.musicCountries)
      ? body.musicCountries.map((c) => ({ name: c.name, count: c.count })).filter((c) => c.name)
      : [];
    energy = body.energy !== undefined && body.energy !== null ? Number(body.energy) : null;
    style = body.style !== undefined && body.style !== null ? Number(body.style) : null;

    // Bump aggregate geography counter once per run
    await bumpGeo(env, request);

    if (provider === "deepseek") {
      resolvedModel = env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-flash";
      if (!env.DEEPSEEK_API_KEY) {
        const songs = demoSongs(body);
        await logRun(env, {
          id: runId,
          created_at: createdAt,
          provider,
          songs_model: resolvedModel,
          songs_ms: 0,
          songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
          countries: selectedCountries,
          energy,
          style,
        });
        return json({ songs, resolvedModel, runId, demo: true });
      }

      const start = Date.now();
      const songs = normalizeSongs(await callDeepSeekSongs(env, body, resolvedModel));
      const songsMs = Date.now() - start;

      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        songs_model: resolvedModel,
        songs_ms: songsMs,
        songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
        countries: selectedCountries,
        energy,
        style,
      });

      return json({ songs, resolvedModel, runId, demo: false });
    }

    if (provider === "qwen") {
      resolvedModel = env.QWEN_TEXT_MODEL || env.QWEN_MODEL || "qwen3.5-flash";
      if (!qwenApiKey(env)) {
        const songs = demoSongs(body);
        await logRun(env, {
          id: runId,
          created_at: createdAt,
          provider,
          songs_model: resolvedModel,
          songs_ms: 0,
          songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
          countries: selectedCountries,
          energy,
          style,
        });
        return json({ songs, resolvedModel, runId, demo: true });
      }

      const start = Date.now();
      const songs = normalizeSongs(await callQwenSongs(env, body, resolvedModel));
      const songsMs = Date.now() - start;

      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        songs_model: resolvedModel,
        songs_ms: songsMs,
        songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
        countries: selectedCountries,
        energy,
        style,
      });

      return json({ songs, resolvedModel, runId, demo: false });
    }

    resolvedModel = env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
    if (!env.GEMINI_API_KEY) {
      const songs = demoSongs(body);
      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        songs_model: resolvedModel,
        songs_ms: 0,
        songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
        countries: selectedCountries,
        energy,
        style,
      });
      return json({ songs, resolvedModel, runId, demo: true });
    }

    const start = Date.now();
    const songs = normalizeSongs(await callGeminiSongs(env, body, resolvedModel));
    const songsMs = Date.now() - start;

    await logRun(env, {
      id: runId,
      created_at: createdAt,
      provider,
      songs_model: resolvedModel,
      songs_ms: songsMs,
      songs_json: songs.map((s) => ({ title: s.title, artist: s.artist, language: s.language })),
      countries: selectedCountries,
      energy,
      style,
    });

    return json({ songs, resolvedModel, runId, demo: false });
  } catch (error) {
    if (runId) {
      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        songs_model: resolvedModel,
        countries: selectedCountries,
        energy,
        style,
        error: error.message || "Song request failed.",
      });
    }
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

function normalizeSongs(songs) {
  if (!Array.isArray(songs)) return [];
  return songs
    .filter((song) => song && typeof song === "object")
    .map((song) => ({
      title: String(song.title || "").trim(),
      artist: String(song.artist || "").trim(),
      language: String(song.language || "English").trim(),
      reason: String(song.reason || "").trim(),
    }))
    .filter((song) => song.title && song.artist);
}

function songPrompt(body) {
  const imageNotes = String(body.imageNotes || "").trim().slice(0, 240);
  const mood = body.mood || {};
  const musicCountries = Array.isArray(body.musicCountries) && body.musicCountries.length > 0
    ? body.musicCountries
    : [{ name: body.country || "United States", count: 8 }];

  const totalRequested = musicCountries.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 8;
  const countryBreakdown = musicCountries
    .map((item) => `- ${item.name}: exactly ${item.count} song(s)`)
    .join("\n");

  return `Recommend exactly ${totalRequested} real, recognizable songs for an Instagram reel/story matching this travel scene.

Context:
- Location in photo: ${body.country || "unknown"}
- Energy slider: ${body.energy ?? 50}/100
- Style slider: ${body.style ?? 50}/100 (0=traditional/local/folk, 100=modern/electronic/pop)
- Image notes from user: ${imageNotes || "none"}
- Mood analysis: ${JSON.stringify(mood)}

Required country breakdown:
${countryBreakdown}

Rules:
1. Return exactly ${totalRequested} songs in total, strictly adhering to the requested count per country.
2. For each country, pick songs that genuinely represent that country's music scene (local language or famous local artists).
3. Match the energy level (${body.energy ?? 50}/100) and style (${body.style ?? 50}/100).
4. Return JSON only in this schema:
{"songs": [{"title": string, "artist": string, "language": string, "reason": string}]}`;
}

function demoSongs(body) {
  const musicCountries = Array.isArray(body.musicCountries) && body.musicCountries.length > 0
    ? body.musicCountries
    : [{ name: body.country || "United States", count: 8 }];

  const pool = [
    { title: "Midnight City", artist: "M83", language: "French", reason: "Dreamy cinematic travel atmosphere" },
    { title: "Daylight", artist: "Harry Styles", language: "English", reason: "Sunlit road trip vibe" },
    { title: "Levitating", artist: "Dua Lipa", language: "English", reason: "High-energy upbeat moments" },
    { title: "Bando Stone", artist: "Childish Gambino", language: "English", reason: "Warm tropical rhythm" },
    { title: "Water", artist: "Tyla", language: "English", reason: "Vibrant coastal energy" },
    { title: "Snooze", artist: "SZA", language: "English", reason: "Smooth sunset pacing" },
    { title: "Golden Hour", artist: "JVKE", language: "English", reason: "Epic landscape reveal soundtrack" },
    { title: "Espresso", artist: "Sabrina Carpenter", language: "English", reason: "Playful summer holiday groove" },
  ];

  const result = [];
  for (const c of musicCountries) {
    for (let i = 0; i < (c.count || 0); i++) {
      const item = pool[(result.length) % pool.length];
      result.push({
        ...item,
        reason: `${item.reason} (matched for ${c.name})`,
      });
    }
  }
  return result.slice(0, 8);
}
