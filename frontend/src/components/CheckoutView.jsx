import { useState, useEffect, useRef } from "react";
import { getApiBase } from "../lib/api.js";

function CheckoutView({
  items,
  customerLinkPayment,
  currentLinkAmount,
  paymentIntent,
  paymentStatus,
  bankError,
  linkedBank,
  bankDetails,
  onConnectBank,
  onConfirmPayment,
  onCancel,
  onSettleByOrderId,
  onBankLinked,
  currencySymbol,
  tax,
  subtotal,
  total,
}) {
  const [showBankAuthModal, setShowBankAuthModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showBankLogin, setShowBankLogin] = useState(false);
  const [bankCredentials, setBankCredentials] = useState({
    username: "",
    password: "",
  });
  const [savedPhone, setSavedPhone] = useState(null);
  const phoneContentRef = useRef(null);

  // Check for saved phone number on mount (try-catch for private browsing)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sheshaPay_savedPhone');
      if (saved) setSavedPhone(saved);
    } catch {
      // localStorage unavailable (private browsing) — continue without saved phone
    }
  }, []);

  // Function to mask phone number: show first 3 digits, dots, last 4 digits
  const maskPhoneNumber = (phone) => {
    if (!phone || phone.length < 7) return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    const first3 = digits.substring(0, 3);
    const last4 = digits.substring(digits.length - 4);
    return `${first3}••••${last4}`;
  };

  // Scroll to top when confirm panel appears
  useEffect(() => {
    if (paymentStatus === "confirm") {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 150);
    }
  }, [paymentStatus]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const banks = [
    "First National Bank (FNB)",
    "Standard Bank",
    "Absa",
    "Nedbank",
    "Capitec Bank",
    "Investec",
  ];

  const handlePayFromBank = () => {
    setShowBankAuthModal(true);
    setSelectedBank("");
    setIsAuthenticating(false);
    setShowBankLogin(false);
    setBankCredentials({ username: "", password: "" });
  };

  const handleQuickPay = async () => {
    // Quick pay: skip bank selection and directly authenticate
    // Use a default bank for quick pay
    const defaultBank = "First National Bank (FNB)";
    setSelectedBank(defaultBank);
    setIsAuthenticating(true);
    
    // Simulate quick authentication (faster than normal flow)
    setTimeout(() => {
      const fakeBankDetails = {
        accountName: "Demo Account",
        accountType: "Checking",
        accountLast4: Math.floor(1000 + Math.random() * 9000).toString(),
      };

      if (onBankLinked) {
        onBankLinked(defaultBank, fakeBankDetails);
      }

      // Authorise the payment - use orderId from customerLinkPayment or paymentIntent
      // The authorization endpoint can work with just orderId if paymentIntentId is not available
      const orderId = customerLinkPayment?.orderId || paymentIntent?.id;
      const paymentIntentId = paymentIntent?.id || orderId; // Fallback to orderId if paymentIntent.id not available
      
      if (orderId) {
        const apiBase = getApiBase();
        fetch(`${apiBase}/api/demo/authorize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderId: orderId,
            paymentIntentId: paymentIntentId 
          }),
        }).catch((err) => {
          console.error("Failed to authorise payment", err);
        });
      }

      setIsAuthenticating(false);
    }, 1000); // Faster than normal 2 second delay
  };

  const handleBankSelected = () => {
    if (!selectedBank) {
      return;
    }
    // Show bank login screen instead of redirecting
    setShowBankLogin(true);
  };

  const handleBankLogin = async () => {
    // Accept any username and password (including empty)
    setIsAuthenticating(true);
    
    // Simulate bank authentication delay
    setTimeout(() => {
      // Generate fake bank details based on selected bank
      const fakeBankDetails = {
        accountName: "Demo Account",
        accountType: "Checking",
        accountLast4: Math.floor(1000 + Math.random() * 9000).toString(), // Random 4 digits
      };

      // Call the callback to update bank details in parent component
      if (onBankLinked) {
        onBankLinked(selectedBank, fakeBankDetails);
      }

      // Authorise the payment (after bank auth) using demo authorize endpoint
      const orderId = customerLinkPayment?.orderId || paymentIntent?.id;
      if (orderId && paymentIntent?.id) {
        const apiBase = getApiBase();
        fetch(`${apiBase}/api/demo/authorize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderId: orderId,
            paymentIntentId: paymentIntent.id 
          }),
        }).catch((err) => {
          console.error("Failed to authorise payment", err);
        });
      }

      // Close modal and show confirm panel
      setShowBankAuthModal(false);
      setIsAuthenticating(false);
      setShowBankLogin(false);
      setBankCredentials({ username: "", password: "" });
    }, 2000);
  };

  const handleCloseBankAuthModal = () => {
    if (!isAuthenticating) {
      setShowBankAuthModal(false);
      setSelectedBank("");
      setIsAuthenticating(false);
      setShowBankLogin(false);
      setBankCredentials({ username: "", password: "" });
    }
  };
  const transactionDate = new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  // Use items array if available, otherwise fall back to note or regular items
  const displayItems = customerLinkPayment
    ? (customerLinkPayment.items && customerLinkPayment.items.length > 0
        ? customerLinkPayment.items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            amount: (Number(item.price) || 0) * (item.quantity || 1),
          }))
        : [
            {
              name: customerLinkPayment.note || "Payment",
              amount: customerLinkPayment.amount || currentLinkAmount,
              quantity: 1,
            },
          ])
    : items;

  return (
    <div className="app landing">
      <div className="top-bar">
        <div className="brand-mark">
          <div className="brand-icon">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="brand-logo" />
          </div>
          <span className="brand-name">Shesha Pay</span>
        </div>
        <div className="secure-badge">Secure Payment</div>
      </div>

      <div className="hero">
        <h1>Complete Your Payment</h1>
        <p>Review your receipt and complete payment</p>
      </div>

      <div className="checkout-shell">
        <div className="card-header">
          <div>
            <p className="card-subtitle">Payment to</p>
            <p className="card-title">Sunrise Salon</p>
          </div>
          <div className="card-icon" aria-hidden>
            ☀️
          </div>
        </div>

        <div className="card-body">
          <div className="reference-row">
            <div>
              <p className="label">Reference</p>
              <p className="value">
                {customerLinkPayment?.orderId || paymentIntent?.id || "Pending"}
              </p>
              {customerLinkPayment?.isoRef && (
                <p className="iso-ref-text">{customerLinkPayment.isoRef}</p>
              )}
            </div>
            <div className="align-end">
              <p className="label">Date</p>
              <p className="value">{transactionDate}</p>
            </div>
          </div>

          <hr className="divider" />

          {displayItems.map((item, idx) => (
            <div className="line-item" key={`${item.name}-${idx}`}>
              <div>
                <p className="item-name">{item.name || "Item"}</p>
                <p className="item-qty">Qty: {item.quantity || 1}</p>
              </div>
              <p className="item-amount">
                {currencySymbol}{" "}
                {(
                  (Number(item.price || item.amount || 0) || 0) *
                  (item.quantity || 1)
                ).toFixed(2)}
              </p>
            </div>
          ))}

          <hr className="divider" />

          <div className="totals">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>
                {currencySymbol} {subtotal.toFixed(2)}
              </span>
            </div>
            <div className="totals-row">
              <span>Tax</span>
              <span>
                {currencySymbol} {tax.toFixed(2)}
              </span>
            </div>
            <div className="totals-row total">
              <strong>Total Due</strong>
              <strong>
                {currencySymbol} {total.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="pay-section">
        {savedPhone && paymentStatus === "idle" ? (
          <>
            <button
              className="pay-button"
              onClick={handleQuickPay}
              disabled={
                paymentStatus === "pending" ||
                paymentStatus === "success" ||
                paymentStatus === "confirm" ||
                paymentStatus === "awaiting_settlement" ||
                isAuthenticating
              }
            >
              <div className="pay-button-content">
                <div className="pay-icon">💳</div>
                <div className="pay-label">Pay from {maskPhoneNumber(savedPhone)}</div>
              </div>
              <div className="pay-arrow">›</div>
            </button>
            <button
              className="secondary-button"
              onClick={handlePayFromBank}
              disabled={
                paymentStatus === "pending" ||
                paymentStatus === "success" ||
                paymentStatus === "confirm" ||
                paymentStatus === "awaiting_settlement" ||
                isAuthenticating
              }
              style={{ marginTop: "12px", width: "100%" }}
            >
              Use different payment method
            </button>
            <p className="demo-note">
              One tap to approve payment
            </p>
          </>
        ) : (
          <>
            <button
              className="pay-button"
              onClick={handlePayFromBank}
              disabled={
                paymentStatus === "pending" ||
                paymentStatus === "success" ||
                paymentStatus === "confirm" ||
                paymentStatus === "awaiting_settlement"
              }
            >
              <div className="pay-button-content">
                <div className="pay-icon">🏦</div>
                <div className="pay-label">Pay by bank</div>
              </div>
              <div className="pay-arrow">›</div>
            </button>
          </>
        )}

        {paymentStatus === "confirm" && (
          <div className="confirm-panel">
            <p className="processing-meta">Review and confirm payment from:</p>
            <ul className="confirm-details">
              <li>
                Bank: <strong>{linkedBank || "Linked bank"}</strong>
              </li>
              <li>
                Account:{" "}
                <strong>{bankDetails.accountName || "Connected account"}</strong>
              </li>
              <li>
                Type: <strong>{bankDetails.accountType || "Bank account"}</strong>
              </li>
              <li>
                Ending in: <strong>{bankDetails.accountLast4 || "****"}</strong>
              </li>
            </ul>
            <div className="processing-actions">
              <button className="pay-button" onClick={onConfirmPayment}>
                Confirm payment
              </button>
              <button className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {paymentStatus === "pending" && (
          <p className="processing">Pending payment...</p>
        )}
        {paymentStatus === "awaiting_settlement" && (
          <p className="processing">Awaiting settlement...</p>
        )}
        {paymentStatus === "success" && (
          <p className="success">Payment received!</p>
        )}
        {bankError && (
          <p className="error">{bankError}</p>
        )}
        {paymentStatus === "error" && !bankError && (
          <p className="error">Something went wrong. Please try again.</p>
        )}
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
      <p className="security-note">
        Payments are processed securely via PayShap instant bank transfer.
      </p>

      {/* Bank Auth Modal */}
      {showBankAuthModal && (
        <div className="bank-auth-modal-overlay" onClick={handleCloseBankAuthModal}>
          <div className="bank-auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bank-auth-modal-header">
              <h2 className="bank-auth-modal-title">
                {isAuthenticating 
                  ? `Logging in to ${selectedBank}…` 
                  : showBankLogin 
                    ? `Login to ${selectedBank}` 
                    : "Select your bank"}
              </h2>
              {!isAuthenticating && (
                <button
                  className="bank-auth-modal-close"
                  onClick={handleCloseBankAuthModal}
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
            <div className="bank-auth-modal-content">
              {isAuthenticating ? (
                <div className="bank-auth-redirecting">
                  <div className="bank-auth-spinner">
                    <div className="spinner"></div>
                  </div>
                  <p className="bank-auth-redirect-message">
                    Authenticating with <strong>{selectedBank}</strong>
                  </p>
                  <p className="bank-auth-instruction">
                    Please wait while we verify your credentials...
                  </p>
                </div>
              ) : showBankLogin ? (
                <>
                  <div className="bank-auth-step">
                    <label className="bank-auth-label" htmlFor="bank-username">
                      Username
                    </label>
                    <input
                      id="bank-username"
                      type="text"
                      className="bank-auth-select"
                      placeholder="Enter your username"
                      value={bankCredentials.username}
                      onChange={(e) => setBankCredentials({ ...bankCredentials, username: e.target.value })}
                      disabled={isAuthenticating}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div className="bank-auth-step">
                    <label className="bank-auth-label" htmlFor="bank-password">
                      Password
                    </label>
                    <input
                      id="bank-password"
                      type="password"
                      className="bank-auth-select"
                      placeholder="Enter your password"
                      value={bankCredentials.password}
                      onChange={(e) => setBankCredentials({ ...bankCredentials, password: e.target.value })}
                      disabled={isAuthenticating}
                      autoComplete="current-password"
                    />
                  </div>
                  <button
                    className="bank-auth-button"
                    onClick={handleBankLogin}
                    disabled={isAuthenticating}
                  >
                    Login
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setShowBankLogin(false);
                      setBankCredentials({ username: "", password: "" });
                    }}
                    style={{ marginTop: "8px", width: "100%" }}
                    disabled={isAuthenticating}
                  >
                    Back to bank selection
                  </button>
                </>
              ) : (
                <>
                  <div className="bank-auth-step">
                    <label className="bank-auth-label" htmlFor="bank-select">
                      Choose bank
                    </label>
                    <select
                      id="bank-select"
                      className="bank-auth-select"
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      disabled={isAuthenticating}
                    >
                      <option value="">Select your bank</option>
                      {banks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="bank-auth-button"
                    onClick={handleBankSelected}
                    disabled={!selectedBank || isAuthenticating}
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckoutView;
