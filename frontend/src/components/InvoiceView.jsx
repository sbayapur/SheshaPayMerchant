import { useEffect, useState } from "react";
import { formatZAR, formatDateZA } from "../lib/format.js";
import { getApiBase } from "../lib/api.js";

const API_BASE = getApiBase();

function getInvoiceIdFromPath() {
  const match = window.location.pathname.match(/^\/invoice\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function InvoiceView() {
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = getInvoiceIdFromPath();
    if (!id) { setError("Invoice not found"); return; }
    fetch(`${API_BASE}/api/agent/invoices/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setInvoice)
      .catch(() => setError("Invoice not found or no longer available."));
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <p style={{ color: "#6b7280", fontSize: 15 }}>{error}</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <div style={{ background: "#0d9488", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Invoice from</p>
            <p style={{ margin: "4px 0 0", color: "#fff", fontSize: 22, fontWeight: 700 }}>Durban Plumbing</p>
            <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.75)", fontSize: 13 }}>Craig</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 11 }}>Due date</p>
            <p style={{ margin: "4px 0 0", color: "#fff", fontSize: 16, fontWeight: 600 }}>{formatDateZA(invoice.due_date)}</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bill to</p>
          <p style={{ margin: "0 0 24px", fontSize: 16, fontWeight: 600, color: "#111827" }}>{invoice.customer_name}</p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                {["Description", "Qty", "Unit price", "Total"].map((h, i) => (
                  <th key={h} style={{ padding: "0 0 10px", fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 0 ? "left" : "right" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#374151", fontSize: 14 }}>{item.description}</td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#6b7280", fontSize: 14, textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#6b7280", fontSize: 14, textAlign: "right" }}>{formatZAR(item.unit_price)}</td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", color: "#111827", fontSize: 14, textAlign: "right", fontWeight: 500 }}>{formatZAR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

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

        <div style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", padding: "24px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Bank-to-bank payment via SheshaPay coming soon.</p>
        </div>

        <div style={{ padding: "16px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>Powered by SheshaPay</p>
        </div>
      </div>
    </div>
  );
}
