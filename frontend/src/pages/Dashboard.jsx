import { useState } from "react";
import OverviewTab from "../components/OverviewTab";
import SandboxesTab from "../components/SandboxesTab";
import GitOperationsTab from "../components/GitOperationsTab";
import GitLogTab from "../components/GitLogTab";
import SyncTab from "../components/SyncTab";
import CompareServerTab from "../components/CompareServerTab";
import ProjectsTab from "../components/ProjectsTab";
import UsersTab from "../components/UsersTab";
import ThemeToggle from "../components/ThemeToggle";
import ConfirmModal from "../components/ConfirmModal";
import ChangePasswordModal from "../components/ChangePasswordModal";

const TABS = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "git", label: "Git Operations", icon: "⎇" },
  { id: "gitlog", label: "Git Log & Setting", icon: "🗒" },
  { id: "sync", label: "Sync", icon: "⟳" },
  { id: "compare", label: "Compare Server", icon: "⇆" },
  { id: "projects", label: "Projects", icon: "🗂" },
  { id: "sandboxes", label: "Server", icon: "▣" },
  { id: "users", label: "Users", icon: "☺" },
];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
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
            <div style={styles.brandSubtitle}>Version Control System</div>
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
              <div className="app-username" style={styles.userName} title={displayName}>
                {displayName}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                <div className="app-userrole" style={styles.usernameTag} title={user.username}>
                  {user.username}
                </div>
                {user.role === "super_admin" && <div style={styles.roleTag} title="Super Admin">👑</div>}
              </div>
            </div>
          </div>

          <div className="user-card-divider" />

          <div style={styles.userBoxRow2}>
            <div style={styles.userBoxActions}>
              <ThemeToggle />
              <span className="user-card-vdivider" />
              <button className="btn" style={styles.logoutBtn} onClick={() => setChangePasswordOpen(true)} title="Change Password">
                🔑
              </button>
              <button className="btn" style={styles.logoutBtn} onClick={() => setConfirmLogout(true)} title="Logout">
                ⏻
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={confirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out of ABAP Version Control System?"
        confirmLabel="Logout"
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        username={user.username}
      />

      <main className="app-main">
        {/* All tabs stay mounted — hidden with CSS so state is preserved when switching */}
        <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
          <OverviewTab username={displayName} active={activeTab === "overview"} />
        </div>
        <div style={{ display: activeTab === "git" ? "block" : "none" }}>
          <GitOperationsTab author={user.username} active={activeTab === "git"} />
        </div>
        <div style={{ display: activeTab === "gitlog" ? "block" : "none" }}>
          <GitLogTab currentUser={user} active={activeTab === "gitlog"} />
        </div>
        <div style={{ display: activeTab === "sync" ? "block" : "none" }}>
          <SyncTab author={user.username} active={activeTab === "sync"} />
        </div>
        <div style={{ display: activeTab === "compare" ? "block" : "none" }}>
          <CompareServerTab active={activeTab === "compare"} />
        </div>
        <div style={{ display: activeTab === "projects" ? "block" : "none" }}>
          <ProjectsTab active={activeTab === "projects"} author={user.username} />
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
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },
  userBoxActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
    width: "100%",
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
