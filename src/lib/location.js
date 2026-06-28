import * as exifr from "exifr";

export async function getGpsFromPhoto(file) {
  try {
    const gps = await exifr.gps(file);
    if (!gps?.latitude || !gps?.longitude) return null;
    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocodeCountry({ latitude, longitude }) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "3",
    addressdetails: "1",
    "accept-language": "en",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) {
    throw new Error("Could not detect country from photo GPS");
  }

  const data = await response.json();
  return data?.address?.country || null;
}
