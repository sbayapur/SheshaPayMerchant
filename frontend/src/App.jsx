import { useEffect, useState, useRef } from "react";
import "./App.css";
import MerchantDashboard from "./components/MerchantDashboard.jsx";
import Toast from "./components/Toast.jsx";
import TabletFrame from "./components/TabletFrame.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import CheckoutView from "./components/CheckoutView.jsx";
import SuccessView from "./components/SuccessView.jsx";
import { supabase } from "./lib/supabase.js";
import { getApiBase } from "./lib/api.js";
import { sessionRequiresNewPassword } from "./lib/authRecovery.js";

const API_BASE = getApiBase();
const ORDER_TOTAL = 75;
const CURRENCY_SYMBOL = "R";

function calculateTotals(items) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );
  const tax = subtotal * 0.15;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function viewFromPath() {
  const path = window.location.pathname.toLowerCase();
  if (path === "/pay" || path.startsWith("/pay/")) return "checkout";
  if (path === "/customer" || path.startsWith("/customer/")) return "checkout";
  return "merchant";
}

function getPaymentTokenFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/(?:pay|customer)\/([^/?#]+)/);
  return match ? match[1] : null;
}

function App() {
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [bankError, setBankError] = useState("");
  const [linkedBank, setLinkedBank] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountType: "",
    accountLast4: "",
  });
  const [receiptPhone, setReceiptPhone] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("");
  const [paidAt, setPaidAt] = useState(null);
  const [items, setItems] = useState([]);
  const [presetItems, setPresetItems] = useState([]);
  const [view, setView] = useState(viewFromPath()); // "checkout" | "merchant"
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  /** Blocks dashboard until user sets a new password after recovery email link */
  const passwordRecoveryPending = useRef(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [toast, setToast] = useState({ message: "", type: "" });
  const [merchantBank, setMerchantBank] = useState({
    bank: "Not linked",
    account: "",
  });
  const [qrPreview, setQrPreview] = useState({
    id: "",
    url: "",
    open: false,
    payment: null, // Store payment data for generating checkout link
  });
  const [merchantPayments, setMerchantPayments] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    note: "",
    orderId: `ORD-${Date.now()}`,
  });
  const [newItem, setNewItem] = useState({ name: "", price: "", quantity: 1 });
  const [customerLinkPayment, setCustomerLinkPayment] = useState(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");

  // Calculate totals - if customerLinkPayment exists, use its amount; otherwise use items
  const { subtotal, tax, total } = customerLinkPayment
    ? (() => {
        const paymentAmount = customerLinkPayment.amount || ORDER_TOTAL;
        const calculatedSubtotal = paymentAmount / 1.15; // Reverse calculate subtotal (amount includes tax)
        const calculatedTax = paymentAmount - calculatedSubtotal;
        return {
          subtotal: calculatedSubtotal,
          tax: calculatedTax,
          total: paymentAmount,
        };
      })()
    : calculateTotals(items);
  const currentLinkAmount =
    customerLinkPayment?.amount || total || ORDER_TOTAL;
  const currentLinkOrderId =
    customerLinkPayment?.orderId || paymentIntent?.id || "N/A";

  useEffect(() => {
    const handlePop = () => setView(viewFromPath());
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Supabase auth: password-recovery links issue a session; we must require a new password before dashboard access
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    const applySession = (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryPending.current = true;
        setNeedsNewPassword(true);
        setIsLoggedIn(false);
        return;
      }

      if (session && sessionRequiresNewPassword(session)) {
        passwordRecoveryPending.current = true;
        setNeedsNewPassword(true);
        setIsLoggedIn(false);
        return;
      }

      if (
        (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") &&
        session &&
        !sessionRequiresNewPassword(session)
      ) {
        passwordRecoveryPending.current = false;
        setNeedsNewPassword(false);
        setIsLoggedIn(!!session);
        return;
      }

      if (event === "SIGNED_IN" && passwordRecoveryPending.current) {
        setNeedsNewPassword(true);
        setIsLoggedIn(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && passwordRecoveryPending.current) {
        setIsLoggedIn(false);
        return;
      }

      if (passwordRecoveryPending.current) {
        setNeedsNewPassword(true);
        setIsLoggedIn(false);
        return;
      }

      setNeedsNewPassword(false);
      setIsLoggedIn(!!session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(event, session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const showToast = (
    message,
    type = "info",
    timeout = 2500,
    actionLabel,
    onAction
  ) => {
    setToast({ message, type, actionLabel, onAction });
    if (message) {
      setTimeout(
        () => setToast({ message: "", type: "", actionLabel: "", onAction: null }),
        timeout
      );
    }
  };

  // Create payment intent on mount or when link params change
  // Only create once per checkout session - don't recreate when items/total change
  useEffect(() => {
    // Don't create if we're not on the checkout view
    if (view !== "checkout") {
      return;
    }

    // Don't create if we already have a payment intent and it's not completed/failed
    // This prevents duplicate creation when items/total change
    if (paymentIntent && paymentStatus !== "success" && paymentStatus !== "error") {
      return;
    }

    const createIntent = async () => {
      try {
        const computedAmount = total;
        const amountToUse =
          customerLinkPayment && customerLinkPayment.amount
            ? customerLinkPayment.amount
            : computedAmount > 0
            ? computedAmount
            : ORDER_TOTAL;

        const res = await fetch(`${API_BASE}/api/payment-intents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountToUse,
            currency: "ZAR",
            description:
              customerLinkPayment?.note || "Sunrise Salon order",
            orderId: customerLinkPayment?.orderId, // Include orderId so it can be matched later
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }

        const data = await res.json();
        setPaymentIntent(data);
        setPaymentStatus("ready");
        setBankError(""); // Clear any previous errors
      } catch (err) {
        console.error("Failed to create payment intent:", err);
        setPaymentStatus("error");
        // Provide helpful error message
        if (err.message?.includes("fetch") || err.message?.includes("Failed to fetch")) {
          setBankError("Cannot connect to server. Please make sure the backend server is running on port 4000.");
        } else {
          setBankError(err.message || "Failed to create payment intent. Please try again.");
        }
      }
    };

    createIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerLinkPayment, view]); // Only recreate when customerLinkPayment or view changes, not when items/total change

  const fetchIntents = async () => {
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      const res = await fetch(`${API_BASE}/api/payment-intents`);
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data
            .map((item) => {
              // Use actual status from backend, don't force SETTLED
              const now = new Date();
              // Determine status - use actual status if available, otherwise default to PENDING
              const actualStatus = item.status || "PENDING";

              return {
                ...item,
                amount: Number(item.amount) || 0,
                status: actualStatus, // Use real status from backend
                settlementTime: item.settlementTime || item.completedAt || (actualStatus === "SETTLED" ? now.toISOString() : null),
                settlementProvider: item.settlementProvider || (actualStatus === "SETTLED" ? "PayShap" : null),
                settlementRef: item.settlementRef || (actualStatus === "SETTLED" ? `SHESHA-${item.id}` : null),
                // Use actual status history if available, otherwise build from timestamps
                statusHistory: item.statusHistory || [
                  ...(item.createdAt ? [{
                    status: "PENDING",
                    timestamp: item.createdAt
                  }] : []),
                  ...(item.authorisedAt ? [{
                    status: "AUTHORISED",
                    timestamp: item.authorisedAt
                  }] : []),
                  ...(actualStatus === "SETTLED" && (item.settlementTime || item.completedAt) ? [{
                    status: "SETTLED",
                    timestamp: item.settlementTime || item.completedAt
                  }] : [])
                ]
              };
            })
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            )
        : [];

      // Merge with locally created payments (from checkout mode) that might not be in backend yet
      setMerchantPayments((prev) => {
        // Create a map of backend payments by their orderId and ID (for matching)
        const backendByOrderId = new Map();
        const backendById = new Map();
        normalized.forEach(payment => {
          if (payment.orderId) {
            backendByOrderId.set(payment.orderId, payment);
          }
          backendById.set(payment.id, payment);
        });

        // Get locally created payments that aren't in backend yet
        const localPayments = prev.filter(p => {
          // Check if backend has this payment by ID or orderId
          const backendPayment = backendById.get(p.id) || backendByOrderId.get(p.id) || backendByOrderId.get(p.orderId);
          // If backend has it, don't include local version (backend has real status)
          return !backendPayment;
        });

        // Start with backend payments (they have real status including SETTLED/COMPLETED)
        const merged = [...normalized];

        // Add local payments that don't exist in backend yet
        localPayments.forEach(localPayment => {
          merged.push(localPayment);
        });

        return merged.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      });
    } catch (err) {
      console.error("Failed to load payment intents", err);
      setPaymentsError("Could not load payment intents.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    setEmployeesError("");
    try {
      const res = await fetch(`${API_BASE}/api/employees`);
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          )
        : [];
      // Merge backend employees with existing mock data (avoid duplicates by id)
      setEmployees((prev) => {
        const backendIds = new Set(normalized.map((e) => e.id));
        const kept = prev.filter((e) => !backendIds.has(e.id));
        return [...normalized, ...kept].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      });
    } catch (err) {
      console.error("Failed to load employees", err);
      // Keep existing mock data on error, don't overwrite
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleAddEmployee = async (employeeData) => {
    try {
      const res = await fetch(`${API_BASE}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeData),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const newEmployee = await res.json();
      setEmployees((prev) => [newEmployee, ...prev]);
      showToast(`Employee ${employeeData.name} added successfully`, "success");
      fetchEmployees(); // Refresh list
    } catch (err) {
      console.error("Failed to add employee", err);
      showToast("Failed to add employee", "error");
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      const res = await fetch(`${API_BASE}/api/employees/${employeeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
      showToast("Employee deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete employee", err);
      showToast("Failed to delete employee", "error");
    }
  };

  // Clear all orders on app mount (page reload)
  useEffect(() => {
    const clearOrders = async () => {
      try {
        await fetch(`${API_BASE}/api/payment-intents`, { method: "DELETE" });
      } catch (err) {
        console.warn("Failed to clear orders:", err);
      }
    };
    clearOrders();
  }, []); // Only run on mount

  // Load payment intents and employees when viewing merchant dashboard
  useEffect(() => {
    if (view !== "merchant") return;
    fetchIntents();
    fetchEmployees();
  }, [view]);

  // Listen for payment completion events to automatically refresh order history and accounting
  useEffect(() => {
    const handlePaymentCompleted = () => {
      if (view === "merchant") {
        fetchIntents(); // This will update merchantPayments, which automatically updates accounting
      }
    };

    // Listen for custom payment completion event
    window.addEventListener('paymentCompleted', handlePaymentCompleted);

    return () => {
      window.removeEventListener('paymentCompleted', handlePaymentCompleted);
    };
  }, [view]); // Re-attach listener if view changes

  const handleConnectBank = () => {
    setBankError("");

    if (!paymentIntent) {
      setBankError("Payment intent not ready. Please wait a moment and try again.");
      return;
    }

    // Mock bank connection for demo (Stitch/PayShap handles real bank linking)
    setLinkedBank("Mock Bank");
    setBankDetails({
      accountName: "Demo Account",
      accountType: "Checking",
      accountLast4: "4242",
    });
    setPaymentStatus("confirm");
  };

  const handleConfirmPayment = async () => {
    // If paymentIntent doesn't exist, try to find it by orderId or create one
    let intentToUse = paymentIntent;

    if (!intentToUse && customerLinkPayment?.orderId) {
      // Try to fetch the payment intent by orderId
      try {
        const res = await fetch(`${API_BASE}/api/payment-intents`);
        if (res.ok) {
          const intents = await res.json();
          const foundIntent = Array.isArray(intents) 
            ? intents.find(intent => intent.orderId === customerLinkPayment.orderId || intent.id === customerLinkPayment.orderId)
            : null;
          if (foundIntent) {
            intentToUse = foundIntent;
            setPaymentIntent(foundIntent);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch payment intent by orderId", err);
      }

      // If still not found, create one
      if (!intentToUse) {
        try {
          const amountToUse = customerLinkPayment.amount || total || ORDER_TOTAL;
          const res = await fetch(`${API_BASE}/api/payment-intents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amountToUse,
              currency: "ZAR",
              description: customerLinkPayment?.note || "Sunrise Salon order",
              orderId: customerLinkPayment.orderId,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            intentToUse = data;
            setPaymentIntent(data);
          }
        } catch (err) {
          console.error("Failed to create payment intent in handleConfirmPayment", err);
        }
      }
    }

    if (!intentToUse) {
      setBankError("Payment intent not found. Please try again.");
      return;
    }

    setPaymentStatus("pending");
    setBankError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/payment-intents/${intentToUse.id}/start`,
        { method: "POST" }
      );

      // If backend returns a link, open it; otherwise just proceed to mock success.
      if (res.ok) {
        const data = await res.json();
        if (data?.redirectUrl) {
          window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch (err) {
      console.warn("Proceeding with mock success due to start error", err);
    }

    // Show "Awaiting settlement" for 2 seconds
    setPaymentStatus("awaiting_settlement");

    // Automatically trigger settlement after 2 seconds (simulating bank settlement)
    setTimeout(async () => {
      try {
        // Trigger settlement webhook - this will log a real settlement event
        // Use intentToUse.id or orderId to ensure we find the correct payment intent
        const orderIdToUse = intentToUse.id || customerLinkPayment?.orderId;
        const amountToUse = intentToUse.amount || customerLinkPayment?.amount || total || ORDER_TOTAL;

        const settleRes = await fetch(`${API_BASE}/api/demo/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderId: orderIdToUse, // Use payment intent id or orderId
            amount: amountToUse,
            status: "COMPLETED"
          }),
        });

        if (settleRes.ok) {
          // Settlement successful - show success screen
          // Save phone number if we have bank details (user completed payment)
          if (bankDetails.accountLast4 && !localStorage.getItem('sheshaPay_savedPhone')) {
            // Generate a fake phone number if not already saved (for demo purposes)
            const fakePhone = `082${Math.floor(1000000 + Math.random() * 9000000)}`;
            localStorage.setItem('sheshaPay_savedPhone', fakePhone);
          }
          setPaidAt(new Date());
          setPaymentStatus("success");

          // Dispatch event to refresh order history
          window.dispatchEvent(new CustomEvent('paymentCompleted', { 
            detail: { orderId: orderIdToUse } 
          }));
        } else {
          // If settlement fails, still show success for demo purposes
          if (bankDetails.accountLast4 && !localStorage.getItem('sheshaPay_savedPhone')) {
            const fakePhone = `082${Math.floor(1000000 + Math.random() * 9000000)}`;
            localStorage.setItem('sheshaPay_savedPhone', fakePhone);
          }
          setPaidAt(new Date());
          setPaymentStatus("success");

          // Dispatch event to refresh order history
          window.dispatchEvent(new CustomEvent('paymentCompleted', { 
            detail: { orderId: orderIdToUse } 
          }));
        }
      } catch (err) {
        console.warn("Settlement webhook failed, showing success anyway", err);
        // Still show success for demo purposes even if settlement webhook fails
        if (bankDetails.accountLast4 && !localStorage.getItem('sheshaPay_savedPhone')) {
          const fakePhone = `082${Math.floor(1000000 + Math.random() * 9000000)}`;
          localStorage.setItem('sheshaPay_savedPhone', fakePhone);
        }
        setPaidAt(new Date());
        setPaymentStatus("success");

        // Dispatch event to refresh order history
        window.dispatchEvent(new CustomEvent('paymentCompleted', { 
          detail: { orderId: intentToUse.id || customerLinkPayment?.orderId } 
        }));
      }
    }, 2000);
  };

  const handleCancel = () => {
    setPaymentStatus(paymentIntent ? "ready" : "idle");
    setLinkedBank("");
    setBankDetails({
      accountName: "",
      accountType: "",
      accountLast4: "",
    });
    setBankError("");
    setReceiptStatus("");
    setReceiptPhone("");
  };

  const handleGoBackFromSuccess = () => {
    // Reset payment status to show checkout again
    setPaymentStatus("idle");
    // Reset payment intent so a new one can be created
    setPaymentIntent(null);
    // Keep the customerLinkPayment so the receipt is still shown
    // Reset bank linking state
    setLinkedBank("");
    setBankDetails({
      accountName: "",
      accountType: "",
      accountLast4: "",
    });
    setBankError("");
    setReceiptStatus("");
    // Don't reset receiptPhone - keep it for the receipt form
  };

  const handleBankLinked = (bankName, bankDetailsData) => {
    setLinkedBank(bankName);
    setBankDetails(bankDetailsData);
    setPaymentStatus("confirm");
    setBankError(""); // Clear any errors
    // Scroll to top when confirm panel appears
    setTimeout(() => {
      const phoneContent = document.querySelector('.phone-content');
      if (phoneContent) {
        phoneContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSendReceipt = (event) => {
    event.preventDefault();
    if (!receiptPhone.trim()) {
      setReceiptStatus("Enter a phone number to send a receipt.");
      return;
    }
    // Save phone number to localStorage for future quick pay
    const phoneNumber = receiptPhone.trim().replace(/\D/g, ''); // Remove non-digits
    if (phoneNumber.length >= 10) {
      localStorage.setItem('sheshaPay_savedPhone', phoneNumber);
    }
    setReceiptStatus(`Receipt will be sent to ${receiptPhone.trim()}.`);
  };

  const handlePresetAdd = (preset) => {
    setItems((prev) => [...prev, { ...preset }]);
    showToast(`Added ${preset.name}`, "success");
  };

  const handleSavePreset = (item) => {
    if (!item?.name) return;
    const exists = presetItems.some(
      (p) => p.name.toLowerCase() === item.name.toLowerCase()
    );
    if (exists) {
      showToast("Preset already exists.", "info");
      return;
    }
    setPresetItems((prev) => [...prev, { ...item }]);
    showToast(`Saved ${item.name} shortcut`, "success");
  };

  const handleAddItem = (event) => {
    event.preventDefault();
    if (!newItem.name.trim()) {
      setReceiptStatus("Enter an item name.");
      return;
    }
    const priceValue = Number(newItem.price);
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setReceiptStatus("Enter a price greater than 0.");
      return;
    }

    const qtyValue = Number(newItem.quantity) || 1;

    const itemToAdd = {
      name: newItem.name.trim(),
      price: priceValue,
      quantity: qtyValue,
    };

    setItems((prev) => [...prev, itemToAdd]);
    setNewItem({ name: "", price: "", quantity: 1 });
    setReceiptStatus("");
    showToast(
      `Added ${itemToAdd.name}`,
      "success",
      3000,
      "Save item",
      () => handleSavePreset(itemToAdd)
    );
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    showToast("Item removed", "info");
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [field]:
                field === "price" || field === "quantity"
                  ? Number(value) || 0
                  : value,
            }
          : item
      )
    );
  };

  const handleLinkMerchantBank = (bankName, bankDetailsData) => {
    setMerchantBank({
      bank: bankName || "Demo Bank",
      account: bankDetailsData?.accountLast4
        ? bankDetailsData.accountLast4
        : "",
    });
    showToast(`Bank account linked successfully`, "success");
  };

  const handleNewPaymentChange = (field, value) => {
    setNewPayment((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateNewPayment = (event) => {
    event.preventDefault();
    if (receiptTotal <= 0 || items.length === 0) {
      setReceiptStatus("Add items to generate a QR.");
      return;
    }

    const orderId = `ORD-${Date.now()}`;
    // Generate note from items
    const note = items.map(item => 
      `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
    ).join(' + ');

    const payment = {
      id: orderId,
      amount: receiptTotal,
      currency: "ZAR",
      status: "PENDING",
      bank: merchantBank.bank === "Not linked" ? "Unlinked" : merchantBank.bank,
      note: note,
      items: [...items],
    };

    setMerchantPayments((prev) => [payment, ...prev]);
    handleGenerateQr(payment);
    setReceiptStatus("");
    showToast("QR generated for new payment", "success");
  };

  const createPaymentLink = async (payment) => {
    if (!payment?.id || !payment?.amount) return null;
    const baseUrl = window.location.origin.includes("localhost")
      ? window.location.origin
      : (import.meta.env.VITE_CUSTOMER_BASE_URL || "https://demo.shesha").replace(/\/+$/, "");
    const res = await fetch(`${API_BASE}/api/payment-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: payment.id,
        amount: payment.amount,
        currency: payment.currency || "ZAR",
        note: payment.note || "",
        items: payment.items || [],
        merchantName: "Sunrise Salon",
        baseUrl, // Let backend override if needed; backend uses FRONTEND_BASE_URL
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create payment link");
    }
    const data = await res.json();
    return data.url || (data.token ? `${baseUrl}/pay/${data.token}` : null);
  };

  const handleGenerateQr = async (payment) => {
    if (!payment) return;
    try {
      const paymentLink = await createPaymentLink(payment);
      if (!paymentLink) {
        showToast("Failed to create payment link", "error");
        return;
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentLink)}`;
      setQrPreview({ id: payment.id, url: qrUrl, open: true, payment });
    } catch (err) {
      console.error("Failed to create payment link", err);
      showToast(err.message || "Failed to create payment link", "error");
    }
  };

  const handleCopyCheckoutLink = async (payment) => {
    if (!payment) return;
    let checkoutLink;
    try {
      checkoutLink = await createPaymentLink(payment);
      if (!checkoutLink) {
        showToast("Failed to create checkout link", "error");
        return;
      }
    } catch (err) {
      console.error("Failed to create checkout link", err);
      showToast(err.message || "Failed to create checkout link", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(checkoutLink);
      showToast("Checkout link copied to clipboard!", "success");
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
      // Fallback: select text in a temporary input
      const textArea = document.createElement("textarea");
      textArea.value = checkoutLink;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Checkout link copied to clipboard!", "success");
      } catch (fallbackErr) {
        showToast("Failed to copy link. Please copy manually.", "error");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleClearPayments = async () => {
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      const res = await fetch(`${API_BASE}/api/payment-intents`);
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data
            .map((item) => {
              // Use actual status from backend, don't force SETTLED
              const now = new Date();
              // Determine status - use actual status if available, otherwise default to PENDING
              const actualStatus = item.status || "PENDING";

              return {
                ...item,
                amount: Number(item.amount) || 0,
                status: actualStatus, // Use real status from backend
                settlementTime: item.settlementTime || item.completedAt || (actualStatus === "SETTLED" ? now.toISOString() : null),
                settlementProvider: item.settlementProvider || (actualStatus === "SETTLED" ? "PayShap" : null),
                settlementRef: item.settlementRef || (actualStatus === "SETTLED" ? `SHESHA-${item.id}` : null),
                // Use actual status history if available, otherwise build from timestamps
                statusHistory: item.statusHistory || [
                  ...(item.createdAt ? [{
                    status: "PENDING",
                    timestamp: item.createdAt
                  }] : []),
                  ...(item.authorisedAt ? [{
                    status: "AUTHORISED",
                    timestamp: item.authorisedAt
                  }] : []),
                  ...(actualStatus === "SETTLED" && (item.settlementTime || item.completedAt) ? [{
                    status: "SETTLED",
                    timestamp: item.settlementTime || item.completedAt
                  }] : [])
                ],
                orderId: item.orderId || item.id, // Ensure orderId is present for matching
              };
            })
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            )
        : [];

      // Replace all payments with backend data (don't merge, just replace)
      setMerchantPayments(normalized);
      showToast("Order history refreshed", "success");
    } catch (err) {
      console.error("Failed to refresh payment intents", err);
      setPaymentsError("Could not refresh payment intents.");
      showToast("Failed to refresh order history", "error");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleSettlePayment = async (payment) => {
    if (!payment?.id) {
      showToast("Invalid payment", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/demo/rail/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: payment.id,
          amount: payment.amount,
          status: "COMPLETED",
          provider: "demo-rail"
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with ${res.status}`);
      }

      await res.json();
      showToast(`Payment ${payment.id} settled successfully via rail`, "success");

      // Dispatch event to refresh order history (event-based, no polling)
      window.dispatchEvent(new CustomEvent('paymentCompleted', { 
        detail: { orderId: payment.id } 
      }));
    } catch (err) {
      console.error("Failed to settle payment", err);
      showToast(err.message || "Failed to settle payment", "error");
    }
  };

  const handleSettleByOrderId = async (orderId) => {
    if (!orderId) {
      showToast("Invalid order ID", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/demo/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with ${res.status}`);
      }

      await res.json();
      showToast("Payment authenticated and settled successfully", "success");

      // Update payment status to success (which will show SETTLED)
      setPaymentStatus("success");

      // Dispatch event to refresh order history
      window.dispatchEvent(new CustomEvent('paymentCompleted', { 
        detail: { orderId } 
      }));
    } catch (err) {
      console.error("Failed to settle payment", err);
      showToast(err.message || "Failed to authenticate payment", "error");
    }
  };

  // Fetch payment data from token or parse legacy query params (customer view)
  useEffect(() => {
    if (view !== "checkout") return;

    const token = getPaymentTokenFromPath();

    if (token) {
      // Secure deep link: fetch from API
      setLinkLoading(true);
      setLinkExpired(false);
      setCustomerLinkPayment(null);

      fetch(`${API_BASE}/api/pay/${token}`)
        .then((res) => {
          if (!res.ok) {
            setLinkExpired(true);
            setCustomerLinkPayment(null);
            return;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setCustomerLinkPayment({
              orderId: data.orderId,
              amount: data.amount,
              note: data.note || "",
              isoRef: data.isoRef || (data.orderId ? `SHESHA-${data.orderId}` : null),
              items: data.items || [],
            });
            setLinkExpired(false);
          }
        })
        .catch(() => {
          setLinkExpired(true);
          setCustomerLinkPayment(null);
        })
        .finally(() => setLinkLoading(false));
      return;
    }

    // Legacy: parse query params (backward compatibility)
    const params = new URLSearchParams(window.location.search);
    const amountParam = params.get("amount");
    const orderIdParam = params.get("order") || params.get("orderId");
    const noteParam = params.get("note");
    const isoRefParam = params.get("iso_ref");
    const itemsParam = params.get("items");
    const parsedAmount = amountParam ? Number(amountParam) : null;

    let parsedItems = null;
    if (itemsParam) {
      try {
        parsedItems = JSON.parse(decodeURIComponent(itemsParam));
      } catch (err) {
        console.warn("Failed to parse items from URL:", err);
      }
    }

    if (parsedAmount || orderIdParam || noteParam || isoRefParam || parsedItems) {
      setLinkExpired(false);
      setCustomerLinkPayment({
        amount: parsedAmount || ORDER_TOTAL,
        orderId: orderIdParam || `ORD-${Date.now()}`,
        note: noteParam || "",
        isoRef: isoRefParam || (orderIdParam ? `SHESHA-${orderIdParam}` : null),
        items: parsedItems || [],
      });
    }
  }, [view]);

  const statusLabel = (status) => {
    // New banking-style statuses
    if (status === "SETTLED") return "Completed";
    if (status === "AUTHORISED") return "Authorised";
    if (status === "PENDING") return "Pending";
    if (status === "FAILED") return "Failed";
    // Legacy statuses for backward compatibility
    if (status === "succeeded") return "Completed";
    if (status === "requires_action") return "Authorised";
    if (status === "requires_payment_method") return "Pending";
    if (status === "processing") return "Pending";
    return "Pending";
  };
  const statusClass = (status) => {
    // New banking-style statuses
    if (status === "SETTLED") return "pill-succeeded";
    if (status === "AUTHORISED") return "pill-authorised";
    if (status === "PENDING") return "pill-processing";
    if (status === "FAILED") return "pill-failed";
    // Legacy statuses
    if (status === "succeeded") return "pill-succeeded";
    return "pill-processing";
  };
  const totalVolume = merchantPayments
    .filter((p) => p.status === "SETTLED" || p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);

  // Calculate merchant dashboard receipt totals (for checkout mode)
  const merchantReceiptTotals = calculateTotals(items);
  const receiptTotal = merchantReceiptTotals.total;
  const receiptSubtotal = merchantReceiptTotals.subtotal;
  const receiptTax = merchantReceiptTotals.tax;

  if (view === "checkout") {
    return (
      <>
        {linkLoading ? (
            <div className="app landing" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
              <p className="processing">Loading payment...</p>
            </div>
          ) : linkExpired ? (
            <div className="app landing" style={{ padding: "24px", textAlign: "center" }}>
              <h1>Link expired or invalid</h1>
              <p style={{ marginTop: "12px", color: "var(--text-secondary)" }}>
                This payment link is no longer valid. Please contact the merchant for a new link.
              </p>
            </div>
          ) : paymentStatus === "success" ? (
            <SuccessView
              currencySymbol={CURRENCY_SYMBOL}
              currentLinkAmount={currentLinkAmount}
              currentLinkOrderId={currentLinkOrderId}
              customerLinkPayment={customerLinkPayment}
              linkedBank={linkedBank}
              bankDetails={bankDetails}
              paidAt={paidAt}
              receiptPhone={receiptPhone}
              receiptStatus={receiptStatus}
              onReceiptPhoneChange={setReceiptPhone}
              onSendReceipt={handleSendReceipt}
              onGoBack={handleGoBackFromSuccess}
            />
          ) : (
            <CheckoutView
              items={items}
              customerLinkPayment={customerLinkPayment}
              currentLinkAmount={currentLinkAmount}
              paymentIntent={paymentIntent}
              paymentStatus={paymentStatus}
              bankError={bankError}
              linkedBank={linkedBank}
              bankDetails={bankDetails}
              onConnectBank={handleConnectBank}
              onConfirmPayment={handleConfirmPayment}
              onCancel={handleCancel}
              onSettleByOrderId={handleSettleByOrderId}
              onBankLinked={handleBankLinked}
              currencySymbol={CURRENCY_SYMBOL}
              tax={tax}
              subtotal={subtotal}
              total={total}
            />
          )}
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      </>
    );
  }

  const handleLogin = () => {
    setIsLoggedIn(true);
    setView("merchant");
    window.history.pushState({}, "", "/");
  };

  const handleLoginError = (message) => {
    showToast(message, "error", 4000);
  };

  const handleLogout = async () => {
    passwordRecoveryPending.current = false;
    setNeedsNewPassword(false);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsLoggedIn(false);
  };

  const handlePasswordRecoveryCompleted = () => {
    passwordRecoveryPending.current = false;
    setNeedsNewPassword(false);
  };

  if (view === "merchant") {
    // Show loading while checking auth
    if (authLoading) {
      return (
        <TabletFrame>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-secondary)" }}>
            Loading…
          </div>
        </TabletFrame>
      );
    }

    // Show login screen if not logged in
    if (!isLoggedIn) {
      return (
        <>
          <TabletFrame>
            <LoginScreen
            onLogin={handleLogin}
            onError={handleLoginError}
            needsNewPassword={needsNewPassword}
            onPasswordUpdated={handlePasswordRecoveryCompleted}
            onCancelPasswordRecovery={handleLogout}
          />
          </TabletFrame>
          <Toast
            message={toast.message}
            type={toast.type}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
          />
        </>
      );
    }

    return (
      <>
        <TabletFrame>
          <MerchantDashboard
          currencySymbol={CURRENCY_SYMBOL}
          merchantPayments={merchantPayments}
          paymentsLoading={paymentsLoading}
          paymentsError={paymentsError}
          merchantBank={merchantBank}
          onLinkBank={handleLinkMerchantBank}
          items={items}
          newItem={newItem}
          presetItems={presetItems}
          onNewItemChange={setNewItem}
          onAddItem={handleAddItem}
          onPresetAdd={handlePresetAdd}
          onItemChange={handleItemChange}
          onRemoveItem={handleRemoveItem}
          receiptTotal={receiptTotal}
          receiptSubtotal={receiptSubtotal}
          receiptTax={receiptTax}
          totalVolume={totalVolume}
          onGenerateNewPayment={handleGenerateNewPayment}
          onAddPayment={(payment) => {
            if (!payment?.id) return;
            setMerchantPayments((prev) => {
              // Check if payment already exists to prevent duplicates
              // Use functional update to ensure we're checking against the latest state
              const exists = prev.some(p => p.id === payment.id);
              if (exists) {
                return prev; // Payment already exists, don't add duplicate
              }
              return [payment, ...prev];
            });
          }}
          statusLabel={statusLabel}
          statusClass={statusClass}
          onRefreshPayments={handleClearPayments}
          onGenerateQr={handleGenerateQr}
          onSettlePayment={handleSettlePayment}
          qrPreview={qrPreview}
          onCloseQr={() => setQrPreview({ id: "", url: "", open: false, payment: null })}
          onCopyCheckoutLink={handleCopyCheckoutLink}
          employees={employees}
          employeesLoading={employeesLoading}
          employeesError={employeesError}
          onAddEmployee={handleAddEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onLogout={supabase ? handleLogout : undefined}
        />
        </TabletFrame>
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      </>
    );
  }

  return null;
}

export default App;

