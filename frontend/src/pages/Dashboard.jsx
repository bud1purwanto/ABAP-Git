import { useState } from "react";
import OverviewTab from "../components/OverviewTab";
import SandboxesTab from "../components/SandboxesTab";
import GitOperationsTab from "../components/GitOperationsTab";
import UsersTab from "../components/UsersTab";
import ThemeToggle from "../components/ThemeToggle";

const TABS = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "git", label: "Git Operations", icon: "⎇" },
  { id: "sandboxes", label: "Sandboxes", icon: "▣" },
  { id: "users", label: "Users", icon: "☺" },
];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const displayName = user.git_author_name || user.username;

  return (
    <div className="app-layout">
      <aside className="glass-panel app-sidebar">
        <div style={styles.brand}>
          <span style={styles.brandIcon}>⌬</span>
          <div className="app-brand-text">
            <div style={styles.brandTitle}>ABAP Git</div>
            <div style={styles.brandSubtitle}>Versioning Console</div>
          </div>
        </div>

        <nav className="app-sidebar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="nav-item"
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navItem,
                ...(activeTab === tab.id ? styles.navItemActive : {}),
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-userbox" style={styles.userBox}>
          <div style={styles.avatar}>{displayName?.[0]?.toUpperCase() || "U"}</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div className="app-username" style={styles.userName}>
              {displayName}
            </div>
            <div className="app-userrole" style={styles.userRole}>
              ABAP Developer
            </div>
          </div>
          <ThemeToggle />
          <button className="btn" style={styles.logoutBtn} onClick={onLogout} title="Logout">
            ⏻
          </button>
        </div>
      </aside>

      <main className="app-main">
        {activeTab === "overview" && <OverviewTab username={displayName} />}
        {activeTab === "git" && <GitOperationsTab author={user.username} />}
        {activeTab === "sandboxes" && <SandboxesTab />}
        {activeTab === "users" && <UsersTab />}
      </main>
    </div>
  );
}

const styles = {
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
    padding: "0 4px",
  },
  brandIcon: {
    fontSize: 26,
    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  brandTitle: { fontSize: 14, fontWeight: 700 },
  brandSubtitle: { fontSize: 11, color: "var(--text-muted)" },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: 10,
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--text-secondary)",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s ease",
  },
  navItemActive: {
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.35)",
    color: "var(--text-primary)",
    boxShadow: "0 0 0 1px var(--accent-glow)",
  },
  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
    borderTop: "1px solid var(--panel-border)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: { fontSize: 11, color: "var(--text-muted)" },
  logoutBtn: { padding: "6px 10px", fontSize: 14 },
};
