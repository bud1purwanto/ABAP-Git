import { useEffect, useState } from "react";

function getInitialTheme() {
  const stored = localStorage.getItem("abap_git_theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("abap_git_theme", theme);
  }, [theme]);

  // Also set on first mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", getInitialTheme());
  }, []);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={styles.btn}
    >
      <span style={styles.icon}>{theme === "dark" ? "☀" : "🌙"}</span>
    </button>
  );
}

const styles = {
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "rgba(99, 102, 241, 0.12)",
    border: "1px solid var(--panel-border)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flexShrink: 0,
  },
  icon: {
    fontSize: 16,
    lineHeight: 1,
  },
};
