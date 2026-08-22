const MAX_MEMORY_CACHE = 300;
const memoryCache = new Map();

function setMemoryCache(key, value) {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, value);
}

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
    const rawTitle = String(body.title || "").trim().toLowerCase();
    const rawArtist = String(body.artist || "").trim().toLowerCase();
    const query = String(body.query || (rawTitle && rawArtist ? `${rawTitle} ${rawArtist}` : "")).trim();
    if (!query && (!rawTitle || !rawArtist)) return json({ videoId: null });

    const cacheKey = rawTitle && rawArtist ? `yt:${rawTitle}|${rawArtist}` : `yt:${query.toLowerCase()}`;

    if (memoryCache.has(cacheKey)) {
      return json(memoryCache.get(cacheKey));
    }

    const kv = env.YT_CACHE || env.TRAVELTUNES_KV || env.KV;
    if (kv) {
      try {
        const cached = await kv.get(cacheKey, "json");
        if (cached) {
          setMemoryCache(cacheKey, cached);
          return json(cached);
        }
      } catch {
        // KV read failure is non-fatal
      }
    }


    if (!env.YOUTUBE_API_KEY) {
      const demoResult = {
        videoId: null,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query || `${rawTitle} ${rawArtist}`)}`,
        demo: true,
      };
      return json(demoResult);
    }

    const params = new URLSearchParams({
      part: "snippet",
      maxResults: "1",
      q: query || `${rawTitle} ${rawArtist}`,
      type: "video",
      videoEmbeddable: "true",
      key: env.YOUTUBE_API_KEY,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");

    const item = data.items?.[0];
    const result = {
      videoId: item?.id?.videoId || null,
      youtubeTitle: item?.snippet?.title || null,
      channelTitle: item?.snippet?.channelTitle || null,
      youtubeUrl: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null,
    };

    setMemoryCache(cacheKey, result);


    if (kv && result.videoId) {
      try {
        // 30 days TTL = 2592000 seconds
        await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 2592000 });
      } catch {
        // KV write failure is non-fatal
      }
    }

    return json(result);
  } catch (error) {
    return json({ error: error.message || "YouTube request failed." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}


