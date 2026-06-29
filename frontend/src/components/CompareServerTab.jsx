import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import SearchableDropdown from "./SearchableDropdown";
import FullscreenDiffModal from "./FullscreenDiffModal";
import { useToast } from "./ToastProvider";
import { useServerValidation } from "../hooks/useServerValidation";
import ServerValidationBadge from "./ServerValidationBadge";
import { useDebounce } from "../hooks/useDebounce";

const ENV_LABELS = { SANDBOX: "Sandbox", DEV: "Development", QA: "Quality Assurance", PROD: "Production" };
const ENV_RANK = { SANDBOX: 0, DEV: 1, QA: 2, PROD: 3 };

function rank(sb) {
  return ENV_RANK[sb.environment] ?? 0;
}

function serverLabel(sb) {
  return `${sb.name} (${ENV_LABELS[sb.environment] || sb.environment})`;
}

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

export default function CompareServerTab() {
  const [sandboxes, setSandboxes] = useState([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [programName, setProgramName] = useState("");
  const [tcode, setTCode] = useState("");

  // SAP metadata from the LEFT (reference) server
  const [sapTCodes, setSapTCodes] = useState([]);
  const [sapPrograms, setSapPrograms] = useState([]);
  const [sapProgramIncludes, setSapProgramIncludes] = useState([]);
  const [isLoadingSapMeta, setIsLoadingSapMeta] = useState(false);

  const [leftSource, setLeftSource] = useState("");
  const [rightSource, setRightSource] = useState("");
  const [leftTransport, setLeftTransport] = useState(null);
  const [rightTransport, setRightTransport] = useState(null);
  const [identical, setIdentical] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const [loadingAction, setLoadingAction] = useState("");
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

  const debouncedProgram = useDebounce(programName, 600);
  const prevProgramRef = useRef(programName);
  const prevLeftRef = useRef(leftId);
  const prevRightRef = useRef(rightId);

  const safeSandboxes = sandboxes || [];
  const selectedLeft = safeSandboxes.find((s) => String(s.id) === String(leftId));
  const selectedRight = safeSandboxes.find((s) => String(s.id) === String(rightId));

  // ── Server Validation ───────────────────────────────────────────────────────
  // Both left & right: Multiple Logon check for non-sandbox, skip for sandbox
  const leftVal = useServerValidation({
    serverId: leftId,
    environment: selectedLeft?.environment || "",
  });
  const rightVal = useServerValidation({
    serverId: rightId,
    environment: selectedRight?.environment || "",
  });

  const serversOk = (leftVal.passed !== false) && (rightVal.passed !== false);

  // Left can be any server. Order by hierarchy: Sandbox, DEV, QA, PROD (then name).
  const leftOptions = [...safeSandboxes]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map((sb) => ({ label: serverLabel(sb), value: String(sb.id) }));

  // Right can only be servers strictly lower in hierarchy than the selected left.
  const rightOptions = selectedLeft
    ? [...safeSandboxes]
        .filter((s) => rank(s) < rank(selectedLeft))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
        .map((sb) => ({ label: serverLabel(sb), value: String(sb.id) }))
    : [];

  useEffect(() => {
    api
      .listSandboxes()
      .then((sbs) => {
        setSandboxes(sbs);
        // Default: left = highest-rank server, right = highest server below it.
        const byRankDesc = [...sbs].sort((a, b) => rank(b) - rank(a));
        const left = byRankDesc[0];
        if (left) {
          setLeftId(left.id);
          const below = byRankDesc.find((s) => rank(s) < rank(left));
          if (below) setRightId(below.id);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsInitialLoad(false));
  }, []);

  // Fetch metadata from the LEFT server
  useEffect(() => {
    if (!leftId) {
      setSapTCodes([]);
      setSapPrograms([]);
      return;
    }
    setIsLoadingSapMeta(true);
    Promise.all([
      api.getTCodes(leftId).catch(() => ({ data: [] })),
      api.getPrograms(leftId).catch(() => ({ data: [] })),
    ])
      .then(([tcodesRes, programsRes]) => {
        setSapTCodes(tcodesRes.data || []);
        setSapPrograms(programsRes.data ? programsRes.data.map((p) => p.name) : []);
      })
      .finally(() => setIsLoadingSapMeta(false));
  }, [leftId]);

  useEffect(() => {
    if (!tcode || !leftId) {
      setSapProgramIncludes([]);
      return;
    }
    const match = sapTCodes.find((t) => t.tcode === tcode);
    if (match && match.program) {
      api
        .getProgramIncludes(leftId, match.program)
        .then((res) => setSapProgramIncludes(res.data || []))
        .catch(() => setSapProgramIncludes([]));
    }
  }, [tcode, leftId, sapTCodes]);

  function resetCompare() {
    setLeftSource("");
    setRightSource("");
    setLeftTransport(null);
    setRightTransport(null);
    setIdentical(false);
    setHasCompared(false);
  }

  function handleLeftChange(val) {
    setLeftId(val);
    resetCompare();
    // If the current right is no longer lower than the new left, clear it.
    const newLeft = safeSandboxes.find((s) => String(s.id) === String(val));
    if (selectedRight && newLeft && rank(selectedRight) >= rank(newLeft)) {
      setRightId("");
    }
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
    if (match && match.program) setProgramName(match.program);
  }

  // Auto-compare when dependencies change
  useEffect(() => {
    if (debouncedProgram && leftId && rightId && serversOk) {
      if (
        debouncedProgram !== prevProgramRef.current ||
        leftId !== prevLeftRef.current ||
        rightId !== prevRightRef.current
      ) {
        prevProgramRef.current = debouncedProgram;
        prevLeftRef.current = leftId;
        prevRightRef.current = rightId;
        handleCompare(debouncedProgram);
      }
    }
  }, [debouncedProgram, leftId, rightId, serversOk]);

  async function handleCompare(progName = programName) {
    if (!leftId || !rightId || !progName) {
      toast.error("Please select both servers and a program.");
      return;
    }
    setLoadingAction("compare");
    try {
      const res = await api.compareServers(leftId, rightId, progName);
      setLeftSource(res.left_source || "");
      setRightSource(res.right_source || "");
      setLeftTransport(res.left_transport || null);
      setRightTransport(res.right_transport || null);
      setIdentical(res.identical);
      setHasCompared(true);
      if (res.identical) {
        toast.info("Both servers have an identical version — no differences.");
      }
    } catch (err) {
      toast.error(err.message);
      resetCompare();
    } finally {
      setLoadingAction("");
    }
  }

  if (isInitialLoad) {
    return <LoadingSpinner message="Loading compare..." />;
  }

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
      <h2 style={styles.heading}>Compare Server</h2>
      <p style={styles.subheading}>
        Compare a program between two servers side by side. The right server can only be one that sits
        lower in the promotion chain (Sandbox → Development → QA → Production). Read-only — nothing is changed.
      </p>

      <div className="glass-panel" style={{ ...styles.controls, position: "relative", zIndex: 30 }}>
        <div className="controls-row">
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Left Server (higher)"
              placeholder="Select server..."
              value={leftId}
              onChange={handleLeftChange}
              options={leftOptions}
              freeSolo={false}
            />
            <ServerValidationBadge
              checking={leftVal.checking}
              passed={leftVal.passed}
              message={leftVal.message}
              onRetry={leftVal.retry}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SearchableDropdown
              label="Right Server (lower)"
              placeholder={rightOptions.length === 0 ? "No lower server available" : "Select server..."}
              value={rightId}
              onChange={(val) => {
                setRightId(val);
                resetCompare();
              }}
              options={rightOptions}
              disabled={rightOptions.length === 0}
              freeSolo={false}
            />
            <ServerValidationBadge
              checking={rightVal.checking}
              passed={rightVal.passed}
              message={rightVal.message}
              onRetry={rightVal.retry}
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
              disabled={!leftId}
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
              disabled={!leftId}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => handleCompare(programName)}
            disabled={loadingAction === "compare" || !leftId || !rightId || !programName || !serversOk}
            title={!serversOk ? "Server validation failed — resolve issues above first" : ""}
          >
            {loadingAction === "compare" ? "Comparing..." : "↻ Refresh Compare"}
          </button>
        </div>
      </div>

      <div className="diff-viewer-wrapper" style={{ marginTop: 20 }}>
        <div className="glass-panel diff-panel" style={styles.diffPanel}>
          <div style={styles.diffHeaderCol}>
            <div style={styles.diffTitleRow}>
              <h3 style={styles.diffTitleCentered}>Comparison</h3>
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
                    <span style={{ ...styles.legendDot, background: "var(--accent-2)" }} />
                    <strong>{selectedLeft?.name}</strong>
                    <span style={styles.legendNote}>{ENV_LABELS[selectedLeft?.environment]}</span>
                  </div>
                  <div style={styles.colTitle}>
                    <span style={{ ...styles.legendDot, background: "#f59e0b" }} />
                    <strong>{selectedRight?.name}</strong>
                    <span style={styles.legendNote}>{ENV_LABELS[selectedRight?.environment]}</span>
                  </div>
                </div>
                <div style={styles.crBoxes}>
                  <TransportBox info={leftTransport} environment={selectedLeft?.environment} />
                  <TransportBox info={rightTransport} environment={selectedRight?.environment} />
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
                Select two servers and a program, then click <strong>Compare</strong> to see the difference.
              </div>
            ) : identical ? (
              <div style={styles.identicalBox}>
                ✓ <strong>{selectedLeft?.name}</strong> and <strong>{selectedRight?.name}</strong> have an
                identical version of <strong>{programName}</strong>. No differences.
              </div>
            ) : (
              <DiffViewer original={leftSource} modified={rightSource} sideBySide={true} />
            )}
          </div>
        </div>
      </div>

      <FullscreenDiffModal
        open={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        title={`Compare: ${programName}`}
        leftLabel={selectedLeft?.name}
        leftSubLabel={ENV_LABELS[selectedLeft?.environment]}
        leftColor="var(--accent-2)"
        rightLabel={selectedRight?.name}
        rightSubLabel={ENV_LABELS[selectedRight?.environment]}
        rightColor="#f59e0b"
        leftCode={leftSource}
        rightCode={rightSource}
      />
    </div>
  );
}

const styles = {
  container: { animation: "fadeIn 0.3s ease" },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  subheading: { color: "var(--text-secondary)", fontSize: 13.5, marginTop: 4, marginBottom: 20, maxWidth: 760, lineHeight: 1.5 },
  controls: { padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  diffPanel: { padding: 20, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", height: "100%" },
  diffHeaderCol: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  diffTitleRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 28 },
  diffTitleCentered: { margin: 0, fontSize: 14, fontWeight: 600, textAlign: "center" },
  colTitles: { display: "flex", gap: 12 },
  colTitle: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--text-primary)", flexWrap: "wrap" },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendNote: { color: "var(--text-muted)", fontWeight: 400, fontSize: 11.5 },
  fullscreenBtnAbs: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", padding: "5px 12px", fontSize: 12.5 },
  crBoxes: { display: "flex", gap: 12 },
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
