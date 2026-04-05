import { useState, useCallback } from "react";

function EmployeesView({
  employees,
  employeesLoading,
  employeesError,
  onAddEmployee,
  onDeleteEmployee,
  currencySymbol,
}) {
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    phoneNumber: "",
    bankAccountNumber: "",
    bankName: "",
    accountHolderName: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const toggleDetails = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleInputChange = (field, value) => {
    setNewEmployee((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newEmployee.name || (!newEmployee.phoneNumber && !newEmployee.bankAccountNumber)) {
      return;
    }
    onAddEmployee(newEmployee);
    setNewEmployee({
      name: "",
      phoneNumber: "",
      bankAccountNumber: "",
      bankName: "",
      accountHolderName: "",
    });
    setShowAddForm(false);
  };

  return (
    <div className="employees-view">
      <div className="employees-header">
        <h2 className="merchant-name">Employees</h2>
        <button
          className="pay-button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Employee"}
        </button>
      </div>

      {showAddForm && (
        <div className="till-card">
          <h3 className="merchant-name" style={{ marginBottom: "16px" }}>
            Add New Employee
          </h3>
          <form className="till-form" onSubmit={handleSubmit}>
            <label className="receipt-label" htmlFor="employee-name">
              Name *
            </label>
            <input
              id="employee-name"
              type="text"
              className="receipt-input"
              placeholder="Employee name"
              value={newEmployee.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />

            <label className="receipt-label" htmlFor="employee-phone">
              Phone Number
            </label>
            <input
              id="employee-phone"
              type="tel"
              className="receipt-input"
              placeholder="e.g. +27 12 345 6789"
              value={newEmployee.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
            />

            <label className="receipt-label" htmlFor="employee-bank-name">
              Bank Name
            </label>
            <input
              id="employee-bank-name"
              type="text"
              className="receipt-input"
              placeholder="e.g. Standard Bank"
              value={newEmployee.bankName}
              onChange={(e) => handleInputChange("bankName", e.target.value)}
            />

            <label className="receipt-label" htmlFor="employee-account-holder">
              Account Holder Name
            </label>
            <input
              id="employee-account-holder"
              type="text"
              className="receipt-input"
              placeholder="Name on bank account"
              value={newEmployee.accountHolderName}
              onChange={(e) => handleInputChange("accountHolderName", e.target.value)}
            />

            <label className="receipt-label" htmlFor="employee-account-number">
              Bank Account Number
            </label>
            <input
              id="employee-account-number"
              type="text"
              className="receipt-input"
              placeholder="Bank account number"
              value={newEmployee.bankAccountNumber}
              onChange={(e) => handleInputChange("bankAccountNumber", e.target.value)}
            />

            <p className="payment-subtext" style={{ marginTop: "8px", fontSize: "0.85rem" }}>
              * At least phone number or bank account number is required
            </p>

            <div className="processing-actions">
              <button type="submit" className="pay-button">
                Save Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {employeesLoading ? (
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="till-card">
              <div className="skeleton-row" style={{ height: "18px", width: "40%", marginBottom: "8px" }} />
              <div className="skeleton-row" style={{ height: "14px", width: "60%" }} />
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="till-card" style={{ marginTop: "24px" }}>
          <p className="payment-subtext">
            No employees added yet. Click "Add Employee" to get started.
          </p>
        </div>
      ) : (
        <div className="employees-list" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {employees.map((employee, idx) => {
            const isExpanded = expandedId === employee.id;
            const hasBankInfo = employee.bankAccountNumber || employee.bankName || employee.accountHolderName;

            return (
              <div key={employee.id} className="till-card" style={{ padding: "16px 20px", background: idx % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 className="merchant-name" style={{ margin: 0, fontSize: "1rem" }}>
                      {employee.name}
                    </h3>
                    {employee.phoneNumber && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                        {employee.phoneNumber}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {hasBankInfo && (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => toggleDetails(employee.id)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        {isExpanded ? "Hide Details" : "Details"}
                      </button>
                    )}
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onDeleteEmployee(employee.id)}
                      style={{ color: "#ef4444", fontSize: "0.8rem" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && hasBankInfo && (
                  <div style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--border)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px 16px",
                    fontSize: "0.85rem",
                  }}>
                    {employee.bankName && (
                      <div>
                        <span style={{ color: "var(--muted)" }}>Bank</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{employee.bankName}</p>
                      </div>
                    )}
                    {employee.accountHolderName && (
                      <div>
                        <span style={{ color: "var(--muted)" }}>Account Holder</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{employee.accountHolderName}</p>
                      </div>
                    )}
                    {employee.bankAccountNumber && (
                      <div>
                        <span style={{ color: "var(--muted)" }}>Account Number</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 600 }}>****{employee.bankAccountNumber.slice(-4)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EmployeesView;
