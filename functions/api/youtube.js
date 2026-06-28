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
    const query = String(body.query || "").trim();
    if (!query) return json({ videoId: null });
    if (!env.YOUTUBE_API_KEY) {
      return json({
        videoId: null,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        demo: true,
      });
    }

    const params = new URLSearchParams({
      part: "snippet",
      maxResults: "1",
      q: query,
      type: "video",
      videoEmbeddable: "true",
      key: env.YOUTUBE_API_KEY,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");

    const item = data.items?.[0];
    return json({
      videoId: item?.id?.videoId || null,
      youtubeTitle: item?.snippet?.title || null,
      channelTitle: item?.snippet?.channelTitle || null,
      youtubeUrl: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null,
    });
  } catch (error) {
    return json({ error: error.message || "YouTube request failed." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
