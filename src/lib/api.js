const VISION_MAX_EDGE = 1024;
const VISION_JPEG_QUALITY = 0.82;


export async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

export function readFileAsPayload(file) {
  return blobToBase64(file).then((base64) => ({
    name: file.name || "photo.jpg",
    type: file.type || "image/jpeg",
    base64,
  }));
}

export async function readFileAsVisionPayload(file) {
  try {
    const resizedBlob = await resizeImageToBlob(file);
    const base64 = await blobToBase64(resizedBlob);
    return {
      name: visionFileName(file.name),
      type: "image/jpeg",
      base64,
    };
  } catch {
    return readFileAsPayload(file);
  }
}

async function resizeImageToBlob(file) {
  const bitmap = await createImageBitmap(file);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longestEdge > VISION_MAX_EDGE ? VISION_MAX_EDGE / longestEdge : 1;

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    throw new Error("Could not resize photo");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress photo"))),
      "image/jpeg",
      VISION_JPEG_QUALITY,
    );
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

function visionFileName(name) {
  const base = String(name || "photo").replace(/\.[^.]+$/, "");
  return `${base || "photo"}.jpg`;
}

