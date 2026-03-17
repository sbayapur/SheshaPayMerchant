import { useEffect, useRef } from "react";

function TabletFrame({ children }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      contentRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  return (
    <div className="dashboard-wrapper" ref={contentRef}>
      {children}
    </div>
  );
}

export default TabletFrame;
