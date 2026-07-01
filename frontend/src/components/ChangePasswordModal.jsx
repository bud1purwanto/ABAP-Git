import { useState } from "react";
import { api } from "../api/client";
import PasswordInput from "./PasswordInput";
import { useToast } from "./ToastProvider";

export default function ChangePasswordModal({ open, onClose, username }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!open) return null;

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
      toast.success("Password changed successfully.");
      handleClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  }

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div className="glass-panel" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.icon}>🔑</div>
        <h3 style={styles.title}>Change Password</h3>
        <p style={styles.message}>Update the password for <strong>{username}</strong>.</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Current Password</label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Your current password"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm New Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div style={styles.actions}>
            <button type="button" className="btn" onClick={handleClose} disabled={loading} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Updating..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    width: 380,
    padding: "28px",
    textAlign: "center",
    animation: "fadeInScale 0.2s ease",
  },
  icon: {
    fontSize: 28,
    marginBottom: 8,
  },
  title: { margin: "0 0 8px", fontSize: 16 },
  message: { color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 22, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 14, textAlign: "left" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" },
  actions: { display: "flex", gap: 10, marginTop: 8 },
};
