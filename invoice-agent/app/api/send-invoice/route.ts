import { NextRequest, NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
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

  // SES client — credentials from env vars locally, IAM role on Amplify
  const ses = new SESClient({ region: process.env.AWS_REGION ?? "eu-west-1" });
  try {
    await ses.send(
      new SendEmailCommand({
        Source: "Craig @ Durban Plumbing <invoices@sheshapay.co.za>",
        Destination: { ToAddresses: [customer_email] },
        Message: {
          Subject: {
            Data: `Invoice from Durban Plumbing — R${total.toFixed(2)} due ${due_date}`,
            Charset: "UTF-8",
          },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      })
    );
  } catch (emailError) {
    console.error("SES error:", emailError);
    // Invoice is saved — return success with warning so the UI still proceeds
    return NextResponse.json({ id: invoice.id, invoiceUrl, emailWarning: "Email delivery failed" });
  }

  return NextResponse.json({ id: invoice.id, invoiceUrl });
}
