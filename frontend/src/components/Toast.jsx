function Toast({ message, type, actionLabel, onAction }) {
  if (!message) return null;
  return (
    <div className={`toast toast-${type || "info"}`}>
      <span>{message}</span>
      {actionLabel && onAction && (
        <button className="toast-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default Toast;
