import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".dev.vars");
loadEnvFile(".env.local");

const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
const model = process.env.QWEN_TEXT_MODEL || process.env.QWEN_MODEL || "qwen3.5-flash";
const prompt = process.argv.slice(2).join(" ") || "Say hello in one short sentence.";

if (!apiKey) {
  console.error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY in .dev.vars, .env.local, or the shell environment.");
  process.exit(1);
}

const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  }),
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Qwen request failed: HTTP ${response.status}`);
  console.error(data.error?.message || data.message || JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2));

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
