function PaymentsTable({
  payments,
  loading,
  error,
  onRefresh,
  currencySymbol,
  statusLabel,
  statusClass,
  onViewQr,
  onSettlePayment,
  onSendInvoice,
  invoicesMap = {},
  whatsappConnected = false,
  onSendReminder,
}) {
  const maskId = (id) => {
    if (!id) return "N/A";
    if (id.length <= 8) return id;
    return `${id.slice(0, 6)}***${id.slice(-2)}`;
  };

  // Get invoice linked to a payment (by id or orderId)
  const getInvoice = (payment) => {
    return invoicesMap[payment.id] || invoicesMap[payment.orderId] || null;
  };

  const getCustomerLabel = (payment) => {
    const invoice = getInvoice(payment);
    if (invoice?.customerPhone) {
      return invoice.customerName
        ? `${invoice.customerName} · ${invoice.customerPhone}`
        : invoice.customerPhone;
    }
    if (payment.savedCustomerName || payment.savedCustomerPhone) {
      return [payment.savedCustomerName, payment.savedCustomerPhone].filter(Boolean).join(" · ");
    }
    return "—";
  };

  // Determine effective status label (includes OVERDUE from invoice)
  const getEffectiveStatusLabel = (payment) => {
    const invoice = getInvoice(payment);
    if (invoice && invoice.status === "OVERDUE") return "Overdue";
    return statusLabel(payment.status);
  };

  // Determine effective status class (includes OVERDUE styling)
  const getEffectiveStatusClass = (payment) => {
    const invoice = getInvoice(payment);
    if (invoice && invoice.status === "OVERDUE") return "pill-overdue";
    return statusClass(payment.status);
  };

  return (
    <div className="payments-table-container">
      <div className="payments-table-header">
        <h2 className="merchant-name">Order History</h2>
        {onRefresh && (
          <button 
            className="ghost-button" 
            type="button" 
            onClick={onRefresh}
            disabled={loading}
            style={{ fontSize: "0.85rem" }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        )}
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
          {loading && (
            <div className="payments-row">
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
              <span className="skeleton">&nbsp;</span>
            </div>
          )}
          {error && !loading && (
            <div className="payments-row payments-error-row">
              <span className="error">{error}</span>
            </div>
          )}
          {!loading && !error && payments.length === 0 && (
            <div className="payments-row payments-empty-row">
              <span className="payment-subtext">No payment intents yet. Create one from checkout.</span>
            </div>
          )}
          {payments.map((p, idx) => {
            const invoice = getInvoice(p);
            const isOverdue = invoice && invoice.status === "OVERDUE";
            const hasInvoice = !!invoice;
            const isNotSettled = p.status !== "SETTLED" && p.status !== "succeeded";
            const persistedOnly = Boolean(p.fromPersistedOnly);

            return (
              <div key={p.id}>
                <div className={`payments-row ${isOverdue ? "payments-row-overdue" : idx % 2 === 1 ? "payments-row-alt" : ""}`}>
                  <span className="payments-cell mono">{maskId(p.id)}</span>
                  <span className="payments-cell">
                    {currencySymbol} {p.amount.toFixed(2)}
                  </span>
                  <span className="payments-cell">
                    <span className={`pill ${getEffectiveStatusClass(p)}`}>
                      {getEffectiveStatusLabel(p)}
                    </span>
                    {hasInvoice && invoice.remindersSent > 0 && (
                      <span style={{
                        display: "inline-block",
                        marginLeft: "6px",
                        fontSize: "0.68rem",
                        color: isOverdue ? "#991b1b" : "var(--muted)",
                        fontWeight: 500,
                      }}>
                        {invoice.remindersSent}/{invoice.maxReminders} sent
                      </span>
                    )}
                  </span>
                  <span className="payments-cell">{p.description || "N/A"}</span>
                  <span
                    className="payments-cell"
                    style={{ textAlign: "center", lineHeight: 1.25 }}
                  >
                    {getCustomerLabel(p)}
                  </span>
                  <span className="payments-cell">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A"}
                  </span>
                  <span className="payments-cell">
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onViewQr(p)}
                        disabled={!p.id || persistedOnly}
                      >
                        Show QR
                      </button>
                      {onSendInvoice && (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => onSendInvoice(p)}
                          disabled={!p.id || persistedOnly}
                        >
                          Send Invoice
                        </button>
                      )}
                      {onSendReminder && isNotSettled && (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => onSendReminder(p)}
                          disabled={!p.id || persistedOnly}
                          style={isOverdue ? {
                            color: "#dc2626",
                            borderColor: "#fecaca",
                            fontWeight: 600,
                          } : {}}
                        >
                          Send Reminder
                        </button>
                      )}
                    </div>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PaymentsTable;
