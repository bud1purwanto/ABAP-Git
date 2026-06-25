import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import PasswordInput from "./PasswordInput";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ToastProvider";

const EMPTY_FORM = { name: "", host: "", sysnr: "", client: "", rfc_user: "", rfc_password: "", environment: "DEV" };

const ENV_STYLES = {
  DEV: { background: "rgba(52, 211, 153, 0.15)", color: "#6ee7b7", border: "rgba(52, 211, 153, 0.4)" },
  QA: { background: "rgba(251, 191, 36, 0.15)", color: "#fcd34d", border: "rgba(251, 191, 36, 0.4)" },
  PROD: { background: "rgba(248, 113, 113, 0.15)", color: "#fca5a5", border: "rgba(248, 113, 113, 0.4)" },
};

export default function SandboxesTab() {
  const [sandboxes, setSandboxes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  async function load() {
    try {
      setSandboxes(await api.listSandboxes());
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
      await api.createSandbox(form);
      setForm(EMPTY_FORM);
      toast.success(`Sandbox "${form.name}" added.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const name = pendingDelete.name;
    try {
      await api.deleteSandbox(pendingDelete.id);
      setPendingDelete(null);
      toast.success(`Sandbox "${name}" deleted.`);
      await load();
    } catch (err) {
      toast.error(err.message);
      setPendingDelete(null);
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading sandboxes..." />;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Sandboxes</h2>
      <p style={styles.subheading}>Manage connections to your SAP environments.</p>

      <div style={styles.grid}>
        <form onSubmit={handleSubmit} className="glass-panel" style={styles.form}>
          <h3 style={styles.formTitle}>Add New Sandbox</h3>

          <div>
            <label>Sandbox Name</label>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="DEV100" required />
          </div>
          <div>
            <label>Environment</label>
            <select value={form.environment} onChange={(e) => update("environment", e.target.value)}>
              <option value="DEV">Development</option>
              <option value="QA">Quality Assurance</option>
              <option value="PROD">Production</option>
            </select>
          </div>
          <div>
            <label>Host</label>
            <input value={form.host} onChange={(e) => update("host", e.target.value)} placeholder="sap.example.com" required />
          </div>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label>System Number</label>
              <input value={form.sysnr} onChange={(e) => update("sysnr", e.target.value)} placeholder="00" required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Client</label>
              <input value={form.client} onChange={(e) => update("client", e.target.value)} placeholder="100" required />
            </div>
          </div>
          <div>
            <label>RFC User</label>
            <input value={form.rfc_user} onChange={(e) => update("rfc_user", e.target.value)} placeholder="RFC_USER" required />
          </div>
          <div>
            <label>RFC Password</label>
            <PasswordInput
              value={form.rfc_password}
              onChange={(e) => update("rfc_password", e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? "Saving..." : "+ Add Sandbox"}
          </button>
        </form>

        <div className="glass-panel" style={styles.listPanel}>
          <h3 style={styles.formTitle}>Connected Sandboxes ({sandboxes.length})</h3>
          {sandboxes.length === 0 && <div style={styles.empty}>No sandboxes configured yet.</div>}
          <div style={styles.list}>
            {sandboxes.map((sb) => (
              <div key={sb.id} style={styles.card}>
                <div style={styles.cardDot} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.cardNameRow}>
                    <span style={styles.cardName}>{sb.name}</span>
                    <span style={{ ...styles.envBadge, ...(ENV_STYLES[sb.environment] || ENV_STYLES.DEV) }}>
                      {sb.environment}
                    </span>
                  </div>
                  <div style={styles.cardMeta}>
                    {sb.host} · sysnr {sb.sysnr} · client {sb.client} · {sb.rfc_user}
                  </div>
                </div>
                <button className="btn btn-danger" style={styles.deleteBtn} onClick={() => setPendingDelete(sb)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete Sandbox"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`}
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
  row: { display: "flex", gap: 12 },
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
  cardNameRow: { display: "flex", alignItems: "center", gap: 8 },
  cardName: { fontWeight: 600, fontSize: 14 },
  envBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid",
  },
  cardMeta: { color: "var(--text-muted)", fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  deleteBtn: { padding: "6px 14px", fontSize: 12.5 },
};
