import DiffViewer from "./DiffViewer";

export default function FullscreenDiffModal({
  open,
  onClose,
  title,
  leftLabel,
  leftSubLabel,
  leftColor = "var(--accent-2)",
  rightLabel,
  rightSubLabel,
  rightColor = "#f43f5e",
  leftCode,
  rightCode,
  footer,
}) {
  if (!open) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.legendRow}>
          <div style={{ ...styles.legendBadge, borderColor: leftColor }}>
            <span style={{ ...styles.legendDot, background: leftColor }} />
            <div>
              <div style={styles.legendLabel}>{leftLabel}</div>
              {leftSubLabel && <div style={styles.legendSub}>{leftSubLabel}</div>}
            </div>
          </div>

          <div style={styles.arrow}>vs</div>

          <div style={{ ...styles.legendBadge, borderColor: rightColor }}>
            <span style={{ ...styles.legendDot, background: rightColor }} />
            <div>
              <div style={styles.legendLabel}>{rightLabel}</div>
              {rightSubLabel && <div style={styles.legendSub}>{rightSubLabel}</div>}
            </div>
          </div>
        </div>

        <div style={styles.diffContainer}>
          <DiffViewer original={leftCode} modified={rightCode} sideBySide={true} />
        </div>

        {footer && <div style={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalContent: {
    background: "var(--bg-deep)",
    border: "1px solid var(--panel-border)",
    borderRadius: 16,
    width: "95vw",
    height: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
    overflow: "hidden",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid var(--panel-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--panel-bg)",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 20,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
  },
  legendRow: {
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "var(--panel-bg)",
    borderBottom: "1px solid var(--panel-border)",
  },
  legendBadge: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid",
    background: "var(--input-bg)",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 2,
  },
  legendLabel: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)" },
  legendSub: { fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 },
  arrow: {
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-muted)",
    background: "var(--input-bg)",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--panel-border)",
    flexShrink: 0,
  },
  diffContainer: { flex: 1, padding: 16, minHeight: 0, display: "flex", flexDirection: "column" },
  footer: {
    padding: "12px 24px",
    borderTop: "1px solid var(--panel-border)",
    background: "var(--panel-bg)",
  },
};
