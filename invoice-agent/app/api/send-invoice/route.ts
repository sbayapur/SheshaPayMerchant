import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { buildInvoiceEmail } from "@/lib/invoiceEmail";
import { ParsedInvoice } from "@/types/invoice";

export async function POST(req: NextRequest) {
  let body: ParsedInvoice;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { customer_name, customer_email, line_items, subtotal, total, due_date } = body;

  if (!customer_name || !customer_email || !line_items?.length || !due_date) {
    return NextResponse.json({ error: "Missing required invoice fields" }, { status: 400 });
  }

  // Save to Supabase
  const supabase = createServerClient();
  const { data: invoice, error: dbError } = await supabase
    .from("invoices")
    .insert({
      merchant_id: "craig-demo",
      customer_name,
      customer_email,
      line_items,
      subtotal,
      total,
      due_date,
      status: "sent",
    })
    .select("id")
    .single();

  if (dbError || !invoice) {
    console.error("Supabase insert error:", dbError);
    return NextResponse.json({ error: "Failed to save invoice" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const invoiceUrl = `${appUrl}/invoice/${invoice.id}`;
  const html = buildInvoiceEmail(body, invoiceUrl);

  // Send email via Resend (lazy init so build succeeds without env vars)
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: emailError } = await resend.emails.send({
    from: "Craig @ Durban Plumbing <invoices@sheshapay.co.za>",
    to: customer_email,
    subject: `Invoice from Durban Plumbing — R${total.toFixed(2)} due ${due_date}`,
    html,
  });

  if (emailError) {
    console.error("Resend error:", emailError);
    // Invoice is saved — return success with a warning so the UI still proceeds
    return NextResponse.json({ id: invoice.id, invoiceUrl, emailWarning: "Email delivery failed" });
  }

  return NextResponse.json({ id: invoice.id, invoiceUrl });
}
