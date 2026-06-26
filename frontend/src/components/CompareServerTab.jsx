import { useEffect, useState } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import SearchableDropdown from "./SearchableDropdown";
import FullscreenDiffModal from "./FullscreenDiffModal";
import { useToast } from "./ToastProvider";
import { useServerValidation } from "../hooks/useServerValidation";
import ServerValidationBadge from "./ServerValidationBadge";

const ENV_LABELS = { SANDBOX: "Sandbox", DEV: "Development", QA: "Quality Assurance", PROD: "Production" };
const ENV_RANK = { SANDBOX: 0, DEV: 1, QA: 2, PROD: 3 };

function rank(sb) {
  return ENV_RANK[sb.environment] ?? 0;
}

function serverLabel(sb) {
  return `${sb.name} (${ENV_LABELS[sb.environment] || sb.environment})`;
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
  const [identical, setIdentical] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const [loadingAction, setLoadingAction] = useState("");
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const toast = useToast();

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

  async function handleCompare() {
    if (!leftId || !rightId || !programName) {
      toast.error("Please select both servers and a program.");
      return;
    }
    setLoadingAction("compare");
    try {
      const res = await api.compareServers(leftId, rightId, programName);
      setLeftSource(res.left_source || "");
      setRightSource(res.right_source || "");
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
            onClick={handleCompare}
            disabled={loadingAction === "compare" || !leftId || !rightId || !programName || !serversOk}
            title={!serversOk ? "Server validation failed — resolve issues above first" : ""}
          >
            {loadingAction === "compare" ? "Comparing..." : "Compare"}
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
                    <strong>{selectedLeft?.name}</strong>
                    <span style={styles.legendNote}>{ENV_LABELS[selectedLeft?.environment]}</span>
                  </span>
                  <span style={styles.legendArrow}>vs</span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, background: "#f59e0b" }} />
                    <strong>{selectedRight?.name}</strong>
                    <span style={styles.legendNote}>{ENV_LABELS[selectedRight?.environment]}</span>
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
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setShowFullscreen(false)}>
              Close
            </button>
          </div>
        }
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
