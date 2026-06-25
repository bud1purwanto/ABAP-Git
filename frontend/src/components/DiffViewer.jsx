import React, { useState, useEffect } from "react";
import { DiffEditor } from "@monaco-editor/react";

export default function DiffViewer({ original, modified, diff, sideBySide = false }) {
  const [editorTheme, setEditorTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "dark");

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          setEditorTheme(document.documentElement.getAttribute("data-theme") || "dark");
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const hasDiff = (original || "") !== (modified || "");

  if (!hasDiff) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.empty}>
          No differences found between SAP and the committed version.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <DiffEditor
        height="100%"
        language="abap"
        theme={editorTheme === "light" ? "light" : "vs-dark"}
        original={original}
        modified={modified}
        options={{
          renderSideBySide: sideBySide,
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    background: "var(--input-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 10,
    height: "100%",
    overflow: "hidden",
  },
  empty: {
    color: "var(--text-muted)",
    padding: "20px 16px",
    fontStyle: "italic",
    textAlign: "center",
  },
};
