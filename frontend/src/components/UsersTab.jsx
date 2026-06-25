import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import PasswordInput from "./PasswordInput";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ToastProvider";

const EMPTY_FORM = { username: "", password: "", git_author_name: "" };

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

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
      await api.createUser(form);
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
      await api.deleteUser(pendingDelete.id);
      setPendingDelete(null);
      toast.success(`User "${username}" deleted.`);
      await load();
    } catch (err) {
      toast.error(err.message);
      setPendingDelete(null);
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading users..." />;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Users</h2>
      <p style={styles.subheading}>Manage accounts that can sign in to this console.</p>

      <div style={styles.grid}>
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

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? "Saving..." : "+ Add User"}
          </button>
        </form>

        <div className="glass-panel" style={styles.listPanel}>
          <h3 style={styles.formTitle}>Accounts ({users.length})</h3>
          {users.length === 0 && <div style={styles.empty}>No users configured yet.</div>}
          <div style={styles.list}>
            {users.map((u) => (
              <div key={u.id} style={styles.card}>
                <div style={styles.cardDot} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.cardName}>{u.username}</div>
                  <div style={styles.cardMeta}>
                    {u.git_author_name || "—"}
                  </div>
                </div>
                <button className="btn btn-danger" style={styles.deleteBtn} onClick={() => setPendingDelete(u)}>
                  Delete
                </button>
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
    </div>
  );
}

const styles = {
  container: { padding: "24px 28px", animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 24 },
  grid: { display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start" },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  formTitle: { margin: "0 0 8px", fontSize: 14, fontWeight: 600 },
  error: {
    color: "var(--danger)",
    fontSize: 13,
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 8,
    padding: "8px 12px",
  },
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
  cardName: { fontWeight: 600, fontSize: 14 },
  cardMeta: { color: "var(--text-muted)", fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  deleteBtn: { padding: "6px 14px", fontSize: 12.5 },
};
