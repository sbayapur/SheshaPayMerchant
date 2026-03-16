const TOKEN_URL = "https://express.stitch.money/api/v1/token";
const PAYMENT_LINK_URL = "https://express.stitch.money/api/v1/payment-links";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getConfig() {
  const clientId = process.env.STITCH_CLIENT_ID;
  const clientSecret = process.env.STITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STITCH_CLIENT_ID and STITCH_CLIENT_SECRET are required");
  }
  return { clientId, clientSecret };
}

export function hasStitchConfig() {
  return Boolean(process.env.STITCH_CLIENT_ID && process.env.STITCH_CLIENT_SECRET);
}

async function fetchToken() {
  const { clientId, clientSecret } = getConfig();
  const body = JSON.stringify({
    clientId,
    clientSecret,
    scope: "client_paymentrequest",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json?.data?.accessToken) {
    throw new Error(
      `Failed to fetch Stitch token: ${res.status} ${
        json?.error || JSON.stringify(json)
      }`
    );
  }

  const accessToken = json.data.accessToken;
  const ttlMs = 14 * 60 * 1000; // refresh a minute before the 15m expiry
  cachedToken = accessToken;
  cachedTokenExpiresAt = Date.now() + ttlMs;
  return accessToken;
}

async function getToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }
  return fetchToken();
}

export async function createPaymentLink({
  amount,
  merchantReference,
  payerName,
  payerEmailAddress,
  payerPhoneNumber,
  description,
}) {
  const token = await getToken();
  const payload = {
    amount,
    merchantReference,
    payerName,
    payerEmailAddress,
    payerPhoneNumber,
    description,
  };

  const res = await fetch(PAYMENT_LINK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = {};
  }

  if (!res.ok || !json?.success || !json?.data?.payment?.link) {
    const rawMessage =
      json?.generalErrors?.[0] || json?.error || json?.fieldErrors || null;
    const message =
      typeof rawMessage === "string"
        ? rawMessage
        : rawMessage
        ? JSON.stringify(rawMessage)
        : `HTTP ${res.status}`;
    const err = new Error(
      `Failed to create Stitch payment link: ${message} ${text || ""}`.trim()
    );
    err.response = json;
    err.status = res.status;
    throw err;
  }

  const payment = json.data.payment;
  return {
    redirectUrl: payment.link,
    paymentId: payment.id,
    status: payment.status,
  };
}

export async function warmUpToken() {
  try {
    await getToken();
    return true;
  } catch (err) {
    console.error("Stitch warm-up failed", err.message);
    return false;
  }
}

export function clearTokenCache() {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}

