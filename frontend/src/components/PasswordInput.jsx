import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder, required }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={styles.wrapper}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={styles.input}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={styles.toggle}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? "🙈" : "👁"}
      </button>
    </div>
  );
}

const styles = {
  wrapper: { position: "relative", width: "100%" },
  input: { paddingRight: 38 },
  toggle: {
    position: "absolute",
    right: 4,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: 6,
    color: "var(--text-muted)",
  },
};
