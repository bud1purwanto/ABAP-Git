import { useEffect, useState } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import SearchableDropdown from "./SearchableDropdown";
import ConfirmModal from "./ConfirmModal";
import FullscreenDiffModal from "./FullscreenDiffModal";
import { useToast } from "./ToastProvider";
import { useServerValidation } from "../hooks/useServerValidation";
import ServerValidationBadge from "./ServerValidationBadge";

const ENV_LABELS = { DEV: "Development", QA: "Quality Assurance", PROD: "Production" };

export default function SyncTab({ author }) {
  const [sandboxes, setSandboxes] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [programName, setProgramName] = useState("");
  const [tcode, setTCode] = useState("");

  // SAP metadata for the SOURCE server (the source of truth we pull from)
  const [sapTCodes, setSapTCodes] = useState([]);
  const [sapPrograms, setSapPrograms] = useState([]);
  const [sapProgramIncludes, setSapProgramIncludes] = useState([]);
  const [isLoadingSapMeta, setIsLoadingSapMeta] = useState(false);

  // Compare result
  const [sourceSource, setSourceSource] = useState("");
  const [sandboxSource, setSandboxSource] = useState("");
  const [identical, setIdentical] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const [loadingAction, setLoadingAction] = useState("");
  const [confirmSync, setConfirmSync] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const safeSandboxes = sandboxes || [];
  const sourceServers = safeSandboxes.filter((s) => s.environment !== "SANDBOX"); // DEV/QA/PROD
  const targetSandboxes = safeSandboxes.filter((s) => s.environment === "SANDBOX");
  const selectedSource = safeSandboxes.find((s) => String(s.id) === String(sourceId));
  const selectedTarget = safeSandboxes.find((s) => String(s.id) === String(targetId));

  // ── Server Validation ───────────────────────────────────────────────────────
  // Source (DEV/QA/PROD): Multiple Logon check
  const sourceVal = useServerValidation({
    serverId: sourceId,
    environment: selectedSource?.environment || "",
    author,
  });
  // Target (SANDBOX): SAP Lock check — needs a program selected
  const targetVal = useServerValidation({
    serverId: targetId,
    environment: selectedTarget?.environment || "",
    programName,
    author,
  });

  const serversOk =
    (sourceVal.passed !== false) &&
    (targetVal.passed !== false);

  useEffect(() => {
    api
      .listSandboxes()
      .then((sbs) => {
        setSandboxes(sbs);
        const sources = sbs.filter((s) => s.environment !== "SANDBOX");
        // Default source: prefer Development, otherwise first available non-sandbox
        const defaultSource = sources.find((s) => s.environment === "DEV") || sources[0];
        if (defaultSource) setSourceId(defaultSource.id);

        const sbx = sbs.filter((s) => s.environment === "SANDBOX");
        if (sbx.length > 0) {
          const oldest = [...sbx].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
          setTargetId(oldest.id);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsInitialLoad(false));
  }, []);

  // Fetch SAP metadata from the SOURCE server when it changes
  useEffect(() => {
    if (!sourceId) {
      setSapTCodes([]);
      setSapPrograms([]);
      return;
    }
    setIsLoadingSapMeta(true);
    Promise.all([
      api.getTCodes(sourceId).catch(() => ({ data: [] })),
      api.getPrograms(sourceId).catch(() => ({ data: [] })),
    ])
      .then(([tcodesRes, programsRes]) => {
        setSapTCodes(tcodesRes.data || []);
        setSapPrograms(programsRes.data ? programsRes.data.map((p) => p.name) : []);
      })
      .finally(() => setIsLoadingSapMeta(false));
  }, [sourceId]);

  // Fetch includes when tcode changes
  useEffect(() => {
    if (!tcode || !sourceId) {
      setSapProgramIncludes([]);
      return;
    }
    const match = sapTCodes.find((t) => t.tcode === tcode);
    if (match && match.program) {
      api
        .getProgramIncludes(sourceId, match.program)
        .then((res) => setSapProgramIncludes(res.data || []))
        .catch(() => setSapProgramIncludes([]));
    }
  }, [tcode, sourceId, sapTCodes]);

  function resetCompare() {
    setSourceSource("");
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
    if (!sourceId || !targetId || !programName) {
      toast.error("Please select a source server, a target sandbox, and a program.");
      return;
    }
    setLoadingAction("compare");
    try {
      const res = await api.syncCompare(sourceId, targetId, programName);
      setSourceSource(res.source_code || "");
      setSandboxSource(res.sandbox_source || "");
      setIdentical(res.identical);
      setHasCompared(true);
      if (res.identical) {
        toast.info("Sandbox already matches the source — nothing to sync.");
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
      const res = await api.syncApply(sourceId, targetId, programName, author);
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

  const canSync = hasCompared && !identical && !!sourceSource;
  const sourceEnvLabel = selectedSource ? ENV_LABELS[selectedSource.environment] || selectedSource.environment : "";
  const syncLabel =
    selectedTarget && selectedSource
      ? `⟳ Sync ${selectedTarget.name} from ${selectedSource.name}`
      : "⟳ Sync Sandbox from Source";
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
        Pull a program from a Development, QA, or Production server into a sandbox — handy when a
        sandbox has been changed for experiments and you want to reset it to match a real environment.
      </p>

      <div className="glass-panel" style={{ ...styles.controls, position: "relative", zIndex: 30 }}>
        <div className="controls-row">
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Source Server (pull from)"
              placeholder="Select source server..."
              value={sourceId}
              onChange={(val) => {
                setSourceId(val);
                resetCompare();
              }}
              options={sourceServers.map((sb) => ({
                label: `${sb.name} (${ENV_LABELS[sb.environment] || sb.environment})`,
                value: String(sb.id),
              }))}
              freeSolo={false}
            />
            <ServerValidationBadge
              checking={sourceVal.checking}
              passed={sourceVal.passed}
              message={sourceVal.message}
              onRetry={sourceVal.retry}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Target Sandbox (overwrite)"
              placeholder="Select sandbox..."
              value={targetId}
              onChange={(val) => {
                setTargetId(val);
                resetCompare();
              }}
              options={targetSandboxes.map((sb) => ({
                label: sb.name,
                value: String(sb.id),
              }))}
              freeSolo={false}
            />
            <ServerValidationBadge
              checking={targetVal.checking}
              passed={targetVal.passed}
              message={targetVal.message}
              onRetry={targetVal.retry}
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
              disabled={!sourceId}
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
              disabled={!sourceId}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleCompare}
            disabled={loadingAction === "compare" || !sourceId || !targetId || !programName || !serversOk}
            title={!serversOk ? "Server validation failed — resolve issues above first" : ""}
          >
            {loadingAction === "compare" ? "Comparing..." : "Compare"}
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 1 }}
            onClick={() => setConfirmSync(true)}
            disabled={loadingAction === "sync" || !canSync || !serversOk}
            title={
              !serversOk
                ? "Server validation failed — resolve issues above first"
                : !hasCompared
                ? "Run Compare first"
                : identical
                ? "Sandbox already matches the source"
                : "Overwrite the sandbox with the version from the source server"
            }
          >
            {loadingAction === "sync" ? "Syncing..." : syncLabel}
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
                    <span style={{ ...styles.legendDot, background: "#f43f5e" }} />
                    <strong>{selectedSource?.name}</strong>
                    <span style={styles.legendNote}>source of truth</span>
                  </span>
                  <span style={styles.legendArrow}>→</span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, background: "var(--accent-2)" }} />
                    <strong>{selectedTarget?.name}</strong>
                    <span style={styles.legendNote}>will be overwritten</span>
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
                Select a source server, target sandbox, and program, then click <strong>Compare</strong> to
                see the difference.
              </div>
            ) : identical ? (
              <div style={styles.identicalBox}>
                ✓ Sandbox <strong>{selectedTarget?.name}</strong> is already identical to{" "}
                <strong>{selectedSource?.name}</strong> for <strong>{programName}</strong>. Nothing to sync.
              </div>
            ) : (
              <DiffViewer original={sourceSource} modified={sandboxSource} sideBySide={true} />
            )}
          </div>
        </div>
      </div>

      <FullscreenDiffModal
        open={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        title={`Sync Comparison: ${programName}`}
        leftLabel={selectedSource?.name}
        leftSubLabel={`${sourceEnvLabel} — source of truth, stays unchanged`}
        leftColor="#f43f5e"
        rightLabel={selectedTarget?.name}
        rightSubLabel="Target sandbox — current state, will be overwritten by Sync"
        rightColor="var(--accent-2)"
        leftCode={sourceSource}
        rightCode={sandboxSource}
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
              {syncLabel}
            </button>
          </div>
        }
      />

      <ConfirmModal
        open={confirmSync}
        title="Sync Sandbox from Source"
        message={`This will OVERWRITE program "${programName}" in sandbox "${selectedTarget?.name}" with the version currently on "${selectedSource?.name}" (${sourceEnvLabel}). Continue?`}
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
