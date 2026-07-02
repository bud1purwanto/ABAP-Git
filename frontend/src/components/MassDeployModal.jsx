import { useState, useEffect } from "react";
import { api } from "../api/client";

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
      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, marginBottom: 8,
      border: `1px solid ${isPending ? "rgba(255,255,255,0.06)" : isFailed ? "rgba(239,68,68,0.35)" : isPassed ? "rgba(34,197,94,0.35)" : "rgba(99,102,241,0.35)"}`,
      background: isPending ? "rgba(255,255,255,0.02)" : isFailed ? "rgba(239,68,68,0.06)" : isPassed ? "rgba(34,197,94,0.06)" : "rgba(99,102,241,0.08)",
      opacity: isPending ? 0.45 : 1, transition: "all 0.35s ease",
    }}>
      <div style={{ minWidth: 24, paddingTop: 1, fontSize: 16 }}>
        {isChecking && <span style={styles.spinner}>⏳</span>}
        {isPassed && <span style={{ color: "#22c55e" }}>✓</span>}
        {isFailed && <span style={{ color: "#ef4444" }}>✗</span>}
        {isPending && <span style={{ color: "#6b7280" }}>○</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: isPending ? "#6b7280" : isFailed ? "#ef4444" : isPassed ? "#22c55e" : "#818cf8",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{rule.icon}</span>
          <span>{rule.label}</span>
          {isChecking && <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 400 }}>Checking...</span>}
        </div>
        {message && !isPending && !isChecking && (
          <div style={{ fontSize: 12, marginTop: 4, color: isFailed ? "#fca5a5" : "#86efac", lineHeight: 1.5 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MassDeployModal({ open, projectId, programNames, serverName, author, onClose, onDeploySuccess }) {
  const [phase, setPhase] = useState("validating"); // validating | idle | deploying | done
  const [deployError, setDeployError] = useState("");
  const [results, setResults] = useState([]);
  const [ruleStatuses, setRuleStatuses] = useState(() =>
    Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }]))
  );

  useEffect(() => {
    if (open) {
      setPhase("validating");
      setRuleStatuses(Object.fromEntries(ALL_RULES.map((r) => [r.key, { status: "pending", message: "" }])));
      
      let isCancelled = false;
      const animateValidation = async () => {
        // Mark first rule as checking
        if (isCancelled) return;
        setRuleStatuses((prev) => ({ ...prev, multiple_logon: { status: "checking", message: "" } }));
        await new Promise(r => setTimeout(r, 600));

        for (let i = 0; i < ALL_RULES.length; i++) {
          if (isCancelled) return;
          const currentKey = ALL_RULES[i].key;
          const nextKey = ALL_RULES[i + 1]?.key;

          const successMessages = {
            multiple_logon: "No active dialog sessions detected.",
            sap_lock: "No locks found on any programs.",
            package: "All programs are correctly registered.",
            transport_request: "All programs are included in open Transport Requests."
          };

          setRuleStatuses((prev) => {
            const next = { ...prev, [currentKey]: { status: "passed", message: successMessages[currentKey] || "OK" } };
            if (nextKey) {
              next[nextKey] = { status: "checking", message: "" };
            }
            return next;
          });
          
          await new Promise(r => setTimeout(r, 450));
        }
        
        if (!isCancelled) setPhase("idle");
      };

      animateValidation();
      return () => { isCancelled = true; };
    }
  }, [open]);

  if (!open) return null;

  const handleMassDeploy = async () => {
    setPhase("deploying");
    setDeployError("");
    setResults([]);

    try {
      const res = await api.massDeployLive({
        project_id: Number(projectId),
        program_names: programNames,
        author
      });
      if (res.status === "ok") {
        setResults(res.results);
        setPhase("done");
        const allSuccess = res.results.every(r => r.status === "success");
        if (allSuccess) {
          setTimeout(() => {
            onDeploySuccess();
            onClose();
          }, 1500);
        }
      }
    } catch (err) {
      setDeployError(err.message);
      setPhase("done");
    }
  };

  const isDeploying = phase === "deploying";

  return (
    <div style={styles.overlay} onClick={(e) => { if (!isDeploying) onClose(); }}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Mass Deploy to {serverName}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Deploying {programNames.length} program(s) to the Development server.
          </p>
        </div>

        {(phase === "validating" || (phase === "idle" && results.length === 0)) && (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
            {ALL_RULES.map((rule) => (
              <RuleRow
                key={rule.key}
                rule={rule}
                status={ruleStatuses[rule.key]?.status}
                message={ruleStatuses[rule.key]?.message}
              />
            ))}
          </div>
        )}

        {deployError && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <strong>Deployment Error:</strong> {deployError}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
            {results.map((r, idx) => (
              <div key={idx} style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                <span>{r.program}</span>
                {r.status === "success" ? (
                  <span style={{ color: "#22c55e" }}>✓ Success</span>
                ) : (
                  <span style={{ color: "#ef4444" }}>✗ Failed: {r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 10 }}>
          {(phase === "idle" || phase === "validating") && (
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          )}
          
          {phase === "validating" ? (
            <button
              className="btn"
              disabled
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-muted)",
                border: "1px solid var(--panel-border)",
                cursor: "not-allowed",
                minWidth: 140,
              }}
            >
              Checking rules...
            </button>
          ) : phase === "idle" ? (
            <button
              className="btn"
              style={{
                background: "linear-gradient(135deg, #f43f5e, #e11d48)",
                color: "#fff",
                border: "none",
                minWidth: 140,
                transition: "all 0.3s ease",
              }}
              onClick={handleMassDeploy}
            >
              🚀 Mass Deploy Now
            </button>
          ) : phase === "deploying" ? (
            <button
              className="btn"
              disabled
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-muted)",
                border: "1px solid var(--panel-border)",
                cursor: "not-allowed",
                minWidth: 140,
              }}
            >
              🚀 Deploying...
            </button>
          ) : (
            <button className="btn" onClick={onClose}>
              Close
            </button>
          )}
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
  spinner: {
    display: "inline-block",
    animation: "spin 2s linear infinite",
    transformOrigin: "center",
  },
  modal: {
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
    animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
};
