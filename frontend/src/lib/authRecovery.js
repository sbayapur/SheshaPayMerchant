/**
 * Detect Supabase sessions created from a password-recovery link.
 * Recovery tokens include `amr` (authentication methods) with method "recovery".
 * Without this, SIGNED_IN after recovery would bypass the "set new password" step.
 */
export function sessionRequiresNewPassword(session) {
  if (!session?.access_token) return false;
  try {
    const part = session.access_token.split(".")[1];
    if (!part) return false;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    const amr = payload.amr;
    if (!Array.isArray(amr)) return false;
    return amr.some(
      (entry) =>
        entry === "recovery" ||
        (typeof entry === "object" && entry && entry.method === "recovery")
    );
  } catch {
    return false;
  }
}
