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
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];

    if (!photos.length) {
      return json({ error: "Upload at least one photo." }, 400);
    }

    if (provider === "qwen") {
      if (!qwenApiKey(env)) return json({ mood: demoMood(body), demo: true });
      return json({ mood: await callQwenVision(env, body, photos), demo: false });
    }

    if (!env.GEMINI_API_KEY) return json({ mood: demoMood(body), demo: true });
    return json({ mood: await callGeminiVision(env, body, photos), demo: false });
  } catch (error) {
    return json({ error: error.message || "Vision request failed." }, 500);
  }
}

async function callGeminiVision(env, body, photos) {
  const model = env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";
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

async function callQwenVision(env, body, photos) {
  const model = env.QWEN_VISION_MODEL || env.QWEN_MODEL || "qwen3.5-flash";
  const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${qwenApiKey(env)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      enable_thinking: true,
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
  if (!response.ok) throw new Error(qwenErrorMessage(data, "Qwen vision call failed."));
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
    return "Qwen/DashScope accepted the key but denied access to the selected model. Enable access for the configured Qwen model in Alibaba Model Studio, or set QWEN_VISION_MODEL to a vision model your account can use.";
  }
  return message;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
