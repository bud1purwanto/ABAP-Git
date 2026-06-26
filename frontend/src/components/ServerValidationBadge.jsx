/**
 * ServerValidationBadge
 * Displays the current validation status for a selected server.
 * Used inline below a server dropdown.
 */
export default function ServerValidationBadge({ checking, passed, message, onRetry }) {
  if (checking) {
    return (
      <div style={{ ...base, color: "#818cf8", borderColor: "rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.06)" }}>
        <span style={dot("#818cf8")} />
        <span>Checking server access…</span>
      </div>
    );
  }

  if (passed === null) return null; // nothing selected yet

  if (!passed) {
    return (
      <div style={{ ...base, color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
          <span style={dot("#ef4444")} />
          <span>{message}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#fca5a5",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              marginLeft: 10,
              flexShrink: 0,
            }}
          >
            🔄 Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...base, color: "#86efac", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)" }}>
      <span style={dot("#22c55e")} />
      <span>{message}</span>
    </div>
  );
}

const base = {
  display: "flex", alignItems: "flex-start", gap: 8,
  fontSize: 12, padding: "7px 10px", borderRadius: 8,
  border: "1px solid", marginTop: 6, lineHeight: 1.5,
};

function dot(color) {
  return {
    width: 7, height: 7, borderRadius: "50%", background: color,
    flexShrink: 0, marginTop: 3,
  };
}
