import { useEffect, useState } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import SearchableDropdown from "./SearchableDropdown";
import ConfirmModal from "./ConfirmModal";
import FullscreenDiffModal from "./FullscreenDiffModal";
import { useToast } from "./ToastProvider";

export default function SyncTab({ author }) {
  const [sandboxes, setSandboxes] = useState([]);
  const [sandboxId, setSandboxId] = useState("");
  const [programName, setProgramName] = useState("");
  const [tcode, setTCode] = useState("");

  // SAP metadata for the selected sandbox
  const [sapTCodes, setSapTCodes] = useState([]);
  const [sapPrograms, setSapPrograms] = useState([]);
  const [sapProgramIncludes, setSapProgramIncludes] = useState([]);
  const [isLoadingSapMeta, setIsLoadingSapMeta] = useState(false);

  // Compare result
  const [liveSource, setLiveSource] = useState("");
  const [sandboxSource, setSandboxSource] = useState("");
  const [identical, setIdentical] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const [loadingAction, setLoadingAction] = useState("");
  const [confirmSync, setConfirmSync] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const safeSandboxes = sandboxes || [];
  const liveSandbox = safeSandboxes.find((s) => s.is_live);
  const regularSandboxes = safeSandboxes.filter((s) => !s.is_live);
  const selectedSandbox = safeSandboxes.find((s) => String(s.id) === String(sandboxId));

  useEffect(() => {
    api
      .listSandboxes()
      .then((sbs) => {
        setSandboxes(sbs);
        const regular = sbs.filter((s) => !s.is_live);
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

  // Fetch SAP metadata when the selected sandbox changes
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

  function resetCompare() {
    setLiveSource("");
    setSandboxSource("");
    setIdentical(false);
    setHasCompared(false);
  }

  function handleProgramChange(value) {
    setProgramName(value);
    resetCompare();
    if (sapTCodes.length > 0) {
      const match = sapTCodes.find((t) => t.program === value);
      if (match) setTCode(match.tcode);
    }
  }

  function handleTCodeChange(val) {
    setTCode(val);
    resetCompare();
    const match = sapTCodes.find((t) => t.tcode === val);
    if (match && match.program) {
      setProgramName(match.program);
    }
  }

  async function handleCompare() {
    if (!sandboxId || !programName) {
      toast.error("Please select a sandbox and a program first.");
      return;
    }
    if (!liveSandbox) {
      toast.error("No Live Development server configured.");
      return;
    }
    setLoadingAction("compare");
    try {
      const res = await api.syncCompare(sandboxId, programName);
      setLiveSource(res.live_source || "");
      setSandboxSource(res.sandbox_source || "");
      setIdentical(res.identical);
      setHasCompared(true);
      if (res.identical) {
        toast.info("Sandbox already matches Live — nothing to sync.");
      }
    } catch (err) {
      toast.error(err.message);
      resetCompare();
    } finally {
      setLoadingAction("");
    }
  }

  async function handleSync() {
    setConfirmSync(false);
    setLoadingAction("sync");
    try {
      const res = await api.syncApply(sandboxId, programName, author);
      toast.success(res.message || "Synced successfully.");
      resetCompare();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction("");
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading sync..." />;
  }

  const canSync = hasCompared && !identical && !!liveSource;
  const programOptions = tcode
    ? [
        ...(sapTCodes.find((t) => t.tcode === tcode)?.program
          ? [sapTCodes.find((t) => t.tcode === tcode).program]
          : []),
        ...sapProgramIncludes,
      ]
    : sapPrograms;

  return (
    <div className="page-padding" style={styles.container}>
      <h2 style={styles.heading}>Sync</h2>
      <p style={styles.subheading}>
        Pull a program straight from the Live Development server into a sandbox — handy when a
        sandbox has been changed for experiments and you want to reset it to match Live.
      </p>

      <div className="glass-panel" style={{ ...styles.controls, position: "relative", zIndex: 30 }}>
        <div className="controls-row">
          <div style={{ flex: 1 }}>
            <label>Live Server (source)</label>
            <div style={styles.liveField}>
              <span style={styles.liveDot} />
              {liveSandbox ? (
                <span>
                  {liveSandbox.name} <span style={styles.liveMeta}>({liveSandbox.environment})</span>
                </span>
              ) : (
                <span style={{ color: "var(--danger)" }}>No Live server configured</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Sandbox (target)"
              placeholder="Select sandbox..."
              value={sandboxId}
              onChange={(val) => {
                setSandboxId(val);
                resetCompare();
              }}
              options={regularSandboxes.map((sb) => ({
                label: `${sb.name} (${sb.environment})`,
                value: String(sb.id),
              }))}
              freeSolo={false}
            />
          </div>
        </div>

        <div className="controls-row" style={{ marginTop: 8 }}>
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
              options={programOptions}
              isLoading={isLoadingSapMeta}
              disabled={!sandboxId}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleCompare}
            disabled={loadingAction === "compare" || !sandboxId || !programName}
          >
            {loadingAction === "compare" ? "Comparing..." : "Compare"}
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 1 }}
            onClick={() => setConfirmSync(true)}
            disabled={loadingAction === "sync" || !canSync}
            title={
              !hasCompared
                ? "Run Compare first"
                : identical
                ? "Sandbox already matches Live"
                : "Overwrite sandbox with the version from Live Development"
            }
          >
            {loadingAction === "sync" ? "Syncing..." : "⟳ Sync Sandbox from Live"}
          </button>
        </div>
      </div>

      <div className="diff-viewer-wrapper" style={{ marginTop: 20 }}>
        <div className="glass-panel diff-panel" style={styles.diffPanel}>
          <div style={styles.diffHeader}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Comparison</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {hasCompared && !identical && (
                <div style={styles.legend}>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, background: "var(--accent-2)" }} />
                    <strong>{selectedSandbox?.name}</strong>
                    <span style={styles.legendNote}>will be overwritten</span>
                  </span>
                  <span style={styles.legendArrow}>←</span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, background: "#f43f5e" }} />
                    <strong>{liveSandbox?.name}</strong>
                    <span style={styles.legendNote}>source of truth</span>
                  </span>
                </div>
              )}
              {hasCompared && !identical && (
                <button className="btn" style={styles.fullscreenBtn} onClick={() => setShowFullscreen(true)}>
                  ⛶ Fullscreen
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {loadingAction === "compare" ? (
              <div style={styles.centerMsg}>
                <LoadingSpinner message="Reading both servers..." />
              </div>
            ) : !hasCompared ? (
              <div style={styles.placeholder}>
                Select a sandbox and program, then click <strong>Compare</strong> to see the
                difference against Live Development.
              </div>
            ) : identical ? (
              <div style={styles.identicalBox}>
                ✓ Sandbox <strong>{selectedSandbox?.name}</strong> is already identical to Live for
                <strong> {programName}</strong>. Nothing to sync.
              </div>
            ) : (
              <DiffViewer original={sandboxSource} modified={liveSource} sideBySide={true} />
            )}
          </div>
        </div>
      </div>

      <FullscreenDiffModal
        open={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        title={`Sync Comparison: ${programName}`}
        leftLabel={selectedSandbox?.name}
        leftSubLabel="Sandbox — current state, will be overwritten by Sync"
        leftColor="var(--accent-2)"
        rightLabel={liveSandbox?.name}
        rightSubLabel="Live Development — source of truth, stays unchanged"
        rightColor="#f43f5e"
        leftCode={sandboxSource}
        rightCode={liveSource}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setShowFullscreen(false)}>
              Close
            </button>
            <button
              className="btn btn-success"
              disabled={!canSync}
              onClick={() => {
                setShowFullscreen(false);
                setConfirmSync(true);
              }}
            >
              ⟳ Sync Sandbox from Live
            </button>
          </div>
        }
      />

      <ConfirmModal
        open={confirmSync}
        title="Sync Sandbox from Live"
        message={`This will OVERWRITE program "${programName}" in sandbox "${selectedSandbox?.name}" with the version currently on Live "${liveSandbox?.name}". Continue?`}
        confirmLabel="Sync"
        onConfirm={handleSync}
        onCancel={() => setConfirmSync(false)}
      />
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 20, maxWidth: 720, lineHeight: 1.5 },
  controls: { padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  liveField: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f43f5e",
    boxShadow: "0 0 8px #f43f5e",
    flexShrink: 0,
  },
  liveMeta: { color: "var(--text-muted)", fontWeight: 400 },
  diffPanel: { padding: 20, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", height: "100%" },
  diffHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" },
  legend: { display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 },
  legendItem: { display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendNote: { color: "var(--text-muted)", fontWeight: 400, fontSize: 11.5 },
  legendArrow: { color: "var(--text-muted)", fontWeight: 700 },
  fullscreenBtn: { padding: "5px 12px", fontSize: 12.5 },
  placeholder: { color: "var(--text-muted)", fontStyle: "italic", padding: "24px 4px", fontSize: 13.5, lineHeight: 1.6 },
  identicalBox: {
    color: "var(--success)",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: 10,
    padding: "16px 18px",
    fontSize: 13.5,
    lineHeight: 1.6,
  },
  centerMsg: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" },
};
