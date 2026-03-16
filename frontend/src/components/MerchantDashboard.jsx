import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ReceiptItemsCard from "./ReceiptItemsCard.jsx";
import PaymentsTable from "./PaymentsTable.jsx";
import EmployeesView from "./EmployeesView.jsx";
import AccountingView from "./AccountingView.jsx";

function MerchantDashboard({
  currencySymbol,
  merchantPayments,
  paymentsLoading,
  paymentsError,
  merchantBank,
  onLinkBank,
  items,
  newItem,
  presetItems,
  onNewItemChange,
  onAddItem,
  onPresetAdd,
  onItemChange,
  onRemoveItem,
  receiptTotal,
  receiptSubtotal,
  receiptTax,
  totalVolume,
  onGenerateNewPayment,
  onAddPayment,
  statusLabel,
  statusClass,
  onLoadDemoPayments,
  onRefreshPayments,
  onGenerateQr,
  onSettlePayment,
  qrPreview,
  onCloseQr,
  onCopyCheckoutLink,
  navigateView,
  employees,
  employeesLoading,
  employeesError,
  onAddEmployee,
  onDeleteEmployee,
}) {
  const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:4000";
  const [currentMode, setCurrentMode] = useState("dashboard"); // "dashboard", "checkout", or "admin"
  const [adminTab, setAdminTab] = useState("employees"); // "employees" or "accounting"
  const [showBankAuthModal, setShowBankAuthModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPaymentForInvoice, setSelectedPaymentForInvoice] = useState(null);
  const [invoicePhoneNumber, setInvoicePhoneNumber] = useState("");
  const [showCreateInvoiceOptions, setShowCreateInvoiceOptions] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [timePeriod, setTimePeriod] = useState("all"); // "all", "1day", "1month", "year"

  // Ref to find tablet-frame for portal rendering
  const appRef = useRef(null);
  const [tabletFrameEl, setTabletFrameEl] = useState(null);
  useEffect(() => {
    if (appRef.current) {
      const frame = appRef.current.closest('.tablet-frame');
      if (frame) setTabletFrameEl(frame);
    }
  }, []);

  // ISO 20022 transaction log modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logPayment, setLogPayment] = useState(null);
  const [logEvents, setLogEvents] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  // Invoice & Reminder state
  const [invoicesMap, setInvoicesMap] = useState({}); // orderId/paymentIntentId -> invoice
  const [customerPhoneInput, setCustomerPhoneInput] = useState("");

  // WhatsApp Business connection state
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false });
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);

  const ISO_STATES = [
    { key: "PENDING", type: "payment_intent_created", label: "Initiated", iso: "ACSP" },
    { key: "AUTHORISED", type: "authorisation_webhook", label: "Authorised", iso: "ACCC" },
    { key: "SETTLED", type: "settlement_webhook", label: "Settled", iso: "ACSC" },
    { key: "COMPLETED", type: "payment_completed", label: "Completed", iso: "ACSP/COMP" },
  ];

  // ── Fetch WhatsApp status and invoices on mount ──
  const fetchWhatsappStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp status", err);
    }
  }, [API_BASE]);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/invoices`);
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach((inv) => {
          if (inv.paymentIntentId) map[inv.paymentIntentId] = inv;
          if (inv.orderId) map[inv.orderId] = inv;
        });
        setInvoicesMap(map);
      }
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchWhatsappStatus();
    fetchInvoices();
  }, [fetchWhatsappStatus, fetchInvoices]);

  // ── WhatsApp Business connect/disconnect ──
  const handleConnectWhatsApp = () => {
    const metaAppId = import.meta.env.VITE_META_APP_ID || "";
    const metaConfigId = import.meta.env.VITE_META_CONFIG_ID || "";

    if (!metaAppId) {
      // Demo mode: simulate connection without Meta SDK
      setWhatsappConnecting(true);
      setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/whatsapp/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: "demo-code",
              wabaId: "demo-waba-id",
              phoneNumberId: "demo-phone-id",
            }),
          });
          if (res.ok) {
            await fetchWhatsappStatus();
          }
        } catch (err) {
          console.error("Failed to connect WhatsApp (demo)", err);
        } finally {
          setWhatsappConnecting(false);
        }
      }, 1500);
      return;
    }

    // Load Facebook JS SDK if not already loaded
    const launchEmbeddedSignup = () => {
      setWhatsappConnecting(true);
      window.FB.login(
        (response) => {
          if (response.authResponse) {
            const code = response.authResponse.code;
            // Exchange the code on the backend
            fetch(`${API_BASE}/api/whatsapp/connect`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.ok) {
                  fetchWhatsappStatus();
                }
              })
              .catch((err) => console.error("WhatsApp connect error:", err))
              .finally(() => setWhatsappConnecting(false));
          } else {
            setWhatsappConnecting(false);
          }
        },
        {
          config_id: metaConfigId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: "3",
          },
        }
      );
    };

    if (window.FB) {
      launchEmbeddedSignup();
    } else {
      // Lazy load the Facebook JS SDK
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: metaAppId,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v21.0",
        });
        launchEmbeddedSignup();
      };
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/disconnect`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWhatsappStatus({ connected: false });
      }
    } catch (err) {
      console.error("Failed to disconnect WhatsApp", err);
    }
  };

  // ── Send Reminder handler ──
  const handleSendReminder = async (payment) => {
    const invoice = invoicesMap[payment.id] || invoicesMap[payment.orderId];

    if (invoice && whatsappStatus.connected) {
      // Automated: call the backend to send via WhatsApp Cloud API
      try {
        const res = await fetch(`${API_BASE}/api/invoices/${invoice.id}/remind`, {
          method: "POST",
        });
        if (res.ok) {
          await fetchInvoices(); // Refresh to update reminder count
        }
      } catch (err) {
        console.error("Failed to send reminder", err);
      }
    } else {
      // Manual fallback: open wa.me link
      const phone = invoice?.customerPhone || "";
      const phoneDigits = phone.replace(/\D/g, "");
      const whatsappNumber = phoneDigits.startsWith("27") ? phoneDigits : `27${phoneDigits}`;
      const orderId = payment.id;
      const isoRef = `SHESHA-${orderId}`;
      const baseUrl = window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://demo.shesha";
      const path = window.location.origin.includes("localhost") ? "/customer" : "/pay";
      const checkoutLink = `${baseUrl}${path}?order=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(payment.amount)}&note=${encodeURIComponent(payment.note || payment.description || "")}&iso_ref=${encodeURIComponent(isoRef)}`;
      const message = encodeURIComponent(
        `Hi! This is a friendly reminder that you have an unpaid invoice of R${payment.amount?.toFixed(2) || "0.00"} from Sunrise Salon.\n\nPlease pay here: ${checkoutLink}`
      );
      window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleViewLog = async (payment) => {
    setLogPayment(payment);
    setShowLogModal(true);
    setLogLoading(true);
    setLogEvents([]);
    try {
      const res = await fetch(`${API_BASE}/api/demo/logs/payment-intent/${payment.id}/events`);
      if (res.ok) {
        const data = await res.json();
        setLogEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to load transaction log", err);
    } finally {
      setLogLoading(false);
    }
  };

  const banks = [
    "First National Bank (FNB)",
    "Standard Bank",
    "Absa",
    "Nedbank",
    "Capitec Bank",
    "Investec",
  ];

  const handleLinkBankClick = () => {
    setShowBankAuthModal(true);
    setSelectedBank("");
    setIsAuthenticating(false);
  };

  const handleAuthenticate = async () => {
    if (!selectedBank) {
      return;
    }

    setIsAuthenticating(true);
    
    // Simulate bank authentication delay
    setTimeout(() => {
      // Generate fake bank details based on selected bank
      const fakeBankDetails = {
        accountName: "Demo Account",
        accountType: "Checking",
        accountLast4: Math.floor(1000 + Math.random() * 9000).toString(),
      };

      // Call the callback to update bank details
      if (onLinkBank) {
        onLinkBank(selectedBank, fakeBankDetails);
      }

      // Close modal
      setShowBankAuthModal(false);
      setIsAuthenticating(false);
    }, 4000);
  };

  const handleCloseBankAuthModal = () => {
    if (!isAuthenticating) {
      setShowBankAuthModal(false);
      setSelectedBank("");
      setIsAuthenticating(false);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    setPinError("");
    
    // For demo: accept any PIN (or you can set a specific PIN like "1234")
    if (pinValue.length >= 4) {
      setPinVerified(true);
      setShowPinModal(false);
      setCurrentMode("admin");
      setPinValue("");
    } else {
      setPinError("PIN must be at least 4 digits");
    }
  };

  const handleClosePinModal = () => {
    setShowPinModal(false);
    setPinValue("");
    setPinError("");
  };

  const handleSendInvoice = (payment) => {
    if (!payment?.id) {
      return;
    }
    setSelectedPaymentForInvoice(payment);
    setShowInvoiceModal(true);
    setInvoicePhoneNumber("");
  };

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedPaymentForInvoice(null);
    setInvoicePhoneNumber("");
  };

  const handleCopyCheckoutLink = async () => {
    if (!selectedPaymentForInvoice || !onCopyCheckoutLink) {
      return;
    }
    await onCopyCheckoutLink(selectedPaymentForInvoice);
    handleCloseInvoiceModal();
  };

  const handleSendViaWhatsApp = () => {
    if (!selectedPaymentForInvoice || !invoicePhoneNumber.trim()) {
      return;
    }
    
    // Generate checkout link
    const orderId = selectedPaymentForInvoice.id;
    const isoRef = `SHESHA-${orderId}`;
    // Include items array in URL if available
    const itemsParam = selectedPaymentForInvoice.items ? `&items=${encodeURIComponent(JSON.stringify(selectedPaymentForInvoice.items))}` : '';
    const baseUrl = window.location.origin.includes('localhost') 
      ? window.location.origin 
      : 'https://demo.shesha';
    const path = window.location.origin.includes('localhost') ? '/customer' : '/pay';
    const checkoutLink = `${baseUrl}${path}?order=${encodeURIComponent(
      orderId
    )}&amount=${encodeURIComponent(selectedPaymentForInvoice.amount)}&note=${encodeURIComponent(
      selectedPaymentForInvoice.note || ""
    )}&iso_ref=${encodeURIComponent(isoRef)}${itemsParam}`;
    
    // Format phone number (remove any non-digits, ensure it starts with country code)
    const phoneNumber = invoicePhoneNumber.trim().replace(/\D/g, '');
    const whatsappNumber = phoneNumber.startsWith('27') ? phoneNumber : `27${phoneNumber}`;
    
    // Create WhatsApp link
    const whatsappMessage = encodeURIComponent(
      `Hi! Please pay R${selectedPaymentForInvoice.amount?.toFixed(2) || "0.00"} for ${selectedPaymentForInvoice.description || "your order"}.\n\nPay here: ${checkoutLink}`
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    handleCloseInvoiceModal();
  };

  const handleCreateInvoice = (event) => {
    event.preventDefault();
    if (receiptTotal <= 0 || items.length === 0) {
      return;
    }

    // Prevent creating multiple invoices at once
    if (pendingPayment || showCreateInvoiceOptions) {
      return;
    }

    // Create payment object (same logic as handleGenerateNewPayment)
    const orderId = `ORD-${Date.now()}`;
    const note = items.map(item => 
      `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
    ).join(' + ');

    const payment = {
      id: orderId,
      orderId: orderId, // Store orderId for matching with backend payment intents
      amount: receiptTotal,
      currency: "ZAR",
      status: "PENDING",
      bank: merchantBank.bank === "Not linked" ? "Unlinked" : merchantBank.bank,
      note: note,
      description: note,
      items: items.map(item => ({ // Store items array separately for detailed display
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
      })),
    };

    // Store payment and show options modal
    setPendingPayment(payment);
    setShowCreateInvoiceOptions(true);
  };

  const handleShowQr = async () => {
    if (!pendingPayment) return;
    
    // Store payment reference before clearing state
    const paymentToAdd = { ...pendingPayment };
    const phone = customerPhoneInput.trim();
    
    // Create payment intent on backend so status can be tracked
    let paymentIntentId = null;
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const piRes = await fetch(`${apiBase}/api/payment-intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentToAdd.amount,
          currency: paymentToAdd.currency || "ZAR",
          description: paymentToAdd.note || paymentToAdd.description || "",
          orderId: paymentToAdd.id, // Use the same orderId
        }),
      });
      if (piRes.ok) {
        const piData = await piRes.json();
        paymentIntentId = piData.id;
      }
    } catch (err) {
      console.warn("Failed to create payment intent on backend:", err);
      // Continue anyway - payment will be added locally
    }

    // If customer phone is provided, create an invoice (with reminder timer)
    if (phone) {
      const orderId = paymentToAdd.id;
      const isoRef = `SHESHA-${orderId}`;
      const baseUrl = window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://demo.shesha";
      const pathStr = window.location.origin.includes("localhost") ? "/customer" : "/pay";
      const itemsParam = paymentToAdd.items
        ? `&items=${encodeURIComponent(JSON.stringify(paymentToAdd.items))}`
        : "";
      const checkoutLink = `${baseUrl}${pathStr}?order=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(paymentToAdd.amount)}&note=${encodeURIComponent(paymentToAdd.note || "")}&iso_ref=${encodeURIComponent(isoRef)}${itemsParam}`;

      try {
        const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:4000";
        await fetch(`${apiBase}/api/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            orderId: paymentToAdd.id,
            customerPhone: phone,
            amount: paymentToAdd.amount,
            subtotal: paymentToAdd.amount / 1.15,
            taxAmount: paymentToAdd.amount - paymentToAdd.amount / 1.15,
            currency: paymentToAdd.currency || "ZAR",
            items: paymentToAdd.items || [],
            description: paymentToAdd.note || paymentToAdd.description || "",
            checkoutLink,
          }),
        });
        fetchInvoices();
      } catch (err) {
        console.warn("Failed to create invoice on backend:", err);
      }
    }
    
    // Close modal first to prevent double-clicks
    setShowCreateInvoiceOptions(false);
    setPendingPayment(null);
    setCustomerPhoneInput("");
    
    // Add payment to list
    if (onAddPayment) {
      onAddPayment(paymentToAdd);
    }
    
    // Generate QR
    if (onGenerateQr) {
      onGenerateQr(paymentToAdd);
    }
  };

  const handleSendInvoiceFromCreate = async () => {
    if (!pendingPayment) return;
    if (!customerPhoneInput.trim()) return;
    
    // Store payment reference before clearing state
    const paymentToAdd = { ...pendingPayment };
    const phone = customerPhoneInput.trim();
    
    // Create payment intent on backend so status can be tracked
    let paymentIntentId = null;
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const piRes = await fetch(`${apiBase}/api/payment-intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentToAdd.amount,
          currency: paymentToAdd.currency || "ZAR",
          description: paymentToAdd.note || paymentToAdd.description || "",
          orderId: paymentToAdd.id, // Use the same orderId
        }),
      });
      if (piRes.ok) {
        const piData = await piRes.json();
        paymentIntentId = piData.id;
      }
    } catch (err) {
      console.warn("Failed to create payment intent on backend:", err);
    }

    // Generate checkout link for the invoice
    const orderId = paymentToAdd.id;
    const isoRef = `SHESHA-${orderId}`;
    const baseUrl = window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://demo.shesha";
    const pathStr = window.location.origin.includes("localhost") ? "/customer" : "/pay";
    const itemsParam = paymentToAdd.items
      ? `&items=${encodeURIComponent(JSON.stringify(paymentToAdd.items))}`
      : "";
    const checkoutLink = `${baseUrl}${pathStr}?order=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(paymentToAdd.amount)}&note=${encodeURIComponent(paymentToAdd.note || "")}&iso_ref=${encodeURIComponent(isoRef)}${itemsParam}`;

    // Create invoice on backend (triggers reminder timer)
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      await fetch(`${apiBase}/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId,
          orderId: paymentToAdd.id,
          customerPhone: phone,
          amount: paymentToAdd.amount,
          subtotal: paymentToAdd.amount / 1.15,
          taxAmount: paymentToAdd.amount - paymentToAdd.amount / 1.15,
          currency: paymentToAdd.currency || "ZAR",
          items: paymentToAdd.items || [],
          description: paymentToAdd.note || paymentToAdd.description || "",
          checkoutLink,
        }),
      });
      // Refresh invoices map
      fetchInvoices();
    } catch (err) {
      console.warn("Failed to create invoice on backend:", err);
    }
    
    // Close create invoice options modal first to prevent double-clicks
    setShowCreateInvoiceOptions(false);
    setPendingPayment(null);
    setCustomerPhoneInput("");
    
    // Add payment to list (only once)
    if (onAddPayment) {
      onAddPayment(paymentToAdd);
    }
    
    // Open invoice modal (pre-fill phone)
    setSelectedPaymentForInvoice(paymentToAdd);
    setShowInvoiceModal(true);
    setInvoicePhoneNumber(phone);
  };

  const handleCloseCreateInvoiceOptions = () => {
    setShowCreateInvoiceOptions(false);
    setPendingPayment(null);
  };

  // Filter payments by time period
  const filterPaymentsByTimePeriod = (payments) => {
    if (timePeriod === "all") return payments;
    
    const now = new Date();
    let cutoffDate;
    
    switch (timePeriod) {
      case "1day":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "1month":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        cutoffDate = new Date(now.getFullYear(), 0, 1); // Start of current year
        break;
      default:
        return payments;
    }
    
    return payments.filter((payment) => {
      const paymentDate = payment.settlementTime 
        ? new Date(payment.settlementTime)
        : payment.createdAt 
        ? new Date(payment.createdAt)
        : null;
      
      if (!paymentDate) return false;
      return paymentDate >= cutoffDate;
    });
  };

  const filteredPayments = filterPaymentsByTimePeriod(merchantPayments);
  const filteredTotalVolume = filteredPayments
    .filter((p) => p.status === "SETTLED" || p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);
  const filteredSettledCount = filteredPayments.filter(
    (p) => p.status === "SETTLED" || p.status === "succeeded"
  ).length;
  const filteredPendingCount = filteredPayments.filter((p) => 
    p.status === "PENDING" || 
    (p.status !== "SETTLED" && p.status !== "succeeded" && p.status !== "FAILED")
  ).length;

  return (
    <div className="app" ref={appRef}>
      <div className="dashboard-card">
        <div className="header-row">
          <div className="logo-with-title">
            <img
              src="/shesha_pay_logo.png"
              alt="Shesha Pay"
              className="brand-logo"
            />
            <div>
              <h1 className="merchant-name">Shesha Pay</h1>
            </div>
          </div>
        </div>

        {currentMode === "admin" ? (
          <>
            {/* Admin Mode Header + Tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "24px", marginBottom: "16px" }}>
              <button
                className="ghost-button"
                onClick={() => setCurrentMode("dashboard")}
                style={{ fontSize: "0.85rem", padding: "6px 12px" }}
              >
                ← Back
              </button>
              <h2 className="merchant-name" style={{ margin: 0, fontSize: "1.1rem" }}>Admin Mode</h2>
            </div>
            <div className="admin-tabs" style={{ marginBottom: "24px" }}>
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

            {/* Tab Content */}
            {adminTab === "employees" ? (
              <EmployeesView
                employees={employees}
                employeesLoading={employeesLoading}
                employeesError={employeesError}
                onAddEmployee={onAddEmployee}
                onDeleteEmployee={onDeleteEmployee}
                currencySymbol={currencySymbol}
              />
            ) : adminTab === "accounting" ? (
              <AccountingView
                merchantPayments={merchantPayments}
                currencySymbol={currencySymbol}
              />
            ) : (
              /* WhatsApp Business Settings */
              <div style={{ marginTop: "16px" }}>
                <div className="bank-card" style={{ marginBottom: "20px" }}>
                  <div className="bank-card-content">
                    <p className="metric-label">WhatsApp Business</p>
                    {whatsappStatus.connected ? (
                      <>
                        <p className="metric-value bank-account-value" style={{ color: "#22c55e" }}>
                          Connected
                        </p>
                        {whatsappStatus.phoneNumberId && (
                          <p className="payment-subtext" style={{ marginTop: "4px" }}>
                            Phone ID: {whatsappStatus.phoneNumberId}
                          </p>
                        )}
                        {whatsappStatus.connectedAt && (
                          <p className="payment-subtext" style={{ marginTop: "2px" }}>
                            Connected: {new Date(whatsappStatus.connectedAt).toLocaleString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="bank-unlinked-text">Not connected</p>
                    )}
                  </div>
                  {whatsappStatus.connected ? (
                    <button
                      className="ghost-button"
                      onClick={handleDisconnectWhatsApp}
                      style={{ color: "#ef4444" }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className="pay-button"
                      onClick={handleConnectWhatsApp}
                      disabled={whatsappConnecting}
                    >
                      {whatsappConnecting ? "Connecting..." : "Connect WhatsApp"}
                    </button>
                  )}
                </div>

                <div style={{
                  background: "var(--card-bg, #f8fafc)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "20px",
                }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", color: "var(--text)" }}>
                    How it works
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    {whatsappStatus.connected ? (
                      <ul style={{ margin: 0, paddingLeft: "20px" }}>
                        <li>Payment reminders are sent <strong>automatically</strong> via WhatsApp when invoices are overdue (after 3 days)</li>
                        <li>Up to 3 reminders are sent, spaced 24 hours apart</li>
                        <li>You can also manually send reminders from the Order History</li>
                      </ul>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "20px" }}>
                        <li>Connect your WhatsApp Business account to enable <strong>automated</strong> payment reminders</li>
                        <li>Without connection, reminders appear as alerts on your dashboard and you can send them manually via WhatsApp</li>
                        <li>Requires a Meta Business account with WhatsApp Business Platform access</li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* Overdue invoices summary */}
                {Object.values(invoicesMap).filter(
                  (inv, idx, self) => self.findIndex((i) => i.id === inv.id) === idx && (inv.status === "OVERDUE" || inv.status === "UNPAID")
                ).length > 0 && (
                  <div style={{
                    marginTop: "20px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "12px",
                    padding: "16px 20px",
                  }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9rem", color: "#991b1b" }}>
                      Pending Reminders
                    </p>
                    {Object.values(invoicesMap)
                      .filter((inv, idx, self) => self.findIndex((i) => i.id === inv.id) === idx && inv.status === "OVERDUE")
                      .map((inv) => (
                        <div key={inv.id} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid #fecaca",
                        }}>
                          <div>
                            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 500 }}>
                              {inv.customerPhone} &mdash; {currencySymbol}{inv.amount.toFixed(2)}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#991b1b" }}>
                              {inv.remindersSent}/{inv.maxReminders} reminders sent
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Main Mode Tabs (visible for dashboard and checkout) */}
            <div className="admin-tabs" style={{ marginTop: "24px", marginBottom: "24px" }}>
              <button
                className={`admin-tab-button ${currentMode === "dashboard" ? "active" : ""}`}
                onClick={() => setCurrentMode("dashboard")}
              >
                Dashboard
              </button>
              <button
                className={`admin-tab-button ${currentMode === "checkout" ? "active" : ""}`}
                onClick={() => setCurrentMode("checkout")}
              >
                Checkout Mode
              </button>
              <button
                className="admin-tab-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (pinVerified) {
                    setCurrentMode("admin");
                  } else {
                    setShowPinModal(true);
                    setPinValue("");
                    setPinError("");
                  }
                }}
              >
                Admin Mode
              </button>
            </div>

            {currentMode === "dashboard" ? (
              <>
                {/* Dashboard Tab - Metrics and Payout Account */}
            {/* Time Period Selector */}
            <div className="time-period-selector" style={{ 
              display: "flex", 
              gap: "8px", 
              marginBottom: "20px",
              flexWrap: "wrap"
            }}>
              <button
                className={`time-period-button ${timePeriod === "all" ? "active" : ""}`}
                onClick={() => setTimePeriod("all")}
              >
                All Time
              </button>
              <button
                className={`time-period-button ${timePeriod === "1day" ? "active" : ""}`}
                onClick={() => setTimePeriod("1day")}
              >
                Last 1 Day
              </button>
              <button
                className={`time-period-button ${timePeriod === "1month" ? "active" : ""}`}
                onClick={() => setTimePeriod("1month")}
              >
                Last 1 Month
              </button>
              <button
                className={`time-period-button ${timePeriod === "year" ? "active" : ""}`}
                onClick={() => setTimePeriod("year")}
              >
                This Year
              </button>
            </div>

            <div className="metrics">
              <div className="metric">
                <p className="metric-label">Total received</p>
                <p className="metric-value">
                  {currencySymbol} {filteredTotalVolume.toFixed(2)}
                </p>
              </div>
              <div className="metric">
                <p className="metric-label">Settled payments</p>
                <p className="metric-value">
                  {filteredSettledCount}
                </p>
              </div>
              <div className="metric">
                <p className="metric-label">Pending</p>
                <p className="metric-value">
                  {filteredPendingCount}
                </p>
              </div>
            </div>

            <div className={`bank-card ${merchantBank.bank === "Not linked" ? "bank-card-unlinked" : ""}`}>
              <div className="bank-card-content">
                <p className="metric-label">Payout account</p>
                {merchantBank.bank === "Not linked" ? (
                  <p className="bank-unlinked-text">No bank account linked</p>
                ) : (
                  <p className="metric-value bank-account-value">
                    {merchantBank.bank} {merchantBank.account ? `*${merchantBank.account}` : ""}
                  </p>
                )}
              </div>
              <button className="pay-button" onClick={handleLinkBankClick}>
                {merchantBank.bank === "Not linked" ? "Link bank" : "Update bank"}
              </button>
            </div>
              </>
            ) : (
              <>
                {/* Checkout Mode - Payment Operations */}
            <div className="checkout-section-container">
              <div className="receipt-dashboard">
                <div className="receipt-dashboard-left">
                  <ReceiptItemsCard
                    currencySymbol={currencySymbol}
                    receiptTotal={receiptTotal}
                    receiptSubtotal={receiptSubtotal}
                    receiptTax={receiptTax}
                    items={items}
                    newItem={newItem}
                    presetItems={presetItems}
                    onNewItemChange={onNewItemChange}
                    onAddItem={onAddItem}
                    onPresetAdd={onPresetAdd}
                    onItemChange={onItemChange}
                    onRemoveItem={onRemoveItem}
                    onGeneratePayment={handleCreateInvoice}
                  />
                </div>
                <div className="receipt-dashboard-right">
                  <div className="quick-add-panel">
                    <h2 className="merchant-name">Quick Add</h2>
                    <div className="quick-add-buttons">
                      {presetItems.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          className="quick-add-button"
                          onClick={() => onPresetAdd(preset)}
                        >
                          <div className="quick-add-button-content">
                            <span className="quick-add-button-name">{preset.name}</span>
                            <span className="quick-add-button-price">
                              {currencySymbol} {preset.price.toFixed(2)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <PaymentsTable
              payments={merchantPayments}
              loading={paymentsLoading}
              error={paymentsError}
              onLoadDemo={onLoadDemoPayments}
              onRefresh={onRefreshPayments}
              currencySymbol={currencySymbol}
              statusLabel={statusLabel}
              statusClass={statusClass}
              onViewQr={onGenerateQr}
              onSettlePayment={onSettlePayment}
              onSendInvoice={handleSendInvoice}
              onViewLog={handleViewLog}
              invoicesMap={invoicesMap}
              whatsappConnected={whatsappStatus.connected}
              onSendReminder={handleSendReminder}
            />
              </>
            )}
          </>
        )}

        {/* QR Modal - rendered via portal to tablet-frame for proper centering */}

        {/* Create Invoice Options Modal 
            Note: Uses create-invoice-overlay class to only grey out the tablet frame, not the whole screen */}
        {showCreateInvoiceOptions && pendingPayment && (
          <div className="bank-auth-modal-overlay create-invoice-overlay" onClick={handleCloseCreateInvoiceOptions}>
            <div className="bank-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bank-auth-modal-header">
                <h2 className="bank-auth-modal-title">Create Invoice</h2>
                <button
                  className="bank-auth-modal-close"
                  onClick={handleCloseCreateInvoiceOptions}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="bank-auth-modal-content">
                <div style={{ marginBottom: "20px" }}>
                  <p className="metric-label" style={{ marginBottom: "8px" }}>
                    Amount: <strong>{currencySymbol}{pendingPayment.amount?.toFixed(2) || "0.00"}</strong>
                  </p>
                  {pendingPayment.note && (
                    <p className="metric-label">
                      Description: {pendingPayment.note}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button
                    className="bank-auth-button"
                    type="button"
                    onClick={handleShowQr}
                    style={{ width: "100%" }}
                  >
                    Show QR
                  </button>
                  <button
                    className="bank-auth-button"
                    type="button"
                    onClick={() => {
                      if (!pendingPayment) return;
                      const paymentToAdd = { ...pendingPayment };
                      setShowCreateInvoiceOptions(false);
                      setPendingPayment(null);
                      if (onAddPayment) {
                        onAddPayment(paymentToAdd);
                      }
                      setSelectedPaymentForInvoice(paymentToAdd);
                      setShowInvoiceModal(true);
                      setInvoicePhoneNumber("");
                    }}
                    style={{ width: "100%" }}
                  >
                    Send Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Modal 
            Note: Uses create-invoice-overlay class to only grey out the tablet frame, not the whole screen */}
        {showInvoiceModal && selectedPaymentForInvoice && (
          <div className="bank-auth-modal-overlay create-invoice-overlay" onClick={handleCloseInvoiceModal}>
            <div className="bank-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bank-auth-modal-header">
                <h2 className="bank-auth-modal-title">Send Invoice</h2>
                <button
                  className="bank-auth-modal-close"
                  onClick={handleCloseInvoiceModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="bank-auth-modal-content">
                <div style={{ marginBottom: "20px" }}>
                  <p className="metric-label" style={{ marginBottom: "8px" }}>
                    Payment: <strong>{selectedPaymentForInvoice.id}</strong>
                  </p>
                  <p className="metric-label" style={{ marginBottom: "8px" }}>
                    Amount: <strong>{currencySymbol}{selectedPaymentForInvoice.amount?.toFixed(2) || "0.00"}</strong>
                  </p>
                  {selectedPaymentForInvoice.description && (
                    <p className="metric-label">
                      Description: {selectedPaymentForInvoice.description}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {onCopyCheckoutLink && (
                    <button
                      className="bank-auth-button"
                      type="button"
                      onClick={handleCopyCheckoutLink}
                      style={{ width: "100%" }}
                    >
                      Copy Checkout Link
                    </button>
                  )}

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "8px" }}>
                    <label className="bank-auth-label" htmlFor="invoice-phone" style={{ marginBottom: "8px" }}>
                      Send via WhatsApp
                    </label>
                    <input
                      id="invoice-phone"
                      type="tel"
                      className="bank-auth-select"
                      placeholder="Enter phone number (e.g., 0821234567)"
                      value={invoicePhoneNumber}
                      onChange={(e) => setInvoicePhoneNumber(e.target.value)}
                      style={{ marginBottom: "12px" }}
                    />
                    <button
                      className="bank-auth-button"
                      type="button"
                      onClick={handleSendViaWhatsApp}
                      disabled={!invoicePhoneNumber.trim()}
                      style={{ width: "100%" }}
                    >
                      Send via WhatsApp
                    </button>
                    <p className="payment-subtext" style={{ marginTop: "8px", fontSize: "0.75rem", textAlign: "center" }}>
                      Enter phone number without country code (e.g., 0821234567)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Auth Modal */}
        {showBankAuthModal && (
          <div className="bank-auth-modal-overlay" onClick={handleCloseBankAuthModal}>
            <div className="bank-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bank-auth-modal-header">
                <h2 className="bank-auth-modal-title">
                  {isAuthenticating ? `Redirecting to ${selectedBank}…` : "Link your bank account"}
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
                      Redirecting to <strong>{selectedBank}</strong>
                    </p>
                    <p className="bank-auth-instruction">
                      Approve this connection securely in your banking app.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bank-auth-step">
                      <label className="bank-auth-label" htmlFor="bank-select-merchant">
                        Choose bank
                      </label>
                      <select
                        id="bank-select-merchant"
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
                      onClick={handleAuthenticate}
                      disabled={!selectedBank || isAuthenticating}
                    >
                      Connect Bank
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PIN Modal */}
        {showPinModal && (
          <div className="bank-auth-modal-overlay pin-modal-overlay" onClick={handleClosePinModal}>
            <div className="bank-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bank-auth-modal-header">
                <h2 className="bank-auth-modal-title">Enter Admin PIN</h2>
                <button
                  className="bank-auth-modal-close"
                  onClick={handleClosePinModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="bank-auth-modal-content">
                <form onSubmit={handlePinSubmit}>
                  <div className="bank-auth-step" style={{ marginBottom: "0" }}>
                    <label className="bank-auth-label" style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
                      Enter PIN
                    </label>
                    {/* PIN Display */}
                    <div className="pin-display">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`pin-dot ${index < pinValue.length ? "filled" : ""}`}
                        />
                      ))}
                    </div>
                    {pinError && (
                      <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px", textAlign: "center" }}>
                        {pinError}
                      </p>
                    )}
                  </div>

                  {/* Keypad */}
                  <div className="pin-keypad">
                    <div className="keypad-row">
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "1");
                            setPinError("");
                          }
                        }}
                      >
                        1
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "2");
                            setPinError("");
                          }
                        }}
                      >
                        2
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "3");
                            setPinError("");
                          }
                        }}
                      >
                        3
                      </button>
                    </div>
                    <div className="keypad-row">
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "4");
                            setPinError("");
                          }
                        }}
                      >
                        4
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "5");
                            setPinError("");
                          }
                        }}
                      >
                        5
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "6");
                            setPinError("");
                          }
                        }}
                      >
                        6
                      </button>
                    </div>
                    <div className="keypad-row">
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "7");
                            setPinError("");
                          }
                        }}
                      >
                        7
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "8");
                            setPinError("");
                          }
                        }}
                      >
                        8
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "9");
                            setPinError("");
                          }
                        }}
                      >
                        9
                      </button>
                    </div>
                    <div className="keypad-row">
                      <button
                        type="button"
                        className="keypad-button keypad-button-empty"
                        disabled
                      >
                        
                      </button>
                      <button
                        type="button"
                        className="keypad-button"
                        onClick={() => {
                          if (pinValue.length < 4) {
                            setPinValue(pinValue + "0");
                            setPinError("");
                          }
                        }}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        className="keypad-button keypad-button-delete"
                        onClick={() => {
                          setPinValue(pinValue.slice(0, -1));
                          setPinError("");
                        }}
                        disabled={pinValue.length === 0}
                      >
                        ⌫
                      </button>
                    </div>
                  </div>

                  <button
                    className="bank-auth-button"
                    type="submit"
                    disabled={pinValue.length < 4}
                    style={{ marginTop: "12px", padding: "12px" }}
                  >
                    Verify PIN
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ISO 20022 Transaction Log Modal */}
      {showLogModal && logPayment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowLogModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              width: "520px",
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 24px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>
                    ISO 20022 Payment Lifecycle
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                    Transaction {logPayment.id ? logPayment.id.slice(0, 8) + "..." : "N/A"}
                  </p>
                  {logPayment.amount && (
                    <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                      {currencySymbol} {logPayment.amount.toFixed(2)} &mdash; {logPayment.description || "Payment"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                    color: "var(--muted)",
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ padding: "24px" }}>
              {logLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                  Loading payment lifecycle...
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  {ISO_STATES.map((state, idx) => {
                    const matchedEvent = logEvents.find((e) => e.type === state.type);
                    const reached = !!matchedEvent;
                    const isLast = idx === ISO_STATES.length - 1;

                    return (
                      <div
                        key={state.key}
                        style={{
                          display: "flex",
                          gap: "16px",
                          marginBottom: isLast ? 0 : "8px",
                          minHeight: isLast ? "auto" : "72px",
                        }}
                      >
                        {/* Vertical line + dot */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            width: "32px",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: reached ? "#22c55e" : "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              color: reached ? "white" : "#9ca3af",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {reached ? "\u2713" : idx + 1}
                          </div>
                          {!isLast && (
                            <div
                              style={{
                                width: "2px",
                                flex: 1,
                                background: reached && logEvents.find((e) => e.type === ISO_STATES[idx + 1]?.type)
                                  ? "#22c55e"
                                  : "#e5e7eb",
                                marginTop: "4px",
                                marginBottom: "4px",
                              }}
                            />
                          )}
                        </div>

                        {/* Event content */}
                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: "0.9rem",
                                color: reached ? "var(--text)" : "#9ca3af",
                              }}
                            >
                              {state.label}
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontFamily: "monospace",
                                background: reached ? "#f0fdf4" : "#f3f4f6",
                                color: reached ? "#15803d" : "#9ca3af",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: 600,
                              }}
                            >
                              {state.key}
                            </span>
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontFamily: "monospace",
                                color: reached ? "#6b7280" : "#d1d5db",
                              }}
                            >
                              ISO: {state.iso}
                            </span>
                          </div>
                          {reached && matchedEvent && (
                            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>
                              {new Date(matchedEvent.timestamp).toLocaleString()}
                              {matchedEvent.provider && matchedEvent.provider !== "unknown" && (
                                <span style={{ marginLeft: "8px", color: "#22c55e", fontWeight: 600 }}>
                                  via {matchedEvent.provider}
                                </span>
                              )}
                              {matchedEvent.settlementRef && (
                                <div style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#6b7280", marginTop: "2px" }}>
                                  Ref: {matchedEvent.settlementRef}
                                </div>
                              )}
                            </div>
                          )}
                          {!reached && (
                            <div style={{ fontSize: "0.78rem", color: "#d1d5db", marginTop: "2px" }}>
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ISO 20022 XML Payload */}
              {!logLoading && logEvents.length > 0 && logEvents[0]?.iso20022_meta && (
                <div style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                  <div style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>
                    ISO 20022 XML Payload
                  </div>
                  <pre
                    style={{
                      background: "#1e293b",
                      color: "#e2e8f0",
                      padding: "12px",
                      borderRadius: "8px",
                      overflow: "auto",
                      fontSize: "0.72rem",
                      lineHeight: "1.5",
                      margin: 0,
                      fontFamily: "'Courier New', monospace",
                      maxHeight: "200px",
                    }}
                  >
                    {logEvents[0].iso20022_meta}
                  </pre>
                </div>
              )}

              {!logLoading && logEvents.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  No lifecycle events recorded for this transaction yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Logs Button - Top Right of Screen */}
      <div style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 1000
      }}>
        <button
          className="ghost-button"
          onClick={() => navigateView("logs")}
          style={{ fontSize: "0.85rem" }}
        >
          View Logs
        </button>
      </div>

      {/* QR Modal - portaled to tablet-frame for proper centering */}
      {qrPreview.open && qrPreview.url && tabletFrameEl && createPortal(
        <div className="qr-modal">
          <div className="qr-modal-content">
            <div className="qr-modal-header">
              <p className="metric-label">
                QR for payment <strong>{qrPreview.id}</strong>
              </p>
              <button className="ghost-button" onClick={onCloseQr}>
                Close
              </button>
            </div>
            <img
              src={qrPreview.url}
              alt={`QR for payment ${qrPreview.id}`}
              className="qr-image-large"
            />
            <p className="payment-subtext qr-subtext">
              Instant, secure bank payment • No app needed
            </p>
            {qrPreview.payment && onCopyCheckoutLink && (
              <button
                className="copy-checkout-link-button"
                type="button"
                onClick={() => onCopyCheckoutLink(qrPreview.payment)}
              >
                Copy checkout link
              </button>
            )}
          </div>
        </div>,
        tabletFrameEl
      )}
    </div>
  );
}

export default MerchantDashboard;
