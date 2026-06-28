import { useState } from "react";
import { api } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username, password);
      onLogin(res);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.themeToggleWrapper}>
        <ThemeToggle />
      </div>
      <div className="glass-panel" style={styles.card}>
        <div style={styles.logo}>⌬</div>
        <h1 style={styles.title}>ABAP Version Control System</h1>
        <p style={styles.subtitle}>Middleware Console</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              required
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  themeToggleWrapper: {
    position: "absolute",
    top: 24,
    right: 28,
  },
  card: {
    width: 380,
    padding: "40px 36px",
    textAlign: "center",
    animation: "fadeInScale 0.4s ease",
  },
  logo: {
    fontSize: 40,
    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    margin: 0,
    fontWeight: 600,
  },
  subtitle: {
    color: "var(--text-secondary)",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    textAlign: "left",
  },
  error: {
    color: "var(--danger)",
    fontSize: 13,
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 8,
    padding: "8px 12px",
  },
};
