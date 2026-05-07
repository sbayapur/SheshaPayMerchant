import { randomUUID } from "crypto";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_SESSION_MESSAGES = 20;
const AGENT_MODEL = "claude-haiku-4-5-20251001";

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Mock mode ───────────────────────────────────────────────────────────────
// Keyword-based fallback when ANTHROPIC_API_KEY is not set.

function mockReply(text, { invoices, getStatsForPeriod }) {
  const lower = text.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hi! I'm your SheshaPay assistant. I can help you create invoices, check payments, and send reminders. What do you need?";
  }

  if (lower.includes("how much") || lower.includes("stats") || lower.includes("revenue") || lower.includes("made")) {
    return "[Demo mode] Your stats are available in the dashboard. Connect an Anthropic API key to enable live summaries here.";
  }

  if (lower.includes("invoice") && (lower.includes("create") || lower.includes("new") || lower.includes("make"))) {
    return "[Demo mode] To create an invoice via WhatsApp, add an ANTHROPIC_API_KEY. For now, use the dashboard.";
  }

  if (lower.includes("remind") || lower.includes("follow") || lower.includes("chase")) {
    const unpaid = Array.from(invoices.values()).filter(
      (inv) => inv.status === "UNPAID" || inv.status === "OVERDUE"
    );
    if (unpaid.length === 0) return "You have no unpaid invoices right now. 🎉";
    return `You have ${unpaid.length} unpaid invoice(s). Reply "send reminders" to chase them all, or use the dashboard.`;
  }

  if (lower.includes("send reminders") || lower.includes("remind all")) {
    return "[Demo mode] Bulk reminders need an API key. You can send individual reminders from the dashboard.";
  }

  if (lower.includes("list") || lower.includes("unpaid") || lower.includes("overdue")) {
    const unpaid = Array.from(invoices.values())
      .filter((inv) => inv.status === "UNPAID" || inv.status === "OVERDUE")
      .slice(0, 5);
    if (unpaid.length === 0) return "No unpaid invoices. 🎉";
    const lines = unpaid.map(
      (inv) => `• ${inv.customerName || inv.customerPhone} — ${formatZAR(inv.amount)} (${inv.status})`
    );
    return `Unpaid invoices:\n${lines.join("\n")}`;
  }

  return "I can help with invoices, payments, and reminders. Add an ANTHROPIC_API_KEY to unlock full AI features. For now, use the dashboard for most actions.";
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_invoices",
    description: "List invoices, optionally filtered by status or customer name",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["UNPAID", "OVERDUE", "PAID", "CANCELLED", "all"],
          description: "Filter by status (default: all)",
        },
        customerName: { type: "string", description: "Partial customer name filter" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
    },
  },
  {
    name: "send_reminder",
    description: "Send a WhatsApp payment reminder for an unpaid or overdue invoice",
    input_schema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID to remind" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "get_stats",
    description: "Get revenue and transaction summary for a time period",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["1day", "1month", "year", "all"] },
      },
      required: ["period"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new invoice and generate a checkout payment link for a customer",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in ZAR (VAT inclusive)" },
        description: { type: "string", description: "What the payment is for" },
        customerName: { type: "string", description: "Customer's name" },
        customerPhone: {
          type: "string",
          description: "Customer's SA mobile number (e.g. 0821234567)",
        },
      },
      required: ["amount", "description", "customerPhone"],
    },
  },
];

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWhatsAppAgent({
  invoices,
  createInvoiceInternal,
  sendReminderForInvoice,
  getStatsForPeriod,
}) {
  const sessions = new Map(); // phone -> { messages: [], lastActivity: Date }

  function getSession(phone) {
    const now = Date.now();
    if (sessions.has(phone)) {
      const s = sessions.get(phone);
      if (now - s.lastActivity.getTime() > SESSION_TTL_MS) {
        sessions.delete(phone);
      } else {
        s.lastActivity = new Date();
        return s;
      }
    }
    const s = { messages: [], lastActivity: new Date() };
    sessions.set(phone, s);
    return s;
  }

  function pruneSession(session) {
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages = session.messages.slice(-MAX_SESSION_MESSAGES);
    }
  }

  async function executeTool(name, input) {
    try {
      switch (name) {
        case "list_invoices": {
          const limit = Math.min(input.limit || 5, 10);
          let result = Array.from(invoices.values());
          if (input.status && input.status !== "all") {
            result = result.filter((inv) => inv.status === input.status);
          }
          if (input.customerName) {
            const q = input.customerName.toLowerCase();
            result = result.filter((inv) =>
              (inv.customerName || "").toLowerCase().includes(q)
            );
          }
          result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return {
            count: result.length,
            invoices: result.slice(0, limit).map((inv) => ({
              id: inv.id,
              amount: formatZAR(inv.amount),
              status: inv.status,
              customer: inv.customerName || inv.customerPhone,
              description: inv.description,
              dueDate: inv.dueDate?.slice(0, 10),
              remindersSent: inv.remindersSent,
              checkoutLink: inv.checkoutLink,
            })),
          };
        }

        case "send_reminder": {
          const inv = invoices.get(input.invoiceId);
          if (!inv) return { error: `Invoice ${input.invoiceId} not found` };
          if (inv.status === "PAID") return { error: "Invoice already paid" };
          if (inv.status === "CANCELLED") return { error: "Invoice is cancelled" };
          const event = await sendReminderForInvoice(inv);
          return {
            ok: true,
            invoiceId: inv.id,
            delivered: event.delivered,
            deliveryMethod: event.deliveryMethod,
            remindersSent: inv.remindersSent,
          };
        }

        case "get_stats": {
          const stats = await getStatsForPeriod(input.period);
          return {
            period: stats.period,
            totalReceived: formatZAR(stats.totalReceived),
            settledCount: stats.settledCount,
            pendingCount: stats.pendingCount,
          };
        }

        case "create_invoice": {
          const inv = createInvoiceInternal({
            amount: input.amount,
            description: input.description,
            customerName: input.customerName || "",
            customerPhone: input.customerPhone,
          });
          return {
            ok: true,
            invoiceId: inv.id,
            amount: formatZAR(inv.amount),
            checkoutLink: inv.checkoutLink,
            dueDate: inv.dueDate?.slice(0, 10),
          };
        }

        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      console.error(`[WhatsAppAgent] Tool "${name}" error:`, err.message);
      return { error: err.message };
    }
  }

  async function processMessageWithClaude(session, anthropic) {
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const systemPrompt = `You are the SheshaPay business assistant for a South African small business owner.
You help manage invoices, track payments, and understand finances — all via WhatsApp.

Currency is ZAR. Format amounts as R1,234.56. Dates are DD/MM/YYYY. Today is ${today}.

Be concise and friendly. WhatsApp messages should be short (2–4 sentences max).
Ask ONE clarifying question at a time when you need more info.
Never guess a customer phone number — ask if needed.
Before sending reminders, confirm which invoice(s) you're about to chase.`;

    let messages = [...session.messages];
    let response;

    // Agentic loop: run until Claude stops calling tools (max 5 iterations)
    for (let i = 0; i < 5; i++) {
      response = await anthropic.messages.create({
        model: AGENT_MODEL,
        system: systemPrompt,
        tools: TOOLS,
        messages,
        max_tokens: 1024,
      });

      if (response.stop_reason !== "tool_use") break;

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        console.log(`[WhatsAppAgent] Tool call: ${block.name}`, JSON.stringify(block.input));
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    const reply =
      response.content.find((b) => b.type === "text")?.text ||
      "I had trouble with that. Please try again.";

    // Save full exchange to session
    messages.push({ role: "assistant", content: response.content });
    session.messages = messages;
    pruneSession(session);

    return reply;
  }

  async function processMessage(fromPhone, text) {
    const session = getSession(fromPhone);
    session.messages.push({ role: "user", content: text });

    if (!process.env.ANTHROPIC_API_KEY) {
      const reply = mockReply(text, { invoices, getStatsForPeriod });
      session.messages.push({ role: "assistant", content: reply });
      pruneSession(session);
      return reply;
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      return await processMessageWithClaude(session, anthropic);
    } catch (err) {
      console.error("[WhatsAppAgent] Error:", err.message);
      const fallback = "I'm having trouble right now. Please try again in a moment.";
      session.messages.push({ role: "assistant", content: fallback });
      return fallback;
    }
  }

  function clearSession(phone) {
    sessions.delete(phone);
  }

  return { processMessage, clearSession, sessions };
}
