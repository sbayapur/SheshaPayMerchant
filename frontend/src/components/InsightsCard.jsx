import { useState, useEffect } from "react";
import { getApiBase } from "../lib/api.js";

const API_BASE = getApiBase();

export default function InsightsCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchInsights() {
    try {
      const res = await fetch(`${API_BASE}/api/insights`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchInsights(); }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchInsights();
  }

  if (loading) {
    return (
      <div className="insights-card">
        <div className="insights-header">
          <span className="insights-title">Business Insights</span>
        </div>
        <div className="insights-skeleton" />
        <div className="insights-skeleton" style={{ width: "85%" }} />
        <div className="insights-skeleton" style={{ width: "70%" }} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="insights-card">
      <div className="insights-header">
        <span className="insights-title">Business Insights</span>
        <button
          type="button"
          className="ghost-button"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
        >
          {refreshing ? "Updating..." : "Refresh"}
        </button>
      </div>
      <ul className="insights-list">
        {data.insights.map((insight, i) => (
          <li key={i} className="insights-item">
            <span className="insights-dot" />
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
