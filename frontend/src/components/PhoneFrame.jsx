import "./PhoneFrame.css";

function PhoneFrame({ children }) {
  return (
    <div className="phone-frame-container">
      <div className="phone-frame">
        {/* Status Bar */}
        <div className="phone-status-bar">
          <div className="status-bar-left">
            <span className="status-bar-time">9:41</span>
          </div>
          <div className="status-bar-right">
            <span className="status-bar-signal">📶</span>
            <span className="status-bar-wifi">📶</span>
            <span className="status-bar-battery">🔋</span>
          </div>
        </div>

        {/* Safe Area / Notch */}
        <div className="phone-safe-area-top"></div>

        {/* Content Area */}
        <div className="phone-content">
          {children}
        </div>

        {/* Bottom Safe Area (for home indicator) */}
        <div className="phone-safe-area-bottom">
          <div className="phone-home-indicator"></div>
        </div>
      </div>
    </div>
  );
}

export default PhoneFrame;
