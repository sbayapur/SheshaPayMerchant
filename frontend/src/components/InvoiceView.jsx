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
    window.scrollTo({ top: 0, behavior: "instant" });
    const id = getInvoiceIdFromPath();
    if (!id) { setError("Invoice not found"); return; }
    fetch(`${API_BASE}/api/agent/invoices/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setInvoice)
      .catch(() => setError("Invoice not found or no longer available."));
  }, []);

  if (error) {
    return (
      <div className="app landing">
        <div className="top-bar">
          <div className="brand-mark">
            <div className="brand-icon">
              <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
            </div>
            <span className="brand-name">Shesha Pay</span>
          </div>
        </div>
        <div className="hero">
          <h1>Invoice Not Found</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="app landing">
        <div className="top-bar">
          <div className="brand-mark">
            <div className="brand-icon">
              <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
            </div>
            <span className="brand-name">Shesha Pay</span>
          </div>
        </div>
        <div className="hero">
          <h1>Loading Invoice…</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="app landing">
      <div className="top-bar">
        <div className="brand-mark">
          <div className="brand-icon">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
          </div>
          <span className="brand-name">Shesha Pay</span>
        </div>
        <div className="secure-badge">Invoice</div>
      </div>

      <div className="hero">
        <h1>Your Invoice</h1>
        <p>From Durban Plumbing · Due {formatDateZA(invoice.due_date)}</p>
      </div>

      <div className="checkout-shell">
        <div className="card-header">
          <div>
            <p className="card-subtitle">Invoice from</p>
            <p className="card-title">Durban Plumbing</p>
          </div>
          <div className="card-icon" aria-hidden>🔧</div>
        </div>

        <div className="card-body">
          <div className="reference-row">
            <div>
              <p className="label">Bill to</p>
              <p className="value">{invoice.customer_name}</p>
            </div>
            <div className="align-end">
              <p className="label">Due date</p>
              <p className="value">{formatDateZA(invoice.due_date)}</p>
            </div>
          </div>

          <hr className="divider" />

          {invoice.line_items.map((item, i) => (
            <div className="line-item" key={i}>
              <div>
                <p className="item-name">{item.description}</p>
                <p className="item-qty">Qty: {item.quantity}</p>
              </div>
              <p className="item-amount">{formatZAR(item.total)}</p>
            </div>
          ))}

          <hr className="divider" />

          <div className="totals">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatZAR(invoice.subtotal)}</span>
            </div>
            <div className="totals-row total">
              <strong>Total Due</strong>
              <strong>{formatZAR(invoice.total)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="pay-section">
        <button className="pay-button" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
          <div className="pay-button-content">
            <div className="pay-icon">🏦</div>
            <div className="pay-label">Pay by bank — Coming soon</div>
          </div>
          <div className="pay-arrow">›</div>
        </button>
        <p className="demo-note">Bank-to-bank payment via SheshaPay is coming soon.</p>
      </div>

      <div className="security-row">
        <div className="security-item">
          <span className="security-icon">🔒</span>
          <span>Bank-level security</span>
        </div>
        <div className="security-item">
          <span className="security-icon">🛡️</span>
          <span>256-bit encryption</span>
        </div>
      </div>
      <p className="security-note">Payments will be processed securely via PayShap instant bank transfer.</p>
    </div>
  );
}
