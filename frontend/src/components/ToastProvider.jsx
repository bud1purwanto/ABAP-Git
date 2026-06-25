import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

const ICONS = { success: "✓", error: "✕", info: "ℹ" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg, duration) => push(msg, "success", duration),
    error: (msg, duration) => push(msg, "error", duration),
    info: (msg, duration) => push(msg, "info", duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} className="glass-panel" style={{ ...styles.toast, ...typeStyles[t.type] }}>
            <span style={styles.icon}>{ICONS[t.type]}</span>
            <span style={styles.message}>{t.message}</span>
            <button style={styles.close} onClick={() => dismiss(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const typeStyles = {
  success: { borderColor: "rgba(52, 211, 153, 0.4)", color: "#a7f3d0" },
  error: { borderColor: "rgba(248, 113, 113, 0.4)", color: "#fecaca" },
  info: { borderColor: "rgba(34, 211, 238, 0.4)", color: "#a5f3fc" },
};

const styles = {
  container: {
    position: "fixed",
    bottom: 20,
    right: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    zIndex: 2000,
    maxWidth: 380,
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    fontSize: 13.5,
    animation: "fadeInScale 0.2s ease",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  },
  icon: { fontWeight: 700, flexShrink: 0, paddingTop: 1 },
  message: { flex: 1, lineHeight: 1.4, color: "var(--text-primary)" },
  close: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    flexShrink: 0,
  },
};
