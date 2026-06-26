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

  const isLight = theme === "light";
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <button
      onClick={toggle}
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
      aria-label="Toggle color theme"
      className="theme-toggle"
      data-active={isLight ? "light" : "dark"}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-icon theme-toggle-icon-sun">☀</span>
        <span className="theme-toggle-icon theme-toggle-icon-moon">🌙</span>
        <span className="theme-toggle-knob" />
      </span>
    </button>
  );
}
