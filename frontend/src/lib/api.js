/**
 * Sanitized API base URL. Strips query params, trailing slashes, and stray ? or &.
 * Prevents malformed URLs like "https://api.com/?/api/payment-intents".
 */
export function getApiBase() {
  const raw = (import.meta.env.VITE_API_BASE || "http://localhost:4000").trim();
  return raw
    .replace(/\?.*$/, "")      // strip any query string
    .replace(/[/?&]+$/, "");  // strip trailing /, ?, &
}
