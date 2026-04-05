import { useState, useMemo, useEffect } from "react";

function AccountingView({ merchantPayments, currencySymbol }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days back to cover all data
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedView, setSelectedView] = useState("income"); // "income", "cashflow", "balance", "ledger", "reconciliation"
  const [accountingData, setAccountingData] = useState(null);

  // Fallback: Calculate accounting data from merchantPayments if backend fails
  const calculateFrontendAccounting = () => {
    if (!merchantPayments || merchantPayments.length === 0) {
      setAccountingData(null);
      return;
    }

    const filteredPayments = merchantPayments.filter((payment) => {
      const paymentDate = new Date(payment.createdAt || payment.settlementTime);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    // Only count SETTLED/completed payments as revenue (proper accounting practice)
    const settledPayments = filteredPayments.filter(
      (p) => p.status === "SETTLED" || p.status === "succeeded" || p.status === "COMPLETED"
    );

    // Income Statement - only count settled payments as revenue
    const totalRevenue = settledPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const vatRate = 15; // 15% VAT
    const vatAmount = totalRevenue * (vatRate / 100);
    const revenueExcludingVAT = totalRevenue - vatAmount;
    
    // For demo purposes, assume some basic expenses
    // In production, these would come from expense records
    const estimatedExpenses = totalRevenue * 0.3; // 30% of revenue as estimated expenses
    const grossProfit = revenueExcludingVAT - estimatedExpenses;
    const netProfit = grossProfit;

    // Cash Flow - only count settled payments as cash inflows
    const cashIn = totalRevenue; // Only settled payments count as cash in
    const cashOut = estimatedExpenses + vatAmount; // Expenses + VAT payable
    const netCashFlow = cashIn - cashOut;

    // Balance Sheet (simplified)
    const openingBalance = 0; // Starting balance
    const closingBalance = openingBalance + netCashFlow;
    const assets = closingBalance;
    const liabilities = vatAmount; // VAT payable
    const equity = assets - liabilities;

    setAccountingData({
      period: `${dateRange.start} to ${dateRange.end}`,
      incomeStatement: {
        revenue: revenueExcludingVAT,
        vatAmount,
        totalRevenue,
        expenses: estimatedExpenses,
        grossProfit,
        netProfit,
      },
      cashFlow: {
        openingBalance,
        cashIn,
        cashOut,
        netCashFlow,
        closingBalance,
      },
      balanceSheet: {
        assets,
        liabilities,
        equity,
      },
      payments: filteredPayments,
    });
  };

  // Calculate accounting from merchantPayments (single source of truth matching dashboard)
  useEffect(() => {
    calculateFrontendAccounting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, merchantPayments]);

  // Listen for payment completion events to refresh accounting
  useEffect(() => {
    const handlePaymentCompleted = () => {
      calculateFrontendAccounting();
    };

    window.addEventListener('paymentCompleted', handlePaymentCompleted);
    
    return () => {
      window.removeEventListener('paymentCompleted', handlePaymentCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, merchantPayments]);

  // Calculate reconciliation data from accounting data
  const reconciliationData = useMemo(() => {
    if (!accountingData || !accountingData.payments) return null;
    
    const payments = accountingData.payments;
    // All payments from backend accounting are settled (they're only added when SETTLED)
    // But we can still check status for reconciliation
    const settled = payments.filter(p => p.status === "SETTLED" || p.status === "succeeded" || p.status === "COMPLETED");
    const pending = payments.filter(p => p.status === "PENDING" || p.status === "AUTHORISED" || p.status === "processing");
    
    const expectedTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const settledTotal = settled.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingTotal = pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const discrepancy = expectedTotal - settledTotal;
    const matchRate = expectedTotal > 0 ? (settledTotal / expectedTotal) * 100 : 100;
    
    return {
      totalTransactions: payments.length,
      settledCount: settled.length,
      pendingCount: pending.length,
      expectedTotal,
      settledTotal,
      pendingTotal,
      discrepancy,
      matchRate,
      unmatched: pending,
      settledPayments: settled,
    };
  }, [accountingData]);

  const handleExportCSV = (type) => {
    if (!accountingData) return;

    let csvRows = [];
    let filename = "";

    if (type === "income") {
      csvRows = [
        ["Income Statement", accountingData.period],
        [],
        ["Revenue (Excl. VAT)", `${currencySymbol}${accountingData.incomeStatement.revenue.toFixed(2)}`],
        ["VAT Amount", `${currencySymbol}${accountingData.incomeStatement.vatAmount.toFixed(2)}`],
        ["Total Revenue (Incl. VAT)", `${currencySymbol}${accountingData.incomeStatement.totalRevenue.toFixed(2)}`],
        [],
        ["Expenses", `${currencySymbol}${accountingData.incomeStatement.expenses.toFixed(2)}`],
        [],
        ["Gross Profit", `${currencySymbol}${accountingData.incomeStatement.grossProfit.toFixed(2)}`],
        ["Net Profit", `${currencySymbol}${accountingData.incomeStatement.netProfit.toFixed(2)}`],
      ];
      filename = `income-statement-${dateRange.start}-to-${dateRange.end}.csv`;
    } else if (type === "cashflow") {
      csvRows = [
        ["Cash Flow Statement", accountingData.period],
        [],
        ["Opening Balance", `${currencySymbol}${accountingData.cashFlow.openingBalance.toFixed(2)}`],
        [],
        ["Cash Inflows", `${currencySymbol}${accountingData.cashFlow.cashIn.toFixed(2)}`],
        ["Cash Outflows", `${currencySymbol}${accountingData.cashFlow.cashOut.toFixed(2)}`],
        [],
        ["Net Cash Flow", `${currencySymbol}${accountingData.cashFlow.netCashFlow.toFixed(2)}`],
        ["Closing Balance", `${currencySymbol}${accountingData.cashFlow.closingBalance.toFixed(2)}`],
      ];
      filename = `cash-flow-${dateRange.start}-to-${dateRange.end}.csv`;
    } else if (type === "balance") {
      csvRows = [
        ["Balance Sheet", accountingData.period],
        [],
        ["ASSETS"],
        ["Cash & Bank", `${currencySymbol}${accountingData.balanceSheet.assets.toFixed(2)}`],
        ["Total Assets", `${currencySymbol}${accountingData.balanceSheet.assets.toFixed(2)}`],
        [],
        ["LIABILITIES"],
        ["VAT Payable", `${currencySymbol}${accountingData.balanceSheet.liabilities.toFixed(2)}`],
        ["Total Liabilities", `${currencySymbol}${accountingData.balanceSheet.liabilities.toFixed(2)}`],
        [],
        ["EQUITY"],
        ["Retained Earnings", `${currencySymbol}${accountingData.balanceSheet.equity.toFixed(2)}`],
        ["Total Equity", `${currencySymbol}${accountingData.balanceSheet.equity.toFixed(2)}`],
        [],
        ["Total Liabilities + Equity", `${currencySymbol}${(accountingData.balanceSheet.liabilities + accountingData.balanceSheet.equity).toFixed(2)}`],
      ];
      filename = `balance-sheet-${dateRange.start}-to-${dateRange.end}.csv`;
    } else if (type === "ledger") {
      csvRows = [
        ["General Ledger", accountingData.period],
        [],
        ["Date", "Transaction ID", "Description", "Debit", "Credit", "Balance"],
      ];
      let runningBalance = accountingData.cashFlow.openingBalance;
      accountingData.payments.forEach((payment) => {
        const date = new Date(payment.createdAt || payment.settlementTime).toLocaleDateString();
        const amount = Number(payment.amount) || 0;
        const isSettled = payment.status === "SETTLED" || payment.status === "succeeded" || payment.status === "COMPLETED";
        // Only add settled payments to running balance (proper accounting)
        if (isSettled) {
          runningBalance += amount;
        }
        csvRows.push([
          date,
          payment.id || "N/A",
          `${payment.description || "Payment received"}${!isSettled ? ` (${payment.status || "PENDING"})` : ""}`,
          isSettled ? `${currencySymbol}${amount.toFixed(2)}` : `(${currencySymbol}${amount.toFixed(2)})`,
          "",
          `${currencySymbol}${runningBalance.toFixed(2)}`,
        ]);
      });
      filename = `general-ledger-${dateRange.start}-to-${dateRange.end}.csv`;
    } else if (type === "reconciliation" && reconciliationData) {
      csvRows = [
        ["Bank Reconciliation Report", accountingData.period],
        [],
        ["Summary"],
        ["Total Transactions", reconciliationData.totalTransactions],
        ["Settled", reconciliationData.settledCount],
        ["Pending/Unmatched", reconciliationData.pendingCount],
        [],
        ["Expected Total", `${currencySymbol}${reconciliationData.expectedTotal.toFixed(2)}`],
        ["Settled Total", `${currencySymbol}${reconciliationData.settledTotal.toFixed(2)}`],
        ["Pending Total", `${currencySymbol}${reconciliationData.pendingTotal.toFixed(2)}`],
        ["Discrepancy", `${currencySymbol}${Math.abs(reconciliationData.discrepancy).toFixed(2)}`],
        ["Match Rate", `${reconciliationData.matchRate.toFixed(1)}%`],
        [],
        ["Unmatched Transactions"],
        ["Date", "Transaction ID", "Status", "Amount"],
      ];
      
      reconciliationData.unmatched.forEach((payment) => {
        const date = new Date(payment.createdAt || payment.settlementTime).toLocaleDateString();
        csvRows.push([
          date,
          payment.id || "N/A",
          payment.status || "PENDING",
          `${currencySymbol}${(Number(payment.amount) || 0).toFixed(2)}`,
        ]);
      });
      
      filename = `reconciliation-${dateRange.start}-to-${dateRange.end}.csv`;
    }

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="accounting-view">
      <div className="vat-header">
        <div>
          <h2 className="merchant-name">Accounting Books</h2>
        </div>
      </div>

      <div className="till-card" style={{ marginTop: "24px" }}>
        <h3 className="merchant-name" style={{ marginBottom: "16px" }}>
          Date Range
        </h3>
        <div className="till-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="receipt-label" htmlFor="accounting-start-date">
                Start Date
              </label>
              <input
                id="accounting-start-date"
                type="date"
                className="receipt-input"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="receipt-label" htmlFor="accounting-end-date">
                End Date
              </label>
              <input
                id="accounting-end-date"
                type="date"
                className="receipt-input"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* View Selector */}
      <div className="admin-tabs" style={{ marginTop: "24px", marginBottom: "24px" }}>
        <button
          className={`admin-tab-button ${selectedView === "income" ? "active" : ""}`}
          onClick={() => setSelectedView("income")}
        >
          Income Statement
        </button>
        <button
          className={`admin-tab-button ${selectedView === "cashflow" ? "active" : ""}`}
          onClick={() => setSelectedView("cashflow")}
        >
          Cash Flow
        </button>
        <button
          className={`admin-tab-button ${selectedView === "balance" ? "active" : ""}`}
          onClick={() => setSelectedView("balance")}
        >
          Balance Sheet
        </button>
        <button
          className={`admin-tab-button ${selectedView === "ledger" ? "active" : ""}`}
          onClick={() => setSelectedView("ledger")}
        >
          General Ledger
        </button>
        <button
          className={`admin-tab-button ${selectedView === "reconciliation" ? "active" : ""}`}
          onClick={() => setSelectedView("reconciliation")}
        >
          Reconciliation
        </button>
      </div>

      {accountingData && (
        <>
          {/* Income Statement */}
          {selectedView === "income" && (
            <div className="till-card">
              <div className="header-row" style={{ marginBottom: "20px" }}>
                <div>
                  <h3 className="merchant-name" style={{ margin: 0 }}>
                    Income Statement - {accountingData.period}
                  </h3>
                  <p className="metric-label" style={{ marginTop: "4px" }}>
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleExportCSV("income")}
                >
                  Export CSV
                </button>
              </div>

              <div className="vat-summary">
                <div className="vat-summary-row">
                  <span className="vat-label">Revenue (Excl. VAT):</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.incomeStatement.revenue.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">VAT Amount (15%):</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.incomeStatement.vatAmount.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Total Revenue (Incl. VAT):</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.incomeStatement.totalRevenue.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Expenses:</span>
                  <span className="vat-value" style={{ color: "var(--red)" }}>
                    -{currencySymbol}{accountingData.incomeStatement.expenses.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Gross Profit:</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.incomeStatement.grossProfit.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Net Profit:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.incomeStatement.netProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Cash Flow Statement */}
          {selectedView === "cashflow" && (
            <div className="till-card">
              <div className="header-row" style={{ marginBottom: "20px" }}>
                <div>
                  <h3 className="merchant-name" style={{ margin: 0 }}>
                    Cash Flow Statement - {accountingData.period}
                  </h3>
                  <p className="metric-label" style={{ marginTop: "4px" }}>
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleExportCSV("cashflow")}
                >
                  Export CSV
                </button>
              </div>

              <div className="vat-summary">
                <div className="vat-summary-row">
                  <span className="vat-label">Opening Balance:</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.cashFlow.openingBalance.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Cash Inflows:</span>
                  <span className="vat-value" style={{ color: "var(--green)" }}>
                    +{currencySymbol}{accountingData.cashFlow.cashIn.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Cash Outflows:</span>
                  <span className="vat-value" style={{ color: "var(--red)" }}>
                    -{currencySymbol}{accountingData.cashFlow.cashOut.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Net Cash Flow:</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.cashFlow.netCashFlow.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Closing Balance:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.cashFlow.closingBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {selectedView === "balance" && (
            <div className="till-card">
              <div className="header-row" style={{ marginBottom: "20px" }}>
                <div>
                  <h3 className="merchant-name" style={{ margin: 0 }}>
                    Balance Sheet - {accountingData.period}
                  </h3>
                  <p className="metric-label" style={{ marginTop: "4px" }}>
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleExportCSV("balance")}
                >
                  Export CSV
                </button>
              </div>

              <div className="vat-summary">
                <h4 className="merchant-name" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                  ASSETS
                </h4>
                <div className="vat-summary-row">
                  <span className="vat-label">Cash & Bank:</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.balanceSheet.assets.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Total Assets:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.balanceSheet.assets.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <h4 className="merchant-name" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                  LIABILITIES
                </h4>
                <div className="vat-summary-row">
                  <span className="vat-label">VAT Payable:</span>
                  <span className="vat-value">
                    {currencySymbol}{accountingData.balanceSheet.liabilities.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Total Liabilities:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.balanceSheet.liabilities.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <h4 className="merchant-name" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                  EQUITY
                </h4>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Retained Earnings:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.balanceSheet.equity.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Total Equity:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{accountingData.balanceSheet.equity.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "2px solid var(--text)" }} />
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Total Liabilities + Equity:</span>
                  <span className="vat-value vat-value-highlight">
                    {currencySymbol}{(accountingData.balanceSheet.liabilities + accountingData.balanceSheet.equity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* General Ledger */}
          {selectedView === "ledger" && (
            <div className="till-card">
              <div className="header-row" style={{ marginBottom: "20px" }}>
                <div>
                  <h3 className="merchant-name" style={{ margin: 0 }}>
                    General Ledger - {accountingData.period}
                  </h3>
                  <p className="metric-label" style={{ marginTop: "4px" }}>
                    Transaction history and running balance
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleExportCSV("ledger")}
                >
                  Export CSV
                </button>
              </div>

              {accountingData.payments.length > 0 ? (
                <div className="vat-payments-table">
                  <div className="vat-payments-header">
                    <div className="vat-payments-cell">Date</div>
                    <div className="vat-payments-cell">Transaction ID</div>
                    <div className="vat-payments-cell">Description</div>
                    <div className="vat-payments-cell" style={{ textAlign: "right" }}>Debit</div>
                    <div className="vat-payments-cell" style={{ textAlign: "right" }}>Credit</div>
                    <div className="vat-payments-cell" style={{ textAlign: "right" }}>Balance</div>
                  </div>
                  {(() => {
                    let runningBalance = accountingData.cashFlow.openingBalance;
                    return accountingData.payments.map((payment, idx) => {
                      const amount = Number(payment.amount) || 0;
                      const isSettled = payment.status === "SETTLED" || payment.status === "succeeded" || payment.status === "COMPLETED";
                      // Only add settled payments to running balance (proper accounting)
                      if (isSettled) {
                        runningBalance += amount;
                      }
                      const date = new Date(payment.createdAt || payment.settlementTime).toLocaleDateString();
                      return (
                        <div key={payment.id || `payment-${idx}`} className="vat-payments-row">
                          <div className="vat-payments-cell">{date}</div>
                          <div className="vat-payments-cell mono">{payment.id || "N/A"}</div>
                          <div className="vat-payments-cell">
                            {payment.description || "Payment received"}
                            {!isSettled && (
                              <span className="pill pill-processing" style={{ marginLeft: "8px", fontSize: "0.75rem" }}>
                                {payment.status || "PENDING"}
                              </span>
                            )}
                          </div>
                          <div className="vat-payments-cell" style={{ 
                            textAlign: "right", 
                            color: isSettled ? "var(--green)" : "#9ca3af",
                            opacity: isSettled ? 1 : 0.6
                          }}>
                            {isSettled ? `${currencySymbol}${amount.toFixed(2)}` : `(${currencySymbol}${amount.toFixed(2)})`}
                          </div>
                          <div className="vat-payments-cell" style={{ textAlign: "right" }}>-</div>
                          <div className="vat-payments-cell" style={{ textAlign: "right", fontWeight: 600 }}>
                            {currencySymbol}{runningBalance.toFixed(2)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="payment-subtext" style={{ textAlign: "center", marginTop: "16px" }}>
                  No transactions found for the selected date range.
                </p>
              )}
            </div>
          )}

          {/* Reconciliation View */}
          {selectedView === "reconciliation" && reconciliationData && (
            <div className="till-card">
              <div className="header-row" style={{ marginBottom: "20px" }}>
                <div>
                  <h3 className="merchant-name" style={{ margin: 0 }}>
                    Bank Reconciliation - {accountingData.period}
                  </h3>
                  <p className="metric-label" style={{ marginTop: "4px" }}>
                    Match transactions and identify discrepancies
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleExportCSV("reconciliation")}
                >
                  Export CSV
                </button>
              </div>

              {/* Reconciliation Summary */}
              <div className="vat-summary" style={{ marginBottom: "24px" }}>
                <div className="vat-summary-row">
                  <span className="vat-label">Total Transactions:</span>
                  <span className="vat-value">{reconciliationData.totalTransactions}</span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Settled:</span>
                  <span className="vat-value" style={{ color: "var(--green)" }}>
                    {reconciliationData.settledCount}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Pending/Unmatched:</span>
                  <span className="vat-value" style={{ color: reconciliationData.pendingCount > 0 ? "#f59e0b" : "var(--green)" }}>
                    {reconciliationData.pendingCount}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Expected Total:</span>
                  <span className="vat-value">
                    {currencySymbol}{reconciliationData.expectedTotal.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Settled Total:</span>
                  <span className="vat-value" style={{ color: "var(--green)" }}>
                    {currencySymbol}{reconciliationData.settledTotal.toFixed(2)}
                  </span>
                </div>
                <div className="vat-summary-row">
                  <span className="vat-label">Pending Total:</span>
                  <span className="vat-value" style={{ color: "#f59e0b" }}>
                    {currencySymbol}{reconciliationData.pendingTotal.toFixed(2)}
                  </span>
                </div>
                <hr style={{ margin: "16px 0", border: "none", borderTop: "2px solid var(--border)" }} />
                <div className="vat-summary-row">
                  <span className="vat-label">Discrepancy:</span>
                  <span className="vat-value" style={{ 
                    color: reconciliationData.discrepancy === 0 ? "var(--green)" : "#ef4444",
                    fontWeight: 700 
                  }}>
                    {reconciliationData.discrepancy === 0 ? "✓ Balanced" : `${currencySymbol}${Math.abs(reconciliationData.discrepancy).toFixed(2)}`}
                  </span>
                </div>
                <div className="vat-summary-row vat-summary-row-highlight">
                  <span className="vat-label">Match Rate:</span>
                  <span className="vat-value vat-value-highlight" style={{ 
                    color: reconciliationData.matchRate === 100 ? "var(--green)" : "#f59e0b" 
                  }}>
                    {reconciliationData.matchRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Unmatched Transactions Table */}
              {reconciliationData.unmatched.length > 0 && (
                <div>
                  <h4 className="merchant-name" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                    Unmatched Transactions ({reconciliationData.unmatched.length})
                  </h4>
                  <div className="vat-payments-table">
                    <div className="vat-payments-header" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                      <div className="vat-payments-cell">Date</div>
                      <div className="vat-payments-cell">Transaction ID</div>
                      <div className="vat-payments-cell">Status</div>
                      <div className="vat-payments-cell" style={{ textAlign: "right" }}>Amount</div>
                    </div>
                    {reconciliationData.unmatched.map((payment, idx) => (
                      <div key={payment.id || `unmatched-${idx}`} className="vat-payments-row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                        <div className="vat-payments-cell">
                          {new Date(payment.createdAt || payment.settlementTime).toLocaleDateString()}
                        </div>
                        <div className="vat-payments-cell mono">{payment.id || "N/A"}</div>
                        <div className="vat-payments-cell">
                          <span className={`pill pill-processing`}>
                            {payment.status || "PENDING"}
                          </span>
                        </div>
                        <div className="vat-payments-cell" style={{ textAlign: "right", fontWeight: 600 }}>
                          {currencySymbol}{(Number(payment.amount) || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconciliationData.unmatched.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #86efac" }}>
                  <p style={{ margin: 0, color: "#166534", fontWeight: 600 }}>
                    ✓ All transactions reconciled
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!accountingData && (
        <div className="till-card" style={{ marginTop: "24px" }}>
          <p className="payment-subtext" style={{ textAlign: "center" }}>
            No payment data available for the selected period.
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountingView;

