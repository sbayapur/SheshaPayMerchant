import { supabase } from "./supabase.js";

/**
 * Merge optional headers with Authorization from the current Supabase session (if any).
 */
export async function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (!supabase) return headers;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
}
