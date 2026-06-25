import { useEffect, useState } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import ActivityFeed from "./ActivityFeed";
import ConfirmModal from "./ConfirmModal";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ToastProvider";

export default function GitOperationsTab({ author }) {
  const [sandboxes, setSandboxes] = useState([]);
  const [sandboxId, setSandboxId] = useState("");
  const [programName, setProgramName] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const [programs, setPrograms] = useState([]);
  const [programSearch, setProgramSearch] = useState("");

  const [sapSource, setSapSource] = useState("");
  const [dbSource, setDbSource] = useState("");
  const [diff, setDiff] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [parentVersionHash, setParentVersionHash] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [activity, setActivity] = useState([]);
  const [loadingAction, setLoadingAction] = useState("");
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const toast = useToast();

  const selectedSandbox = sandboxes.find((s) => String(s.id) === String(sandboxId));
  const isProdTarget = selectedSandbox?.environment === "PROD";

  useEffect(() => {
    Promise.all([
      api.listSandboxes().then((sbs) => {
        setSandboxes(sbs);
        if (sbs.length > 0) {
          const oldest = [...sbs].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
          setSandboxId(oldest.id);
        }
      }).catch((e) => toast.error(e.message)),
      refreshActivity(),
      refreshPrograms()
    ]).finally(() => setIsInitialLoad(false));
  }, [author]);

  function refreshActivity() {
    return api.getActivity(50, author).then(setActivity).catch(() => {});
  }

  function refreshPrograms(search) {
    return api.listPrograms(search, author).then(setPrograms).catch(() => {});
  }

  async function loadHistory(name) {
    if (!name) {
      setHistory([]);
      setSelectedVersionId("");
      setDbSource("");
      return;
    }
    try {
      const h = await api.getHistory(name);
      setHistory(h);
      if (h.length > 0) {
        setSelectedVersionId(h[0].id);
      } else {
        setSelectedVersionId("");
      }
    } catch {
      setHistory([]);
      setSelectedVersionId("");
    }
  }

  function handleProgramChange(value) {
    setProgramName(value);
    setSelectedVersionId("");
    setSapSource("");
    setDbSource("");
    setDiff("");
    setCommitMessage("");
  }

  async function handleProgramBlur() {
    await loadHistory(programName);
  }

  function handleSelectProgram(name) {
    setProgramName(name);
    setSelectedVersionId("");
    setSapSource("");
    setDbSource("");
    setDiff("");
    setCommitMessage("");
    loadHistory(name);
  }

  async function handleSelectVersion(versionId) {
    setSelectedVersionId(versionId);
    if (!versionId || !sandboxId || !programName) return;
    await fetchAndCompare(versionId);
  }

  async function fetchAndCompare(versionId) {
    setLoadingAction("fetch");
    try {
      const res = await api.readFromSap(programName, sandboxId, versionId || undefined, author);
      setSapSource(res.sap_source);
      setDbSource(res.db_source || "");
      setDiff(res.diff);
      setParentVersionHash(res.parent_version_hash);
      if (!versionId && res.version_id) setSelectedVersionId(res.version_id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction("");
    }
  }

  async function handleFetch() {
    if (!sandboxId || !programName) {
      toast.error("Please select a sandbox and enter a program name.");
      return;
    }
    await fetchAndCompare(selectedVersionId);
    await loadHistory(programName);
  }

  async function handleGenerateCommit() {
    if (!diff) {
      toast.error("Fetch code from SAP first to generate a diff.");
      return;
    }
    setLoadingAction("ai");
    try {
      const res = await api.generateCommit(diff, programName);
      setCommitMessage(res.commit_message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction("");
    }
  }

  function openCommitModal() {
    setShowCommitModal(true);
  }

  async function handleCommit() {
    if (!sapSource || !commitMessage) {
      toast.error("Please provide a commit message before committing.");
      return;
    }
    setLoadingAction("commit");
    try {
      const sandboxName = selectedSandbox?.name;
      await api.commitVersion({
        program_name: programName,
        source_code: sapSource,
        commit_message: commitMessage,
        author,
        sandbox_name: sandboxName,
        parent_version_hash: parentVersionHash,
      });
      toast.success("Committed successfully to ABAP_GIT (Postgres).");
      setShowCommitModal(false);
      setCommitMessage("");
      await loadHistory(programName);
      refreshActivity();
      refreshPrograms(programSearch);
      setDiff("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction("");
    }
  }

  async function handleRollback() {
    setConfirmRollback(false);
    if (!selectedVersionId) {
      toast.error("Select a version from history to rollback to.");
      return;
    }
    setLoadingAction("rollback");
    try {
      await api.writeToSap({
        program_name: programName,
        sandbox_id: Number(sandboxId),
        version_id: Number(selectedVersionId),
      });
      toast.success(`Rollback successful: ${programName} restored to version ${selectedVersionId} on SAP.`);
      refreshActivity();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction("");
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading git operations..." />;
  }

  const isLatestVersion = history.length === 0 || (history[0] && String(selectedVersionId) === String(history[0].id));
  const hasDiff = diff && diff.trim().length > 0;
  const canCommit = !!sapSource && isLatestVersion && hasDiff;
  const canRollback = !!selectedVersionId && hasDiff;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Git Operations</h2>
      <p style={styles.subheading}>Pull ABAP code from SAP, compare versions, and manage rollbacks.</p>

      <div className="git-ops-main-column">
        <div className="git-ops-layout" style={{ marginBottom: 20, position: "relative" }}>
          <div className="glass-panel git-ops-programs-panel" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 280, display: "flex", flexDirection: "column", flexShrink: 0, margin: 0 }}>
          <h3 style={styles.panelTitle}>Programs</h3>
          <input
            value={programSearch}
            onChange={(e) => {
              setProgramSearch(e.target.value);
              refreshPrograms(e.target.value);
            }}
            placeholder="Search programs..."
            style={{ marginBottom: 12 }}
          />
          <div style={{ ...styles.programsList, flex: 1, overflowY: "auto", minHeight: 0 }}>
            {programs.length === 0 && <div style={styles.empty}>No programs committed yet.</div>}
            {programs.map((p) => (
              <button
                key={p.program_name}
                onClick={() => handleSelectProgram(p.program_name)}
                style={{
                  ...styles.programItem,
                  ...(programName === p.program_name ? styles.programItemActive : {}),
                }}
              >
                <div style={styles.programName}>{p.program_name}</div>
                <div style={styles.programMeta}>
                  {p.version_count} version{p.version_count !== 1 ? "s" : ""} · {p.latest_author}
                </div>
              </button>
            ))}
          </div>
        </div>

          <div className="glass-panel" style={{ ...styles.controls, flex: 1, marginLeft: 300 }}>
            <div className="controls-row">
              <div style={{ flex: 1 }}>
                <label>Sandbox</label>
                <select value={sandboxId} onChange={(e) => setSandboxId(e.target.value)}>
                  <option value="">Select sandbox...</option>
                  {sandboxes.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name} ({sb.environment})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Version History</label>
                <select value={selectedVersionId} onChange={(e) => handleSelectVersion(e.target.value)} disabled={history.length === 0}>
                  {history.length === 0 && <option value="">No versions available</option>}
                  {history.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.created_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(h.created_at)) : ""} — {h.author || "system"} ({h.version_hash})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="controls-row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label>Program Name</label>
                <input
                  value={programName}
                  onChange={(e) => handleProgramChange(e.target.value.toUpperCase())}
                  onBlur={handleProgramBlur}
                  placeholder="Z_PROGRAM_NAME"
                />
              </div>
            </div>

            {isProdTarget && (
              <div style={styles.prodWarning}>⚠ Target sandbox is <strong>PRODUCTION</strong>. Operations here affect a live system.</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFetch} disabled={loadingAction === "fetch"}>
                {loadingAction === "fetch" ? "Fetching..." : "Fetch Code from SAP"}
              </button>
              <button 
                className="btn btn-success" 
                style={{ flex: 1 }}
                onClick={openCommitModal} 
                disabled={loadingAction === "commit" || !canCommit}
                title={!isLatestVersion ? "Select the latest version to commit" : (!hasDiff ? "No changes to commit" : "")}
              >
                Commit & Push to GIT
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => setConfirmRollback(true)}
                disabled={loadingAction === "rollback" || !canRollback}
                title={!hasDiff ? "SAP is identical to this version" : ""}
              >
                {loadingAction === "rollback" ? "Rolling back..." : "Rollback & Pull to SAP"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, height: 600 }}>
          <div className="glass-panel diff-panel" style={styles.diffPanel}>
            <h3 style={styles.panelTitle}>Diff Viewer</h3>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <DiffViewer original={dbSource} modified={sapSource} diff={diff} />
            </div>
          </div>
        </div>

        <ActivityFeed activity={activity} history={history} />
      </div>

      <ConfirmModal
        open={confirmRollback}
        title={isProdTarget ? "Rollback to PRODUCTION" : "Rollback to SAP"}
        message={
          isProdTarget
            ? `⚠ DANGER: This will overwrite the LIVE PRODUCTION program "${programName}" on sandbox "${selectedSandbox?.name}". This action affects real users. Continue?`
            : `This will overwrite the live program "${programName}" on SAP with the selected version. Continue?`
        }
        confirmLabel="Rollback"
        onConfirm={handleRollback}
        onCancel={() => setConfirmRollback(false)}
      />

      {/* Commit Message Modal */}
      {showCommitModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCommitModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Commit Message</h3>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Write your commit message here, or use AI to generate one..."
              style={styles.modalTextarea}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={handleGenerateCommit}
                disabled={loadingAction === "ai" || !hasDiff}
              >
                {loadingAction === "ai" ? "✨ Generating..." : "✨ AI Generate"}
              </button>
              <button
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={handleCommit}
                disabled={loadingAction === "commit" || !commitMessage.trim()}
              >
                {loadingAction === "commit" ? "Committing..." : "Commit"}
              </button>
              <button
                className="btn"
                style={{ flex: 0 }}
                onClick={() => setShowCommitModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "24px 28px", animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 20 },
  programsList: { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 8 },
  programItem: {
    textAlign: "left",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
    color: "var(--text-primary)",
  },
  programItemActive: {
    background: "rgba(99, 102, 241, 0.18)",
    border: "1px solid rgba(99, 102, 241, 0.4)",
  },
  programName: { fontSize: 13, fontWeight: 600, fontFamily: "monospace" },
  programMeta: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
  empty: { color: "var(--text-muted)", fontSize: 12.5, padding: "12px 0", textAlign: "center" },
  controls: { padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  actionsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  prodWarning: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: 500,
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.4)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  diffPanel: { padding: 20, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", height: "100%" },
  panelTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 600 },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modalContent: {
    background: "var(--panel-bg)", border: "1px solid var(--panel-border)",
    borderRadius: 16, padding: 24, width: "100%", maxWidth: 560,
    boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
  },
  modalTextarea: {
    width: "100%", minHeight: 140, resize: "vertical", fontFamily: "inherit",
    background: "var(--input-bg)", border: "1px solid var(--panel-border)",
    borderRadius: 8, padding: 12, color: "var(--text-primary)", fontSize: 13,
  },
};
