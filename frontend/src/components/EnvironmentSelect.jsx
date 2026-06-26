import { useEffect, useRef, useState } from "react";

export const ENV_META = {
  SANDBOX: { label: "Sandbox", color: "#a5b4fc" },
  DEV: { label: "Development", color: "#6ee7b7" },
  QA: { label: "Quality Assurance", color: "#fcd34d" },
  PROD: { label: "Production", color: "#fca5a5" },
};

const ORDER = ["SANDBOX", "DEV", "QA", "PROD"];

export default function EnvironmentSelect({ value, onChange, takenEnvs = new Set() }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = ENV_META[value] || ENV_META.SANDBOX;

  return (
    <div style={styles.wrapper} ref={wrapperRef}>
      <button type="button" style={styles.trigger} onClick={() => setIsOpen((v) => !v)}>
        <span style={{ ...styles.dot, background: current.color }} />
        <span style={styles.triggerLabel}>{current.label}</span>
        <span style={{ ...styles.chevron, transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {ORDER.map((env) => {
            const meta = ENV_META[env];
            const taken = env !== "SANDBOX" && takenEnvs.has(env);
            const isSelected = env === value;
            return (
              <button
                type="button"
                key={env}
                disabled={taken}
                onClick={() => {
                  if (taken) return;
                  onChange(env);
                  setIsOpen(false);
                }}
                style={{
                  ...styles.option,
                  ...(isSelected ? styles.optionSelected : {}),
                  ...(taken ? styles.optionDisabled : {}),
                }}
              >
                <span style={{ ...styles.dot, background: taken ? "var(--text-muted)" : meta.color }} />
                <span style={styles.optionLabel}>{meta.label}</span>
                {taken && <span style={styles.takenBadge}>In use</span>}
                {isSelected && !taken && <span style={styles.checkMark}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { position: "relative" },
  trigger: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.2s ease",
  },
  triggerLabel: { flex: 1, fontWeight: 500 },
  chevron: { color: "var(--text-secondary)", fontSize: 12, transition: "transform 0.15s ease" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "var(--bg-deep)",
    border: "1px solid var(--panel-border)",
    borderRadius: 10,
    padding: 6,
    zIndex: 1000,
    backdropFilter: "blur(12px)",
    boxShadow: "var(--shadow-soft)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    animation: "fadeIn 0.12s ease",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 10px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 7,
    color: "var(--text-primary)",
    fontSize: 13.5,
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.12s ease",
  },
  optionSelected: {
    background: "rgba(99, 102, 241, 0.14)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
  },
  optionDisabled: {
    cursor: "not-allowed",
    opacity: 0.45,
  },
  optionLabel: { flex: 1 },
  takenBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    background: "rgba(148, 163, 184, 0.15)",
    border: "1px solid var(--panel-border)",
    borderRadius: 5,
    padding: "1px 6px",
    flexShrink: 0,
  },
  checkMark: { color: "var(--accent-2)", fontSize: 13, fontWeight: 700, flexShrink: 0 },
};
