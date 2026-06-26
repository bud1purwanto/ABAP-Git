import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { api } from "../api/client";
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
  DEPLOY_LIVE: "#f43f5e",
};

const CARDS = [
  { key: "total_sandboxes", label: "Servers", icon: "▣" },
  { key: "total_programs", label: "Programs Versioned", icon: "⌬" },
  { key: "total_commits", label: "Total Commits", icon: "⎇" },
  { key: "commits_today", label: "Commits Today", icon: "◷" },
];

export default function OverviewTab({ username }) {
  const [stats, setStats] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api
      .getOverviewStats()
      .then(setStats)
      .catch((err) => toast.error(err.message));
  }, []);

  if (!stats) {
    return <LoadingSpinner message="Fetching dashboard stats..." />;
  }

  return (
    <div className="page-padding" style={styles.container}>
      <h2 style={styles.heading}>Welcome back, {username}</h2>
      <p style={styles.subheading}>Here's what's happening across your ABAP Git middleware.</p>

      <div className="stats-card-grid">
        {CARDS.map((c) => (
          <div key={c.key} className="glass-panel" style={styles.card}>
            <div style={styles.cardIcon}>{c.icon}</div>
            <div style={styles.cardValue}>{stats ? stats[c.key] : "—"}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="glass-panel" style={styles.activityPanel}>
          <h3 style={styles.panelTitle}>Recent Commits</h3>
          {stats && stats.recent_commits.length === 0 && (
            <div style={styles.empty}>No commits recorded yet.</div>
          )}
          <div style={styles.activityList}>
            {(stats?.recent_commits || []).map((c) => (
              <div key={c.id} style={styles.activityItem}>
                <span style={{ ...styles.actionBadge, color: "var(--success)" }}>
                  COMMIT
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.activityDetail}>
                    <span style={{ fontFamily: "monospace", color: "var(--accent-2)" }}>{c.program_name}</span> - {c.commit_message}
                  </div>
                  <div style={styles.activityMeta}>
                    {c.author} · {formatDateTime(c.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={styles.activityPanel}>
          <h3 style={styles.panelTitle}>Recent Activity</h3>
          {stats && stats.recent_activity.length === 0 && (
            <div style={styles.empty}>No activity recorded yet. Start by pulling a program from SAP.</div>
          )}
          <div style={styles.activityList}>
            {(stats?.recent_activity || []).map((a) => (
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
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 24 },
  card: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6 },
  cardIcon: {
    fontSize: 18,
    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    marginBottom: 4,
  },
  cardValue: { fontSize: 28, fontWeight: 700 },
  cardLabel: { fontSize: 12.5, color: "var(--text-secondary)" },
  activityPanel: { padding: 20 },
  panelTitle: { margin: "0 0 14px", fontSize: 14, fontWeight: 600 },
  empty: { color: "var(--text-muted)", fontSize: 13, padding: "12px 0" },
  activityList: { display: "flex", flexDirection: "column", gap: 10 },
  activityItem: { display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--panel-border)" },
  actionBadge: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", paddingTop: 2, minWidth: 50 },
  activityDetail: { fontSize: 12.5, color: "var(--text-primary)" },
  activityMeta: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
};
