import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import PasswordInput from "./PasswordInput";
import LoadingSpinner from "./LoadingSpinner";
import EnvironmentSelect from "./EnvironmentSelect";
import { useToast } from "./ToastProvider";

const EMPTY_FORM = { name: "", host: "", sysnr: "", client: "", rfc_user: "", rfc_password: "", environment: "SANDBOX", allow_multiple_logon: true };

const ENV_LABELS = {
  SANDBOX: "Sandbox",
  DEV: "Development",
  QA: "Quality Assurance",
  PROD: "Production",
};

const ENV_STYLES = {
  SANDBOX: { background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "rgba(99, 102, 241, 0.4)" },
  DEV: { background: "rgba(52, 211, 153, 0.15)", color: "#6ee7b7", border: "rgba(52, 211, 153, 0.4)" },
  QA: { background: "rgba(251, 191, 36, 0.15)", color: "#fcd34d", border: "rgba(251, 191, 36, 0.4)" },
  PROD: { background: "rgba(248, 113, 113, 0.15)", color: "#fca5a5", border: "rgba(248, 113, 113, 0.4)" },
};

const SINGLETON_ENVS = ["DEV", "QA", "PROD"];

export default function SandboxesTab({ currentUser }) {
  const [sandboxes, setSandboxes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const isSuperAdmin = currentUser?.role === "super_admin";

  // Which singleton environments are already taken (excluding the one being edited)
  const takenEnvs = new Set(
    sandboxes.filter((sb) => sb.id !== editingId && SINGLETON_ENVS.includes(sb.environment)).map((sb) => sb.environment)
  );

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

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(sb) {
    setForm({
      name: sb.name,
      host: sb.host,
      sysnr: sb.sysnr,
      client: sb.client,
      rfc_user: sb.rfc_user,
      rfc_password: "",
      environment: sb.environment,
      allow_multiple_logon: sb.allow_multiple_logon,
    });
    setEditingId(sb.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) {
      const original = sandboxes.find((s) => s.id === editingId);
      if (original && original.name !== form.name) {
        setSubmitting(true);
        try {
          const deps = await api.getSandboxDependencies(editingId);
          if (deps.program_versions > 0 || deps.activity_logs > 0) {
            setPendingRename(deps);
            setSubmitting(false);
            return;
          }
        } catch (err) {
          toast.error(err.message);
          setSubmitting(false);
          return;
        }
      }
    }
    await performSave();
  }

  async function performSave() {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateSandbox(editingId, { ...form, requested_by: currentUser.username });
        toast.success(`Server "${form.name}" updated.`);
      } else {
        await api.createSandbox({ ...form, requested_by: currentUser.username });
        toast.success(`Server "${form.name}" added.`);
      }
      resetForm();
      await load();
      setPendingRename(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestConnection() {
    if (!form.host || !form.sysnr || !form.client || !form.rfc_user) {
      toast.error("Please fill in Host, System Number, Client, and RFC User first.");
      return;
    }
    setTesting(true);
    try {
      const payload = {
        sandbox_id: editingId,
        host: form.host,
        sysnr: form.sysnr,
        client: form.client,
        rfc_user: form.rfc_user,
        rfc_password: form.rfc_password
      };
      const res = await api.testConnection(payload);
      if (res.passed) {
        toast.success(res.message);
      } else {
        toast.error(`Connection failed: ${res.message}`);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function confirmDelete() {
    const name = pendingDelete.name;
    try {
      await api.deleteSandbox(pendingDelete.id, currentUser.username);
      setPendingDelete(null);
      if (editingId === pendingDelete.id) resetForm();
      toast.success(`Server "${name}" deleted.`);
      await load();
    } catch (err) {
      toast.error(err.message);
      setPendingDelete(null);
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading servers..." />;
  }

  return (
    <div className="page-padding" style={styles.container}>
      <h2 style={styles.heading}>Server</h2>
      <p style={styles.subheading}>
        Manage connections to your SAP environments.
        {!isSuperAdmin && " Only a super admin can add, edit, or delete servers."}
      </p>

      <div className="form-list-grid">
        {isSuperAdmin ? (
          <form onSubmit={handleSubmit} className="glass-panel" style={styles.form}>
            <h3 style={styles.formTitle}>{editingId ? "Edit Server" : "Add New Server"}</h3>

            <div>
              <label>Server Name</label>
              <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="DEV100" required />
            </div>
            <div>
              <label>Environment</label>
              <EnvironmentSelect
                value={form.environment}
                onChange={(env) => update("environment", env)}
                takenEnvs={takenEnvs}
              />
              <div style={styles.hint}>
                Sandbox servers are unlimited. Development, QA, and Production each allow only one server.
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Allow Multiple Logon</label>
              <div style={{ display: "flex", gap: "16px", marginTop: "4px", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: form.environment === "SANDBOX" ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  <input
                    type="radio"
                    name="allow_multiple_logon"
                    checked={form.environment === "SANDBOX" ? true : form.allow_multiple_logon === true}
                    onChange={() => update("allow_multiple_logon", true)}
                    disabled={form.environment === "SANDBOX"}
                  />
                  Yes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: form.environment === "SANDBOX" ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  <input
                    type="radio"
                    name="allow_multiple_logon"
                    checked={form.environment === "SANDBOX" ? false : form.allow_multiple_logon === false}
                    onChange={() => update("allow_multiple_logon", false)}
                    disabled={form.environment === "SANDBOX"}
                  />
                  No (Enforce Audit)
                </label>
              </div>
              <div style={styles.hint}>
                {form.environment === "SANDBOX" 
                  ? "Sandbox servers always allow multiple logons by default."
                  : "If enabled, bypasses SAP multiple logon checks during deployment or compare operations."}
              </div>
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
              <label>RFC Password {editingId && <span style={styles.optional}>(leave blank to keep)</span>}</label>
              <PasswordInput
                value={form.rfc_password}
                onChange={(e) => update("rfc_password", e.target.value)}
                placeholder="••••••••"
                required={!editingId}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={submitting || testing} style={{ flex: 1, minWidth: "120px" }}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "+ Add Server"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleTestConnection}
                disabled={testing || submitting}
                style={{ flex: 1, minWidth: "120px" }}
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              {editingId && (
                <button type="button" className="btn" onClick={resetForm} style={{ flex: 1, minWidth: "100px" }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="glass-panel" style={styles.restrictedBox}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
            <h3 style={styles.formTitle}>Restricted</h3>
            <p style={styles.restrictedText}>Adding, editing, and deleting servers is limited to super admins.</p>
          </div>
        )}

        <div className="glass-panel" style={styles.listPanel}>
          <h3 style={styles.formTitle}>Connected Servers ({sandboxes.length})</h3>
          {sandboxes.length === 0 && <div style={styles.empty}>No servers configured yet.</div>}
          <div style={styles.list}>
            {sandboxes.map((sb) => (
              <div key={sb.id} style={{ ...styles.card, ...(editingId === sb.id ? styles.cardEditing : {}) }}>
                <div
                  style={{
                    ...styles.cardDot,
                    ...(ENV_STYLES[sb.environment]
                      ? { background: ENV_STYLES[sb.environment].color, boxShadow: `0 0 8px ${ENV_STYLES[sb.environment].color}` }
                      : {}),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.cardNameRow}>
                    <span style={styles.cardName}>{sb.name}</span>
                    <span style={{ ...styles.envBadge, ...(ENV_STYLES[sb.environment] || ENV_STYLES.SANDBOX) }}>
                      {ENV_LABELS[sb.environment] || sb.environment}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    <span style={{ color: "var(--accent-glow)" }}>★</span> <strong>System:</strong> {sb.sysnr} / {sb.client} · {sb.host}
                  </div>
                  {sb.environment !== "SANDBOX" && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      <span style={{ color: sb.allow_multiple_logon ? "var(--warning)" : "var(--accent-2)" }}>★</span> <strong>Multiple Logon:</strong> {sb.allow_multiple_logon ? "Allowed (Bypass)" : "Blocked (Audit)"}
                    </div>
                  )}
                </div>
                {isSuperAdmin && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button className="btn" style={styles.actionBtn} onClick={() => startEdit(sb)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" style={styles.actionBtn} onClick={() => setPendingDelete(sb)}>
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
        title="Delete Server"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={!!pendingRename}
        title="Rename Server"
        message={`You are renaming this server. It is currently referenced by ${pendingRename?.program_versions} program version(s) and ${pendingRename?.activity_logs} activity log(s). These records will be automatically updated to use the new name. Proceed?`}
        confirmLabel="Yes, rename and update data"
        onConfirm={performSave}
        onCancel={() => setPendingRename(null)}
      />
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 24 },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  formTitle: { margin: "0 0 8px", fontSize: 14, fontWeight: 600 },
  hint: { fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 },
  optional: { color: "var(--text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 },
  row: { display: "flex", gap: 12 },
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
  cardEditing: { border: "1px solid rgba(99, 102, 241, 0.5)", boxShadow: "0 0 0 1px var(--accent-glow)" },
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
  envBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid",
  },
  cardMeta: { color: "var(--text-muted)", fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  actionBtn: { padding: "6px 12px", fontSize: 12 },
};
