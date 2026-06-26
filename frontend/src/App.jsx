import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForceChangePassword from "./pages/ForceChangePassword";
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

  function handlePasswordChanged() {
    const updated = { ...user, must_change_password: false };
    sessionStorage.setItem("abap_git_user", JSON.stringify(updated));
    setUser(updated);
  }

  let content;
  if (!user) {
    content = <Login onLogin={handleLogin} />;
  } else if (user.must_change_password) {
    content = (
      <ForceChangePassword username={user.username} onDone={handlePasswordChanged} onCancel={handleLogout} />
    );
  } else {
    content = <Dashboard user={user} onLogout={handleLogout} />;
  }

  return <ToastProvider>{content}</ToastProvider>;
}
