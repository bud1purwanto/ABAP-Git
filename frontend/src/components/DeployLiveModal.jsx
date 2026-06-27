import { useState, useEffect } from "react";
import { api } from "../api/client";

// All 4 rules in display order — backend may return fewer if it stopped early
const ALL_RULES = [
  { key: "multiple_logon", label: "Multiple Logon Check", icon: "👤" },
  { key: "sap_lock", label: "SAP Lock / Edit Check", icon: "🔒" },
  { key: "package", label: "Package Check (ZTRD)", icon: "📦" },
  { key: "transport_request", label: "Transport Request Check", icon: "🚚" },
];

// status: "pending" | "checking" | "passed" | "failed"
function RuleRow({ rule, status, message }) {
  const isPending = status === "pending";
  const isChecking = status === "checking";
  const isPassed = status === "passed";
  const isFailed = status === "failed";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 10,
      marginBottom: 8,
      border: `1px solid ${isPending ? "rgba(255,255,255,0.06)" : isFailed ? "rgba(239,68,68,0.35)" : isPassed ? "rgba(34,197,94,0.35)" : "rgba(99,102,241,0.35)"}`,
      background: isPending
        ? "rgba(255,255,255,0.02)"
        : isFailed
        ? "rgba(239,68,68,0.06)"
        : isPassed
        ? "rgba(34,197,94,0.06)"
        : "rgba(99,102,241,0.08)",
      opacity: isPending ? 0.45 : 1,
      transition: "all 0.35s ease",
    }}>
      {/* Status icon */}
      <div style={{ minWidth: 24, paddingTop: 1, fontSize: 16 }}>
        {isChecking && <span style={styles.spinner}>⏳</span>}
        {isPassed && <span style={{ color: "#22c55e" }}>✓</span>}
        {isFailed && <span style={{ color: "#ef4444" }}>✗</span>}
        {isPending && <span style={{ color: "#6b7280" }}>○</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Rule label */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: isPending ? "#6b7280" : isFailed ? "#ef4444" : isPassed ? "#22c55e" : "#818cf8",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span>{rule.icon}</span>
          <span>{rule.label}</span>
          {isChecking && (
            <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 400 }}>Checking...</span>
          )}
        </div>

        {/* Message — only show once we have a result */}
        {message && !isPending && !isChecking && (
          <div style={{
            fontSize: 12,
            marginTop: 4,
            color: isFailed ? "#fca5a5" : "#86efac",
            lineHeight: 1.5,
          }}>
            {message}
          </div>
        )}

        {/* Pending placeholder */}
        {isPending && (
          <div style={{ fontSize: 12, marginTop: 3, color: "#4b5563" }}>Waiting…</div>
        )}
      </div>
    </div>
  );
}

export default function DeployLiveModal({ open, programName, serverName, versionId, author, onClose, onDeploySuccess }) {
  const [phase, setPhase] = useState("idle"); // idle | validating | done_fail | done_ok | deploying | deployed
  const [ruleStatuses, setRuleStatuses] = useState(() =>
    Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }]))
  );
  const [deployError, setDeployError] = useState("");

  // Auto-run validation whenever the modal opens
  useEffect(() => {
    if (open) {
      setDeployError("");
      setRuleStatuses(Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }])));
      // Small delay so the modal is visible before rules start ticking
      const t = setTimeout(() => handleValidate(), 150);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleValidate() {
    setPhase("validating");
    setDeployError("");

    // Show ALL rules as pending first
    setRuleStatuses(Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }])));

    try {
      // Mark first rule as "checking"
      setRuleStatuses((prev) => ({ ...prev, multiple_logon: { status: "checking", message: "" } }));

      const res = await api.validateLiveDeployment({ program_name: programName, author });
      const checks = res.checks; // array of {key, label, passed, message}

      // Animate results one by one, 450ms apart
      for (let i = 0; i < checks.length; i++) {
        const check = checks[i];
        const nextKey = ALL_RULES[i + 1]?.key;

        // Small delay for visual effect
        await new Promise((resolve) => setTimeout(resolve, 400));

        setRuleStatuses((prev) => {
          const next = { ...prev, [check.key]: { status: check.passed ? "passed" : "failed", message: check.message } };
          // If there's a next rule and current passed, mark next as "checking"
          if (check.passed && nextKey) {
            next[nextKey] = { status: "checking", message: "" };
          }
          return next;
        });

        // Stop animating if this rule failed (backend already stopped here)
        if (!check.passed) break;
      }

      setPhase(res.all_passed ? "done_ok" : "done_fail");
    } catch (err) {
      setDeployError(err.message || "Validation failed.");
      setPhase("done_fail");
    }
  }

  async function handleDeploy() {
    setPhase("deploying");
    try {
      await api.deployToLive({ program_name: programName, version_id: versionId, author });
      setPhase("deployed");
      onDeploySuccess?.();
    } catch (err) {
      setDeployError(err.message || "Deployment failed.");
      setPhase("done_fail");
    }
  }

  if (!open) return null;

  const isValidating = phase === "validating";
  const isDeploying = phase === "deploying";
  const allOk = phase === "done_ok";
  const deployed = phase === "deployed";

  return (
    <div style={styles.overlay} onClick={phase === "idle" ? onClose : undefined}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>🚀</div>
          <div>
            <div style={styles.headerTitle}>Deploy to {serverName || "Live Development"}</div>
            <div style={styles.headerSub}>
              {programName} — validating {ALL_RULES.length} security rules
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--panel-border)", margin: "16px 0" }} />

        {/* Rules list */}
        <div style={{ marginBottom: 16 }}>
          {ALL_RULES.map((rule) => (
            <RuleRow
              key={rule.key}
              rule={rule}
              status={ruleStatuses[rule.key]?.status || "pending"}
              message={ruleStatuses[rule.key]?.message || ""}
            />
          ))}
        </div>

        {/* Error banner */}
        {deployError && (
          <div style={styles.errorBanner}>
            ⚠ {deployError}
          </div>
        )}

        {/* Success banner */}
        {deployed && (
          <div style={styles.successBanner}>
            ✓ Program deployed successfully to {serverName || "Live Development"}!
          </div>
        )}

        {/* Actions — always visible: Retry (left) + Deploy (right) */}
        <div style={styles.actions}>
          {deployed ? (
            <button className="btn btn-success" style={{ flex: 1 }} onClick={onClose}>
              ✓ Close
            </button>
          ) : (
            <>
              {/* Cancel */}
              <button
                className="btn"
                onClick={onClose}
                disabled={isDeploying}
              >
                Cancel
              </button>

              {/* Retry */}
              <button
                className="btn"
                onClick={handleValidate}
                disabled={isValidating || isDeploying}
              >
                🔄 Retry
              </button>

              {/* Deploy — only active when all rules passed */}
              <button
                className="btn"
                onClick={handleDeploy}
                disabled={!allOk || isDeploying || isValidating}
                title={!allOk ? "All validation rules must pass first" : "Deploy to Live"}
                style={{
                  background: allOk && !isDeploying
                    ? "linear-gradient(135deg, #f43f5e, #e11d48)"
                    : "rgba(255,255,255,0.06)",
                  color: allOk && !isDeploying ? "#fff" : "var(--text-muted)",
                  border: allOk && !isDeploying ? "none" : "1px solid var(--panel-border)",
                  transition: "all 0.3s ease",
                  cursor: !allOk || isDeploying || isValidating ? "not-allowed" : "pointer",
                  minWidth: 140,
                }}
              >
                {isDeploying ? "🚀 Deploying…" : "🚀 Deploy Now"}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(2,6,23,0.75)",
    backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease",
  },
  modal: {
    width: "100%", maxWidth: 500,
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 18, padding: "24px 24px 20px",
    boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
    animation: "fadeInScale 0.2s ease",
  },
  header: { display: "flex", alignItems: "flex-start", gap: 14 },
  headerIcon: { fontSize: 32, lineHeight: 1 },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 },
  headerSub: { fontSize: 12.5, color: "var(--text-muted)", fontFamily: "monospace" },
  spinner: { display: "inline-block", animation: "spin 1s linear infinite" },
  errorBanner: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5",
    marginBottom: 16, lineHeight: 1.5,
  },
  successBanner: {
    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.35)",
    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#86efac",
    marginBottom: 16,
  },
  actions: { display: "flex", gap: 10, justifyContent: "flex-end" },
};
