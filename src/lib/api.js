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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve({
        name: file.name,
        type: file.type || "image/jpeg",
        base64,
        dataUrl: result,
      });
    };
    reader.readAsDataURL(file);
  });
}
