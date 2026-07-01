import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import SearchableDropdown from "./SearchableDropdown";
import ConfirmModal from "./ConfirmModal";
import FullscreenDiffModal from "./FullscreenDiffModal";
import { useToast } from "./ToastProvider";
import { useServerValidation } from "../hooks/useServerValidation";
import ServerValidationBadge from "./ServerValidationBadge";
import { useDebounce } from "../hooks/useDebounce";

const ENV_LABELS = { DEV: "Development", QA: "Quality Assurance", PROD: "Production" };

const CR_STATUS_COLORS = {
  Modifiable: { color: "#fcd34d", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.35)" },
  Released: { color: "#6ee7b7", bg: "rgba(52, 211, 153, 0.14)", border: "rgba(52, 211, 153, 0.4)" },
};

function TransportBox({ info, environment }) {
  const pkg = info?.package || "—";
  const cr = info?.cr_number || "—";
  const desc = info?.cr_description;
  const isGit = pkg === "Git";
  // CR status is only shown for the Development server, or if it's a Git commit version
  const status = environment === "DEV" ? info?.cr_status : (isGit ? info?.cr_status : null);
  const statusStyle = status
    ? CR_STATUS_COLORS[status] || { color: "var(--accent-2)", bg: "rgba(34, 211, 238, 0.12)", border: "rgba(34, 211, 238, 0.3)" }
    : null;
  return (
    <div style={styles.crBox}>
      <div style={styles.crHeader}>
        <span style={styles.crChip}>{isGit ? "🌲" : "📦"} {pkg}</span>
        <span style={styles.crChip}>{isGit ? "📝" : "🚚"} {cr}</span>
        {status && (
          <span style={{ ...styles.crStatusChip, color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}>
            ● {status}
          </span>
        )}
      </div>
      <div style={styles.crDesc}>
        {desc || <em style={{ color: "var(--text-muted)" }}>{isGit ? "No commit message." : "No change request description."}</em>}
      </div>
    </div>
  );
}

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
  const [sourceTransport, setSourceTransport] = useState(null);
  const [sandboxTransport, setSandboxTransport] = useState(null);

  const [loadingAction, setLoadingAction] = useState("");
  const [confirmSync, setConfirmSync] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const debouncedProgram = useDebounce(programName, 600);
  const prevProgramRef = useRef(programName);
  const prevSourceRef = useRef(sourceId);
  const prevTargetRef = useRef(targetId);
  const prevServersOkRef = useRef(false);

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
    (sourceVal.passed === true) &&
    (targetVal.passed === true);

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
    setSourceTransport(null);
    setSandboxTransport(null);
    setIdentical(false);
    setHasCompared(false);
    setIsSwapped(false);
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

  // Auto-compare when dependencies change
  useEffect(() => {
    if (debouncedProgram && sourceId && targetId && serversOk) {
      if (
        debouncedProgram !== prevProgramRef.current ||
        sourceId !== prevSourceRef.current ||
        targetId !== prevTargetRef.current ||
        serversOk !== prevServersOkRef.current
      ) {
        prevProgramRef.current = debouncedProgram;
        prevSourceRef.current = sourceId;
        prevTargetRef.current = targetId;
        prevServersOkRef.current = serversOk;
        handleCompare(debouncedProgram);
      }
    } else {
      prevServersOkRef.current = serversOk;
    }
  }, [debouncedProgram, sourceId, targetId, serversOk]);

  async function handleCompare(progName = programName) {
    if (!sourceId || !targetId || !progName) {
      toast.error("Please select a source server, a target sandbox, and a program.");
      return;
    }
    setLoadingAction("compare");
    try {
      const res = await api.syncCompare(sourceId, targetId, progName);
      setSourceSource(res.source_code || "");
      setSandboxSource(res.sandbox_source || "");
      setIdentical(res.identical);
      setSourceTransport(res.source_transport || null);
      setSandboxTransport(res.sandbox_transport || null);
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

  const dispLeftLabel = isSwapped ? selectedTarget?.name : selectedSource?.name;
  const dispLeftSubLabel = isSwapped ? "Target sandbox — current state, will be overwritten by Sync" : `${sourceEnvLabel} — source of truth, stays unchanged`;
  const dispLeftTransport = isSwapped ? sandboxTransport : sourceTransport;
  const dispLeftSource = isSwapped ? sandboxSource : sourceSource;
  const dispLeftColor = isSwapped ? "var(--accent-2)" : "#f43f5e";
  
  const dispRightLabel = isSwapped ? selectedSource?.name : selectedTarget?.name;
  const dispRightSubLabel = isSwapped ? `${sourceEnvLabel} — source of truth, stays unchanged` : "Target sandbox — current state, will be overwritten by Sync";
  const dispRightTransport = isSwapped ? sourceTransport : sandboxTransport;
  const dispRightSource = isSwapped ? sourceSource : sandboxSource;
  const dispRightColor = isSwapped ? "#f43f5e" : "var(--accent-2)";

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
              options={sapTCodes.map((t) => ({ label: `${t.tcode} — ${t.description || t.program}`, value: t.tcode, display: t.tcode }))}
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
            onClick={() => handleCompare(programName)}
            disabled={loadingAction === "compare" || !sourceId || !targetId || !programName || !serversOk}
            title={!serversOk ? "Server validation failed — resolve issues above first" : ""}
          >
            {loadingAction === "compare" ? "Comparing..." : "↻ Refresh Compare"}
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

      <div className="diff-viewer-wrapper" key={isSwapped ? "swapped" : "normal"} style={{ marginTop: 20, animation: "fadeIn 0.25s ease-in-out" }}>
        <div className="glass-panel diff-panel" style={styles.diffPanel}>
          <div style={styles.diffHeaderCol}>
            <div style={styles.diffTitleRow}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
                <h3 style={styles.diffTitleCentered}>Comparison</h3>
                {hasCompared && !identical && (
                  <button 
                    className="btn" 
                    style={{ padding: "2px 6px", fontSize: 11, display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid var(--panel-border)", color: "var(--text-secondary)", borderRadius: 4 }}
                    onClick={() => setIsSwapped(!isSwapped)}
                    title="Swap Original and Modified"
                  >
                    ⇄ Swap
                  </button>
                )}
              </div>
              {hasCompared && !identical && (
                <button className="btn" style={styles.fullscreenBtnAbs} onClick={() => setShowFullscreen(true)}>
                  ⛶ Fullscreen
                </button>
              )}
            </div>
            {hasCompared && !identical && (
              <>
                <div style={styles.colTitles}>
                  <div style={styles.colTitle}>
                    <span style={{ ...styles.legendDot, background: dispLeftColor }} />
                    <strong>{dispLeftLabel}</strong>
                    <span style={styles.legendNote}>{isSwapped ? "target sandbox" : "source of truth"}</span>
                  </div>
                  <div style={styles.colTitle}>
                    <span style={{ ...styles.legendDot, background: dispRightColor }} />
                    <strong>{dispRightLabel}</strong>
                    <span style={styles.legendNote}>{isSwapped ? "source of truth" : "target sandbox"}</span>
                  </div>
                </div>
                <div style={styles.crBoxes}>
                  <TransportBox info={dispLeftTransport} environment={isSwapped ? selectedTarget?.environment : selectedSource?.environment} />
                  <TransportBox info={dispRightTransport} environment={isSwapped ? selectedSource?.environment : selectedTarget?.environment} />
                </div>
              </>
            )}
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
              <DiffViewer original={dispLeftSource} modified={dispRightSource} sideBySide={true} />
            )}
          </div>
        </div>
      </div>

      <FullscreenDiffModal
        open={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        title={`Sync Comparison: ${programName}`}
        leftLabel={dispLeftLabel}
        leftSubLabel={dispLeftSubLabel}
        leftColor={dispLeftColor}
        rightLabel={dispRightLabel}
        rightSubLabel={dispRightSubLabel}
        rightColor={dispRightColor}
        leftCode={dispLeftSource}
        rightCode={dispRightSource}
        headerActions={
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
  diffHeaderCol: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  diffTitleRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 28 },
  diffTitleCentered: { margin: 0, fontSize: 14, fontWeight: 600, textAlign: "center" },
  colTitles: { display: "flex", gap: 12, marginBottom: 12 },
  colTitle: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--text-primary)", flexWrap: "wrap" },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendNote: { color: "var(--text-muted)", fontWeight: 400, fontSize: 11.5 },
  fullscreenBtnAbs: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", padding: "5px 12px", fontSize: 12.5 },
  crBoxes: { display: "flex", gap: 12, marginBottom: 12 },
  crBox: {
    flex: 1, minWidth: 0,
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid var(--accent-glow)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  crHeader: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 4 },
  crChip: {
    fontSize: 11.5, fontWeight: 700, color: "var(--accent-2)",
    background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.25)",
    borderRadius: 5, padding: "1px 8px", fontFamily: "monospace",
  },
  crStatusChip: {
    fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "1px 8px",
  },
  crDesc: { fontSize: 12.5, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.4, wordBreak: "break-word" },
  placeholder: { color: "var(--text-muted)", fontStyle: "italic", padding: "24px 4px", fontSize: 13.5, lineHeight: 1.6, textAlign: "center" },
  identicalBox: {
    color: "var(--success)",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: 10,
    padding: "16px 18px",
    fontSize: 13.5,
    lineHeight: 1.6,
    textAlign: "center",
  },
  centerMsg: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" },
};
