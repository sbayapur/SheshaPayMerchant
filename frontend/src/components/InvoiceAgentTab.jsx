import { useState, useRef, useEffect } from "react";
import { formatZAR, formatDateZA } from "../lib/format.js";

const INVOICE_API = (import.meta.env.VITE_INVOICE_AGENT_URL || "http://localhost:3000").replace(/\/$/, "");

const GREETING = "Hi Craig! Tell me about a job you just completed and I'll generate an invoice. For example: \"Fixed a burst pipe for John Smith at 5 Berea Road, 2 hours labour at R450/hr plus R320 in parts, due in 14 days, john@example.com\"";

const accent = "var(--primary-accent)";
const border = "var(--border)";
const card = "var(--card)";
const muted = "var(--muted)";
const text = "var(--text)";
const bg = "var(--bg)";

// ── Invoice Preview ───────────────────────────────────────────────────────────

function InvoicePreview({ invoice, onEdit }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [error, setError] = useState(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${INVOICE_API}/api/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSent(true);
      setInvoiceUrl(data.invoiceUrl);
    } catch (err) {
      setError(err.message || "Failed to send invoice");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div style={{ borderRadius: 12, border: `1px solid ${border}`, background: card, overflow: "hidden", maxWidth: 480 }}>
        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0ea073" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ margin: 0, fontWeight: 600, color: text }}>Invoice sent!</p>
          <p style={{ margin: 0, fontSize: 13, color: muted }}>
            Email delivered to <strong>{invoice.customer_email}</strong>
          </p>
          {invoiceUrl && (
            <a href={invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: accent, textDecoration: "none" }}>
              View invoice page →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${border}`, background: card, overflow: "hidden", maxWidth: 480, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Draft Invoice</span>
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: text }}>Durban Plumbing</p>
          <p style={{ margin: 0, fontSize: 12, color: muted }}>Craig</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: muted }}>Due date</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 500, color: text }}>{formatDateZA(invoice.due_date)}</p>
        </div>
      </div>

      {/* Bill to */}
      <div style={{ padding: "10px 18px", borderBottom: `1px solid ${border}`, background: "#f9fafb" }}>
        <p style={{ margin: "0 0 2px", fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bill to</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: text }}>{invoice.customer_name}</p>
        <p style={{ margin: 0, fontSize: 12, color: muted }}>{invoice.customer_email}</p>
      </div>

      {/* Line items */}
      <div style={{ padding: "10px 18px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Description", "Qty", "Unit", "Total"].map((h, i) => (
                <th key={h} style={{ padding: "0 0 8px", textAlign: i === 0 ? "left" : "right", fontSize: 11, color: muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${border}` }}>
                <td style={{ padding: "8px 0", color: text, paddingRight: 8 }}>{item.description}</td>
                <td style={{ padding: "8px 0", textAlign: "right", color: muted }}>{item.quantity}</td>
                <td style={{ padding: "8px 0", textAlign: "right", color: muted }}>{formatZAR(item.unit_price)}</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 500, color: text }}>{formatZAR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ padding: "10px 18px", borderTop: `2px solid ${border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: muted }}>Subtotal</span>
          <span style={{ fontSize: 13, color: text }}>{formatZAR(invoice.subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: text }}>Total due</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: accent }}>{formatZAR(invoice.total)}</span>
        </div>
      </div>

      {/* AI assumptions */}
      {invoice.confidence_notes?.length > 0 && (
        <div style={{ padding: "10px 18px", borderTop: `1px solid ${border}`, background: "#fffbeb" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#92400e" }}>AI assumptions</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {invoice.confidence_notes.map((note, i) => (
              <li key={i} style={{ fontSize: 11, color: "#b45309", display: "flex", gap: 6 }}>
                <span>·</span><span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "8px 18px", borderTop: `1px solid #fee2e2`, background: "#fef2f2" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>{error}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "14px 18px", borderTop: `1px solid ${border}`, display: "flex", gap: 8 }}>
        <button
          onClick={onEdit}
          style={{ flex: 1, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", padding: "9px 0", fontSize: 13, fontWeight: 500, color: text, cursor: "pointer" }}
        >
          Edit
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ flex: 1, borderRadius: 8, border: "none", background: accent, padding: "9px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1 }}
        >
          {sending ? "Sending…" : "Send Invoice"}
        </button>
      </div>
    </div>
  );
}

// ── Invoice Agent Chat Tab ────────────────────────────────────────────────────

export default function InvoiceAgentTab() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, invoice]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = { role: "user", content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    setInvoice(null);

    try {
      const res = await fetch(`${INVOICE_API}/api/parse-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      if (data.state === "needs_info") {
        setMessages([...next, { role: "assistant", content: data.clarifying_question }]);
      } else if (data.state === "complete") {
        setMessages([...next, { role: "assistant", content: `Got it! Here's the invoice for ${data.invoice.customer_name}. Review it below.` }]);
        setInvoice(data.invoice);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleEdit() {
    setInvoice(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "No problem — what would you like to change?" }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 480, background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: card, borderBottom: `1px solid ${border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text, lineHeight: 1 }}>Invoice Agent</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: muted }}>AI-powered invoicing · Durban Plumbing</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: muted }}>Online</span>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
            {msg.role === "assistant" && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            )}
            <div style={{
              maxWidth: "72%",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "9px 14px",
              fontSize: 13,
              lineHeight: 1.5,
              background: msg.role === "user" ? accent : card,
              color: msg.role === "user" ? "white" : text,
              border: msg.role === "user" ? "none" : `1px solid ${border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 150, 300].map((delay) => (
                  <span key={delay} style={{ width: 6, height: 6, borderRadius: "50%", background: muted, display: "inline-block", animation: `bounce 1s ${delay}ms infinite` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        {invoice && (
          <div style={{ marginTop: 4 }}>
            <InvoicePreview invoice={invoice} onEdit={handleEdit} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ flexShrink: 0, background: card, borderTop: `1px solid ${border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the job you completed..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: bg,
              padding: "9px 13px",
              fontSize: 13,
              color: text,
              fontFamily: "inherit",
              outline: "none",
              overflow: "hidden",
              opacity: loading ? 0.5 : 1,
            }}
            onFocus={(e) => { e.target.style.borderColor = "#0ea073"; e.target.style.boxShadow = "0 0 0 2px rgba(14,160,115,0.15)"; }}
            onBlur={(e) => { e.target.style.borderColor = border; e.target.style.boxShadow = "none"; }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "none",
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
              opacity: (!input.trim() || loading) ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={{ margin: "6px 0 0", textAlign: "center", fontSize: 11, color: muted }}>Enter to send · Shift+Enter for new line</p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
