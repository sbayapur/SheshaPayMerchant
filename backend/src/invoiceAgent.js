import Anthropic from "@anthropic-ai/sdk";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Router } from "express";
import { supabaseAdmin } from "./supabaseClient.js";
import { buildInvoiceEmail } from "./invoiceEmail.js";

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sesClient() {
  const region = process.env.APP_AWS_REGION ?? "us-east-2";
  const keyId = process.env.APP_AWS_ACCESS_KEY_ID;
  const secret = process.env.APP_AWS_SECRET_ACCESS_KEY;
  return new SESClient({
    region,
    ...(keyId && { credentials: { accessKeyId: keyId, secretAccessKey: secret } }),
  });
}

const SYSTEM_PROMPT = () =>
  `You are an invoice-parsing assistant for Craig, owner of Durban Plumbing, South Africa.
Today's date is ${new Date().toISOString().split("T")[0]}.
Currency is ZAR (South African Rand, symbol R).
Merchant name: Craig
Business name: Durban Plumbing

Your job is to extract invoice details from Craig's natural-language job descriptions.

CRITICAL: Respond ONLY with a single JSON object. No prose, no markdown, no code fences.

If you are missing the customer's name, customer's email, or any required line-item detail (description, quantity, price), respond with:
{"state":"needs_info","clarifying_question":"<one specific question to get the missing detail>"}

If you have all required information, respond with:
{"state":"complete","invoice":{"customer_name":"string","customer_email":"string","line_items":[{"description":"string","quantity":number,"unit_price":number,"total":number}],"subtotal":number,"total":number,"due_date":"YYYY-MM-DD","confidence_notes":["string"]}}

Rules:
- subtotal equals sum of all line_item totals. total equals subtotal (no VAT for this demo).
- due_date: calculate from phrases like "due in 14 days". If not mentioned, default to 30 days from today.
- confidence_notes: list any assumptions you made. Empty array if none.
- All amounts are in ZAR as plain numbers (not strings).
- Do not invent prices. If a price is ambiguous, ask.`;

// POST /api/agent/parse-invoice
router.post("/parse-invoice", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const claudeMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT(),
      messages: claudeMessages,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.json({
        state: "needs_info",
        clarifying_question: "Sorry, I didn't understand that. Could you describe the job again?",
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error("[parse-invoice]", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// POST /api/agent/send-invoice
router.post("/send-invoice", async (req, res) => {
  const { customer_name, customer_email, line_items, subtotal, total, due_date } = req.body || {};

  if (!customer_name || !customer_email || !line_items?.length || !due_date) {
    return res.status(400).json({ error: "Missing required invoice fields" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { data: invoice, error: dbError } = await supabaseAdmin
    .from("invoices")
    .insert({ merchant_id: "craig-demo", customer_name, customer_email, line_items, subtotal, total, due_date, status: "sent" })
    .select("id")
    .single();

  if (dbError || !invoice) {
    console.error("[send-invoice] Supabase error:", dbError);
    return res.status(500).json({ error: "Failed to save invoice" });
  }

  const frontendUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
  const invoiceUrl = `${frontendUrl}/invoice/${invoice.id}`;
  const html = buildInvoiceEmail(req.body, invoiceUrl);

  try {
    await sesClient().send(
      new SendEmailCommand({
        Source: "Craig @ Durban Plumbing <invoices@sheshapay.co>",
        Destination: { ToAddresses: [customer_email] },
        Message: {
          Subject: { Data: `Invoice from Durban Plumbing — R${total.toFixed(2)} due ${due_date}`, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      })
    );
  } catch (emailError) {
    console.error("[send-invoice] SES error:", emailError);
    return res.json({ id: invoice.id, invoiceUrl, emailWarning: "Email delivery failed" });
  }

  res.json({ id: invoice.id, invoiceUrl });
});

// GET /api/agent/invoices/:id  — public, for the invoice view page
router.get("/invoices/:id", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Database not configured" });
  }
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  res.json(data);
});

export { router as invoiceAgentRouter };
