import { supabaseAdmin } from "./supabaseClient.js";

export function normalizeCustomerPhone(phone) {
  if (phone == null) return null;
  const d = String(phone).replace(/\D/g, "");
  return d.length ? d : null;
}

export async function upsertCustomerRecord({
  merchantUserId,
  phone,
  displayName,
  authUserId,
  email,
}) {
  if (!supabaseAdmin || !merchantUserId) return { customerId: null, customer: null };
  const phoneNorm = normalizeCustomerPhone(phone);
  if (!phoneNorm) return { customerId: null, customer: null };

  const row = {
    merchant_user_id: merchantUserId,
    phone_normalized: phoneNorm,
    display_name: displayName || null,
    auth_user_id: authUserId || null,
    email: email || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("customers")
    .upsert(row, { onConflict: "merchant_user_id,phone_normalized" })
    .select()
    .single();

  if (error) {
    console.error("[OrderHistory] upsert customer failed:", error.message);
    return { customerId: null, customer: null };
  }
  return { customerId: data.id, customer: data };
}

const TERMINAL_ORDER = new Set(["PAID", "CANCELLED"]);

export async function upsertMerchantOrderRecord({
  merchantUserId,
  customerId,
  orderId,
  invoiceId,
  paymentIntentId,
  amount,
  currency,
  items,
  description,
  status,
}) {
  if (!supabaseAdmin || !merchantUserId || !orderId) return null;

  const oid = String(orderId);
  const now = new Date().toISOString();
  const st = (status || "PENDING").toUpperCase();

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("merchant_orders")
    .select("*")
    .eq("merchant_user_id", merchantUserId)
    .eq("order_id", oid)
    .maybeSingle();

  if (selErr) {
    console.error("[OrderHistory] select order failed:", selErr.message);
    return null;
  }

  if (!existing) {
    const insertRow = {
      merchant_user_id: merchantUserId,
      customer_id: customerId,
      order_id: oid,
      invoice_id: invoiceId || null,
      payment_intent_id: paymentIntentId || null,
      amount: Number(amount) || 0,
      currency: currency || "ZAR",
      items: Array.isArray(items) ? items : [],
      description: description || null,
      status: st,
      paid_at: st === "PAID" ? now : null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await supabaseAdmin
      .from("merchant_orders")
      .insert(insertRow)
      .select()
      .single();
    if (error) console.error("[OrderHistory] insert order failed:", error.message);
    return data || null;
  }

  const patch = { updated_at: now };
  if (customerId != null) patch.customer_id = customerId;
  if (invoiceId != null) patch.invoice_id = invoiceId;
  if (paymentIntentId != null) patch.payment_intent_id = paymentIntentId;
  if (amount != null && !Number.isNaN(Number(amount))) patch.amount = Number(amount);
  if (currency) patch.currency = currency;
  if (Array.isArray(items)) patch.items = items;
  if (description != null) patch.description = description;

  const exSt = (existing.status || "").toUpperCase();
  if (!TERMINAL_ORDER.has(exSt)) {
    patch.status = st;
    if (st === "PAID") patch.paid_at = now;
  }

  const { data, error } = await supabaseAdmin
    .from("merchant_orders")
    .update(patch)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) console.error("[OrderHistory] update order failed:", error.message);
  return data || null;
}

export async function syncInvoiceToPersistedStores({ merchantUserId, invoice, paymentIntentId }) {
  if (!supabaseAdmin || !merchantUserId || !invoice) return;

  const { customerId } = await upsertCustomerRecord({
    merchantUserId,
    phone: invoice.customerPhone,
    displayName: invoice.customerName,
    authUserId: invoice.customerAuthUserId || null,
  });

  const orderId = invoice.orderId || invoice.id;
  const invStatus = (invoice.status || "UNPAID").toUpperCase();
  const orderStatus =
    invStatus === "PAID"
      ? "PAID"
      : invStatus === "CANCELLED"
        ? "CANCELLED"
        : invStatus === "OVERDUE"
          ? "UNPAID"
          : "UNPAID";

  await upsertMerchantOrderRecord({
    merchantUserId,
    customerId,
    orderId: String(orderId),
    invoiceId: invoice.id,
    paymentIntentId: paymentIntentId || invoice.paymentIntentId || null,
    amount: invoice.amount,
    currency: invoice.currency,
    items: invoice.items,
    description: invoice.description,
    status: orderStatus,
  });
}

export async function markMerchantOrdersPaidForIntent(intent) {
  if (!supabaseAdmin || !intent?.merchant_user_id) return;
  const merchantUserId = intent.merchant_user_id;
  const pid = intent.id;
  const oid = String(intent.orderId || pid);
  const now = new Date().toISOString();

  const { data: rows, error: qErr } = await supabaseAdmin
    .from("merchant_orders")
    .select("id,status")
    .eq("merchant_user_id", merchantUserId)
    .or(`payment_intent_id.eq.${pid},order_id.eq.${oid}`);

  if (qErr) {
    console.error("[OrderHistory] find orders for settle failed:", qErr.message);
    return;
  }

  if (rows?.length) {
    for (const r of rows) {
      const st = (r.status || "").toUpperCase();
      if (st === "CANCELLED") continue;
      await supabaseAdmin
        .from("merchant_orders")
        .update({
          status: "PAID",
          paid_at: now,
          updated_at: now,
          payment_intent_id: pid,
        })
        .eq("id", r.id);
    }
    return;
  }

  const { error: insErr } = await supabaseAdmin.from("merchant_orders").insert({
    merchant_user_id: merchantUserId,
    customer_id: null,
    order_id: oid,
    invoice_id: null,
    payment_intent_id: pid,
    amount: Number(intent.amount) || 0,
    currency: intent.currency || "ZAR",
    items: [],
    description: intent.description || null,
    status: "PAID",
    paid_at: now,
    created_at: now,
    updated_at: now,
  });
  if (insErr) console.error("[OrderHistory] insert settled order failed:", insErr.message);
}

export async function markMerchantOrdersPaidForInvoiceId(invoiceId) {
  if (!supabaseAdmin || !invoiceId) return;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("merchant_orders")
    .update({ status: "PAID", paid_at: now, updated_at: now })
    .eq("invoice_id", invoiceId);
}

export async function markMerchantOrdersCancelledForInvoiceId(invoiceId) {
  if (!supabaseAdmin || !invoiceId) return;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("merchant_orders")
    .update({ status: "CANCELLED", updated_at: now })
    .eq("invoice_id", invoiceId);
}

export async function listMerchantOrdersForMerchant(merchantUserId, limit = 500) {
  if (!supabaseAdmin || !merchantUserId) return [];
  const { data, error } = await supabaseAdmin
    .from("merchant_orders")
    .select("*, customers (*)")
    .eq("merchant_user_id", merchantUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[OrderHistory] list orders failed:", error.message);
    return [];
  }
  return data || [];
}

export async function listCustomersForMerchant(merchantUserId, limit = 500) {
  if (!supabaseAdmin || !merchantUserId) return [];
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("merchant_user_id", merchantUserId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[OrderHistory] list customers failed:", error.message);
    return [];
  }
  return data || [];
}
