import { useState } from "react";
import OverviewTab from "../components/OverviewTab";
import SandboxesTab from "../components/SandboxesTab";
import GitOperationsTab from "../components/GitOperationsTab";
import GitLogTab from "../components/GitLogTab";
import SyncTab from "../components/SyncTab";
import CompareServerTab from "../components/CompareServerTab";
import UsersTab from "../components/UsersTab";
import ThemeToggle from "../components/ThemeToggle";
import ConfirmModal from "../components/ConfirmModal";

const TABS = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "git", label: "Git Operations", icon: "⎇" },
  { id: "gitlog", label: "Git Log & Setting", icon: "🗒" },
  { id: "sync", label: "Sync", icon: "⟳" },
  { id: "compare", label: "Compare Server", icon: "⇆" },
  { id: "sandboxes", label: "Server", icon: "▣" },
  { id: "users", label: "Users", icon: "☺" },
];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const displayName = user.git_author_name || user.username;

  function selectTab(id) {
    setActiveTab(id);
    setNavOpen(false);
  }

  return (
    <div className="app-layout">
      <div className="app-topbar glass-panel">
        <button className="hamburger-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>
        <span style={styles.brandIcon}>⌬</span>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>ABAP Git</div>
        <ThemeToggle />
      </div>

      <div className={`nav-drawer-backdrop ${navOpen ? "is-open" : ""}`} onClick={() => setNavOpen(false)} />

      <aside className={`glass-panel app-sidebar ${navOpen ? "is-open" : ""}`}>
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
              onClick={() => selectTab(tab.id)}
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

        <div className="app-userbox user-card">
          <div style={styles.userBoxRow1}>
            <div style={styles.avatarWrapper}>
              <div style={styles.avatar}>{displayName?.[0]?.toUpperCase() || "U"}</div>
              <span className="online-dot" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="app-username" style={styles.userName}>
                {displayName}
              </div>
              <div className="app-userrole" style={styles.usernameTag} title={user.username}>
                {user.username}
              </div>
              {user.role === "super_admin" && <span style={styles.roleTag}>★ Super Admin</span>}
            </div>
          </div>

          <div className="user-card-divider" />

          <div style={styles.userBoxRow2}>
            <span style={styles.onlineText}>
              <span style={styles.onlineTextDot} /> Online
            </span>
            <div style={styles.userBoxActions}>
              <ThemeToggle />
              <span className="user-card-vdivider" />
              <button className="btn" style={styles.logoutBtn} onClick={() => setConfirmLogout(true)} title="Logout">
                ⏻
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={confirmLogout}
        title="Log out"
        message="Are you sure you want to log out of ABAP Git Versioning Console?"
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <main className="app-main">
        {/* All tabs stay mounted — hidden with CSS so state is preserved when switching */}
        <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
          <OverviewTab username={displayName} active={activeTab === "overview"} />
        </div>
        <div style={{ display: activeTab === "git" ? "block" : "none" }}>
          <GitOperationsTab author={user.username} />
        </div>
        <div style={{ display: activeTab === "gitlog" ? "block" : "none" }}>
          <GitLogTab currentUser={user} />
        </div>
        <div style={{ display: activeTab === "sync" ? "block" : "none" }}>
          <SyncTab author={user.username} />
        </div>
        <div style={{ display: activeTab === "compare" ? "block" : "none" }}>
          <CompareServerTab />
        </div>
        <div style={{ display: activeTab === "sandboxes" ? "block" : "none" }}>
          <SandboxesTab currentUser={user} />
        </div>
        <div style={{ display: activeTab === "users" ? "block" : "none" }}>
          <UsersTab currentUser={user} />
        </div>
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
  userBoxRow1: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  userBoxRow2: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  userBoxActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  avatarWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "#fff",
    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.4)",
  },
  userName: {
    fontSize: 13.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  usernameTag: {
    display: "inline-block",
    marginTop: 4,
    maxWidth: "100%",
    fontSize: 10.5,
    fontFamily: "monospace",
    letterSpacing: 0.3,
    color: "var(--accent-2)",
    background: "rgba(34, 211, 238, 0.1)",
    border: "1px solid rgba(34, 211, 238, 0.25)",
    borderRadius: 5,
    padding: "1px 6px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  roleTag: {
    display: "inline-block",
    marginTop: 4,
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: "#fbbf24",
    background: "rgba(251, 191, 36, 0.12)",
    border: "1px solid rgba(251, 191, 36, 0.35)",
    borderRadius: 5,
    padding: "1px 6px",
  },
  onlineText: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "var(--text-muted)",
  },
  onlineTextDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--success)",
    boxShadow: "0 0 5px var(--success)",
    flexShrink: 0,
  },
  logoutBtn: { padding: "6px 10px", fontSize: 14 },
};
