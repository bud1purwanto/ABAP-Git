export default function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmLabel = "Delete" }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div className="glass-panel" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.icon}>⚠</div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    width: 360,
    padding: "28px 28px",
    textAlign: "center",
    animation: "fadeInScale 0.2s ease",
  },
  icon: {
    fontSize: 28,
    color: "var(--danger)",
    marginBottom: 8,
  },
  title: { margin: "0 0 8px", fontSize: 16 },
  message: { color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 22, lineHeight: 1.5 },
  actions: { display: "flex", gap: 10, justifyContent: "center" },
};
