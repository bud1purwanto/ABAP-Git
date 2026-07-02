import { useState, useEffect } from "react";
import { api } from "../api/client";

// All 4 rules in display order
const ALL_RULES = [
  { key: "multiple_logon", label: "Multiple Logon Check", icon: "👤" },
  { key: "sap_lock", label: "SAP Lock / Edit Check", icon: "🔒" },
  { key: "package", label: "Package Check (ZTRD / $TMP)", icon: "📦" },
  { key: "transport_request", label: "Transport Request Check", icon: "🚚" },
];

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
      <div style={{ minWidth: 24, paddingTop: 1, fontSize: 16 }}>
        {isChecking && <span style={styles.spinner}>⏳</span>}
        {isPassed && <span style={{ color: "#22c55e" }}>✓</span>}
        {isFailed && <span style={{ color: "#ef4444" }}>✗</span>}
        {isPending && <span style={{ color: "#6b7280" }}>○</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
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
      </div>
    </div>
  );
}

export default function ScanUndeployedModal({ open, projectId, author, onClose, onScanSuccess }) {
  const [phase, setPhase] = useState("idle"); // idle | checking | failed
  const [ruleStatuses, setRuleStatuses] = useState(() =>
    Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }]))
  );

  useEffect(() => {
    if (open) {
      let isCancelled = false;
      setRuleStatuses(Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }])));
      setPhase("checking");
      
      // Simulate checking animation visually before API returns
      const simTimer = setTimeout(() => {
        if (!isCancelled) {
          setRuleStatuses(prev => ({
            ...prev,
            multiple_logon: { status: "checking", message: "" }
          }));
        }
      }, 100);

      api.scanUndeployed({ project_id: Number(projectId), author })
        .then(async (res) => {
          if (isCancelled) return;
          if (res.status === "failed") {
            // Found a failed rule
            const failedRuleIndex = ALL_RULES.findIndex(r => r.key === res.failed_rule);
            
            const successMessages = {
              multiple_logon: "No active dialog sessions detected.",
              sap_lock: "No locks found on any programs.",
              package: "All programs are correctly registered.",
              transport_request: "All programs are included in open Transport Requests."
            };

            // Animate passing the rules before the failed one
            for (let i = 0; i < failedRuleIndex; i++) {
              if (isCancelled) return;
              const rKey = ALL_RULES[i].key;
              const nextKey = ALL_RULES[i + 1]?.key;
              setRuleStatuses(prev => {
                const next = { ...prev, [rKey]: { status: "passed", message: successMessages[rKey] || "OK" } };
                if (nextKey) next[nextKey] = { status: "checking", message: "" };
                return next;
              });
              await new Promise(r => setTimeout(r, 450));
            }
            if (isCancelled) return;
            
            // Show the failed rule
            setRuleStatuses(prev => ({
              ...prev,
              [res.failed_rule]: { status: "failed", message: `[${res.program_name}] ${res.message}` } 
            }));
            setPhase("failed");
          } else {
            const successMessages = {
              multiple_logon: "No active dialog sessions detected.",
              sap_lock: "No locks found on any programs.",
              package: "All programs are correctly registered.",
              transport_request: "All programs are included in open Transport Requests."
            };

            // Success - animate all rules passing
            for (let i = 0; i < ALL_RULES.length; i++) {
              if (isCancelled) return;
              const rKey = ALL_RULES[i].key;
              const nextKey = ALL_RULES[i + 1]?.key;
              setRuleStatuses(prev => {
                const next = { ...prev, [rKey]: { status: "passed", message: successMessages[rKey] || "OK" } };
                if (nextKey) next[nextKey] = { status: "checking", message: "" };
                return next;
              });
              await new Promise(r => setTimeout(r, 450));
            }
            if (isCancelled) return;
            
            setTimeout(() => {
              onScanSuccess(res.undeployed);
              onClose();
            }, 600); // Wait a bit so user sees green checks
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          setPhase("failed");
          setRuleStatuses(prev => ({
            ...prev,
            multiple_logon: { status: "failed", message: err.message }
          }));
        });

      return () => {
        isCancelled = true;
        clearTimeout(simTimer);
      };
    }
  }, [open, projectId, author, onClose, onScanSuccess]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={(e) => { if (phase !== "checking") onClose(); }}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Scanning Undeployed Programs
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Running pre-deployment checks against the Development server...
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {ALL_RULES.map((rule) => {
            let st = ruleStatuses[rule.key]?.status || "pending";
            // If phase is checking, make the first pending rule spin
            if (phase === "checking" && st === "pending") {
              const prevRules = ALL_RULES.slice(0, ALL_RULES.indexOf(rule));
              const allPrevPassed = prevRules.every(r => ruleStatuses[r.key]?.status === "passed");
              if (allPrevPassed) st = "checking";
            }
            return (
              <RuleRow
                key={rule.key}
                rule={rule}
                status={st}
                message={ruleStatuses[rule.key]?.message}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 10 }}>
          <button
            className="btn"
            disabled={phase === "checking"}
            onClick={onClose}
          >
            {phase === "checking" ? "Checking..." : "Exit"}
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
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
    animation: "fadeIn 0.2s ease-out",
  },
  modal: {
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 540,
    boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
    animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  spinner: {
    display: "inline-block",
    animation: "spin 2s linear infinite",
    transformOrigin: "center",
  }
};
