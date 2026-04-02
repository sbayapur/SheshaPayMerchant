import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import rateLimit from "express-rate-limit";

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Run in Supabase SQL editor:
 * CREATE TABLE IF NOT EXISTS merchant_admin_pins (
 *   merchant_user_id UUID PRIMARY KEY,
 *   pin_hash TEXT NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 */
const TABLE = "merchant_admin_pins";

function isValidPin(pin) {
  return typeof pin === "string" && /^\d{4,12}$/.test(pin);
}

export async function hashPin(pin) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(pin, salt, KEY_BYTES);
  return `${salt.toString("hex")}:${Buffer.from(key).toString("hex")}`;
}

export async function verifyPinAgainstHash(pin, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) {
    return false;
  }
  const idx = stored.indexOf(":");
  const saltHex = stored.slice(0, idx);
  const keyHex = stored.slice(idx + 1);
  if (!saltHex || !keyHex) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  const derived = await scryptAsync(pin, salt, KEY_BYTES);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(expected, derived);
}

export function registerMerchantAdminPinRoutes(app, { getMerchantUserIdFromRequest, supabaseAdmin }) {
  const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many PIN attempts, try again later" },
  });

  app.get("/api/merchant/admin-pin/status", async (req, res) => {
    const merchantId = await getMerchantUserIdFromRequest(req);
    if (!merchantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) {
      return res.json({ configured: false, storageAvailable: false });
    }
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("merchant_user_id")
      .eq("merchant_user_id", merchantId)
      .maybeSingle();
    if (error) {
      console.error("[admin-pin] status", error.message);
      return res.status(500).json({ error: "Failed to read admin PIN status" });
    }
    res.json({ configured: Boolean(data), storageAvailable: true });
  });

  app.post("/api/merchant/admin-pin/verify", verifyLimiter, async (req, res) => {
    const merchantId = await getMerchantUserIdFromRequest(req);
    if (!merchantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Admin PIN storage is not configured" });
    }
    const { pin } = req.body || {};
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: "PIN must be 4–12 digits" });
    }
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("pin_hash")
      .eq("merchant_user_id", merchantId)
      .maybeSingle();
    if (error) {
      console.error("[admin-pin] verify read", error.message);
      return res.status(500).json({ error: "Failed to verify PIN" });
    }
    if (!data?.pin_hash) {
      return res.status(400).json({ error: "No admin PIN set yet", code: "NEEDS_SETUP" });
    }
    const ok = await verifyPinAgainstHash(pin, data.pin_hash);
    if (!ok) {
      return res.status(401).json({ error: "Incorrect PIN" });
    }
    res.json({ ok: true });
  });

  app.put("/api/merchant/admin-pin", async (req, res) => {
    const merchantId = await getMerchantUserIdFromRequest(req);
    if (!merchantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Admin PIN storage is not configured" });
    }
    const { pin, currentPin } = req.body || {};
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: "New PIN must be 4–12 digits" });
    }

    const { data: existing, error: readErr } = await supabaseAdmin
      .from(TABLE)
      .select("pin_hash")
      .eq("merchant_user_id", merchantId)
      .maybeSingle();
    if (readErr) {
      console.error("[admin-pin] put read", readErr.message);
      return res.status(500).json({ error: "Failed to update admin PIN" });
    }

    if (existing?.pin_hash) {
      if (!isValidPin(currentPin)) {
        return res.status(400).json({ error: "Current PIN is required to change your PIN" });
      }
      const curOk = await verifyPinAgainstHash(currentPin, existing.pin_hash);
      if (!curOk) {
        return res.status(401).json({ error: "Current PIN is incorrect" });
      }
    }

    const pin_hash = await hashPin(pin);
    const now = new Date().toISOString();
    const { error: upsertErr } = await supabaseAdmin.from(TABLE).upsert(
      {
        merchant_user_id: merchantId,
        pin_hash,
        updated_at: now,
      },
      { onConflict: "merchant_user_id" }
    );
    if (upsertErr) {
      console.error("[admin-pin] put upsert", upsertErr.message);
      return res.status(500).json({ error: "Failed to save admin PIN" });
    }
    res.json({ ok: true });
  });
}
