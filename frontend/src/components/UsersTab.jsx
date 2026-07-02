import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import PasswordInput from "./PasswordInput";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ToastProvider";

const EMPTY_FORM = { username: "", password: "", git_author_name: "", role: "developer" };

export default function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const isSuperAdmin = currentUser?.role === "super_admin";

  async function load() {
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsInitialLoad(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createUser({ ...form, requested_by: currentUser.username });
      setForm(EMPTY_FORM);
      toast.success(`User "${form.username}" added.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const username = pendingDelete.username;
    try {
      await api.deleteUser(pendingDelete.id, currentUser.username);
      setPendingDelete(null);
      toast.success(`User "${username}" deleted.`);
      await load();
    } catch (err) {
      toast.error(err.message);
      setPendingDelete(null);
    }
  }

  function openResetModal(u) {
    setResetTarget(u);
    setResetPassword("");
  }

  async function confirmReset() {
    if (resetPassword.length < 4) {
      toast.error("New password must be at least 4 characters.");
      return;
    }
    setResetting(true);
    try {
      await api.resetPassword(resetTarget.id, currentUser.username, resetPassword);
      toast.success(
        `Password for "${resetTarget.username}" was reset. They'll be asked to set a new one at next login.`
      );
      setResetTarget(null);
      setResetPassword("");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading users..." />;
  }

  return (
    <div className="page-padding" style={styles.container}>
      <h2 style={styles.heading}>Users</h2>
      <p style={styles.subheading}>
        Manage accounts that can sign in to this console.
        {!isSuperAdmin && " Only a super admin can add, delete, or reset passwords."}
      </p>

      <div className="form-list-grid">
        {isSuperAdmin ? (
          <form onSubmit={handleSubmit} className="glass-panel" style={styles.form}>
            <h3 style={styles.formTitle}>Add New User</h3>

            <div>
              <label>Username</label>
              <input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="jdoe" required />
            </div>
            <div>
              <label>Password</label>
              <PasswordInput
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label>Git Author Name</label>
              <input
                value={form.git_author_name}
                onChange={(e) => update("git_author_name", e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => update("role", e.target.value)}>
                <option value="developer">Developer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 4 }}>
              {submitting ? "Saving..." : "+ Add User"}
            </button>
          </form>
        ) : (
          <div className="glass-panel" style={styles.restrictedBox}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
            <h3 style={styles.formTitle}>Restricted</h3>
            <p style={styles.restrictedText}>
              Adding, deleting, and resetting passwords for users is limited to super admins.
            </p>
          </div>
        )}

        <div className="glass-panel" style={styles.listPanel}>
          <h3 style={styles.formTitle}>Accounts ({users.length})</h3>
          {users.length === 0 && <div style={styles.empty}>No users configured yet.</div>}
          <div style={styles.list}>
            {users.map((u) => (
              <div key={u.id} style={styles.card}>
                <div style={styles.cardDot} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.cardNameRow}>
                    <span style={styles.cardName}>{u.username}</span>
                    {u.role === "super_admin" && <span style={styles.roleBadge}>★ Super Admin</span>}
                    {u.must_change_password && <span style={styles.pendingBadge}>Pending password reset</span>}
                  </div>
                  <div style={styles.cardMeta}>{u.git_author_name || "—"}</div>
                </div>
                {isSuperAdmin && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button className="btn" style={styles.actionBtn} onClick={() => openResetModal(u)}>
                      Reset Password
                    </button>
                    <button
                      className="btn btn-danger"
                      style={styles.actionBtn}
                      onClick={() => setPendingDelete(u)}
                      disabled={u.id === currentUser.id}
                      title={u.id === currentUser.id ? "You cannot delete your own account" : ""}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete User"
        message={`Are you sure you want to delete "${pendingDelete?.username}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {resetTarget && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
              Reset Password — {resetTarget.username}
            </h3>
            <p style={styles.restrictedText}>
              Set a temporary password. <strong>{resetTarget.username}</strong> will be required to choose
              a new password the next time they log in.
            </p>
            <div style={{ marginTop: 12 }}>
              <label>New Temporary Password</label>
              <PasswordInput
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setResetTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmReset} disabled={resetting}>
                {resetting ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 24 },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  formTitle: { margin: "0 0 8px", fontSize: 14, fontWeight: 600 },
  restrictedBox: { padding: 24, textAlign: "center" },
  restrictedText: { color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, margin: 0 },
  listPanel: { padding: 24, minHeight: 200 },
  empty: { color: "var(--text-muted)", fontSize: 13.5, padding: "20px 0", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    animation: "fadeIn 0.25s ease",
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--success)",
    boxShadow: "0 0 8px var(--success)",
    flexShrink: 0,
  },
  cardNameRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardName: { fontWeight: 600, fontSize: 14 },
  cardMeta: { color: "var(--text-muted)", fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  roleBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#fbbf24",
    background: "rgba(251, 191, 36, 0.12)",
    border: "1px solid rgba(251, 191, 36, 0.35)",
    borderRadius: 5,
    padding: "1px 6px",
  },
  pendingBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--accent-2)",
    background: "rgba(34, 211, 238, 0.1)",
    border: "1px solid rgba(34, 211, 238, 0.3)",
    borderRadius: 5,
    padding: "1px 6px",
  },
  actionBtn: { padding: "6px 12px", fontSize: 12 },
  modalOverlay: {
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
  modalContent: { width: 420, maxWidth: "90vw", padding: 24, animation: "fadeInScale 0.2s ease" },
};
