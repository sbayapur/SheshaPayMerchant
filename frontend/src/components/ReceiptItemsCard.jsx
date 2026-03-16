function ReceiptItemsCard({
  currencySymbol,
  receiptTotal,
  receiptSubtotal,
  receiptTax,
  items,
  newItem,
  presetItems,
  onNewItemChange,
  onAddItem,
  onPresetAdd,
  onItemChange,
  onRemoveItem,
  onGeneratePayment,
}) {
  return (
    <div className="items-card">
      <form className="items-form" onSubmit={onAddItem}>
        <div className="items-inputs">
          <div className="input-stack">
            <label className="receipt-label" htmlFor="item-name">
              Item name
            </label>
            <input
              id="item-name"
              type="text"
              className="receipt-input"
              placeholder="e.g. Curly Haircut"
              value={newItem.name}
              onChange={(e) =>
                onNewItemChange((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="input-stack">
            <label className="receipt-label" htmlFor="item-price">
              Price
            </label>
            <input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              className="receipt-input"
              placeholder="0.00"
              value={newItem.price}
              onChange={(e) =>
                onNewItemChange((prev) => ({ ...prev, price: e.target.value }))
              }
            />
          </div>
          <div className="input-stack">
            <label className="receipt-label" htmlFor="item-quantity">
              Qty
            </label>
            <input
              id="item-quantity"
              type="number"
              min="1"
              step="1"
              className="receipt-input"
              value={newItem.quantity}
              onChange={(e) =>
                onNewItemChange((prev) => ({ ...prev, quantity: e.target.value }))
              }
            />
          </div>
        </div>
        <button type="submit" className="pay-button">
          Add item
        </button>
      </form>

      <div className="items-list">
        {items.map((item, index) => (
          <div className="items-row" key={`${item.name}-${index}`}>
            <input
              className="receipt-input item-inline-input"
              value={item.name}
              onChange={(e) => onItemChange(index, "name", e.target.value)}
            />
            <div className="items-actions">
              <input
                className="receipt-input item-qty-input"
                type="number"
                min="1"
                step="1"
                value={item.quantity || 1}
                onChange={(e) => onItemChange(index, "quantity", e.target.value)}
              />
              <input
                className="receipt-input item-price-input"
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => onItemChange(index, "price", e.target.value)}
              />
              <button
                className="ghost-button"
                type="button"
                onClick={() => onRemoveItem(index)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {onGeneratePayment && (
        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
          <div style={{ marginBottom: "12px" }}>
            <div className="receipt-total" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Subtotal</span>
              <span>
                {currencySymbol} {(receiptSubtotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="receipt-total" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Tax (15%)</span>
              <span>
                {currencySymbol} {(receiptTax || 0).toFixed(2)}
              </span>
            </div>
            <div className="receipt-total" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
              <strong>Total</strong>
              <strong>
                {currencySymbol} {receiptTotal.toFixed(2)}
              </strong>
            </div>
          </div>
          <button
            type="button"
            className="pay-button"
            onClick={(e) => {
              e.preventDefault();
              onGeneratePayment(e);
            }}
            disabled={receiptTotal <= 0 || items.length === 0}
            style={{ width: "100%" }}
          >
            Create Invoice
          </button>
        </div>
      )}
    </div>
  );
}

export default ReceiptItemsCard;
