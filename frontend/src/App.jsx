import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { ToastProvider } from "./components/ToastProvider";

export default function App() {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem("abap_git_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      sessionStorage.removeItem("abap_git_user");
      return null;
    }
  });

  function handleLogin(userData) {
    sessionStorage.setItem("abap_git_user", JSON.stringify(userData));
    setUser(userData);
  }

  function handleLogout() {
    sessionStorage.removeItem("abap_git_user");
    setUser(null);
  }

  return (
    <ToastProvider>
      {!user ? <Login onLogin={handleLogin} /> : <Dashboard user={user} onLogout={handleLogout} />}
    </ToastProvider>
  );
}
