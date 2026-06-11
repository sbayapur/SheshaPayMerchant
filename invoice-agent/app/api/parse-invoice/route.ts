import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = () => `You are an invoice-parsing assistant for Craig, owner of Durban Plumbing, South Africa.
Today's date is ${new Date().toISOString().split("T")[0]}.
Currency is ZAR (South African Rand, symbol R).
Merchant name: Craig
Business name: Durban Plumbing

Your job is to extract invoice details from Craig's natural-language job descriptions.

CRITICAL: Respond ONLY with a single JSON object. No prose, no markdown, no code fences.

If you are missing the customer's name, customer's email, or any required line-item detail (description, quantity, price), respond with:
{
  "state": "needs_info",
  "clarifying_question": "<one specific question to get the missing detail>"
}

If you have all required information, respond with:
{
  "state": "complete",
  "invoice": {
    "customer_name": "string",
    "customer_email": "string",
    "line_items": [
      {
        "description": "string",
        "quantity": number,
        "unit_price": number,
        "total": number
      }
    ],
    "subtotal": number,
    "total": number,
    "due_date": "YYYY-MM-DD",
    "confidence_notes": ["string"]
  }
}

Rules:
- subtotal equals sum of all line_item totals. total equals subtotal (no VAT for this demo).
- due_date: calculate from phrases like "due in 14 days" or "due Friday". If not mentioned, default to 30 days from today.
- confidence_notes: list any assumptions you made (e.g. "Assumed 1 unit of labour", "Due date defaulted to 30 days"). Empty array if no assumptions.
- All amounts are in ZAR as plain numbers (not strings).
- Do not invent prices. If a price is ambiguous, ask.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history }: { message: string; history: Message[] } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build message history for Claude — include prior turns, append the new user message
    const claudeMessages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT(),
      messages: claudeMessages,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    let parsed: { state: string; clarifying_question?: string; invoice?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Claude returned something unparseable — treat as needs_info
      return NextResponse.json({
        state: "needs_info",
        clarifying_question: "Sorry, I didn't understand that. Could you describe the job again?",
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("parse-invoice error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", detail: message }, { status: 500 });
  }
}
