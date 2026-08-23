import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".dev.vars");
loadEnvFile(".env.local");

const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
const textModel = process.env.QWEN_TEXT_MODEL || process.env.QWEN_MODEL || "qwen3.5-flash";
const visionModel = process.env.QWEN_VISION_MODEL || process.env.QWEN_MODEL || "qwen3.5-flash";

if (!apiKey) {
  console.error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY in .dev.vars, .env.local, or the shell environment.");
  process.exit(1);
}

// 1x1 transparent PNG base64
const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

console.log("=== Testing Qwen / DashScope Integration ===");

// 1. Text-only test
console.log(`\n1. Testing text model: ${textModel}...`);
try {
  const res = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: textModel,
      enable_thinking: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: 'Return JSON only with {"message": "hello", "status": "ok"}.',
        },
      ],
    }),
  });

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Text call error response:", JSON.stringify(data));
  } else {
    const content = data.choices?.[0]?.message?.content;
    console.log("Response content:", content);
    try {
      const parsed = JSON.parse(content);
      console.log("Valid JSON received:", parsed);
    } catch {
      console.error("Failed to parse response as JSON");
    }
  }
} catch (err) {
  console.error("Text call error:", err.message);
}

// 2. Multi-image vision test
console.log(`\n2. Testing vision model: ${visionModel}...`);
try {
  const res = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: visionModel,
      enable_thinking: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Return JSON only with {"energy": 60, "mood": "bright"}.',
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${sampleBase64}`,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${sampleBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Vision call error response:", JSON.stringify(data));
  } else {
    const content = data.choices?.[0]?.message?.content;
    console.log("Response content:", content);
    try {
      const parsed = JSON.parse(content);
      console.log("Valid JSON received:", parsed);
    } catch {
      console.error("Failed to parse response as JSON");
    }
  }
} catch (err) {
  console.error("Vision call error:", err.message);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}
