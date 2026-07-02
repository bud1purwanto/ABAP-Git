import { useState, useEffect, useRef, useCallback } from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function PaginatedListModal({ open, title, onClose, fetchData, renderItem, limit = 50 }) {
  const [data, setData] = useState([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setSkip(prevSkip => prevSkip + limit);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setData([]);
      setSkip(0);
      setHasMore(true);
    }
  }, [open]);

  // Fetch when skip changes or opened
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    
    setLoading(true);
    fetchData(skip, limit)
      .then(newData => {
        if (!isMounted) return;
        setData(prev => (skip === 0 ? newData : [...prev, ...newData]));
        if (newData.length < limit) {
          setHasMore(false);
        }
      })
      .catch(err => {
        console.error("Failed to load:", err);
        setHasMore(false);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [skip, open]);

  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button className="btn" style={styles.closeBtn} onClick={onClose}>✖</button>
        </div>
        <div style={styles.content}>
          {data.length === 0 && !loading && (
            <div style={styles.empty}>No data found.</div>
          )}
          <div style={styles.list}>
            {data.map((item, index) => {
              if (data.length === index + 1) {
                return (
                  <div ref={lastElementRef} key={item.id || index}>
                    {renderItem(item)}
                  </div>
                );
              } else {
                return <div key={item.id || index}>{renderItem(item)}</div>;
              }
            })}
          </div>
          {loading && (
            <div style={{ padding: 20 }}>
              <LoadingSpinner message="Loading..." />
            </div>
          )}
        </div>
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
    width: "90%",
    maxWidth: 600,
    height: "80vh",
    display: "flex",
    flexDirection: "column",
    padding: 0,
    animation: "fadeInScale 0.2s ease",
    overflow: "hidden",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--panel-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(15, 23, 42, 0.4)",
  },
  title: { margin: 0, fontSize: 16 },
  closeBtn: { padding: "4px 8px", background: "transparent", border: "none" },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
  },
  empty: { color: "var(--text-muted)", fontSize: 13, padding: "12px 0", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
};
