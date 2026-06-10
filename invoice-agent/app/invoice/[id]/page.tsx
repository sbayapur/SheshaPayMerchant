export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import { formatZAR, formatDateZA } from "@/lib/format";
import { LineItem } from "@/types/invoice";

interface InvoiceRow {
  id: string;
  merchant_id: string;
  customer_name: string;
  customer_email: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  due_date: string;
  status: string;
  created_at: string;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single<InvoiceRow>();

  if (error || !data) notFound();

  const invoice = data;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#0d9488",
            padding: "28px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Invoice from
            </p>
            <p style={{ margin: "4px 0 0", color: "#fff", fontSize: 22, fontWeight: 700 }}>Durban Plumbing</p>
            <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.75)", fontSize: 13 }}>Craig</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 11 }}>Due date</p>
            <p style={{ margin: "4px 0 0", color: "#fff", fontSize: 16, fontWeight: 600 }}>
              {formatDateZA(invoice.due_date)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Bill to
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 16, fontWeight: 600, color: "#111827" }}>{invoice.customer_name}</p>

          {/* Line items */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                {["Description", "Qty", "Unit price", "Total"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "0 0 10px",
                      fontSize: 11,
                      color: "#9ca3af",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: i === 0 ? "left" : "right",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#374151", fontSize: 14 }}>
                    {item.description}
                  </td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#6b7280", fontSize: 14, textAlign: "right" }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#6b7280", fontSize: 14, textAlign: "right" }}>
                    {formatZAR(item.unit_price)}
                  </td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#111827", fontSize: 14, textAlign: "right", fontWeight: 500 }}>
                    {formatZAR(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: "2px solid #f0f0f0", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: "#6b7280" }}>Subtotal</span>
              <span style={{ fontSize: 14, color: "#374151" }}>{formatZAR(invoice.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Total due</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#0d9488" }}>{formatZAR(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Pay CTA */}
        <div
          style={{
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            padding: "24px 32px",
            textAlign: "center",
          }}
        >
          <button
            disabled
            style={{
              background: "#0d9488",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 40px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "not-allowed",
              opacity: 0.7,
              width: "100%",
              maxWidth: 260,
            }}
          >
            Pay {formatZAR(invoice.total)} — Coming soon
          </button>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#9ca3af" }}>
            Bank-to-bank payment via SheshaPay is coming soon.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>Powered by SheshaPay</p>
        </div>
      </div>
    </main>
  );
}
