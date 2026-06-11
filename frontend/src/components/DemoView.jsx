import { useState, useEffect, useCallback } from "react";
import TabletFrame from "./TabletFrame.jsx";
import EmployeesView from "./EmployeesView.jsx";
import AccountingView from "./AccountingView.jsx";
import { formatZAR, formatDateZA } from "../lib/format.js";
import { getApiBase } from "../lib/api.js";

const API_BASE = getApiBase();

// ─── Mock data ────────────────────────────────────────────────────────────────

const INSIGHTS = [
  "Winter is 3 weeks away. WhatsApp your last 20 customers about a free geyser check. Usually gets 3 to 5 new installs.",
  "Acorn Properties booked you 4 times this month. Ask them for a monthly agreement. Could be R8,000 a month guaranteed.",
  "You're charging R850 for emergencies. Other plumbers charge R1,200+. Put your rates up on new jobs.",
];

const FORECAST = [
  { id: 1, client: "Acorn Properties",        amount: 4200, likelihood: "likely",  reason: "4 payments, never late" },
  { id: 2, client: "Mr Sithole",              amount: 3500, likelihood: "likely",  reason: "deposit already paid" },
  { id: 3, client: "Sunrise Villas",          amount: 4200, likelihood: "likely",  reason: "signed quote" },
  { id: 4, client: "Sandton Estates",         amount: 2800, likelihood: "likely",  reason: "regular client" },
  { id: 5, client: "BuildRight Construction", amount: 8500, likelihood: "at-risk", reason: "overdue by 1 day" },
  { id: 6, client: "Khumalo Residence",       amount: 1850, likelihood: "at-risk", reason: "new client" },
];

const LIKELY_TOTAL  = 4200 + 3500 + 4200 + 2800;
const AT_RISK_TOTAL = 8500 + 1850 + 750 + 3200 + 1950 + 2850 + 650;
const BEST_CASE     = 145230 + LIKELY_TOTAL + AT_RISK_TOTAL;
const CONSERVATIVE  = 145230 + LIKELY_TOTAL;

const PAYMENTS = [
  { id: "ORD-1842", customer: "Mrs Dlamini",             phone: "+27831112233", desc: "Drain cleaning",        amount:  950, status: "SETTLED", date: "2026-05-06T09:14:00" },
  { id: "ORD-1841", customer: "Acorn Properties",        phone: "+27115550100", desc: "Geyser installation",   amount: 3500, status: "SETTLED", date: "2026-05-05T11:30:00" },
  { id: "ORD-1840", customer: "Mr Mokoena",              phone: "+27722334455", desc: "Burst pipe repair",     amount: 2200, status: "SETTLED", date: "2026-05-04T08:05:00" },
  { id: "ORD-1839", customer: "StayEasy Apartments",     phone: "+27114470200", desc: "Bathroom fitting",      amount: 4800, status: "SETTLED", date: "2026-05-02T14:22:00" },
  { id: "ORD-1838", customer: "Khumalo Residence",       phone: "+27843219876", desc: "Blocked drain",         amount: 1850, status: "PENDING", date: "2026-05-07T07:45:00" },
  { id: "ORD-1837", customer: "BuildRight Construction", phone: "+27115551234", desc: "Pipe relining",         amount: 8500, status: "PENDING", date: "2026-05-07T06:58:00" },
  { id: "ORD-1836", customer: "Mr Sithole",              phone: "+27791234567", desc: "Geyser installation",   amount: 3500, status: "PENDING", date: "2026-05-07T10:02:00" },
  { id: "ORD-1835", customer: "Sunrise Villas",          phone: "+27116670300", desc: "Bathroom fitting",      amount: 4200, status: "PENDING", date: "2026-05-06T15:33:00" },
  { id: "ORD-1834", customer: "Mrs Nkosi",               phone: "+27834445566", desc: "Leaking tap repair",    amount:  750, status: "PENDING", date: "2026-05-06T12:10:00" },
  { id: "ORD-1833", customer: "Sandton Estates",         phone: "+27117780400", desc: "Monthly maintenance",   amount: 2800, status: "PENDING", date: "2026-05-05T09:50:00" },
  { id: "ORD-1832", customer: "Mr Dube",                 phone: "+27766778899", desc: "Hot water cylinder",    amount: 3200, status: "PENDING", date: "2026-05-05T16:20:00" },
  { id: "ORD-1831", customer: "Thabo Residence",         phone: "+27855667788", desc: "Burst pipe repair",     amount: 1950, status: "PENDING", date: "2026-05-04T07:30:00" },
  { id: "ORD-1830", customer: "Cape Road Properties",    phone: "+27118890500", desc: "Drain cleaning",        amount: 2850, status: "PENDING", date: "2026-05-04T13:45:00" },
  { id: "ORD-1829", customer: "Mrs Zulu",                phone: "+27811223344", desc: "Toilet cistern repair", amount:  650, status: "PENDING", date: "2026-05-03T10:55:00" },
];

const PRESET_ITEMS = [
  { name: "Geyser installation", price: 3500 },
  { name: "Burst pipe repair",   price: 2200 },
  { name: "Drain cleaning",      price:  950 },
  { name: "Emergency callout",   price: 1200 },
];

const DEMO_RECEIPT_ITEMS = [
  { name: "Geyser installation", price: 3500, quantity: 1 },
  { name: "Labour (2 hrs)",      price:  600, quantity: 1 },
];

const DEMO_EMPLOYEES = [
  { id: "emp-1", name: "Sipho Nkosi",    phoneNumber: "+27731112233", bankName: "Capitec",       accountHolderName: "Sipho Nkosi",    bankAccountNumber: "1234567890", createdAt: "2026-01-15T08:00:00" },
  { id: "emp-2", name: "Thandi Mokoena", phoneNumber: "+27822334455", bankName: "Standard Bank", accountHolderName: "Thandi Mokoena", bankAccountNumber: "9876543210", createdAt: "2026-02-01T08:00:00" },
  { id: "emp-3", name: "Bongani Dube",   phoneNumber: "+27713445566", bankName: "FNB",           accountHolderName: "Bongani Dube",   bankAccountNumber: "4567891230", createdAt: "2025-11-10T08:00:00" },
];

// Payments shaped for AccountingView (uses createdAt + description instead of date + desc)
const ACCOUNTING_PAYMENTS = PAYMENTS.map((p) => ({
  ...p,
  createdAt: p.date,
  description: p.desc,
}));

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    SETTLED: { label: "Settled", cls: "status-settled" },
    PENDING: { label: "Pending", cls: "status-pending" },
  };
  const { label, cls } = map[status] || { label: status, cls: "" };
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

function DemoInsights() {
  return (
    <div className="agentic-panel">
      <div className="agentic-panel-header">
        <span className="agentic-panel-title">Business Insights</span>
      </div>
      <div className="agentic-scroll-list">
        {INSIGHTS.map((text, i) => (
          <div key={i} className="agentic-item insight-item">
            <div className="insight-item-num">{i + 1}</div>
            <p className="agentic-item-body">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoForecast() {
  return (
    <div className="agentic-panel">
      <div className="agentic-panel-header">
        <span className="agentic-panel-title">Cash Flow · 30 days</span>
      </div>
      <div className="agentic-scroll-list">
        {FORECAST.map((inv) => (
          <div key={inv.id} className={`agentic-item forecast-item forecast-item-${inv.likelihood}`}>
            <div className="forecast-item-top">
              <span className="forecast-item-client">{inv.client}</span>
              <span className={`forecast-badge forecast-badge-${inv.likelihood}`}>
                {inv.likelihood === "likely" ? "likely" : "at risk"}
              </span>
            </div>
            <div className="forecast-item-amount">{formatZAR(inv.amount)}</div>
            <div className="forecast-item-reason">{inv.reason}</div>
          </div>
        ))}
        <div className="agentic-item forecast-summary">
          <div className="forecast-summary-row">
            <span>Best case</span>
            <span className="forecast-summary-val">{formatZAR(BEST_CASE)}</span>
          </div>
          <div className="forecast-summary-divider" />
          <div className="forecast-summary-row">
            <span className="forecast-summary-conservative">If at-risk unpaid</span>
            <span className="forecast-summary-val">{formatZAR(CONSERVATIVE)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MorningBriefingCard() {
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/agent/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "briefing" }),
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => { if (!cancelled) { setMessage(data.result?.message || "Briefing generated."); setState("done"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      background: "linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)",
      borderRadius: 14,
      padding: "20px 24px",
      color: "#fff",
      marginBottom: 0,
    }}>
      <p style={{ margin: "0 0 12px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>
        Morning Briefing
      </p>

      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[80, 60, 72].map((w) => (
            <div key={w} style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.15)", width: `${w}%` }} />
          ))}
        </div>
      )}

      {state === "done" && (
        <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.7, whiteSpace: "pre-wrap", paddingLeft: 16, borderLeft: "3px solid rgba(255,255,255,0.35)" }}>
          {message}
        </p>
      )}

      {state === "error" && (
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.7 }}>
          Could not reach the backend. Make sure the server is running.
        </p>
      )}
    </div>
  );
}

function DemoDashboardTab() {
  return (
    <>
      <div className="metrics" style={{ marginTop: 24 }}>
        <div className="metric">
          <p className="metric-label">Total received</p>
          <p className="metric-value">{formatZAR(145230)}</p>
        </div>
        <div className="metric">
          <p className="metric-label">Settled</p>
          <p className="metric-value">47</p>
        </div>
        <div className="metric">
          <p className="metric-label">Pending</p>
          <p className="metric-value">10</p>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <MorningBriefingCard />
      </div>

      <div className="agentic-two-col">
        <DemoInsights />
        <DemoForecast />
      </div>
    </>
  );
}

function DemoOrdersTable() {
  const maskId = (id) => {
    if (!id || id.length <= 8) return id;
    return `${id.slice(0, 6)}***${id.slice(-2)}`;
  };

  const sortedByOverdue = [...PAYMENTS].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return new Date(b.date) - new Date(a.date);
  });

  return (
    <div className="payments-table-container">
      <div className="payments-table-header">
        <h2 className="merchant-name">Order History</h2>
      </div>
      <div className="payments-table-scroll">
        <div className="payments-table">
          <div className="payments-header-row">
            <span className="payments-header-cell">ID</span>
            <span className="payments-header-cell">Amount</span>
            <span className="payments-header-cell">Status</span>
            <span className="payments-header-cell">Description</span>
            <span className="payments-header-cell">Customer</span>
            <span className="payments-header-cell">Created</span>
            <span className="payments-header-cell">Actions</span>
          </div>
          {sortedByOverdue.map((p, idx) => (
            <div
              key={p.id}
              className={`payments-row ${idx % 2 === 1 ? "payments-row-alt" : ""}`}
            >
              <span className="payments-cell mono">{maskId(p.id)}</span>
              <span className="payments-cell">{formatZAR(p.amount)}</span>
              <span className="payments-cell">
                <span className={`pill ${p.status === "SETTLED" ? "pill-succeeded" : "pill-processing"}`}>
                  {p.status === "SETTLED" ? "Settled" : "Pending"}
                </span>
              </span>
              <span className="payments-cell">{p.desc}</span>
              <span className="payments-cell" style={{ lineHeight: 1.25 }}>
                {p.customer}<br />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{p.phone}</span>
              </span>
              <span className="payments-cell">{formatDateZA(p.date, true)}</span>
              <span className="payments-cell">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="ghost-button" type="button">Show QR</button>
                  {p.status === "PENDING" && (
                    <button className="ghost-button" type="button">Send Reminder</button>
                  )}
                </div>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoCheckoutTab() {
  const subtotal = DEMO_RECEIPT_ITEMS.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="checkout-section-container">
      <div className="receipt-dashboard">
        <div className="receipt-dashboard-left">
          <div className="receipt-card">
            <h2 className="merchant-name" style={{ marginBottom: 16 }}>New Job</h2>

            <div style={{ marginBottom: 16 }}>
              {DEMO_RECEIPT_ITEMS.map((item, i) => (
                <div key={i} className="receipt-item-row" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{item.name}</span>
                  <span>{formatZAR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="metric-label">Subtotal</span>
                <span className="metric-label">{formatZAR(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="metric-label">VAT (15%)</span>
                <span className="metric-label">{formatZAR(tax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <strong>Total</strong>
                <strong>{formatZAR(total)}</strong>
              </div>
            </div>

            <button className="pay-button" type="button" style={{ marginTop: 20, width: "100%" }}>
              Generate QR / Send link
            </button>
          </div>
        </div>

        <div className="receipt-dashboard-right">
          <div className="quick-add-panel">
            <h2 className="merchant-name">Quick Add</h2>
            <div className="quick-add-buttons">
              {PRESET_ITEMS.map((preset) => (
                <button key={preset.name} type="button" className="quick-add-button">
                  <div className="quick-add-button-content">
                    <span className="quick-add-button-name">{preset.name}</span>
                    <span className="quick-add-button-price">{formatZAR(preset.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <DemoOrdersTable />
      </div>
    </div>
  );
}

// Seed items shown before any real notifications exist
const SEED_ACTIVITY = [
  { id: "seed-1", type: "follow_up",        message: "Sent payment reminder to BuildRight Construction — R8,500 overdue by 1 day",  createdAt: "2026-05-07T06:02:00" },
  { id: "seed-2", type: "follow_up",        message: "Sent payment reminder to Khumalo Residence — R1,850 pending 2 days",          createdAt: "2026-05-07T06:02:00" },
  { id: "seed-3", type: "morning_briefing", message: "Morning briefing delivered to +27821236201 via WhatsApp",                      createdAt: "2026-05-07T06:00:00" },
  { id: "seed-4", type: "scan",             message: "Scanned 10 pending payments — 2 flagged for follow-up",                        createdAt: "2026-05-06T06:00:00" },
  { id: "seed-5", type: "morning_briefing", message: "Morning briefing delivered to +27821236201 via WhatsApp",                      createdAt: "2026-05-06T06:00:00" },
];

const ACTIVITY_ICON = {
  morning_briefing:  { icon: "☀️", label: "Briefing" },
  invoice_escalation:{ icon: "🚨", label: "Escalation" },
  follow_up:         { icon: "✓",  label: "Reminder sent" },
  scan:              { icon: "⚡", label: "Scan" },
};

function DemoWhatsAppTab() {
  const [connected, setConnected]   = useState(false);
  const [phone, setPhone]           = useState("+27821236201");
  const [showInput, setShowInput]   = useState(false);
  const [inputVal, setInputVal]     = useState("");
  const [activity, setActivity]     = useState(SEED_ACTIVITY);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/merchant/notifications`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setActivity(data);
      }
    } catch {
      // keep seed data
    }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const handleConnect = () => {
    const num = inputVal.trim() || "+27821236201";
    setPhone(num);
    setConnected(true);
    setShowInput(false);
    setInputVal("");
  };

  const handleDisconnect = () => {
    setConnected(false);
    setScanResult(null);
  };

  const handleFollowUpScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/agent/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow_up" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScanResult(data.result || { sent: 0, alerted: 0, skipped: 0 });
      await fetchActivity();
    } catch {
      setScanResult({ error: true });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* Connection card */}
      <div className={`bank-card${connected ? "" : " bank-card-unlinked"}`} style={{ marginBottom: 20 }}>
        <div className="bank-card-content">
          <p className="metric-label">WhatsApp Business</p>
          {connected ? (
            <>
              <p className="metric-value bank-account-value" style={{ color: "#22c55e" }}>Connected</p>
              <p className="payment-subtext" style={{ marginTop: 4 }}>{phone}</p>
            </>
          ) : (
            <p className="bank-unlinked-text">Not connected</p>
          )}
        </div>
        {connected ? (
          <button className="ghost-button" onClick={handleDisconnect} style={{ color: "#ef4444" }}>
            Disconnect
          </button>
        ) : showInput ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="receipt-input"
              style={{ width: 160, fontSize: "0.85rem" }}
              placeholder="+27821234567"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button className="pay-button" type="button" onClick={handleConnect}>Confirm</button>
          </div>
        ) : (
          <button className="pay-button" type="button" onClick={() => setShowInput(true)}>
            Connect WhatsApp
          </button>
        )}
      </div>

      {/* How it works */}
      <div style={{ background: "var(--card-bg, #f8fafc)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", color: "var(--text)" }}>How it works</h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
          {connected ? (
            <>
              <li>Payment reminders are sent <strong>automatically</strong> via WhatsApp when invoices are overdue</li>
              <li>Up to 3 reminders are sent, spaced 24 hours apart</li>
              <li>Morning briefing is delivered to {phone} every day at 08:00</li>
            </>
          ) : (
            <>
              <li>Connect your WhatsApp Business account to enable <strong>automated</strong> payment reminders</li>
              <li>Without connection, reminders appear as alerts on your dashboard</li>
              <li>Requires a Meta Business account with WhatsApp Business Platform access</li>
            </>
          )}
        </ul>
      </div>

      {/* Agent activity section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)" }}>Agent Activity</h3>
          <button
            className="ghost-button"
            type="button"
            onClick={handleFollowUpScan}
            disabled={scanning}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            {scanning ? "Scanning..." : "Run follow-up scan"}
          </button>
        </div>

        {scanResult && !scanResult.error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: "0.82rem", color: "#166534" }}>
            Scan complete — {scanResult.sent} reminder{scanResult.sent !== 1 ? "s" : ""} sent, {scanResult.alerted} escalated, {scanResult.skipped} skipped.
          </div>
        )}
        {scanResult?.error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: "0.82rem", color: "#991b1b" }}>
            Could not reach the backend. Make sure the server is running.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {activity.map((item, idx) => {
            const meta = ACTIVITY_ICON[item.type] || { icon: "•", label: item.type };
            const isNew = idx === 0 && scanResult && !scanResult.error;
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: isNew ? "#f0fdf4" : idx % 2 === 0 ? "var(--card-bg, #f8fafc)" : "transparent",
                  border: isNew ? "1px solid #86efac" : "1px solid transparent",
                  fontSize: "0.82rem",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: "0.9rem", minWidth: 18, textAlign: "center", marginTop: 1 }}>
                  {meta.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>{item.message}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                    {formatDateZA(item.createdAt, true)}
                  </p>
                </div>
                {!item.read && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", marginTop: 5, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DemoAdminTab({ onBack }) {
  const [adminTab, setAdminTab] = useState("employees");
  const [employees, setEmployees] = useState(DEMO_EMPLOYEES);

  const handleAddEmployee = (data) => {
    setEmployees((prev) => [
      { ...data, id: `emp-${Date.now()}`, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const handleDeleteEmployee = (id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <>
      {/* Header — matches real admin exactly */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className="ghost-button"
          onClick={onBack}
          style={{ fontSize: "0.85rem", padding: "6px 12px" }}
        >
          ← Back
        </button>
        <h2 className="merchant-name" style={{ margin: 0, fontSize: "1.1rem" }}>Admin Mode</h2>
        <button
          type="button"
          className="ghost-button"
          style={{ fontSize: "0.85rem", padding: "6px 12px", marginLeft: "auto" }}
        >
          Change PIN
        </button>
      </div>

      <div className="bank-card" style={{ marginBottom: 20 }}>
        <div className="bank-card-content">
          <p className="metric-label">Payout account</p>
          <p className="metric-value bank-account-value">FNB *6201</p>
        </div>
        <button className="pay-button" type="button">Update bank</button>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 24 }}>
        <button
          className={`admin-tab-button ${adminTab === "employees" ? "active" : ""}`}
          onClick={() => setAdminTab("employees")}
        >
          Pay Team
        </button>
        <button
          className={`admin-tab-button ${adminTab === "accounting" ? "active" : ""}`}
          onClick={() => setAdminTab("accounting")}
        >
          Check Books
        </button>
        <button
          className={`admin-tab-button ${adminTab === "whatsapp" ? "active" : ""}`}
          onClick={() => setAdminTab("whatsapp")}
        >
          Connect WhatsApp Business
        </button>
      </div>

      {adminTab === "employees" && (
        <EmployeesView
          employees={employees}
          employeesLoading={false}
          employeesError=""
          onAddEmployee={handleAddEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          currencySymbol="R"
        />
      )}

      {adminTab === "accounting" && (
        <AccountingView
          merchantPayments={ACCOUNTING_PAYMENTS}
          currencySymbol="R"
          loading={false}
        />
      )}

      {adminTab === "whatsapp" && (
        <DemoWhatsAppTab />
      )}
    </>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function DemoView() {
  const [tab, setTab] = useState("dashboard");

  return (
    <TabletFrame>
      <div className="dashboard-card">

        <div className="header-row">
          <div className="logo-with-title">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
            <div>
              <h1 className="merchant-name">Themba's Plumbing & Gas</h1>
            </div>
          </div>
        </div>

        {tab !== "admin" && (
          <div className="admin-tabs" style={{ marginTop: 24, marginBottom: 24 }}>
            <button
              className={`admin-tab-button ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`admin-tab-button ${tab === "checkout" ? "active" : ""}`}
              onClick={() => setTab("checkout")}
            >
              Checkout Mode
            </button>
            <button
              className="admin-tab-button"
              onClick={() => setTab("admin")}
            >
              Admin Mode
            </button>
          </div>
        )}

        {tab === "dashboard" && <DemoDashboardTab />}
        {tab === "checkout"  && <DemoCheckoutTab />}
        {tab === "admin"     && <DemoAdminTab onBack={() => setTab("dashboard")} />}

      </div>
    </TabletFrame>
  );
}
