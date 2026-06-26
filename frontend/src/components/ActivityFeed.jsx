import { useState } from "react";
import { useToast } from "./ToastProvider";

function formatDateTime(dateStr) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

const ACTION_COLORS = {
  PULL: "var(--accent-2)",
  PUSH: "var(--danger)",
  COMMIT: "var(--success)",
  DELETE: "var(--text-muted)",
};

export default function ActivityFeed({ activity, history }) {
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(null);

  async function copyHash(h) {
    try {
      await navigator.clipboard.writeText(h.version_hash);
      setCopiedId(h.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="activity-grid">
      <div className="glass-panel" style={styles.panel}>
        <h3 style={styles.title}>Commit History</h3>
        {history.length === 0 && <div style={styles.empty}>No commits yet for this program.</div>}
        <table style={styles.table}>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} style={styles.row}>
                <td style={styles.hashCell} onClick={() => copyHash(h)} title="Click to copy">
                  {copiedId === h.id ? "✓ copied" : h.version_hash}
                </td>
                <td style={styles.msgCell}>{h.commit_message}</td>
                <td style={styles.metaCell}>{h.author}</td>
                <td style={styles.metaCell}>{formatDateTime(h.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-panel" style={styles.panel}>
        <h3 style={styles.title}>Activity Log</h3>
        {activity.length === 0 && <div style={styles.empty}>No activity recorded yet.</div>}
        <div style={styles.activityList}>
          {activity.map((a) => (
            <div key={a.id} style={styles.activityItem}>
              <span style={{ ...styles.actionBadge, color: ACTION_COLORS[a.action] || "var(--text-secondary)" }}>
                {a.action}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.activityDetail}>{a.detail}</div>
                <div style={styles.activityMeta}>
                  {a.username} · {formatDateTime(a.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  panel: { padding: 20, maxHeight: 320, overflowY: "auto" },
  title: { margin: "0 0 14px", fontSize: 14, fontWeight: 600 },
  empty: { color: "var(--text-muted)", fontSize: 13, padding: "12px 0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  row: { borderBottom: "1px solid var(--panel-border)" },
  hashCell: { padding: "8px 6px", fontFamily: "monospace", color: "var(--accent-2)", cursor: "pointer", userSelect: "none" },
  msgCell: { padding: "8px 6px", color: "var(--text-primary)" },
  metaCell: { padding: "8px 6px", color: "var(--text-muted)", whiteSpace: "nowrap" },
  activityList: { display: "flex", flexDirection: "column", gap: 10 },
  activityItem: { display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--panel-border)" },
  actionBadge: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", paddingTop: 2, minWidth: 50 },
  activityDetail: { fontSize: 12.5, color: "var(--text-primary)" },
  activityMeta: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
};
