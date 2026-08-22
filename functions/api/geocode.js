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

const NOMINATIM_USER_AGENT = "TravelTunes/0.1 (https://traveltunes.pages.dev)";

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

export async function onRequestPost({ request }) {
  if (!isSameOrigin(request)) {
    return json({ error: "Forbidden" }, 403);
  }
  try {
    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json({ error: "Valid latitude and longitude are required." }, 400);
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ error: "Latitude or longitude is out of range." }, 400);
    }

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "3",
      addressdetails: "1",
      "accept-language": "en",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
        Referer: "https://traveltunes.pages.dev/",
      },
    });

    if (!response.ok) {
      throw new Error("Could not detect country from photo GPS");
    }

    const data = await response.json();
    return json({ country: data?.address?.country || null });
  } catch (error) {
    return json({ error: error.message || "Geocode request failed." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}


