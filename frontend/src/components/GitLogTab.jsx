import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "./ToastProvider";
import SearchableDropdown from "./SearchableDropdown";
import ConfirmModal from "./ConfirmModal";
import LoadingSpinner from "./LoadingSpinner";

export default function GitLogTab({ currentUser }) {
  const username = currentUser?.username;
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [sandboxes, setSandboxes] = useState([]);
  const [sandboxId, setSandboxId] = useState("");
  const [programName, setProgramName] = useState("");
  const [tcode, setTCode] = useState("");

  const [sapTCodes, setSapTCodes] = useState([]);
  const [sapPrograms, setSapPrograms] = useState([]);
  const [sapProgramIncludes, setSapProgramIncludes] = useState([]);
  const [isLoadingSapMeta, setIsLoadingSapMeta] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Modals
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const toast = useToast();

  const safeSandboxes = sandboxes || [];
  const regularSandboxes = safeSandboxes.filter((s) => s.environment === "SANDBOX");

  useEffect(() => {
    api
      .listSandboxes()
      .then((sbs) => {
        setSandboxes(sbs);
        const regular = sbs.filter((s) => s.environment === "SANDBOX");
        if (regular.length > 0) {
          const oldest = [...regular].sort(
            (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
          )[0];
          setSandboxId(oldest.id);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsInitialLoad(false));
  }, []);

  // Fetch SAP metadata when sandbox changes
  useEffect(() => {
    if (!sandboxId) {
      setSapTCodes([]);
      setSapPrograms([]);
      return;
    }
    setIsLoadingSapMeta(true);
    Promise.all([
      api.getTCodes(sandboxId).catch(() => ({ data: [] })),
      api.getPrograms(sandboxId).catch(() => ({ data: [] })),
    ])
      .then(([tcodesRes, programsRes]) => {
        setSapTCodes(tcodesRes.data || []);
        setSapPrograms(programsRes.data ? programsRes.data.map((p) => p.name) : []);
      })
      .finally(() => setIsLoadingSapMeta(false));
  }, [sandboxId]);

  // Fetch includes when tcode changes
  useEffect(() => {
    if (!tcode || !sandboxId) {
      setSapProgramIncludes([]);
      return;
    }
    const match = sapTCodes.find((t) => t.tcode === tcode);
    if (match && match.program) {
      api
        .getProgramIncludes(sandboxId, match.program)
        .then((res) => setSapProgramIncludes(res.data || []))
        .catch(() => setSapProgramIncludes([]));
    }
  }, [tcode, sandboxId, sapTCodes]);

  // Load commit history whenever the program changes
  useEffect(() => {
    if (!programName) {
      setHistory([]);
      return;
    }
    let active = true;
    setLoadingHistory(true);
    api
      .getHistory(programName)
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [programName]);

  function reloadHistory() {
    if (!programName) return;
    api.getHistory(programName).then(setHistory).catch(() => {});
  }

  function handleTCodeChange(val) {
    setTCode(val);
    const match = sapTCodes.find((t) => t.tcode === val);
    if (match && match.program) {
      setProgramName(match.program);
    }
  }

  function handleProgramChange(val) {
    setProgramName(val);
    const match = sapTCodes.find((t) => t.program === val);
    if (match) setTCode(match.tcode);
  }

  const userHasCommit = history.some((h) => h.author === username);
  const canRename = !!programName && history.length > 0 && (isSuperAdmin || userHasCommit);
  const canModifyCommit = (commit) => isSuperAdmin || commit.author === username;

  // ---- Rename ----
  function openRename() {
    setRenameValue(programName);
    setShowRenameModal(true);
  }

  async function submitRename() {
    const newName = renameValue.trim().toUpperCase();
    if (!newName) {
      toast.error("Enter a new program name.");
      return;
    }
    if (newName === programName) {
      toast.error("New name must differ from the current name.");
      return;
    }
    setRenameBusy(true);
    try {
      await api.renameProgram(programName, newName, username);
      toast.success(`Program renamed to ${newName}.`);
      setShowRenameModal(false);
      setProgramName(newName);
      // history reloads via effect on programName change
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRenameBusy(false);
    }
  }

  // ---- Edit commit message ----
  function openEdit(commit) {
    setEditTarget(commit);
    setEditValue(commit.commit_message || "");
  }

  async function submitEdit() {
    if (!editTarget) return;
    if (!editValue.trim()) {
      toast.error("Commit message cannot be empty.");
      return;
    }
    setEditBusy(true);
    try {
      await api.editCommit(editTarget.id, username, editValue);
      toast.success("Commit message updated.");
      setEditTarget(null);
      reloadHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  // ---- Delete commit ----
  async function submitDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.deleteCommit(deleteTarget.id, username);
      toast.success("Commit deleted.");
      setDeleteTarget(null);
      reloadHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const formatDate = (dateStr) =>
    dateStr
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dateStr))
      : "";

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading git log..." />;
  }

  return (
    <div className="page-padding" style={styles.container}>
      <h2 style={styles.heading}>Git Log &amp; Setting</h2>
      <p style={styles.subheading}>
        Browse a program's commit history, edit or delete your own commit messages, and rename programs.
      </p>

      <div className="glass-panel" style={styles.controls}>
        <div className="controls-row" style={{ position: "relative", zIndex: 30 }}>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Server"
              placeholder="Select server..."
              value={sandboxId}
              onChange={(val) => setSandboxId(val)}
              options={regularSandboxes.map((sb) => ({
                label: `${sb.name} (${sb.environment})`,
                value: String(sb.id),
              }))}
              freeSolo={false}
            />
          </div>
        </div>

        <div className="controls-row" style={{ marginTop: 8, position: "relative", zIndex: 20 }}>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="T-Code (Optional)"
              placeholder="Select or type T-Code..."
              value={tcode}
              onChange={handleTCodeChange}
              options={sapTCodes.map((t) => ({ label: `${t.tcode} — ${t.program}`, value: t.tcode }))}
              isLoading={isLoadingSapMeta}
              disabled={!sandboxId}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Program Name"
              placeholder="Select or type Z_PROGRAM..."
              value={programName}
              onChange={handleProgramChange}
              options={
                tcode
                  ? [
                      ...(sapTCodes.find((t) => t.tcode === tcode)?.program
                        ? [sapTCodes.find((t) => t.tcode === tcode).program]
                        : []),
                      ...sapProgramIncludes,
                    ]
                  : sapPrograms
              }
              isLoading={isLoadingSapMeta}
              disabled={!sandboxId}
            />
          </div>
        </div>

        {programName && (
          <div style={styles.renameRow}>
            <div style={styles.programBadge}>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Program</span>
              <span style={styles.programBadgeName}>{programName}</span>
            </div>
            <button
              className="btn"
              onClick={openRename}
              disabled={!canRename}
              title={
                !history.length
                  ? "No version history for this program"
                  : !canRename
                  ? "You must have committed to this program to rename it"
                  : "Rename this program across all versions"
              }
              style={styles.renameBtn}
            >
              ✏️ Rename Program
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel" style={styles.logPanel}>
        <h3 style={styles.panelTitle}>Commit Log {programName ? `— ${programName}` : ""}</h3>

        {!programName ? (
          <div style={styles.empty}>Select a program to view its commit log.</div>
        ) : loadingHistory ? (
          <LoadingSpinner message="Loading commits..." />
        ) : history.length === 0 ? (
          <div style={styles.empty}>No commits found for this program.</div>
        ) : (
          <div style={styles.commitList}>
            {history.map((commit) => {
              const mine = commit.author === username;
              const allowed = canModifyCommit(commit);
              return (
                <div key={commit.id} style={styles.commitCard}>
                  <div style={styles.commitTop}>
                    <span style={styles.versionTag}>v{commit.version_number}</span>
                    <span style={styles.commitAuthor}>
                      {commit.author || "system"}
                      {mine && <span style={styles.youTag}>you</span>}
                    </span>
                    <span style={styles.commitDate}>{formatDate(commit.created_at)}</span>
                    <span style={styles.commitHash}>{commit.version_hash}</span>
                  </div>
                  <div style={styles.commitMessage}>
                    {commit.commit_message?.trim() || (
                      <em style={{ color: "var(--text-muted)" }}>No commit message.</em>
                    )}
                  </div>
                  <div style={styles.commitActions}>
                    <button
                      className="btn"
                      style={styles.actionBtn}
                      onClick={() => openEdit(commit)}
                      disabled={!allowed}
                      title={allowed ? "Edit commit message" : "You can only edit your own commits"}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={styles.actionBtn}
                      onClick={() => setDeleteTarget(commit)}
                      disabled={!allowed}
                      title={allowed ? "Delete this commit" : "You can only delete your own commits"}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div style={styles.modalOverlay} onClick={() => !renameBusy && setShowRenameModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Rename Program</h3>
            <p style={styles.modalHint}>
              This renames <strong>{programName}</strong> across its entire version history. The new name
              must not already exist.
            </p>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.toUpperCase())}
              placeholder="New program name..."
              style={styles.modalInput}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
            />
            <div style={styles.modalActions}>
              <button className="btn" onClick={() => setShowRenameModal(false)} disabled={renameBusy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitRename} disabled={renameBusy}>
                {renameBusy ? "Renaming..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Commit Modal */}
      {editTarget && (
        <div style={styles.modalOverlay} onClick={() => !editBusy && setEditTarget(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Edit Commit Message — v{editTarget.version_number}</h3>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Commit message..."
              style={styles.modalTextarea}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button className="btn" onClick={() => setEditTarget(null)} disabled={editBusy}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={submitEdit} disabled={editBusy}>
                {editBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Commit"
        message={
          deleteTarget
            ? `Delete commit v${deleteTarget.version_number} of "${deleteTarget.program_name}"? This cannot be undone.`
            : ""
        }
        confirmLabel={deleteBusy ? "Deleting..." : "Delete"}
        onConfirm={submitDelete}
        onCancel={() => !deleteBusy && setDeleteTarget(null)}
      />
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 20 },
  controls: { padding: 20, display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, position: "relative", zIndex: 10 },
  renameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
  },
  programBadge: { display: "flex", alignItems: "center", gap: 8 },
  programBadgeName: { fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--accent-2)" },
  renameBtn: {
    background: "rgba(99, 102, 241, 0.15)",
    color: "var(--accent-2)",
    border: "1px solid var(--accent-glow)",
  },
  logPanel: { padding: 20 },
  panelTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 600 },
  empty: { color: "var(--text-muted)", fontSize: 13, padding: "24px 0", textAlign: "center" },
  commitList: { display: "flex", flexDirection: "column", gap: 10 },
  commitCard: {
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 10,
    padding: "12px 14px",
  },
  commitTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  versionTag: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--accent-2)",
    background: "rgba(34, 211, 238, 0.1)",
    border: "1px solid rgba(34, 211, 238, 0.25)",
    borderRadius: 5,
    padding: "1px 7px",
  },
  commitAuthor: { fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 },
  youTag: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "var(--success)",
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: 4,
    padding: "0 5px",
  },
  commitDate: { fontSize: 11.5, color: "var(--text-muted)" },
  commitHash: { fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", marginLeft: "auto" },
  commitMessage: {
    fontSize: 13,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
    marginBottom: 10,
  },
  commitActions: { display: "flex", gap: 8 },
  actionBtn: { padding: "5px 12px", fontSize: 12 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 520,
    boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
  },
  modalTitle: { margin: "0 0 12px", fontSize: 18, fontWeight: 700 },
  modalHint: { margin: "0 0 14px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 },
  modalInput: {
    width: "100%",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "var(--text-primary)",
    fontSize: 14,
    fontFamily: "monospace",
  },
  modalTextarea: {
    width: "100%",
    minHeight: 120,
    resize: "vertical",
    fontFamily: "inherit",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    padding: 12,
    color: "var(--text-primary)",
    fontSize: 13,
  },
  modalActions: { display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" },
};
