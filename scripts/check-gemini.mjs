import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".dev.vars");
loadEnvFile(".env.local");

const apiKey = process.env.GEMINI_API_KEY;
const textModel = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
const visionModel = process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .dev.vars, .env.local, or the shell environment.");
  process.exit(1);
}

// 1x1 transparent PNG base64
const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

console.log("=== Testing Gemini Integration ===");

// 1. Text-only test
console.log(`\n1. Testing text model: ${textModel}...`);
try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: 'Return JSON only with {"message": "hello", "status": "ok"}.' }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Text call error response:", JSON.stringify(data));
  } else {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: 'Return JSON only with {"energy": 60, "mood": "bright"}.' },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: sampleBase64,
                },
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: sampleBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Vision call error response:", JSON.stringify(data));
  } else {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
