import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function DeployLiveModal({ open, programName, author, deploying, onConfirm, onCancel }) {
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      runValidation();
    } else {
      setChecks([]);
      setHasValidated(false);
      setValidationError("");
    }
  }, [open]);

  async function runValidation() {
    setChecking(true);
    setValidationError("");
    try {
      const res = await api.validateLiveDeployment(programName, author);
      setChecks(res.checks || []);
      setHasValidated(true);
    } catch (err) {
      setValidationError(err.message);
      setChecks([]);
      setHasValidated(false);
    } finally {
      setChecking(false);
    }
  }

  if (!open) return null;

  const allPassed = hasValidated && checks.length > 0 && checks.every((c) => c.passed);
  const canDeploy = allPassed && !checking && !deploying;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div className="glass-panel" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.icon}>🚀</div>
        <h3 style={styles.title}>Deploy to Development</h3>
        <p style={styles.message}>
          You are about to deploy <strong>{programName}</strong> to the Development environment.
        </p>

        <div style={styles.checksBox}>
          {validationError && <div style={styles.fetchError}>Could not run validation: {validationError}</div>}

          {!validationError &&
            (checking && checks.length === 0 ? (
              <div style={styles.checkRow}>
                <span style={styles.spinner} />
                <span style={styles.checkLabel}>Running validation checks...</span>
              </div>
            ) : (
              checks.map((c) => (
                <div key={c.key} style={styles.checkRow}>
                  <span style={{ ...styles.statusIcon, color: c.passed ? "var(--success)" : "var(--danger)" }}>
                    {c.passed ? "✓" : "✕"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.checkLabel}>{c.label}</div>
                    <div style={{ ...styles.checkMessage, color: c.passed ? "var(--text-muted)" : "var(--danger)" }}>
                      {c.message}
                    </div>
                  </div>
                </div>
              ))
            ))}
        </div>

        {hasValidated && !allPassed && !checking && (
          <button className="btn" style={{ marginBottom: 12, width: "100%" }} onClick={runValidation}>
            ↻ Re-check
          </button>
        )}

        <div style={styles.actions}>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={!canDeploy}
            title={!allPassed ? "All checks must pass before deploying" : ""}
          >
            {deploying ? "Deploying..." : checking ? "Validating..." : "Validate & Deploy"}
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
    zIndex: 1000,
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    width: 440,
    maxWidth: "90vw",
    padding: "28px 28px",
    textAlign: "center",
    animation: "fadeInScale 0.2s ease",
  },
  icon: { fontSize: 28, marginBottom: 8 },
  title: { margin: "0 0 8px", fontSize: 16 },
  message: { color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 18, lineHeight: 1.5 },
  checksBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    textAlign: "left",
    background: "rgba(15, 23, 42, 0.4)",
    border: "1px solid var(--panel-border)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    minHeight: 60,
  },
  checkRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  statusIcon: { fontWeight: 700, fontSize: 14, paddingTop: 1, flexShrink: 0, width: 16, textAlign: "center" },
  checkLabel: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },
  checkMessage: { fontSize: 12, marginTop: 2, lineHeight: 1.4 },
  fetchError: { color: "var(--danger)", fontSize: 13 },
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid var(--panel-border)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    flexShrink: 0,
  },
  actions: { display: "flex", gap: 10, justifyContent: "center" },
};
