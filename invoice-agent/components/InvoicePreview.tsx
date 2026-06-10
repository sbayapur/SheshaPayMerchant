"use client";

import { useState } from "react";
import { ParsedInvoice } from "@/types/invoice";
import { formatZAR, formatDateZA } from "@/lib/format";

interface Props {
  invoice: ParsedInvoice;
  onEdit: () => void;
}

export default function InvoicePreview({ invoice, onEdit }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden max-w-lg">
        <div className="p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--foreground)]">Invoice sent!</p>
          <p className="text-sm text-[var(--muted)]">
            Email delivered to <span className="font-medium">{invoice.customer_email}</span>
          </p>
          <a href="/sent" className="mt-1 text-xs text-[var(--accent)] hover:underline">
            View all sent invoices →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden max-w-lg">
      {/* Invoice header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-5 h-5 rounded bg-[var(--accent)] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">Draft Invoice</span>
          </div>
          <p className="font-semibold text-[var(--foreground)]">Durban Plumbing</p>
          <p className="text-xs text-[var(--muted)]">Craig</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)]">Due date</p>
          <p className="text-sm font-medium text-[var(--foreground)]">{formatDateZA(invoice.due_date)}</p>
        </div>
      </div>

      {/* Bill to */}
      <div className="px-5 py-3 border-b border-[var(--border)] bg-zinc-50">
        <p className="text-xs text-[var(--muted)] mb-1">Bill to</p>
        <p className="text-sm font-medium text-[var(--foreground)]">{invoice.customer_name}</p>
        <p className="text-xs text-[var(--muted)]">{invoice.customer_email}</p>
      </div>

      {/* Line items */}
      <div className="px-5 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--muted)]">
              <th className="text-left pb-2 font-medium">Description</th>
              <th className="text-right pb-2 font-medium">Qty</th>
              <th className="text-right pb-2 font-medium">Unit</th>
              <th className="text-right pb-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {invoice.line_items.map((item, i) => (
              <tr key={i}>
                <td className="py-2 text-[var(--foreground)] pr-2">{item.description}</td>
                <td className="py-2 text-right text-[var(--muted)]">{item.quantity}</td>
                <td className="py-2 text-right text-[var(--muted)]">{formatZAR(item.unit_price)}</td>
                <td className="py-2 text-right font-medium text-[var(--foreground)]">{formatZAR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-5 py-3 border-t border-[var(--border)] space-y-1">
        <div className="flex justify-between text-sm text-[var(--muted)]">
          <span>Subtotal</span>
          <span>{formatZAR(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-[var(--foreground)]">
          <span>Total</span>
          <span className="text-[var(--accent)]">{formatZAR(invoice.total)}</span>
        </div>
      </div>

      {/* Confidence notes */}
      {invoice.confidence_notes.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border)] bg-amber-50">
          <p className="text-xs font-medium text-amber-700 mb-1">AI assumptions</p>
          <ul className="space-y-0.5">
            {invoice.confidence_notes.map((note, i) => (
              <li key={i} className="text-xs text-amber-600 flex gap-1.5">
                <span>·</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {error && (
        <div className="px-5 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      <div className="px-5 py-4 border-t border-[var(--border)] flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm font-medium text-[var(--foreground)] hover:bg-zinc-50 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 py-2 text-sm font-medium text-white transition-colors"
        >
          {sending ? "Sending…" : "Send Invoice"}
        </button>
      </div>
    </div>
  );
}
