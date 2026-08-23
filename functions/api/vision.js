import {
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
  const runId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let provider = "gemini";
  let resolvedModel = "gemini-3.1-flash-lite";

  try {
    const body = await request.json();
    provider = body.model === "deepseek" ? "deepseek" : body.model === "qwen" ? "qwen" : "gemini";
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];

    if (!photos.length) {
      return json({ error: "Upload at least one photo." }, 400);
    }

    if (provider === "deepseek") {
      resolvedModel = env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp";
      if (!env.DEEPSEEK_API_KEY) {
        const mood = demoMood(body);
        await logRun(env, {
          id: runId,
          created_at: createdAt,
          provider,
          vision_model: resolvedModel,
          vision_ms: 0,
          mood_json: mood,
        });
        return json({ mood, resolvedModel, runId, demo: true });
      }

      const start = Date.now();
      const mood = await callDeepSeekVision(env, body, photos, resolvedModel);
      const visionMs = Date.now() - start;

      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        vision_model: resolvedModel,
        vision_ms: visionMs,
        mood_json: mood,
      });

      return json({ mood, resolvedModel, runId, demo: false });
    }

    if (provider === "qwen") {
      resolvedModel = env.QWEN_VISION_MODEL || env.QWEN_MODEL || "qwen3.5-flash";
      if (!qwenApiKey(env)) {
        const mood = demoMood(body);
        await logRun(env, {
          id: runId,
          created_at: createdAt,
          provider,
          vision_model: resolvedModel,
          vision_ms: 0,
          mood_json: mood,
        });
        return json({ mood, resolvedModel, runId, demo: true });
      }

      const start = Date.now();
      const mood = await callQwenVision(env, body, photos, resolvedModel);
      const visionMs = Date.now() - start;

      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        vision_model: resolvedModel,
        vision_ms: visionMs,
        mood_json: mood,
      });

      return json({ mood, resolvedModel, runId, demo: false });
    }

    resolvedModel = env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";
    if (!env.GEMINI_API_KEY) {
      const mood = demoMood(body);
      await logRun(env, {
        id: runId,
        created_at: createdAt,
        provider,
        vision_model: resolvedModel,
        vision_ms: 0,
        mood_json: mood,
      });
      return json({ mood, resolvedModel, runId, demo: true });
    }

    const start = Date.now();
    const mood = await callGeminiVision(env, body, photos, resolvedModel);
    const visionMs = Date.now() - start;

    await logRun(env, {
      id: runId,
      created_at: createdAt,
      provider,
      vision_model: resolvedModel,
      vision_ms: visionMs,
      mood_json: mood,
    });

    return json({ mood, resolvedModel, runId, demo: false });
  } catch (error) {
    await logRun(env, {
      id: runId,
      created_at: createdAt,
      provider,
      vision_model: resolvedModel,
      error: error.message || "Vision request failed.",
    });
    return json({ error: error.message || "Vision request failed." }, 500);
  }
}

async function callGeminiVision(env, body, photos, model) {
  const prompt = visionPrompt(body);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...photos.map((photo) => ({
                inlineData: {
                  mimeType: photo.type || "image/jpeg",
                  data: photo.base64,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini vision call failed.");
  return parseJsonText(data.candidates?.[0]?.content?.parts?.[0]?.text) || demoMood(body);
}

async function callQwenVision(env, body, photos, model) {
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
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt(body) },
            ...photos.map((photo) => ({
              type: "image_url",
              image_url: {
                url: `data:${photo.type || "image/jpeg"};base64,${photo.base64}`,
              },
            })),
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(qwenErrorMessage(data, "Qwen vision call failed.", model));
  return parseJsonText(data.choices?.[0]?.message?.content) || demoMood(body);
}

async function callDeepSeekVision(env, body, photos, model) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt(body) },
            ...photos.map((photo) => ({
              type: "image_url",
              image_url: {
                url: `data:${photo.type || "image/jpeg"};base64,${photo.base64}`,
              },
            })),
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(deepSeekErrorMessage(data, "DeepSeek vision call failed.", model));
  return parseJsonText(data.choices?.[0]?.message?.content) || demoMood(body);
}

function visionPrompt(body) {
  const imageNotes = String(body.imageNotes || "").trim().slice(0, 240);
  return `Return JSON only for a travel photo mood read. Country: ${body.country || "unknown"}.
User image notes: ${imageNotes || "none"}.
Use this schema: {"energy": number 0-100, "setting": string, "mood": string, "palette": string[], "notes": string}.
Keep it concise and infer travel ambience, not identity or sensitive attributes.`;
}

function demoMood(body) {
  return {
    energy: Math.max(20, Math.min(88, Number(body.energy || 62))),
    setting: `${body.country || "Travel"} scenery`,
    mood: "warm, open-air, scenic",
    palette: ["teal", "sunlit coral", "soft sky"],
    notes: "Demo mood used until the selected provider key is configured.",
  };
}
