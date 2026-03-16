export async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse JSON response", err);
    }
  }

  if (!response.ok) {
    const message =
      (data && data.error) || (data && data.message) || text || "Request failed";
    throw new Error(message);
  }

  return data;
}

