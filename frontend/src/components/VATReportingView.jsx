import { useState, useMemo } from "react";

function VATReportingView({ merchantPayments, currencySymbol }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [vatRate, setVatRate] = useState(15); // Default 15% VAT (South Africa)
  const [reportGenerated, setReportGenerated] = useState(false);

  // Calculate VAT from payments
  const vatReport = useMemo(() => {
    if (!merchantPayments || merchantPayments.length === 0) {
      return null;
    }

    const filteredPayments = merchantPayments.filter((payment) => {
      const paymentDate = new Date(payment.createdAt || payment.settlementTime);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalRevenue = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const vatAmount = totalRevenue * (vatRate / 100);
    const revenueExcludingVAT = totalRevenue - vatAmount;

    return {
      period: `${dateRange.start} to ${dateRange.end}`,
      totalPayments: filteredPayments.length,
      totalRevenue,
      revenueExcludingVAT,
      vatAmount,
      vatRate,
      payments: filteredPayments,
    };
  }, [merchantPayments, dateRange, vatRate]);

  const handleGenerateReport = () => {
    setReportGenerated(true);
  };

  const handleExportCSV = () => {
    if (!vatReport) return;

    const csvRows = [
      ["VAT Report", vatReport.period],
      [],
      ["Total Payments", vatReport.totalPayments],
      ["Total Revenue (Incl. VAT)", `${currencySymbol}${vatReport.totalRevenue.toFixed(2)}`],
      ["Revenue (Excl. VAT)", `${currencySymbol}${vatReport.revenueExcludingVAT.toFixed(2)}`],
      ["VAT Amount", `${currencySymbol}${vatReport.vatAmount.toFixed(2)}`],
      ["VAT Rate", `${vatReport.vatRate}%`],
      [],
      ["Payment ID", "Date", "Amount", "VAT"],
    ];

    vatReport.payments.forEach((payment) => {
      const paymentVAT = (Number(payment.amount) || 0) * (vatRate / 100);
      const date = new Date(payment.createdAt || payment.settlementTime).toLocaleDateString();
      csvRows.push([
        payment.id || "N/A",
        date,
        `${currencySymbol}${(Number(payment.amount) || 0).toFixed(2)}`,
        `${currencySymbol}${paymentVAT.toFixed(2)}`,
      ]);
    });

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="vat-reporting-view">
      <div className="vat-header">
        <div>
          <h2 className="merchant-name">VAT Tax Reporting</h2>
          <p className="metric-label" style={{ marginTop: "4px" }}>
            Generate VAT reports for tax compliance
          </p>
        </div>
      </div>

      <div className="till-card" style={{ marginTop: "24px" }}>
        <h3 className="merchant-name" style={{ marginBottom: "16px" }}>
          Report Configuration
        </h3>
        <div className="till-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="receipt-label" htmlFor="start-date">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                className="receipt-input"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start: e.target.value });
                  setReportGenerated(false);
                }}
              />
            </div>
            <div>
              <label className="receipt-label" htmlFor="end-date">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                className="receipt-input"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange({ ...dateRange, end: e.target.value });
                  setReportGenerated(false);
                }}
              />
            </div>
          </div>

          <div>
            <label className="receipt-label" htmlFor="vat-rate">
              VAT Rate (%)
            </label>
            <input
              id="vat-rate"
              type="number"
              className="receipt-input"
              value={vatRate}
              onChange={(e) => {
                setVatRate(Number(e.target.value));
                setReportGenerated(false);
              }}
              min="0"
              max="100"
              step="0.1"
            />
            <p className="payment-subtext" style={{ marginTop: "4px", fontSize: "0.8rem", textAlign: "left" }}>
              Default: 15% (South Africa standard rate)
            </p>
          </div>

          <div className="processing-actions">
            <button
              type="button"
              className="pay-button"
              onClick={handleGenerateReport}
              disabled={!dateRange.start || !dateRange.end}
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {reportGenerated && vatReport && (
        <div className="till-card" style={{ marginTop: "24px" }}>
          <div className="header-row" style={{ marginBottom: "20px" }}>
            <div>
              <h3 className="merchant-name" style={{ margin: 0 }}>
                VAT Report: {vatReport.period}
              </h3>
              <p className="metric-label" style={{ marginTop: "4px" }}>
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
          </div>

          <div className="vat-summary">
            <div className="vat-summary-row">
              <span className="vat-label">Total Payments:</span>
              <span className="vat-value">{vatReport.totalPayments}</span>
            </div>
            <div className="vat-summary-row">
              <span className="vat-label">Total Revenue (Incl. VAT):</span>
              <span className="vat-value">
                {currencySymbol}{vatReport.totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="vat-summary-row">
              <span className="vat-label">Revenue (Excl. VAT):</span>
              <span className="vat-value">
                {currencySymbol}{vatReport.revenueExcludingVAT.toFixed(2)}
              </span>
            </div>
            <div className="vat-summary-row vat-summary-row-highlight">
              <span className="vat-label">VAT Amount ({vatReport.vatRate}%):</span>
              <span className="vat-value vat-value-highlight">
                {currencySymbol}{vatReport.vatAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {vatReport.payments.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h4 className="merchant-name" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                Payment Details
              </h4>
              <div className="vat-payments-table">
                <div className="vat-payments-header">
                  <div className="vat-payments-cell">Payment ID</div>
                  <div className="vat-payments-cell">Date</div>
                  <div className="vat-payments-cell" style={{ textAlign: "right" }}>Amount</div>
                  <div className="vat-payments-cell" style={{ textAlign: "right" }}>VAT</div>
                </div>
                {vatReport.payments.map((payment, idx) => {
                  const paymentVAT = (Number(payment.amount) || 0) * (vatRate / 100);
                  const date = new Date(payment.createdAt || payment.settlementTime).toLocaleDateString();
                  return (
                    <div key={payment.id || `vat-payment-${idx}`} className="vat-payments-row">
                      <div className="vat-payments-cell mono">{payment.id || "N/A"}</div>
                      <div className="vat-payments-cell">{date}</div>
                      <div className="vat-payments-cell" style={{ textAlign: "right" }}>
                        {currencySymbol}{(Number(payment.amount) || 0).toFixed(2)}
                      </div>
                      <div className="vat-payments-cell" style={{ textAlign: "right" }}>
                        {currencySymbol}{paymentVAT.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {vatReport.payments.length === 0 && (
            <p className="payment-subtext" style={{ marginTop: "16px", textAlign: "center" }}>
              No payments found for the selected date range.
            </p>
          )}
        </div>
      )}

      {reportGenerated && !vatReport && (
        <div className="till-card" style={{ marginTop: "24px" }}>
          <p className="payment-subtext" style={{ textAlign: "center" }}>
            No payment data available for the selected period.
          </p>
        </div>
      )}
    </div>
  );
}

export default VATReportingView;
