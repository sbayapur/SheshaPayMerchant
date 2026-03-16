import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function LogsView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [iso20022Data, setIso20022Data] = useState(null);
  const [loadingIso, setLoadingIso] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/demo/logs`);
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = await res.json();
      const eventsArray = Array.isArray(data) ? data : [];
      // Sort by timestamp (most recent first)
      const sortedEvents = eventsArray.sort((a, b) => {
        const timestampA = new Date(a.timestamp || 0).getTime();
        const timestampB = new Date(b.timestamp || 0).getTime();
        return timestampB - timestampA; // Descending order (newest first)
      });
      setEvents(sortedEvents);
    } catch (err) {
      console.error("Failed to load webhook events", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // Refresh every 2 seconds
    const interval = setInterval(fetchEvents, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event);
    if (event.paymentIntentId) {
      setLoadingIso(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/demo/logs/payment-intent/${event.paymentIntentId}`
        );
        if (res.ok) {
          const data = await res.json();
          setIso20022Data(data);
        } else {
          setIso20022Data(null);
        }
      } catch (err) {
        console.error("Failed to load ISO 20022 data", err);
        setIso20022Data(null);
      } finally {
        setLoadingIso(false);
      }
    } else {
      setIso20022Data(null);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const formatEventType = (type) => {
    // Map ISO 20022 event types to user-friendly names
    const eventTypeMap = {
      payment_intent_created: "Payment Initiated (PENDING)",
      authorisation_webhook: "Payment Authorised (AUTHORISED)",
      settlement_webhook: "Payment Settled (SETTLED)",
      payment_completed: "Payment Completed (COMPLETED)",
    };
    
    return eventTypeMap[type] || type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="app">
      <div className="dashboard-card">
        <div className="header-row">
          <div>
            <h1 className="merchant-name">Demo Webhook Logs</h1>
            <p className="merchant-subtitle">
              Recent webhook events and ISO 20022 payloads
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => (window.location.href = "/")}
          >
            Back to dashboard
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
          {/* Events List */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 className="merchant-name" style={{ margin: 0, fontSize: "1.1rem" }}>
                Webhook Events ({events.length})
              </h2>
              <button className="ghost-button" onClick={fetchEvents} disabled={loading}>
                Refresh
              </button>
            </div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                overflow: "hidden",
                background: "white",
                maxHeight: "600px",
                overflowY: "auto",
              }}
            >
              {loading && (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                  Loading events...
                </div>
              )}
              {!loading && events.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                  No webhook events yet. Create a payment to see events.
                </div>
              )}
              {!loading &&
                events.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                      background:
                        selectedEvent?.id === event.id ? "#f0f9ff" : "white",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedEvent?.id !== event.id) {
                        e.currentTarget.style.background = "#f8fafc";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedEvent?.id !== event.id) {
                        e.currentTarget.style.background = "white";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--text)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {formatEventType(event.type)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      Order: {event.orderId || event.paymentIntentId || "N/A"}
                    </div>
                    {event.amount && (
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "4px" }}>
                        Amount: {event.currency || "ZAR"} {event.amount.toFixed(2)}
                      </div>
                    )}
                    {event.provider && (
                      <div style={{ fontSize: "0.75rem", color: "var(--green)", marginTop: "4px", fontWeight: 600 }}>
                        Provider: {event.provider}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* ISO 20022 Details */}
          <div>
            <h2 className="merchant-name" style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>
              ISO 20022 & Settlement Payload
            </h2>
            {!selectedEvent && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "white",
                }}
              >
                Select an event to view ISO 20022 XML and settlement payload
              </div>
            )}
            {selectedEvent && loadingIso && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "white",
                }}
              >
                Loading ISO 20022 data...
              </div>
            )}
            {selectedEvent && !loadingIso && iso20022Data && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Settlement Webhook Payload */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Settlement Webhook Payload
                    </div>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <pre
                      style={{
                        background: "#f8fafc",
                        color: "#1f2937",
                        padding: "16px",
                        borderRadius: "8px",
                        overflow: "auto",
                        fontSize: "0.8rem",
                        lineHeight: "1.6",
                        margin: 0,
                        fontFamily: "'Courier New', monospace",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {JSON.stringify({
                        type: selectedEvent.type,
                        orderId: selectedEvent.orderId || selectedEvent.paymentIntentId,
                        status: selectedEvent.status,
                        provider: selectedEvent.provider,
                        amount: selectedEvent.amount,
                        currency: selectedEvent.currency,
                        timestamp: selectedEvent.timestamp,
                      }, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* ISO 20022 XML */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "8px" }}>
                      Payment Intent: {iso20022Data.id}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      Status: <strong>{iso20022Data.status}</strong> • Amount:{" "}
                      <strong>
                        {iso20022Data.currency} {iso20022Data.amount.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      ISO 20022 XML Payload
                    </div>
                    <pre
                      style={{
                        background: "#1e293b",
                        color: "#e2e8f0",
                        padding: "16px",
                        borderRadius: "8px",
                        overflow: "auto",
                        fontSize: "0.8rem",
                        lineHeight: "1.6",
                        margin: 0,
                        fontFamily: "'Courier New', monospace",
                      }}
                    >
                      {iso20022Data.iso20022_meta || "No ISO 20022 metadata available"}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            {selectedEvent && !loadingIso && !iso20022Data && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "white",
                }}
              >
                No ISO 20022 metadata found for this event
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogsView;
