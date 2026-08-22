import { existsSync, readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function loadEnvVars() {
  const env = { ...process.env };
  for (const path of [".dev.vars", ".env.local", ".env"]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && !env[match[1]]) {
        env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

function cloudflareFunctionsPlugin() {
  function handleApi(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (!url.pathname.startsWith("/api/")) {
        return next();
      }

      const routeName = url.pathname.replace(/^\/api\//, "").split("/")[0].split("?")[0];
      if (!routeName || routeName.startsWith("_")) {
        return next();
      }

      try {
        let handlerModule;
        if (routeName === "vision") {
          handlerModule = await import("./functions/api/vision.js");
        } else if (routeName === "songs") {
          handlerModule = await import("./functions/api/songs.js");
        } else if (routeName === "youtube") {
          handlerModule = await import("./functions/api/youtube.js");
        } else if (routeName === "geocode") {
          handlerModule = await import("./functions/api/geocode.js");
        } else {
          return next();
        }

        const method = req.method?.toUpperCase();
        const handler =
          method === "OPTIONS"
            ? handlerModule.onRequestOptions
            : method === "POST"
            ? handlerModule.onRequestPost
            : handlerModule.onRequestGet || handlerModule.onRequest;

        if (!handler) {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        // Build Web Standard Request
        const headers = new Headers();
        for (const [key, val] of Object.entries(req.headers)) {
          if (val) {
            if (Array.isArray(val)) {
              val.forEach((v) => headers.append(key, v));
            } else {
              headers.set(key, val);
            }
          }
        }

        let body = null;
        if (method !== "GET" && method !== "HEAD") {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }

        const webRequest = new Request(url.href, {
          method,
          headers,
          body: body && body.length > 0 ? body : undefined,
        });

        const env = loadEnvVars();
        const webResponse = await handler({ request: webRequest, env });

        res.statusCode = webResponse.status;
        webResponse.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        const resBody = await webResponse.arrayBuffer();
        res.end(Buffer.from(resBody));
      } catch (err) {
        console.error(`[API dev] Error handling ${url.pathname}:`, err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err.message || "Internal server error" }));
      }
    });
  }

  return {
    name: "cloudflare-pages-functions-dev",
    configureServer(server) {
      handleApi(server);
    },
    configurePreviewServer(server) {
      handleApi(server);
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflareFunctionsPlugin()],
});
