import { useState, useEffect } from "react";
import { getApiBase } from "../lib/api.js";

const API_BASE = getApiBase();

const DEMO_BRIEFING = `Good morning 👋

No payments settled yet today. This month you've received R11,450 across 4 jobs.

Chase today:
• BuildRight Construction — R8,500 (1 day overdue)
• Khumalo Residence — R1,850 due in 2 days

Acorn Properties has booked Craig 4 times this month — worth asking about a monthly maintenance contract. Could be R8,000 guaranteed every month.`;

export default function MorningBriefingCard({ isDemoMode = false }) {
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isDemoMode) {
      const t = setTimeout(() => { setMessage(DEMO_BRIEFING); setState("done"); }, 1400);
      return () => clearTimeout(t);
    }
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
  }, [isDemoMode]);

  return (
    <div style={{
      background: "linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)",
      borderRadius: 14,
      padding: "20px 24px",
      color: "#fff",
      margin: "16px 0",
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
          Briefing unavailable right now.
        </p>
      )}
    </div>
  );
}
