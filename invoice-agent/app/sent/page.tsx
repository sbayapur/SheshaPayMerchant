export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatZAR, formatDateZA } from "@/lib/format";

interface InvoiceRow {
  id: string;
  customer_name: string;
  customer_email: string;
  total: number;
  due_date: string;
  status: string;
  created_at: string;
}

export default async function SentPage() {
  const supabase = createServerClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, customer_name, customer_email, total, due_date, status, created_at")
    .eq("merchant_id", "craig-demo")
    .order("created_at", { ascending: false })
    .returns<InvoiceRow[]>();

  const rows = error ? [] : (invoices ?? []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "40px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Durban Plumbing · Craig
            </p>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: "#111827" }}>Sent invoices</h1>
          </div>
          <Link
            href="/"
            style={{
              background: "#0d9488",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            + New invoice
          </Link>
        </div>

        {/* Table card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: "48px 32px", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
              No invoices sent yet.{" "}
              <Link href="/" style={{ color: "#0d9488", textDecoration: "underline" }}>
                Create your first one
              </Link>
              .
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {["Customer", "Email", "Total", "Due date", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: "1px solid #f9fafb" }}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {inv.customer_name}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#6b7280" }}>{inv.customer_email}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#0d9488" }}>
                      {formatZAR(inv.total)}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#374151" }}>
                      {formatDateZA(inv.due_date)}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          background: inv.status === "paid" ? "#dcfce7" : "#fef3c7",
                          color: inv.status === "paid" ? "#166534" : "#92400e",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <Link
                        href={`/invoice/${inv.id}`}
                        style={{ fontSize: 13, color: "#0d9488", textDecoration: "none", fontWeight: 500 }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
