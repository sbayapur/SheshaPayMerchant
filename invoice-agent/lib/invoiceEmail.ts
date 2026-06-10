import { ParsedInvoice } from "@/types/invoice";
import { formatZAR, formatDateZA } from "@/lib/format";

export function buildInvoiceEmail(invoice: ParsedInvoice, invoiceUrl: string): string {
  const lineItemRows = invoice.line_items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">${item.description}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;text-align:right;">${formatZAR(item.unit_price)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#111827;font-size:14px;text-align:right;font-weight:500;">${formatZAR(item.total)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice from Durban Plumbing</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#0d9488;border-radius:12px 12px 0 0;padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Invoice from</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Durban Plumbing</p>
                    <p style="margin:2px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Craig</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:11px;">Due date</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:16px;font-weight:600;">${formatDateZA(invoice.due_date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px;">

              <!-- Bill to -->
              <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Bill to</p>
              <p style="margin:0 0 24px;font-size:16px;font-weight:600;color:#111827;">${invoice.customer_name}</p>

              <!-- Line items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <thead>
                  <tr>
                    <th style="padding:0 0 8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Description</th>
                    <th style="padding:0 0 8px;text-align:center;font-size:11px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Qty</th>
                    <th style="padding:0 0 8px;text-align:right;font-size:11px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Unit</th>
                    <th style="padding:0 0 8px;text-align:right;font-size:11px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Total</th>
                  </tr>
                </thead>
                <tbody>${lineItemRows}</tbody>
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #f0f0f0;padding-top:16px;">
                <tr>
                  <td style="font-size:14px;color:#6b7280;">Subtotal</td>
                  <td style="font-size:14px;color:#374151;text-align:right;">${formatZAR(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:16px;font-weight:700;color:#111827;">Total due</td>
                  <td style="padding-top:8px;font-size:18px;font-weight:700;color:#0d9488;text-align:right;">${formatZAR(invoice.total)}</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;">
              <a href="${invoiceUrl}"
                 style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                View Invoice
              </a>
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
                Or copy this link: <a href="${invoiceUrl}" style="color:#0d9488;">${invoiceUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Powered by SheshaPay</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
