import { useState, useRef, useEffect } from "react";

export default function SearchableDropdown({
  label,
  value,
  onChange,
  onSelect,
  onEnter,
  options, // Array of strings or objects {label, value}
  placeholder,
  isLoading = false,
  disabled = false,
  freeSolo = true, // If true, allows arbitrary text and calls onChange on type
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  // Update local search when value changes from outside or the selected option's label changes
  const matchedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));
  const matchedDisplay = matchedOption ? (matchedOption.display || matchedOption.label) : "";

  useEffect(() => {
    if (value === null || value === undefined || value === "") {
      setSearch("");
      return;
    }
    const match = normalizedOptions.find((opt) => String(opt.value) === String(value));
    if (match) {
      setSearch(match.display || match.label);
    } else {
      setSearch(String(value));
    }
  }, [value, matchedDisplay]);

  const isExactMatch = normalizedOptions.some((opt) => opt.label === search);
  
  const filteredOptions = isExactMatch
    ? normalizedOptions
    : normalizedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(String(search).toLowerCase())
      );

  const handleSelect = (val, opt) => {
    setSearch(opt.display || opt.label);
    if (onChange) onChange(val);
    if (onSelect) onSelect(val, opt);
    setIsOpen(false);
  };

  return (
    <div style={styles.wrapper} ref={wrapperRef}>
      {label && <label style={styles.label}>{label}</label>}
      <div style={styles.inputWrapper}>
        <input
          type="text"
          name={`search_${Math.random().toString(36).substring(7)}`}
          style={styles.input}
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            if (freeSolo && onChange) {
              onChange(val.toUpperCase());
            }
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (onEnter) onEnter(search);
              setIsOpen(false);
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={isLoading ? "Loading..." : placeholder}
          disabled={disabled || isLoading}
          autoComplete="new-password"
          spellCheck="false"
          autoCorrect="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <div style={styles.icon}>{isOpen ? "▴" : "▾"}</div>
      </div>

      {isOpen && !disabled && (
        <div style={styles.dropdown}>
          {filteredOptions.length === 0 ? (
            <div style={styles.empty}>No results found</div>
          ) : (
            filteredOptions.map((opt, i) => (
              <div
                key={i}
                style={styles.option}
                onClick={() => handleSelect(opt.value, opt)}
                onMouseEnter={(e) => (e.target.style.background = "var(--panel-border)")}
                onMouseLeave={(e) => (e.target.style.background = "transparent")}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    paddingRight: 32,
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },
  icon: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "var(--text-secondary)",
    fontSize: 18,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    background: "var(--bg-deep)",
    border: "1px solid var(--panel-border)",
    borderRadius: 8,
    maxHeight: 250,
    overflowY: "auto",
    zIndex: 1000,
    backdropFilter: "blur(12px)",
    boxShadow: "var(--shadow-soft)",
  },
  option: {
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-primary)",
    transition: "background 0.15s",
  },
  empty: {
    padding: "10px 14px",
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
  },
};
