function SuccessView({
  currencySymbol,
  currentLinkAmount,
  currentLinkOrderId,
  customerLinkPayment,
  linkedBank,
  bankDetails,
  paidAt,
  receiptPhone,
  receiptStatus,
  onReceiptPhoneChange,
  onSendReceipt,
  onGoBack,
}) {
  const formatDate = (date) => {
    if (!date) return new Date().toLocaleString();
    const d = new Date(date);
    return d.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="app landing">
      <div className="top-bar">
        <div className="brand-mark" onClick={onGoBack} style={{ cursor: "pointer" }}>
          <div className="brand-icon">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
          </div>
          <span className="brand-name">Shesha Pay</span>
        </div>
      </div>

      <div className="success-container">
        <div className="success-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#0ea073" opacity="0.1"/>
            <path
              d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 44c-11.046 0-20-8.954-20-20S20.954 12 32 12s20 8.954 20 20-8.954 20-20 20z"
              fill="#0ea073"
            />
            <path
              d="M28 32l4 4 8-8"
              stroke="#0ea073"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="success-title">Payment Successful!</h1>
        <p className="success-subtitle">Thank you for your payment. Your order has been confirmed.</p>

        <div className="checkout-shell">
          <div className="card-header">
            <div>
              <p className="card-subtitle">Order Confirmation</p>
              <p className="card-title">Order #{currentLinkOrderId}</p>
            </div>
            <div className="card-icon" aria-hidden>
              ✓
            </div>
          </div>

          <div className="card-body">
            <div className="order-details-section">
              <h3 className="order-section-title">Order Details</h3>
              <div className="order-detail-item">
                <span className="order-detail-label">Order Number</span>
                <span className="order-detail-value">{currentLinkOrderId}</span>
              </div>
              {customerLinkPayment?.note && (
                <div className="order-detail-item">
                  <span className="order-detail-label">Description</span>
                  <span className="order-detail-value">{customerLinkPayment.note}</span>
                </div>
              )}
              <div className="order-detail-item">
                <span className="order-detail-label">Date & Time</span>
                <span className="order-detail-value">{formatDate(paidAt)}</span>
              </div>
            </div>

            <hr className="divider" />

            <div className="order-details-section">
              <h3 className="order-section-title">Payment Information</h3>
              <div className="order-detail-item">
                <span className="order-detail-label">Amount Paid</span>
                <span className="order-detail-value order-amount">
                  {currencySymbol} {currentLinkAmount.toFixed(2)}
                </span>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Payment Method</span>
                <span className="order-detail-value">
                  {linkedBank || "Linked bank"}
                  {bankDetails.accountLast4 && ` •••• ${bankDetails.accountLast4}`}
                </span>
              </div>
              {bankDetails.accountName && (
                <div className="order-detail-item">
                  <span className="order-detail-label">Account</span>
                  <span className="order-detail-value">{bankDetails.accountName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pay-section">
          <form className="receipt-form" onSubmit={onSendReceipt}>
            <label htmlFor="phone" className="receipt-label">
              Get receipt via SMS
            </label>
            <input
              id="phone"
              type="tel"
              className="receipt-input"
              placeholder="e.g. 071 234 5678"
              value={receiptPhone}
              onChange={(e) => onReceiptPhoneChange(e.target.value)}
            />
            <button type="submit" className="pay-button">
              Send receipt
            </button>
            {receiptStatus && (
              <p className="receipt-status" style={{ marginTop: "12px", textAlign: "center" }}>
                {receiptStatus}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default SuccessView;
