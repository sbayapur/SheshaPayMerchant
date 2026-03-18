import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { randomUUID, randomBytes } from "crypto";
import { startPayment } from "./paymentsProvider.js";
import { warmUpToken, hasStitchConfig } from "./stitchClient.js";
import { supabaseAdmin } from "./supabaseClient.js";

const app = express();
const port = process.env.PORT || 4000;

// CORS: allow FRONTEND_BASE_URL (comma-separated for multiple). When unset, allow all.
// Support origin with or without trailing slash; echo exact origin back for strict browsers.
const normOrigin = (url) => (url || "").trim().toLowerCase().replace(/\/+$/, "");
const rawAllowed = (process.env.FRONTEND_BASE_URL || "").trim();
const allowedList = rawAllowed
  ? rawAllowed.split(",").map((s) => normOrigin(s)).filter(Boolean)
  : [];

const corsOptions = allowedList.length === 0
  ? { origin: true }
  : {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const norm = normOrigin(origin);
        if (allowedList.includes(norm)) return cb(null, origin);
        cb(null, false);
      },
    };
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Rate limiter for public payment link lookup (60 req/min per IP)
const payTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const bankLinks = new Map();
const payments = new Map();
const paymentIntents = new Map();
const employees = new Map();
// In-memory webhook event log (last 50 events)
// Cleared automatically on every server restart (in-memory storage)
// Only real events triggered by the app will be logged
const webhookEvents = [];
const MAX_EVENTS = 50;
// Per-payment-intent event log (paymentIntentId -> event[])
// Stores the full ISO 20022 lifecycle for each transaction (no cap)
const paymentIntentEvents = new Map();

// ─── Payment Link Tokens (Secure Deep Links) ─────────────────────────────────
const paymentLinks = new Map();       // token -> { orderId, amount, currency, note, items, isoRef, merchantName, createdAt, expiresAt, invoiceId? }
const PAYMENT_LINK_TTL_DAYS = Number(process.env.PAYMENT_LINK_TTL_DAYS) || 30;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "https://demo.shesha";
// Customer checkout app URL (where /pay/{token} links point) - separate from merchant dashboard
const CUSTOMER_BASE_URL = (process.env.CUSTOMER_BASE_URL || "").trim().replace(/\/+$/, "") || FRONTEND_BASE_URL;

function generatePaymentLinkToken() {
  return randomBytes(16).toString("base64url");
}

// ─── Invoice & Reminder System ───────────────────────────────────────────────
const invoices = new Map();           // invoiceId -> invoice object
const invoiceTimers = new Map();      // invoiceId -> setTimeout ID (for cancellation)
const reminderEvents = [];            // Log of all reminder events
const MAX_REMINDER_EVENTS = 100;
const INVOICE_DUE_DAYS = 3;           // Days until invoice is overdue
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours between follow-up reminders
const MAX_REMINDERS_DEFAULT = 3;

// WhatsApp Business connection state (in-memory, resets on server restart)
const whatsappConfig = {
  connected: false,
  accessToken: null,        // Long-lived token from Meta
  wabaId: null,             // WhatsApp Business Account ID
  phoneNumberId: null,      // Registered phone number ID
  connectedAt: null,        // When the account was connected
};

// Meta app credentials (from environment variables)
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_GRAPH_VERSION = "v21.0";

// Accounting data - maintains running totals
const accountingData = {
  totalRevenue: 0, // Total revenue including VAT
  totalRevenueExcludingVAT: 0, // Revenue excluding VAT
  totalVAT: 0, // Total VAT collected
  totalExpenses: 0, // Total expenses (estimated at 30% of revenue)
  totalCashIn: 0, // Total cash inflows
  totalCashOut: 0, // Total cash outflows
  openingBalance: 0, // Opening balance
  transactions: [], // List of all settled transactions for ledger
  lastUpdated: new Date().toISOString(),
};

// Function to update accounting when a payment is settled
function updateAccounting(paymentIntent) {
  if (!paymentIntent || paymentIntent.status !== "SETTLED") {
    return;
  }

  const amount = Number(paymentIntent.amount) || 0;
  if (amount <= 0) return;

  const vatRate = 0.15; // 15% VAT
  const revenueExcludingVAT = amount / (1 + vatRate);
  const vatAmount = amount - revenueExcludingVAT;
  const estimatedExpenses = revenueExcludingVAT * 0.3; // 30% of revenue as expenses

  // Update running totals
  accountingData.totalRevenue += amount;
  accountingData.totalRevenueExcludingVAT += revenueExcludingVAT;
  accountingData.totalVAT += vatAmount;
  accountingData.totalExpenses += estimatedExpenses;
  accountingData.totalCashIn += amount;
  accountingData.totalCashOut += estimatedExpenses + vatAmount;
  accountingData.lastUpdated = new Date().toISOString();

  // Add transaction to ledger
  accountingData.transactions.push({
    id: paymentIntent.id,
    orderId: paymentIntent.orderId || paymentIntent.id,
    date: paymentIntent.settlementTime || paymentIntent.completedAt || new Date().toISOString(),
    amount: amount,
    revenueExcludingVAT: revenueExcludingVAT,
    vatAmount: vatAmount,
    expenses: estimatedExpenses,
    description: paymentIntent.description || "Payment received",
    status: "SETTLED",
  });
}

// Function to calculate accounting data for a date range
function getAccountingDataForDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Filter transactions by date range
  const filteredTransactions = accountingData.transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= start && txDate <= end;
  });

  // Calculate totals for the date range
  const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalRevenueExcludingVAT = filteredTransactions.reduce((sum, t) => sum + t.revenueExcludingVAT, 0);
  const totalVAT = filteredTransactions.reduce((sum, t) => sum + t.vatAmount, 0);
  const totalExpenses = filteredTransactions.reduce((sum, t) => sum + t.expenses, 0);
  const grossProfit = totalRevenueExcludingVAT - totalExpenses;
  const netProfit = grossProfit;

  // Cash flow
  const cashIn = totalRevenue;
  const cashOut = totalExpenses + totalVAT;
  const netCashFlow = cashIn - cashOut;
  const closingBalance = accountingData.openingBalance + netCashFlow;

  // Balance sheet
  const assets = closingBalance;
  const liabilities = totalVAT;
  const equity = assets - liabilities;

  return {
    period: `${startDate} to ${endDate}`,
    incomeStatement: {
      revenue: totalRevenueExcludingVAT,
      vatAmount: totalVAT,
      totalRevenue: totalRevenue,
      expenses: totalExpenses,
      grossProfit: grossProfit,
      netProfit: netProfit,
    },
    cashFlow: {
      openingBalance: accountingData.openingBalance,
      cashIn: cashIn,
      cashOut: cashOut,
      netCashFlow: netCashFlow,
      closingBalance: closingBalance,
    },
    balanceSheet: {
      assets: assets,
      liabilities: liabilities,
      equity: equity,
    },
    payments: filteredTransactions.map(t => ({
      id: t.id,
      orderId: t.orderId,
      amount: t.amount,
      status: t.status,
      createdAt: t.date,
      settlementTime: t.date,
      description: t.description,
    })),
  };
}

// No sample orders - start with empty order history

// Function to log webhook events (in-memory + Supabase)
async function logWebhookEvent(event) {
  webhookEvents.push(event);
  if (webhookEvents.length > MAX_EVENTS) {
    webhookEvents.shift();
  }
  if (event.paymentIntentId) {
    if (!paymentIntentEvents.has(event.paymentIntentId)) {
      paymentIntentEvents.set(event.paymentIntentId, []);
    }
    paymentIntentEvents.get(event.paymentIntentId).push(event);
  }

  // Push to Supabase transactions table
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from("transactions").insert({
        event_id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        payment_intent_id: event.paymentIntentId,
        order_id: event.orderId,
        status: event.status,
        provider: event.provider,
        amount: event.amount,
        currency: event.currency || "ZAR",
        iso20022_meta: typeof event.iso20022_meta === "string" ? event.iso20022_meta : (event.iso20022_meta ? JSON.stringify(event.iso20022_meta) : null),
        settlement_ref: event.settlementRef,
        completed_at: event.completedAt,
      });
    } catch (err) {
      console.error("[Transactions] Failed to insert into Supabase:", err.message);
    }
  }
}

// ─── Invoice & Reminder Helper Functions ─────────────────────────────────────

// Log a reminder event
function logReminderEvent(event) {
  reminderEvents.push(event);
  if (reminderEvents.length > MAX_REMINDER_EVENTS) {
    reminderEvents.shift();
  }
}

// Send a reminder for an invoice (WhatsApp Cloud API or manual fallback)
async function sendReminder(invoice) {
  const now = new Date();
  const reminderEvent = {
    id: randomUUID(),
    invoiceId: invoice.id,
    paymentIntentId: invoice.paymentIntentId,
    orderId: invoice.orderId,
    customerPhone: invoice.customerPhone,
    amount: invoice.amount,
    currency: invoice.currency,
    timestamp: now.toISOString(),
    reminderNumber: invoice.remindersSent + 1,
    maxReminders: invoice.maxReminders,
  };

  if (whatsappConfig.connected && whatsappConfig.accessToken && whatsappConfig.phoneNumberId) {
    // ── Automated: WhatsApp Cloud API ──
    try {
      const phoneNumber = invoice.customerPhone.replace(/\D/g, "");
      const intlPhone = phoneNumber.startsWith("27") ? phoneNumber : `27${phoneNumber}`;

      const response = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${whatsappConfig.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappConfig.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: intlPhone,
            type: "template",
            template: {
              name: "payment_reminder",
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: invoice.customerName || "Customer" },
                    { type: "text", text: `${invoice.currency} ${invoice.amount.toFixed(2)}` },
                    { type: "text", text: invoice.merchantName || "Sunrise Salon" },
                    { type: "text", text: invoice.checkoutLink || "" },
                  ],
                },
              ],
            },
          }),
        }
      );

      const result = await response.json();
      reminderEvent.deliveryMethod = "whatsapp_api";
      reminderEvent.delivered = response.ok;
      reminderEvent.whatsappMessageId = result?.messages?.[0]?.id || null;
      if (!response.ok) {
        reminderEvent.error = result?.error?.message || "WhatsApp API error";
        console.error("[Reminder] WhatsApp API error:", result?.error);
      } else {
        console.log(`[Reminder] Sent via WhatsApp API to ${intlPhone} for invoice ${invoice.id}`);
      }
    } catch (err) {
      reminderEvent.deliveryMethod = "whatsapp_api";
      reminderEvent.delivered = false;
      reminderEvent.error = err.message;
      console.error("[Reminder] WhatsApp API call failed:", err.message);
    }
  } else {
    // ── Manual fallback: log for dashboard notification ──
    reminderEvent.deliveryMethod = "manual";
    reminderEvent.delivered = false;
    console.log(`[Reminder] Invoice ${invoice.id} is overdue. Manual reminder pending for ${invoice.customerPhone}`);
  }

  logReminderEvent(reminderEvent);

  // Update invoice reminder tracking
  invoice.remindersSent += 1;
  invoice.lastReminderAt = now.toISOString();
  invoice.nextReminderAt =
    invoice.remindersSent < invoice.maxReminders
      ? new Date(now.getTime() + REMINDER_INTERVAL_MS).toISOString()
      : null;
  invoices.set(invoice.id, invoice);

  return reminderEvent;
}

// Schedule the reminder timer for an invoice
function scheduleInvoiceReminder(invoice) {
  // Clear any existing timer for this invoice
  if (invoiceTimers.has(invoice.id)) {
    clearTimeout(invoiceTimers.get(invoice.id));
    invoiceTimers.delete(invoice.id);
  }

  // Don't schedule if already paid, cancelled, or max reminders reached
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") return;
  if (invoice.remindersSent >= invoice.maxReminders) return;

  // Calculate delay until the next reminder
  let targetTime;
  if (invoice.remindersSent === 0) {
    // First reminder: fire at dueDate (3 days after creation)
    targetTime = new Date(invoice.dueDate).getTime();
  } else {
    // Follow-up reminders: 24 hours after last reminder
    targetTime = new Date(invoice.nextReminderAt).getTime();
  }

  const delay = Math.max(0, targetTime - Date.now());

  const timerId = setTimeout(async () => {
    invoiceTimers.delete(invoice.id);
    const current = invoices.get(invoice.id);
    if (!current) return;

    // Only send if still unpaid/overdue
    if (current.status === "PAID" || current.status === "CANCELLED") return;

    // Mark as OVERDUE if still UNPAID
    if (current.status === "UNPAID") {
      current.status = "OVERDUE";
      invoices.set(current.id, current);
      console.log(`[Reminder] Invoice ${current.id} marked OVERDUE`);
    }

    // Send the reminder
    await sendReminder(current);

    // Schedule next follow-up if under max
    if (current.remindersSent < current.maxReminders) {
      scheduleInvoiceReminder(current);
    }
  }, delay);

  invoiceTimers.set(invoice.id, timerId);
  console.log(`[Reminder] Timer scheduled for invoice ${invoice.id} in ${Math.round(delay / 1000)}s`);
}

// Mark an invoice as PAID and clear its timer
function markInvoicePaid(invoiceId) {
  const invoice = invoices.get(invoiceId);
  if (!invoice) return null;
  if (invoice.status === "PAID") return invoice; // Idempotent

  invoice.status = "PAID";
  invoice.paidAt = new Date().toISOString();
  invoices.set(invoiceId, invoice);

  // Cancel any pending reminder timer
  if (invoiceTimers.has(invoiceId)) {
    clearTimeout(invoiceTimers.get(invoiceId));
    invoiceTimers.delete(invoiceId);
    console.log(`[Reminder] Timer cancelled for paid invoice ${invoiceId}`);
  }

  return invoice;
}

// Find invoice by paymentIntentId or orderId
function findInvoiceByPaymentIntent(intentId) {
  for (const invoice of invoices.values()) {
    if (invoice.paymentIntentId === intentId || invoice.orderId === intentId) {
      return invoice;
    }
  }
  return null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/bank-link", (req, res) => {
  const { enrollment } = req.body || {};
  if (!enrollment) {
    return res.status(400).json({ error: "enrollment is required" });
  }

  const bankLinkId = randomUUID();
  bankLinks.set(bankLinkId, {
    id: bankLinkId,
    enrollment,
    createdAt: new Date().toISOString(),
  });

  res.json({ bankLinkId });
});

app.post("/api/payment-intents", (req, res) => {
  const { amount, currency = "ZAR", description = "", orderId } = req.body || {};
  if (!amount) {
    return res.status(400).json({ error: "amount is required" });
  }

  const id = randomUUID();
  const orderIdToUse = orderId || id;
  const now = new Date();
  const executionDate = now.toISOString().slice(0, 10);

  // Generate ISO 20022 XML metadata
  const iso20022_meta = `<Document>
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${orderIdToUse}</MsgId>
      <CreDtTm>${now.toISOString()}</CreDtTm>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>SHESHA-${orderIdToUse}</PmtInfId>
      <ReqdExctnDt>${executionDate}</ReqdExctnDt>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  const intent = {
    id,
    orderId: orderIdToUse, // Store orderId for matching during settlement
    amount,
    currency,
    description,
    status: "PENDING",
    createdAt: now.toISOString(),
    iso20022_meta,
  };

  paymentIntents.set(id, intent);
  
  // Log payment intent creation (PENDING status) - Step 1 of ISO 20022 payment flow
  logWebhookEvent({
    id: randomUUID(),
    type: "payment_intent_created",
    timestamp: now.toISOString(),
    paymentIntentId: id,
    orderId: orderIdToUse,
    status: "PENDING",
    amount: amount,
    currency: currency,
    iso20022_meta: iso20022_meta,
  });
  
  res.status(201).json(intent);
});

app.get("/api/payment-intents", (_req, res) => {
  res.json(Array.from(paymentIntents.values()));
});

app.delete("/api/payment-intents", (_req, res) => {
  paymentIntents.clear();
  // Also reset accounting when clearing payment intents
  accountingData.totalRevenue = 0;
  accountingData.totalRevenueExcludingVAT = 0;
  accountingData.totalVAT = 0;
  accountingData.totalExpenses = 0;
  accountingData.totalCashIn = 0;
  accountingData.totalCashOut = 0;
  accountingData.transactions = [];
  accountingData.lastUpdated = new Date().toISOString();
  res.json({ message: "All payment intents cleared" });
});

app.post("/api/payment-intents/:id/start", async (req, res) => {
  const intent = paymentIntents.get(req.params.id);
  if (!intent) {
    return res.status(404).json({ error: "not found" });
  }

  try {
    const providerResponse = await startPayment(intent);
    const redirectUrl = providerResponse?.redirectUrl;

    if (!redirectUrl) {
      throw new Error("redirectUrl missing from provider response");
    }

    // Update to AUTHORISED when payment is started (bank auth completed)
    const updated = updatePaymentIntentStatus(intent.id, "AUTHORISED");
    if (!updated) {
      return res.status(500).json({ error: "Failed to update payment intent" });
    }
    
    // Add redirectUrl and startedAt to the updated intent
    const finalUpdated = {
      ...updated,
      redirectUrl,
      startedAt: new Date().toISOString(),
    };
    paymentIntents.set(intent.id, finalUpdated);
    
    res.json({ redirectUrl, status: finalUpdated.status });
  } catch (err) {
    console.error("Failed to start payment intent", err);
    res
      .status(500)
      .json({
        error: "could not start payment",
        details: err?.message,
        stitch: err?.response,
        status: err?.status,
      });
  }
});

// Internal function to update payment intent status
// skipWebhookLog: set to true when initializing sample data to avoid logging
function updatePaymentIntentStatus(intentId, newStatus, options = {}) {
  const intent = paymentIntents.get(intentId);
  if (!intent) {
    return null;
  }

  const { provider, skipWebhookLog = false } = options;
  const now = new Date();
  const updated = {
    ...intent,
    status: newStatus,
    ...(newStatus === "SETTLED" && { 
      completedAt: now.toISOString(),
      settlementTime: now.toISOString(),
      settlementRef: `STL-${intent.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    }),
    ...(newStatus === "AUTHORISED" && { authorisedAt: new Date().toISOString() }),
    ...(provider && { settlementProvider: provider }),
  };

  paymentIntents.set(intent.id, updated);
  
  // Update accounting when payment is settled
  if (newStatus === "SETTLED") {
    updateAccounting(updated);

    // Auto-mark linked invoice as PAID and cancel reminder timer
    const linkedInvoice = findInvoiceByPaymentIntent(intent.id) || findInvoiceByPaymentIntent(intent.orderId);
    if (linkedInvoice) {
      markInvoicePaid(linkedInvoice.id);
      console.log(`[Invoice] Auto-marked invoice ${linkedInvoice.id} as PAID (payment ${intent.id} settled)`);
    }
  }
  
  // Log webhook event for status changes (only for real checkout events, not sample data)
  if (!skipWebhookLog) {
    if (newStatus === "AUTHORISED") {
      // Step 2: Payment Authorised (ISO 20022)
      logWebhookEvent({
        id: randomUUID(),
        type: "authorisation_webhook",
        timestamp: new Date().toISOString(),
        paymentIntentId: intent.id,
        orderId: intent.id,
        status: "AUTHORISED",
        provider: provider || "unknown",
        amount: intent.amount,
        currency: intent.currency,
        iso20022_meta: intent.iso20022_meta,
      });
    } else if (newStatus === "SETTLED") {
      // Step 3: Payment Settled (ISO 20022)
      logWebhookEvent({
        id: randomUUID(),
        type: "settlement_webhook",
        timestamp: new Date().toISOString(),
        paymentIntentId: intent.id,
        orderId: intent.id,
        status: "SETTLED",
        provider: provider || "unknown",
        amount: intent.amount,
        currency: intent.currency,
        iso20022_meta: intent.iso20022_meta,
      });
      
      // Step 4: Payment Completed/Paid (ISO 20022 final status)
      // Log completion event immediately after settlement
      setTimeout(() => {
        logWebhookEvent({
          id: randomUUID(),
          type: "payment_completed",
          timestamp: new Date().toISOString(),
          paymentIntentId: intent.id,
          orderId: intent.id,
          status: "COMPLETED",
          provider: provider || "unknown",
          amount: intent.amount,
          currency: intent.currency,
          iso20022_meta: intent.iso20022_meta,
          settlementRef: updated.settlementRef,
          completedAt: updated.completedAt,
        });
      }, 100); // Small delay to ensure settlement event is logged first
    }
  }
  
  return updated;
}

// Internal function to complete a payment intent (for backward compatibility)
function completePaymentIntent(intentId, options = {}) {
  return updatePaymentIntentStatus(intentId, "SETTLED", options);
}

app.post("/api/payment-intents/:id/complete", (req, res) => {
  const intent = paymentIntents.get(req.params.id);
  if (!intent) {
    return res.status(404).json({ error: "not found" });
  }

  const updated = updatePaymentIntentStatus(req.params.id, "SETTLED");
  if (!updated) {
    return res.status(500).json({ error: "Failed to complete payment intent" });
  }
  res.json(updated);
});

// Authorise payment intent (after bank auth)
app.post("/api/payment-intents/:id/authorise", (req, res) => {
  const intent = paymentIntents.get(req.params.id);
  if (!intent) {
    return res.status(404).json({ error: "not found" });
  }

  const updated = updatePaymentIntentStatus(req.params.id, "AUTHORISED");
  if (!updated) {
    return res.status(500).json({ error: "Failed to authorise payment intent" });
  }

  res.json(updated);
});

// Shared settlement webhook handler - called by both demo and real webhooks
async function handleSettlementWebhook(webhookData) {
  const { orderId, amount, status = "COMPLETED", provider = "unknown" } = webhookData;
  
  if (!orderId) {
    throw new Error("orderId is required");
  }

  // Try to find payment intent by id (orderId might be the payment intent id)
  let intent = paymentIntents.get(orderId);
  
  // If not found by id, search through all intents to find a match
  // (e.g., if orderId is stored in orderId field, description or metadata)
  if (!intent) {
    for (const [id, paymentIntent] of paymentIntents.entries()) {
      // Check if orderId matches the intent id, orderId field, or if it's in the ISO metadata
      if (
        paymentIntent.id === orderId ||
        paymentIntent.orderId === orderId ||
        paymentIntent.iso20022_meta?.includes(orderId) ||
        paymentIntent.description?.includes(orderId)
      ) {
        intent = paymentIntent;
        break;
      }
    }
  }

  if (!intent) {
    throw new Error(`Payment intent not found for orderId: ${orderId}`);
  }

  // Idempotency check: if already SETTLED, return success without reprocessing
  if (intent.status === "SETTLED" || intent.status === "succeeded") {
    return {
      ok: true,
      orderId,
      paymentIntentId: intent.id,
      status: intent.status,
      completedAt: intent.completedAt,
      settlementProvider: intent.settlementProvider,
      idempotent: true, // Indicates this was already processed
    };
  }

  // Map status from bank format to payment intent status
  const intentStatus = status === "COMPLETED" || status === "succeeded" || status === "SETTLED"
    ? "SETTLED" 
    : status === "FAILED" || status === "failed"
    ? "FAILED"
    : "SETTLED"; // Default to SETTLED

  // Update payment intent to SETTLED/FAILED
  const updated = updatePaymentIntentStatus(intent.id, intentStatus, {
    provider,
  });

  if (!updated) {
    throw new Error("Failed to update payment intent status");
  }

  return {
    ok: true,
    orderId,
    paymentIntentId: updated.id,
    status: updated.status,
    completedAt: updated.completedAt,
    settlementProvider: updated.settlementProvider,
  };
}

// Real webhook endpoint - called by bank/rail providers
app.post("/api/webhooks/settlement", async (req, res) => {
  try {
    // In production, you would verify the webhook signature here
    // const signature = req.headers['x-webhook-signature'];
    // verifyWebhookSignature(req.body, signature);
    
    const result = await handleSettlementWebhook({
      orderId: req.body.orderId || req.body.merchantReference || req.body.paymentIntentId,
      amount: req.body.amount,
      status: req.body.status || req.body.paymentStatus,
      provider: req.body.provider || "bank-rail",
    });

    res.json(result);
  } catch (err) {
    console.error("Webhook settlement error:", err);
    res.status(400).json({ 
      error: err.message || "Failed to process settlement webhook" 
    });
  }
});

// Demo settlement endpoint - simulates bank/rail callback
app.post("/api/demo/settle", async (req, res) => {
  try {
    const { orderId, amount, status } = req.body;
    console.log(`[Settlement] Processing settlement for orderId: ${orderId}, amount: ${amount}, status: ${status || "COMPLETED"}`);
    console.log(`[Settlement] Available payment intents:`, Array.from(paymentIntents.keys()));
    
    const result = await handleSettlementWebhook({
      orderId: orderId,
      amount: amount,
      status: status || "COMPLETED",
      provider: "demo-stablecoin",
    });

    console.log(`[Settlement] Settlement successful:`, result);
    res.json(result);
  } catch (err) {
    console.error("Demo settlement error:", err);
    console.error(`[Settlement] Failed to settle orderId: ${req.body.orderId}`);
    res.status(400).json({ 
      error: err.message || "Failed to process demo settlement",
      hint: "Make sure the orderId matches a payment intent id"
    });
  }
});

// Demo authorize endpoint - mark AUTHORISED and schedule/allow settlement
app.post("/api/demo/authorize", async (req, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;
    const intentId = paymentIntentId || orderId;
    
    if (!intentId) {
      return res.status(400).json({ error: "orderId or paymentIntentId is required" });
    }

    const intent = paymentIntents.get(intentId);
    if (!intent) {
      return res.status(404).json({ error: "Payment intent not found" });
    }

    // Mark as AUTHORISED
    const updated = updatePaymentIntentStatus(intentId, "AUTHORISED", {
      provider: "demo-bank-auth",
    });

    if (!updated) {
      return res.status(500).json({ error: "Failed to authorise payment intent" });
    }

    res.json({
      ok: true,
      paymentIntentId: updated.id,
      orderId: intentId,
      status: updated.status,
      authorisedAt: updated.authorisedAt,
      message: "Payment authorised. Settlement can now be processed.",
    });
  } catch (err) {
    console.error("Demo authorize error:", err);
    res.status(400).json({ 
      error: err.message || "Failed to authorise payment intent"
    });
  }
});

// Demo rail settle endpoint - simulate PSP/rail posting a webhook (calls webhook endpoint)
app.post("/api/demo/rail/settle", async (req, res) => {
  try {
    const { orderId, amount, status = "COMPLETED", provider = "demo-rail" } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    // Simulate PSP/rail posting to webhook endpoint
    // This internally calls handleSettlementWebhook which marks SETTLED
    const result = await handleSettlementWebhook({
      orderId,
      amount,
      status,
      provider,
    });

    res.json({
      ok: true,
      message: "Rail settlement webhook simulated successfully",
      ...result,
    });
  } catch (err) {
    console.error("Demo rail settle error:", err);
    res.status(400).json({ 
      error: err.message || "Failed to process rail settlement"
    });
  }
});

// PayShap webhook receiver - marks SETTLED (idempotent)
app.post("/webhooks/payshap", async (req, res) => {
  try {
    // In production, you would verify the webhook signature here
    // const signature = req.headers['x-webhook-signature'];
    // verifyWebhookSignature(req.body, signature);
    
    const { 
      orderId, 
      merchantReference, 
      paymentIntentId,
      amount, 
      status = "COMPLETED", 
      provider = "payshap" 
    } = req.body;

    const orderIdToUse = orderId || merchantReference || paymentIntentId;
    
    if (!orderIdToUse) {
      return res.status(400).json({ error: "orderId, merchantReference, or paymentIntentId is required" });
    }

    // Use the shared settlement handler which is idempotent
    const result = await handleSettlementWebhook({
      orderId: orderIdToUse,
      amount,
      status,
      provider,
    });

    // Return 200 OK to acknowledge webhook receipt
    res.json(result);
  } catch (err) {
    console.error("PayShap webhook error:", err);
    // Still return 200 to prevent webhook retries for client errors
    // In production, you might want to return 500 for server errors
    res.status(200).json({ 
      error: err.message || "Failed to process PayShap webhook",
      acknowledged: true
    });
  }
});

function mockOzowPayment({ orderId, amount, currency, bankLinkId, rail }) {
  const ozowPaymentId = randomUUID();
  const redirectUrl = `https://pay.ozow.com/${ozowPaymentId}`;
  const qrString = `ozow:${ozowPaymentId}`;

  return {
    providerPaymentId: ozowPaymentId,
    status: "pending",
    redirectUrl,
    qrString,
    rail,
  };
}

app.post("/api/payments", (req, res) => {
  const {
    orderId,
    amount,
    currency = "USD",
    bankLinkId,
    rail = "ozow",
  } = req.body || {};

  if (!orderId || !amount || !bankLinkId) {
    return res
      .status(400)
      .json({ error: "orderId, amount, and bankLinkId are required" });
  }

  const paymentId = randomUUID();
  let providerData = null;

  if (rail === "ozow") {
    // Placeholder: replace with real Ozow signing + API call using your credentials
    providerData = mockOzowPayment({
      orderId,
      amount,
      currency,
      bankLinkId,
      rail,
    });
  } else {
    providerData = {
      providerPaymentId: `mock-${paymentId}`,
      status: "processing",
      rail,
    };
  }

  const payment = {
    id: paymentId,
    orderId,
    amount,
    currency,
    bankLinkId,
    rail,
    providerPaymentId: providerData.providerPaymentId,
    status: providerData.status === "pending" ? "processing" : "processing",
    redirectUrl: providerData.redirectUrl,
    qrString: providerData.qrString,
    createdAt: new Date().toISOString(),
  };

  payments.set(paymentId, payment);

  // Simulate async success for demo; in real Ozow flow, update via webhook or status poll.
  setTimeout(() => {
    const existing = payments.get(paymentId);
    if (existing) {
      payments.set(paymentId, {
        ...existing,
        status: "succeeded",
        settledAt: new Date().toISOString(),
      });
    }
  }, 2000);

  res.status(201).json(payment);
});

app.get("/api/payments/:id", (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: "not found" });
  }
  res.json(payment);
});

// Employee endpoints
app.get("/api/employees", (_req, res) => {
  res.json(Array.from(employees.values()));
});

app.post("/api/employees", (req, res) => {
  const {
    name,
    phoneNumber,
    bankAccountNumber,
    bankName,
    accountHolderName,
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  if (!phoneNumber && !bankAccountNumber) {
    return res
      .status(400)
      .json({ error: "phoneNumber or bankAccountNumber is required" });
  }

  const employeeId = randomUUID();
  const employee = {
    id: employeeId,
    name,
    phoneNumber: phoneNumber || null,
    bankAccountNumber: bankAccountNumber || null,
    bankName: bankName || null,
    accountHolderName: accountHolderName || null,
    createdAt: new Date().toISOString(),
  };

  employees.set(employeeId, employee);
  res.status(201).json(employee);
});

app.delete("/api/employees/:id", (req, res) => {
  const employee = employees.get(req.params.id);
  if (!employee) {
    return res.status(404).json({ error: "not found" });
  }
  employees.delete(req.params.id);
  res.json({ success: true });
});

// Accounting endpoints
app.get("/api/accounting", (req, res) => {
  const { startDate, endDate } = req.query;
  
  // If date range provided, return filtered data
  if (startDate && endDate) {
    const accountingDataForRange = getAccountingDataForDateRange(startDate, endDate);
    res.json(accountingDataForRange);
  } else {
    // Return overall accounting summary
    const netCashFlow = accountingData.totalCashIn - accountingData.totalCashOut;
    const closingBalance = accountingData.openingBalance + netCashFlow;
    const assets = closingBalance;
    const liabilities = accountingData.totalVAT;
    const equity = assets - liabilities;
    
    res.json({
      summary: {
        totalRevenue: accountingData.totalRevenue,
        totalRevenueExcludingVAT: accountingData.totalRevenueExcludingVAT,
        totalVAT: accountingData.totalVAT,
        totalExpenses: accountingData.totalExpenses,
        totalCashIn: accountingData.totalCashIn,
        totalCashOut: accountingData.totalCashOut,
        netCashFlow: netCashFlow,
        closingBalance: closingBalance,
        assets: assets,
        liabilities: liabilities,
        equity: equity,
      },
      lastUpdated: accountingData.lastUpdated,
      transactionCount: accountingData.transactions.length,
    });
  }
});

// Reset accounting data (for testing/demo purposes)
app.delete("/api/accounting", (req, res) => {
  accountingData.totalRevenue = 0;
  accountingData.totalRevenueExcludingVAT = 0;
  accountingData.totalVAT = 0;
  accountingData.totalExpenses = 0;
  accountingData.totalCashIn = 0;
  accountingData.totalCashOut = 0;
  accountingData.transactions = [];
  accountingData.lastUpdated = new Date().toISOString();
  res.json({ message: "Accounting data reset" });
});

// Transactions from Supabase (or fallback to in-memory when Supabase not configured)
app.get("/api/transactions", async (req, res) => {
  const paymentIntentId = req.query.payment_intent_id;
  const intent = paymentIntentId ? paymentIntents.get(paymentIntentId) : null;

  if (supabaseAdmin) {
    try {
      let query = supabaseAdmin.from("transactions").select("*").order("timestamp", { ascending: true });
      if (paymentIntentId) {
        query = query.eq("payment_intent_id", paymentIntentId);
      } else {
        query = query.limit(100).order("timestamp", { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;

      const mapRow = (row) => ({
        id: row.event_id || row.id,
        type: row.type,
        timestamp: row.timestamp,
        paymentIntentId: row.payment_intent_id,
        orderId: row.order_id,
        status: row.status,
        provider: row.provider,
        amount: row.amount,
        currency: row.currency,
        iso20022_meta: row.iso20022_meta,
        settlementRef: row.settlement_ref,
        completedAt: row.completed_at,
      });

      if (paymentIntentId && intent) {
        return res.json({
          paymentIntentId,
          currentStatus: intent.status,
          events: (data || []).map(mapRow),
        });
      }
      return res.json((data || []).map(mapRow));
    } catch (err) {
      console.error("[Transactions] Failed to fetch from Supabase:", err.message);
    }
  }

  // Fallback: in-memory
  if (paymentIntentId && intent) {
    const events = paymentIntentEvents.get(paymentIntentId) || [];
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return res.json({
      paymentIntentId,
      currentStatus: intent.status,
      events: sorted,
    });
  }
  res.json(webhookEvents);
});

// Get ISO 20022 lifecycle events for a specific payment intent (for per-payment log modal)
app.get("/api/demo/logs/payment-intent/:id/events", async (req, res) => {
  const intentId = req.params.id;
  const intent = paymentIntents.get(intentId);
  if (!intent) {
    return res.status(404).json({ error: "Payment intent not found" });
  }

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("payment_intent_id", intentId)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return res.json({
        paymentIntentId: intentId,
        currentStatus: intent.status,
        events: (data || []).map((row) => ({
          id: row.event_id || row.id,
          type: row.type,
          timestamp: row.timestamp,
          paymentIntentId: row.payment_intent_id,
          orderId: row.order_id,
          status: row.status,
          provider: row.provider,
          amount: row.amount,
          currency: row.currency,
          iso20022_meta: row.iso20022_meta,
          settlementRef: row.settlement_ref,
          completedAt: row.completed_at,
        })),
      });
    } catch (err) {
      console.error("[Transactions] Failed to fetch from Supabase:", err.message);
    }
  }

  const events = paymentIntentEvents.get(intentId) || [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  res.json({
    paymentIntentId: intentId,
    currentStatus: intent.status,
    events: sorted,
  });
});

// ─── Payment Link Tokens (Secure Deep Links) ─────────────────────────────────

// Create a new payment link (returns token + url)
app.post("/api/payment-links", (req, res) => {
  const {
    orderId,
    amount,
    currency = "ZAR",
    note = "",
    items = [],
    invoiceId = null,
    merchantName = "Sunrise Salon",
    baseUrl,
  } = req.body || {};

  if (!orderId || !amount || amount <= 0) {
    return res
      .status(400)
      .json({ error: "orderId and positive amount are required" });
  }

  const token = generatePaymentLinkToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAYMENT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  const isoRef = `SHESHA-${orderId}`;

  const linkData = {
    orderId,
    amount: Number(amount),
    currency,
    note: String(note),
    items: Array.isArray(items) ? items : [],
    isoRef,
    merchantName,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    invoiceId: invoiceId || null,
  };

  paymentLinks.set(token, linkData);
  const linkBase = CUSTOMER_BASE_URL || (baseUrl || "").replace(/\/+$/, "") || FRONTEND_BASE_URL;
  const url = `${linkBase}/pay/${token}`;

  console.log(`[PaymentLink] Created for ${orderId}, expires ${expiresAt.toISOString()}`);
  res.status(201).json({ token, url });
});

// Public lookup: get payment context by token (for customer checkout)
// Rate-limited, no auth required
app.get("/api/pay/:token", payTokenRateLimiter, (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(404).json({ error: "Not found" });
  }

  const linkData = paymentLinks.get(token);
  if (!linkData) {
    return res.status(404).json({ error: "Link not found or expired" });
  }

  const now = new Date();
  if (new Date(linkData.expiresAt) < now) {
    paymentLinks.delete(token); // Clean up expired
    return res.status(404).json({ error: "Link not found or expired" });
  }

  // Return only sanitized data needed for checkout display
  res.json({
    orderId: linkData.orderId,
    amount: linkData.amount,
    currency: linkData.currency,
    note: linkData.note,
    items: linkData.items,
    isoRef: linkData.isoRef,
    merchantName: linkData.merchantName,
  });
});

// ─── Invoice Endpoints ───────────────────────────────────────────────────────

// Create a new invoice
app.post("/api/invoices", (req, res) => {
  const {
    paymentIntentId,
    orderId,
    customerPhone,
    customerName = "",
    merchantName = "Sunrise Salon",
    amount,
    subtotal,
    taxAmount,
    currency = "ZAR",
    items = [],
    description = "",
    checkoutLink = "",
  } = req.body || {};

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "amount is required and must be positive" });
  }
  if (!customerPhone) {
    return res.status(400).json({ error: "customerPhone is required for reminders" });
  }

  const now = new Date();
  const dueDate = new Date(now.getTime() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);
  const invoiceId = `INV-${Date.now()}`;

  const vatRate = 0.15;
  const computedSubtotal = subtotal != null ? subtotal : amount / (1 + vatRate);
  const computedTax = taxAmount != null ? taxAmount : amount - computedSubtotal;

  // Ensure we have a secure token-based checkout link (create if not provided)
  let checkoutLinkToUse = checkoutLink;
  if (!checkoutLinkToUse) {
    const token = generatePaymentLinkToken();
    const orderIdToUse = orderId || invoiceId;
    const isoRef = `SHESHA-${orderIdToUse}`;
    const expiresAt = new Date(now.getTime() + PAYMENT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    paymentLinks.set(token, {
      orderId: orderIdToUse,
      amount: Number(amount),
      currency,
      note: String(description),
      items: Array.isArray(items) ? items : [],
      isoRef,
      merchantName,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      invoiceId,
    });
    checkoutLinkToUse = `${CUSTOMER_BASE_URL}/pay/${token}`;
    console.log(`[Invoice] Auto-created payment link for ${invoiceId}`);
  }

  const invoice = {
    id: invoiceId,
    paymentIntentId: paymentIntentId || null,
    orderId: orderId || null,
    merchantName,
    customerPhone,
    customerName,
    amount: Number(amount),
    subtotal: Number(computedSubtotal),
    taxAmount: Number(computedTax),
    currency,
    items,
    description,
    status: "UNPAID",
    createdAt: now.toISOString(),
    dueDate: dueDate.toISOString(),
    paidAt: null,
    cancelledAt: null,
    remindersSent: 0,
    lastReminderAt: null,
    nextReminderAt: dueDate.toISOString(),
    maxReminders: MAX_REMINDERS_DEFAULT,
    checkoutLink: checkoutLinkToUse,
  };

  invoices.set(invoiceId, invoice);

  // Schedule the first reminder timer (fires at dueDate)
  scheduleInvoiceReminder(invoice);

  console.log(`[Invoice] Created ${invoiceId} for ${customerPhone}, due ${dueDate.toISOString()}`);
  res.status(201).json(invoice);
});

// List all invoices (with optional ?status= filter)
app.get("/api/invoices", (req, res) => {
  const { status } = req.query;
  let result = Array.from(invoices.values());

  if (status) {
    result = result.filter((inv) => inv.status === status.toUpperCase());
  }

  // Sort by createdAt descending (newest first)
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(result);
});

// Get reminder events (must be before /api/invoices/:id to avoid route conflict)
app.get("/api/invoices/reminders", (_req, res) => {
  res.json(reminderEvents);
});

// Get a single invoice
app.get("/api/invoices/:id", (req, res) => {
  const invoice = invoices.get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  res.json(invoice);
});

// Manually trigger a reminder for an invoice
app.post("/api/invoices/:id/remind", async (req, res) => {
  const invoice = invoices.get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  if (invoice.status === "PAID") {
    return res.status(400).json({ error: "Invoice is already paid" });
  }
  if (invoice.status === "CANCELLED") {
    return res.status(400).json({ error: "Invoice is cancelled" });
  }

  const event = await sendReminder(invoice);
  res.json({
    ok: true,
    invoiceId: invoice.id,
    remindersSent: invoice.remindersSent,
    maxReminders: invoice.maxReminders,
    deliveryMethod: event.deliveryMethod,
    delivered: event.delivered,
  });
});

// Update an invoice (cancel, update phone, etc.)
app.patch("/api/invoices/:id", (req, res) => {
  const invoice = invoices.get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const { status, customerPhone, customerName } = req.body || {};

  if (status === "CANCELLED") {
    invoice.status = "CANCELLED";
    invoice.cancelledAt = new Date().toISOString();
    // Cancel any pending reminder timer
    if (invoiceTimers.has(invoice.id)) {
      clearTimeout(invoiceTimers.get(invoice.id));
      invoiceTimers.delete(invoice.id);
    }
  }

  if (customerPhone) invoice.customerPhone = customerPhone;
  if (customerName !== undefined) invoice.customerName = customerName;

  invoices.set(invoice.id, invoice);
  res.json(invoice);
});

// ─── WhatsApp Business Integration Endpoints ─────────────────────────────────

// Get WhatsApp connection status
app.get("/api/whatsapp/status", (_req, res) => {
  res.json({
    connected: whatsappConfig.connected,
    phoneNumberId: whatsappConfig.phoneNumberId || null,
    wabaId: whatsappConfig.wabaId || null,
    connectedAt: whatsappConfig.connectedAt || null,
    // Never expose the access token
  });
});

// Connect WhatsApp Business (exchange code from Embedded Signup)
app.post("/api/whatsapp/connect", async (req, res) => {
  const { code, wabaId, phoneNumberId } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: "code is required (from Meta Embedded Signup)" });
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    // If Meta credentials aren't configured, store the provided data in demo mode
    console.warn("[WhatsApp] META_APP_ID or META_APP_SECRET not set. Using demo mode.");
    whatsappConfig.connected = true;
    whatsappConfig.accessToken = `demo-token-${Date.now()}`;
    whatsappConfig.wabaId = wabaId || "demo-waba";
    whatsappConfig.phoneNumberId = phoneNumberId || "demo-phone";
    whatsappConfig.connectedAt = new Date().toISOString();

    return res.json({
      ok: true,
      connected: true,
      phoneNumberId: whatsappConfig.phoneNumberId,
      wabaId: whatsappConfig.wabaId,
      mode: "demo",
    });
  }

  try {
    // Exchange the code for a long-lived access token
    const tokenUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?` +
      `client_id=${encodeURIComponent(META_APP_ID)}` +
      `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
      `&code=${encodeURIComponent(code)}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[WhatsApp] Token exchange failed:", tokenData);
      return res.status(400).json({
        error: "Failed to exchange token with Meta",
        details: tokenData?.error?.message || "Unknown error",
      });
    }

    whatsappConfig.connected = true;
    whatsappConfig.accessToken = tokenData.access_token;
    whatsappConfig.wabaId = wabaId || null;
    whatsappConfig.phoneNumberId = phoneNumberId || null;
    whatsappConfig.connectedAt = new Date().toISOString();

    console.log(`[WhatsApp] Connected successfully. WABA: ${wabaId}, Phone: ${phoneNumberId}`);

    res.json({
      ok: true,
      connected: true,
      phoneNumberId: whatsappConfig.phoneNumberId,
      wabaId: whatsappConfig.wabaId,
      mode: "live",
    });
  } catch (err) {
    console.error("[WhatsApp] Connection error:", err);
    res.status(500).json({
      error: "Failed to connect WhatsApp Business",
      details: err.message,
    });
  }
});

// Disconnect WhatsApp Business
app.delete("/api/whatsapp/disconnect", (_req, res) => {
  whatsappConfig.connected = false;
  whatsappConfig.accessToken = null;
  whatsappConfig.wabaId = null;
  whatsappConfig.phoneNumberId = null;
  whatsappConfig.connectedAt = null;

  console.log("[WhatsApp] Disconnected.");
  res.json({ ok: true, connected: false });
});

// ─── Server Start ────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Mock payment API listening on http://localhost:${port}`);
  // Webhook events log is cleared on server restart (in-memory storage)
  console.log(`Webhook events log initialized (empty, will log up to ${MAX_EVENTS} events)`);
  console.log(`Invoice reminder system active (${INVOICE_DUE_DAYS}-day due period, ${MAX_REMINDERS_DEFAULT} max reminders)`);
  if (whatsappConfig.connected) {
    console.log(`WhatsApp Business connected (WABA: ${whatsappConfig.wabaId})`);
  } else {
    console.log(`WhatsApp Business not connected. Reminders will use manual wa.me fallback.`);
  }
  if (hasStitchConfig()) {
    warmUpToken().catch((err) =>
      console.error("Stitch warm-up failed", err.message || err)
    );
  } else {
    console.warn("Stitch env vars not set; Stitch integration is disabled.");
  }
});

