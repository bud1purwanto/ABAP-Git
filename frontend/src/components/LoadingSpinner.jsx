export default function LoadingSpinner({ message = "Loading data..." }) {
  return (
    <div style={styles.container}>
      <div className="spinner" style={styles.spinner}></div>
      <div style={styles.text}>{message}</div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    color: "var(--text-muted)",
    animation: "fadeIn 0.3s ease",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(99, 102, 241, 0.2)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: 500,
  }
};
