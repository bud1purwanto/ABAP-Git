import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App.jsx'

// Apply theme before React mounts to prevent flash
const stored = localStorage.getItem("abap_git_theme");
const theme = stored === "light" || stored === "dark"
  ? stored
  : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
document.documentElement.setAttribute("data-theme", theme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
