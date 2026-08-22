import * as exifr from "exifr";
import { postJson } from "./api";

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
  try {
    const data = await postJson("/api/geocode", { latitude, longitude });
    return data?.country || null;
  } catch {
    return null;
  }
}

