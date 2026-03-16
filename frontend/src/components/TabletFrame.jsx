import { useEffect, useRef } from "react";
import "./TabletFrame.css";

function TabletFrame({ children }) {
  const tabletContentRef = useRef(null);

  // Scroll to top on mount
  useEffect(() => {
    if (tabletContentRef.current) {
      tabletContentRef.current.scrollTop = 0;
      tabletContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <div className="tablet-frame-container">
      <div className="tablet-frame">
        {/* Status Bar */}
        <div className="tablet-status-bar">
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
        <div className="tablet-safe-area-top"></div>

        {/* Content Area */}
        <div className="tablet-content" ref={tabletContentRef}>
          {children}
        </div>

        {/* Bottom Safe Area (for home indicator) */}
        <div className="tablet-safe-area-bottom">
          <div className="tablet-home-indicator"></div>
        </div>
      </div>
    </div>
  );
}

export default TabletFrame;
