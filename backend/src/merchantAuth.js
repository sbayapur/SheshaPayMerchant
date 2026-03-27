import { supabaseAdmin } from "./supabaseClient.js";

/**
 * Resolve Supabase auth user id from Authorization: Bearer <access_token>
 */
export async function getMerchantUserIdFromRequest(req) {
  const auth = req.headers?.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
