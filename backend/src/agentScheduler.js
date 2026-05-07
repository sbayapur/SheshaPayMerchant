import { randomUUID } from "crypto";

const HOURS_MS = 60 * 60 * 1000;
const AGENT_MODEL = "claude-haiku-4-5-20251001";

// SAST is UTC+2. Morning briefing fires at 08:00 SAST = 06:00 UTC.
const BRIEFING_UTC_HOUR = 6;

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Mock mode ────────────────────────────────────────────────────────────────
// Rule-based decision engine used when ANTHROPIC_API_KEY is not set.

function mockDecideFollowUps(unpaidInvoices) {
  const now = Date.now();
  return unpaidInvoices.map((inv) => {
    const daysOverdue = (now - new Date(inv.dueDate).getTime()) / (24 * 60 * 60 * 1000);
    const hoursSinceLast = inv.lastReminderAt
      ? (now - new Date(inv.lastReminderAt).getTime()) / (60 * 60 * 1000)
      : Infinity;

    if (daysOverdue > 7 && inv.remindersSent >= inv.maxReminders) {
      return {
        invoiceId: inv.id,
        action: "alert_merchant",
        reason: `${Math.floor(daysOverdue)} days overdue — max reminders exhausted`,
      };
    }
    if (daysOverdue > 0 && hoursSinceLast >= 24 && inv.remindersSent < inv.maxReminders) {
      return {
        invoiceId: inv.id,
        action: "send_reminder",
        reason: `${Math.floor(daysOverdue)} days overdue`,
      };
    }
    return { invoiceId: inv.id, action: "skip", reason: "Not yet due or reminder sent recently" };
  });
}

// ─── Claude mode ──────────────────────────────────────────────────────────────

async function claudeDecideFollowUps(unpaidInvoices, anthropic) {
  const now = Date.now();
  const context = unpaidInvoices.map((inv) => ({
    id: inv.id,
    amount: inv.amount,
    customerName: inv.customerName || "Unknown",
    daysOverdue: Math.floor((now - new Date(inv.dueDate).getTime()) / (24 * 60 * 60 * 1000)),
    remindersSent: inv.remindersSent,
    maxReminders: inv.maxReminders,
    hoursSinceLastReminder: inv.lastReminderAt
      ? Math.floor((now - new Date(inv.lastReminderAt).getTime()) / (60 * 60 * 1000))
      : null,
  }));

  const response = await anthropic.messages.create({
    model: AGENT_MODEL,
    system: `You are an autonomous invoice follow-up agent for a South African small business.

Review unpaid invoices and decide the right action for each:
- "send_reminder": send WhatsApp payment reminder (only if: daysOverdue > 0 AND hoursSinceLastReminder >= 24 or null AND remindersSent < maxReminders)
- "skip": do nothing yet (too soon, or reminder sent recently, or invoice not yet due)
- "alert_merchant": flag for merchant attention (when: daysOverdue > 7 AND remindersSent >= maxReminders)

Respond ONLY with a JSON array. No explanation outside the array.
Example: [{"invoiceId": "INV-123", "action": "send_reminder", "reason": "2 days overdue, first reminder"}]`,
    messages: [{ role: "user", content: JSON.stringify(context) }],
    max_tokens: 512,
  });

  const text = response.content.find((b) => b.type === "text")?.text || "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn("[FollowUp] Claude response had no JSON array:", text.slice(0, 200));
    return mockDecideFollowUps(unpaidInvoices); // safe fallback
  }
  return JSON.parse(match[0]);
}

async function claudeGenerateBriefing(context, anthropic) {
  const response = await anthropic.messages.create({
    model: AGENT_MODEL,
    system: `You are SheshaPay, a smart business assistant for a South African freelancer or small business owner.

Write a personalised WhatsApp morning briefing in this structure:

Good morning 👋

[One sentence on revenue: today's earnings vs this month's total. Be specific with amounts.]

Chase today:
[Bullet each overdue client: name, amount, days overdue. If none, write "All invoices up to date 🎉" and skip the bullets.]

[One sharp, specific observation — e.g. a payment pattern, a client worth nurturing, or a milestone approaching. Make it actionable, not generic.]

Rules:
- ZAR amounts formatted as R1,234.56
- Whole message under 120 words
- Direct and practical — like a smart colleague, not a chatbot
- Max 2 emojis total
- If no overdue invoices, skip the Chase section and make the observation forward-looking`,
    messages: [
      {
        role: "user",
        content: `Business snapshot:\n${JSON.stringify(context, null, 2)}\n\nWrite the morning briefing.`,
      },
    ],
    max_tokens: 350,
  });
  return response.content.find((b) => b.type === "text")?.text || null;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAgentScheduler({
  invoices,
  sendReminderForInvoice,
  getStatsForPeriod,
  sendWhatsAppText,
  whatsappConfig,
  merchantNotifications,
}) {
  let lastFollowUpRun = null;
  let lastBriefingDate = null; // "YYYY-MM-DD"

  async function runFollowUpScan() {
    const unpaid = Array.from(invoices.values()).filter(
      (inv) => inv.status === "UNPAID" || inv.status === "OVERDUE"
    );

    if (unpaid.length === 0) {
      console.log("[FollowUp] No unpaid invoices.");
      lastFollowUpRun = new Date().toISOString();
      return { sent: 0, alerted: 0, skipped: 0 };
    }

    console.log(`[FollowUp] Reviewing ${unpaid.length} unpaid invoice(s)...`);

    let decisions;
    const useAI = !!process.env.ANTHROPIC_API_KEY;

    if (useAI) {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        decisions = await claudeDecideFollowUps(unpaid, anthropic);
        console.log(`[FollowUp] Claude returned ${decisions.length} decision(s)`);
      } catch (err) {
        console.error("[FollowUp] Claude error, using rule-based fallback:", err.message);
        decisions = mockDecideFollowUps(unpaid);
      }
    } else {
      decisions = mockDecideFollowUps(unpaid);
      console.log(`[FollowUp] Mock mode — ${decisions.length} decision(s) (rule-based)`);
    }

    let sent = 0, alerted = 0, skipped = 0;

    for (const d of decisions) {
      if (d.action === "send_reminder") {
        const inv = invoices.get(d.invoiceId);
        if (inv) {
          await sendReminderForInvoice(inv);
          sent++;
          console.log(`[FollowUp] Reminded ${d.invoiceId}: ${d.reason}`);
        }
      } else if (d.action === "alert_merchant") {
        merchantNotifications.push({
          id: randomUUID(),
          type: "invoice_escalation",
          invoiceId: d.invoiceId,
          message: `Invoice ${d.invoiceId} needs attention: ${d.reason}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
        alerted++;
        console.log(`[FollowUp] Merchant alert queued for ${d.invoiceId}: ${d.reason}`);
      } else {
        skipped++;
      }
    }

    lastFollowUpRun = new Date().toISOString();
    console.log(`[FollowUp] Done — ${sent} sent, ${alerted} alerted, ${skipped} skipped.`);
    return { sent, alerted, skipped };
  }

  async function runMorningBriefing() {
    console.log("[Briefing] Generating morning briefing...");

    const [dayStats, monthStats, yearStats] = await Promise.all([
      getStatsForPeriod("1day"),
      getStatsForPeriod("1month"),
      getStatsForPeriod("year"),
    ]);

    const now = Date.now();
    const overdueInvoices = Array.from(invoices.values()).filter(
      (inv) => inv.status === "UNPAID" || inv.status === "OVERDUE"
    );

    const today = new Date().toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });

    const context = {
      today,
      todaySettledCount: dayStats.settledCount,
      todayRevenue: dayStats.totalReceived,
      monthRevenue: monthStats.totalReceived,
      yearRevenue: yearStats.totalReceived,
      overdueInvoices: overdueInvoices.map((inv) => ({
        customerName: inv.customerName || inv.customerPhone || "Unknown",
        amount: inv.amount,
        daysOverdue: Math.max(
          0,
          Math.floor((now - new Date(inv.dueDate).getTime()) / (24 * 60 * 60 * 1000))
        ),
        remindersSent: inv.remindersSent,
      })),
    };

    let message = null;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        message = await claudeGenerateBriefing(context, anthropic);
      } catch (err) {
        console.error("[Briefing] Claude error, using template:", err.message);
      }
    }

    // Template fallback (mock mode or Claude failure)
    if (!message) {
      const parts = [`Good morning! Today is ${today}.`];
      if (dayStats.settledCount > 0) {
        parts.push(
          `You received ${formatZAR(dayStats.totalReceived)} across ${dayStats.settledCount} settled payment(s) today.`
        );
      } else {
        parts.push(`No payments settled yet today. This month you've received ${formatZAR(monthStats.totalReceived)}.`);
      }
      const overdueTotal = context.overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      if (context.overdueInvoices.length > 0) {
        parts.push(
          `${context.overdueInvoices.length} invoice(s) still outstanding — ${formatZAR(overdueTotal)} total.`
        );
      } else {
        parts.push("All invoices are up to date!");
      }
      message = parts.join(" ");
    }

    // Always queue in dashboard notifications
    merchantNotifications.push({
      id: randomUUID(),
      type: "morning_briefing",
      message,
      read: false,
      createdAt: new Date().toISOString(),
    });

    // Send via WhatsApp if merchant phone is registered and WhatsApp is connected
    const merchantPhone = whatsappConfig.merchantPhone;
    if (merchantPhone && whatsappConfig.connected && whatsappConfig.accessToken) {
      try {
        await sendWhatsAppText(merchantPhone, message);
        console.log(`[Briefing] Sent to merchant ${merchantPhone}`);
      } catch (err) {
        console.error("[Briefing] WhatsApp send failed:", err.message);
      }
    } else {
      console.log("[Briefing] Queued to notifications (WhatsApp not connected or merchant phone not set)");
    }

    lastBriefingDate = new Date().toISOString().slice(0, 10);
    return { message };
  }

  async function checkAndRun() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (now.getUTCHours() === BRIEFING_UTC_HOUR && lastBriefingDate !== todayStr) {
      await runMorningBriefing().catch((err) =>
        console.error("[Briefing] Scheduled run error:", err.message)
      );
    }

    await runFollowUpScan().catch((err) =>
      console.error("[FollowUp] Scheduled run error:", err.message)
    );
  }

  function start() {
    const mode = process.env.ANTHROPIC_API_KEY ? "Claude AI" : "mock/rule-based";
    console.log(`[AgentScheduler] Starting in ${mode} mode.`);
    console.log(`[AgentScheduler] Follow-up scans: every hour. Morning briefing: 08:00 SAST.`);

    // Initial follow-up scan 5s after startup
    setTimeout(
      () => runFollowUpScan().catch((err) => console.error("[FollowUp] Startup error:", err.message)),
      5000
    );

    // Hourly check
    setInterval(checkAndRun, HOURS_MS);
  }

  return {
    start,
    runFollowUpScan,
    runMorningBriefing,
    getStatus: () => ({
      lastFollowUpRun,
      lastBriefingDate,
      mode: process.env.ANTHROPIC_API_KEY ? "claude" : "mock",
    }),
  };
}
