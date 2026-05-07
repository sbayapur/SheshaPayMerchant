import { useState, useEffect } from "react";
import { getApiBase } from "../lib/api.js";
import { formatZAR } from "../lib/format.js";

const API_BASE = getApiBase();

export default function ForecastPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/forecast`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="insights-card">
        <div className="insights-header">
          <span className="insights-title">Cash Flow — Next 30 Days</span>
        </div>
        <div className="insights-skeleton" />
        <div className="insights-skeleton" style={{ width: "75%" }} />
      </div>
    );
  }

  if (!data || data.forecast.length === 0) return null;

  return (
    <div className="insights-card">
      <div className="insights-header">
        <span className="insights-title">Cash Flow — Next 30 Days</span>
      </div>

      <table className="forecast-table">
        <tbody>
          {data.forecast.map((inv) => (
            <tr key={inv.id} className="forecast-row">
              <td className="forecast-client">{inv.customerName}</td>
              <td className="forecast-amount">{formatZAR(inv.amount)}</td>
              <td>
                <span className={`forecast-badge forecast-badge-${inv.likelihood}`}>
                  {inv.likelihood === "likely" ? "likely" : "at risk"}
                </span>
              </td>
              <td className="forecast-reason">{inv.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="forecast-totals">
        <div className="forecast-scenario">
          <span className="forecast-scenario-label">Best case</span>
          <span className="forecast-scenario-value">{formatZAR(data.bestCase)}</span>
        </div>
        <div className="forecast-scenario forecast-scenario-conservative">
          <span className="forecast-scenario-label">If at-risk unpaid</span>
          <span className="forecast-scenario-value">{formatZAR(data.conservativeCase)}</span>
        </div>
      </div>
    </div>
  );
}
