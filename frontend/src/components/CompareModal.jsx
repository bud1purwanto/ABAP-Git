import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import DiffViewer from "./DiffViewer";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ToastProvider";
import SearchableDropdown from "./SearchableDropdown";

export default function CompareModal({
  open,
  onClose,
  programName,
  sandboxId,
  history,
  author
}) {
  const [leftSource, setLeftSource] = useState("");
  const [rightSource, setRightSource] = useState("");
  
  const [leftCode, setLeftCode] = useState("");
  const [rightCode, setRightCode] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Reset state when program name changes
    setLeftSource("");
    setRightSource("");
    setLeftCode("");
    setRightCode("");
  }, [programName]);

  useEffect(() => {
    if (open && !leftSource && !rightSource) {
      // Set initial defaults: Left = SAP (Newest), Right = Latest Commit (Older)
      setLeftSource("SAP");
      if (history.length > 0) {
        setRightSource(String(history[0].id));
      } else {
        setRightSource("");
      }
    }
  }, [open, history, leftSource, rightSource]);

  useEffect(() => {
    if (!open) return;
    
    let isActive = true;

    async function fetchCode() {
      setIsLoading(true);
      try {
        let left = "";
        let right = "";

        // Fetch Left
        if (leftSource === "SAP") {
          const res = await api.readFromSap(programName, sandboxId, undefined, author);
          left = res.sap_source;
        } else if (leftSource) {
          const res = await api.getVersion(leftSource);
          left = res.source_code;
        }

        // Fetch Right
        if (rightSource === "SAP") {
          const res = await api.readFromSap(programName, sandboxId, undefined, author);
          right = res.sap_source;
        } else if (rightSource) {
          const res = await api.getVersion(rightSource);
          right = res.source_code;
        }

        if (isActive) {
          setLeftCode(left);
          setRightCode(right);
        }
      } catch (err) {
        if (isActive) toast.error("Failed to fetch code for comparison: " + err.message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }
    
    if (leftSource || rightSource) {
      fetchCode();
    }

    return () => {
      isActive = false;
    };
  }, [leftSource, rightSource, open, programName, sandboxId, author]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dateStr));
  };

  const getRightOptions = () => {
    if (!leftSource) return [];
    
    if (leftSource === "SAP") {
      return history.map((h) => ({
        label: `v${h.version_number} — ${formatDate(h.created_at)} — ${h.author}`,
        value: String(h.id),
      }));
    }

    const leftIndex = history.findIndex((h) => String(h.id) === leftSource);
    if (leftIndex >= 0) {
      const olderHistory = history.slice(leftIndex + 1);
      return olderHistory.map((h) => ({
        label: `v${h.version_number} — ${formatDate(h.created_at)} — ${h.author}`,
        value: String(h.id),
      }));
    }

    return [];
  };

  const rightOptions = getRightOptions();

  const describeSource = (source) => {
    if (source === "SAP") {
      return { title: "Actual SAP (Live)", message: "Live source code read directly from the SAP server — not a stored commit.", meta: "" };
    }
    const v = history.find((h) => String(h.id) === String(source));
    if (!v) return null;
    return {
      title: `v${v.version_number}`,
      message: v.commit_message?.trim() || "No commit message.",
      meta: `${v.author || "system"}${v.created_at ? ` · ${formatDate(v.created_at)}` : ""}`,
    };
  };

  const leftInfo = describeSource(leftSource);
  const rightInfo = describeSource(rightSource);

  // Ensure rightSource is valid when leftSource changes
  useEffect(() => {
    if (rightSource && rightOptions.length > 0) {
      const isValid = rightOptions.some((opt) => opt.value === rightSource);
      if (!isValid) {
        setRightSource(rightOptions[0].value);
      }
    } else if (rightSource && rightOptions.length === 0) {
      setRightSource("");
    }
  }, [rightOptions, rightSource]);

  if (!open) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>🔍 Advanced Compare: {programName}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ ...styles.controlsRow, position: "relative", zIndex: 30 }}>
          <div style={styles.controlBox}>
            <SearchableDropdown
              label="Left Side (Newer Version)"
              value={leftSource}
              onChange={(val) => setLeftSource(val)}
              options={[
                { label: "Actual SAP (Live)", value: "SAP" },
                ...history.map((h) => ({
                  label: `v${h.version_number} — ${formatDate(h.created_at)} — ${h.author}`,
                  value: String(h.id),
                }))
              ]}
              freeSolo={false}
            />
          </div>
          
          <div style={styles.vsIcon}>VS</div>

          <div style={styles.controlBox}>
            <SearchableDropdown
              label="Right Side (Older Version)"
              value={rightSource}
              onChange={(val) => setRightSource(val)}
              options={rightOptions}
              disabled={rightOptions.length === 0}
              placeholder={rightOptions.length === 0 ? "No older versions available" : "Select older version..."}
              freeSolo={false}
            />
          </div>
        </div>

        {(leftInfo || rightInfo) && (
          <div style={styles.commitMsgRow}>
            <div style={styles.commitMsgBox}>
              <div style={styles.commitMsgHeader}>
                <span style={styles.commitMsgTitle}>💬 Left — {leftInfo?.title || "—"}</span>
                {leftInfo?.meta && <span style={styles.commitMsgMeta}>{leftInfo.meta}</span>}
              </div>
              <div style={styles.commitMsgText}>{leftInfo?.message || "—"}</div>
            </div>
            <div style={styles.commitMsgBox}>
              <div style={styles.commitMsgHeader}>
                <span style={styles.commitMsgTitle}>💬 Right — {rightInfo?.title || "—"}</span>
                {rightInfo?.meta && <span style={styles.commitMsgMeta}>{rightInfo.meta}</span>}
              </div>
              <div style={styles.commitMsgText}>{rightInfo?.message || "—"}</div>
            </div>
          </div>
        )}

        <div style={styles.diffContainer}>
          {isLoading ? (
            <div style={styles.loadingWrapper}>
              <LoadingSpinner message="Fetching sources..." />
            </div>
          ) : (
            <DiffViewer original={leftCode} modified={rightCode} sideBySide={true} />
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalContent: {
    background: "var(--bg-deep)",
    border: "1px solid var(--panel-border)",
    borderRadius: 16,
    width: "95vw",
    height: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
    overflow: "hidden",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid var(--panel-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--panel-bg)",
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 20,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "background 0.2s",
  },
  controlsRow: {
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "var(--panel-bg)",
    borderBottom: "1px solid var(--panel-border)",
  },
  controlBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
  },
  vsIcon: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text-muted)",
    background: "var(--input-bg)",
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid var(--panel-border)",
  },
  commitMsgRow: {
    display: "flex",
    gap: 12,
    padding: "12px 24px 0",
    background: "var(--panel-bg)",
  },
  commitMsgBox: {
    flex: 1,
    minWidth: 0,
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid var(--accent-glow)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  commitMsgHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  commitMsgTitle: { fontSize: 11.5, fontWeight: 700, color: "var(--accent-2)" },
  commitMsgMeta: { fontSize: 10.5, color: "var(--text-muted)" },
  commitMsgText: {
    fontSize: 12.5,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.45,
    maxHeight: 80,
    overflowY: "auto",
  },
  diffContainer: {
    flex: 1,
    padding: 16,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  loadingWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
