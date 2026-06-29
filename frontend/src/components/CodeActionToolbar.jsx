import React, { useState } from "react";
import { useToast } from "./ToastProvider";

export default function CodeActionToolbar({ sourceCode, defaultFilename = "source", containerStyle = {} }) {
  const [format, setFormat] = useState(".abap");
  const toast = useToast();

  const handleCopy = async () => {
    if (!sourceCode) {
      toast.error("No source code to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(sourceCode);
      toast.success("Source code copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy source code.");
    }
  };

  const handleDownload = () => {
    if (!sourceCode) {
      toast.error("No source code to download.");
      return;
    }
    const blob = new Blob([sourceCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${defaultFilename}${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded as ${format}`);
  };

  return (
    <div style={{ ...styles.toolbar, ...containerStyle }}>
      <button className="btn btn-secondary" style={styles.btn} onClick={handleCopy} title="Copy Source Code">
        📋 Copy
      </button>
      <div style={styles.downloadGroup}>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={styles.select}
          title="Choose format"
        >
          <option value=".abap">.abap</option>
          <option value=".txt">.txt</option>
        </select>
        <button className="btn btn-secondary" style={styles.btnDownload} onClick={handleDownload} title="Download Source Code">
          ⬇️ Download
        </button>
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    marginTop: "8px",
  },
  btn: {
    padding: "4px 10px",
    fontSize: 12,
  },
  downloadGroup: {
    display: "flex",
    alignItems: "stretch",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid var(--panel-border)",
  },
  select: {
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    border: "none",
    borderRight: "1px solid var(--panel-border)",
    padding: "0 6px",
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
  },
  btnDownload: {
    padding: "4px 10px",
    fontSize: 12,
    border: "none",
    borderRadius: 0,
  }
};
