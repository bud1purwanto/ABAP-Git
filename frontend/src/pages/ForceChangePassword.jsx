import { useState } from "react";
import { api } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";

export default function ForceChangePassword({ username, onDone, onCancel }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 4) {
      toast.error("New password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(username, currentPassword, newPassword);
      toast.success("Password changed. Welcome back!");
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div className="glass-panel" style={styles.card}>
        <div style={styles.icon}>🔒</div>
        <h1 style={styles.title}>Set a New Password</h1>
        <p style={styles.subtitle}>
          Your password was reset by an administrator. Please set a new password for{" "}
          <strong>{username}</strong> before continuing.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label>Temporary Password</label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Password given by admin"
              required
            />
          </div>
          <div>
            <label>New Password</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label>Confirm New Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "Updating..." : "Set New Password"}
          </button>
          <button type="button" className="btn" onClick={onCancel} style={{ width: "100%" }}>
            Cancel and log out
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
  },
  card: {
    width: 400,
    padding: "40px 36px",
    textAlign: "center",
    animation: "fadeInScale 0.4s ease",
  },
  icon: { fontSize: 32, marginBottom: 8 },
  title: { fontSize: 19, margin: 0, fontWeight: 700 },
  subtitle: { color: "var(--text-secondary)", fontSize: 13, marginTop: 8, marginBottom: 24, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 14, textAlign: "left" },
};
