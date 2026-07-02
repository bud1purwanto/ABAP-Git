import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useToast } from "./ToastProvider";
import SearchableDropdown from "./SearchableDropdown";
import ConfirmModal from "./ConfirmModal";

export default function ProjectsTab({ active, author }) {
  const [projects, setProjects] = useState([]);
  const [sandboxes, setSandboxes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [projectToCopy, setProjectToCopy] = useState(null);

  const [projectToDelete, setProjectToDelete] = useState(null);

  useEffect(() => {
    if (active) {
      fetchData();
    }
  }, [active]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projRes, sbRes] = await Promise.all([
        api.listProjects(),
        api.listSandboxes(),
      ]);
      setProjects(projRes);
      setSandboxes(sbRes);
    } catch (err) {
      toast.error("Failed to fetch projects or sandboxes");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await api.deleteProject(projectToDelete.id, author);
      toast.success("Project deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleSave = async (payload) => {
    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, payload);
        toast.success("Project updated");
      } else {
        await api.createProject(payload);
        toast.success("Project created");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to save project");
    }
  };

  const handleCopy = async (targetSandboxId) => {
    try {
      await api.copyProject(projectToCopy.id, targetSandboxId, author);
      toast.success("Project copied successfully!");
      setCopyModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to copy project");
    }
  };

  if (!active) return null;

  return (
    <div className="page-padding" style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Projects</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5, margin: "4px 0 0 0" }}>
            Group your ABAP programs into projects for mass sync & compare
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingProject(null);
            setModalOpen(true);
          }}
        >
          + Create Project
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading...</div>
      ) : projects.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          No projects found. Create one to get started!
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {projects.map((proj) => {
            const sb = sandboxes.find(s => s.id === proj.sandbox_id);
            return (
              <div key={proj.id} className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, wordBreak: "break-word", lineHeight: 1.4 }}>{proj.name}</h3>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Sandbox: <strong>{sb?.name || "Unknown"}</strong>
                    {proj.created_by && <span style={{ marginLeft: 8 }}>• By: <strong>{proj.created_by}</strong></span>}
                  </div>
                </div>
                {proj.description && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>{proj.description}</p>
                )}
                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                    Programs ({proj.programs?.length || 0}):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {proj.programs?.slice(0, 5).map(p => (
                      <span key={p.id} style={{ fontSize: 11, background: "rgba(99, 102, 241, 0.1)", color: "var(--accent-2)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                        {p.program_name} {p.tcode ? `(${p.tcode})` : ""}
                      </span>
                    ))}
                    {(proj.programs?.length || 0) > 5 && (
                      <span style={{ fontSize: 11, background: "rgba(255, 255, 255, 0.05)", padding: "2px 6px", borderRadius: 4 }}>
                        +{proj.programs.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn" style={{ flex: 1, padding: "6px 8px", fontSize: 12 }} onClick={() => {
                    setProjectToCopy(proj);
                    setCopyModalOpen(true);
                  }}>
                    Copy
                  </button>
                  <button className="btn" style={{ flex: 1, padding: "6px 8px", fontSize: 12 }} onClick={() => {
                    setEditingProject(proj);
                    setModalOpen(true);
                  }}>
                    Edit
                  </button>
                  <button className="btn" style={{ flex: 1, padding: "6px 8px", fontSize: 12, color: "var(--danger)", border: "1px solid rgba(248, 113, 113, 0.25)" }} onClick={() => setProjectToDelete(proj)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ProjectModal
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          initialData={editingProject}
          sandboxes={sandboxes}
          author={author}
        />
      )}

      {copyModalOpen && (
        <CopyProjectModal
          onClose={() => setCopyModalOpen(false)}
          onCopy={handleCopy}
          project={projectToCopy}
          sandboxes={sandboxes}
        />
      )}

      {projectToDelete && (
        <ConfirmModal
          open={!!projectToDelete}
          title="Delete Project"
          message={`Are you sure you want to delete the project "${projectToDelete.name}"?`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setProjectToDelete(null)}
        />
      )}
    </div>
  );
}

function CopyProjectModal({ onClose, onCopy, project, sandboxes }) {
  const sandboxEnvs = [...sandboxes]
    .filter(s => s.environment === "SANDBOX" && s.id !== project.sandbox_id)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const [targetId, setTargetId] = useState(sandboxEnvs[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div style={modalStyles.overlay}>
      <div className="glass-panel" style={{...modalStyles.modal, maxWidth: 400}} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, fontSize: 18 }}>Copy Project</h3>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Copy project <strong>{project.name}</strong> to another sandbox. All its associated programs will be copied.
        </p>

        <div>
          <SearchableDropdown
            label="Target Sandbox"
            placeholder="Select target server..."
            value={targetId}
            onChange={(val) => setTargetId(val)}
            options={sandboxEnvs.map((sb) => ({
              label: sb.name,
              value: String(sb.id),
            }))}
            freeSolo={false}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 }}>
          <button className="btn" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button 
            className="btn btn-primary"  
            disabled={isSubmitting || !targetId}
            onClick={async () => {
              setIsSubmitting(true);
              await onCopy(targetId);
              setIsSubmitting(false);
            }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ onClose, onSave, initialData, sandboxes, author }) {
  const sandboxEnvs = [...sandboxes]
    .filter(s => s.environment === "SANDBOX")
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [sandboxId, setSandboxId] = useState(initialData?.sandbox_id || sandboxEnvs[0]?.id || "");
  
  // Array of { program_name, tcode }
  const [programs, setPrograms] = useState(initialData?.programs?.map(p => ({ program_name: p.program_name, tcode: p.tcode })) || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tcodesList, setTcodesList] = useState([]);
  const [programsList, setProgramsList] = useState([]);
  const [isFetchingSAP, setIsFetchingSAP] = useState(false);
  const [tcodeSearch, setTcodeSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (sandboxId) {
      fetchSAPData(sandboxId);
    }
  }, [sandboxId]);

  const fetchSAPData = async (sbId) => {
    setIsFetchingSAP(true);
    try {
      const [tcRes, progRes] = await Promise.all([
        api.getTCodes(sbId).catch(() => ({ data: [] })),
        api.getPrograms(sbId).catch(() => ({ data: [] })),
      ]);
      
      setTcodesList(tcRes.data.map(tc => ({
        label: tc.description 
          ? `${tc.tcode} - ${tc.description} (${tc.program})` 
          : `${tc.tcode} (${tc.program})`,
        value: tc.tcode,
        program_name: tc.program,
        display: tc.tcode
      })));

      setProgramsList(progRes.data.map(p => ({
        label: p.name,
        value: p.name,
        display: p.name
      })));
    } catch (err) {
      toast.error("Failed to fetch T-Codes or Programs from SAP");
    } finally {
      setIsFetchingSAP(false);
    }
  };

  const handleAddTCode = (tcodeVal) => {
    if (!tcodeVal) return;
    const tcObj = tcodesList.find(t => t.value === tcodeVal);
    if (!tcObj) {
      // Manual tcode? Just add it
      if (!programs.some(p => p.tcode === tcodeVal)) {
        setPrograms([...programs, { tcode: tcodeVal, program_name: "" }]); // Program name unknown yet
      }
      return;
    }

    if (!programs.some(p => p.program_name === tcObj.program_name)) {
      setPrograms([...programs, { tcode: tcObj.value, program_name: tcObj.program_name }]);
    } else {
      toast.error(`Program ${tcObj.program_name} is already added`);
    }
    setTcodeSearch("");
  };

  const handleAddProgram = (progVal) => {
    if (!progVal) return;
    const progObj = programsList.find(p => p.value === progVal);
    const name = progObj ? progObj.value : progVal;
    
    if (!programs.some(p => p.program_name === name)) {
      setPrograms([...programs, { tcode: null, program_name: name }]);
    } else {
      toast.error(`Program ${name} is already added`);
    }
    setProgramSearch("");
  };

  const handleRemove = (idx) => {
    setPrograms(programs.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!name || !sandboxId) return;
    
    // Ensure all have program_name (fallback if manually typed tcode without program)
    const validPrograms = programs.map(p => ({
      program_name: p.program_name || p.tcode, // Fallback if they typed a T-Code that wasn't found
      tcode: p.tcode || null
    }));

    setIsSubmitting(true);
    await onSave({ name, description, sandbox_id: sandboxId, programs: validPrograms, created_by: author });
    setIsSubmitting(false);
  };

  return (
    <div style={modalStyles.overlay}>
      <div className="glass-panel" style={{...modalStyles.modal, maxWidth: 640}} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{initialData ? "Edit Project" : "Create Project"}</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit} 
              disabled={isSubmitting || !name || !sandboxId}
            >
              {isSubmitting ? "Saving..." : "Save Project"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label>Project Name *</label>
              <input
                type="text"
                className="input"
                style={{ width: "100%" }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., HR Integration Phase 1"
              />
            </div>
            <div style={{ flex: 1 }}>
              <SearchableDropdown
                label="Sandbox *"
                placeholder="Select server..."
                value={sandboxId}
                onChange={(val) => setSandboxId(val)}
                options={sandboxEnvs.map((sb) => ({
                  label: sb.name,
                  value: String(sb.id),
                }))}
                disabled={!!initialData}
                freeSolo={false}
              />
            </div>
          </div>

          <div>
            <label>Description</label>
            <input
              type="text"
              className="input"
              style={{ width: "100%" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", margin: "4px 0" }} />

          <div>
            <h3 style={{ fontSize: 14, margin: "0 0 16px 0" }}>Programs Included</h3>
            
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <SearchableDropdown
                  label="Add by T-Code (Enter to add)"
                  placeholder={isFetchingSAP ? "Loading SAP T-Codes..." : "Search T-Code..."}
                  options={tcodesList}
                  onChange={setTcodeSearch}
                  onSelect={(val) => handleAddTCode(val)}
                  onEnter={(val) => handleAddTCode(val)}
                  isLoading={isFetchingSAP}
                  value={tcodeSearch}
                />
              </div>
              <div style={{ flex: 1 }}>
                <SearchableDropdown
                  label="Add by Program (Enter to add)"
                  placeholder={isFetchingSAP ? "Loading SAP Programs..." : "Search Program..."}
                  options={programsList}
                  onChange={setProgramSearch}
                  onSelect={(val) => handleAddProgram(val)}
                  onEnter={(val) => handleAddProgram(val)}
                  isLoading={isFetchingSAP}
                  value={programSearch}
                />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: 10, padding: 16, minHeight: 120, display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--panel-border)" }}>
              {programs.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: "auto", fontStyle: "italic" }}>
                  No programs added yet. Use the dropdowns above to add them.
                </div>
              ) : (
                programs.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--input-bg)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--panel-border)", animation: "fadeIn 0.2s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.program_name || "(Unknown)"}</span>
                      {p.tcode && (
                        <span style={{ fontSize: 11, background: "rgba(34, 211, 238, 0.1)", color: "var(--accent-2)", border: "1px solid rgba(34, 211, 238, 0.25)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                          T-Code: {p.tcode}
                        </span>
                      )}
                    </div>
                    <button className="btn" style={{ padding: "4px 8px", fontSize: 12, color: "var(--danger)" }} onClick={() => handleRemove(idx)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
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
    padding: "20px"
  },
  modal: {
    width: "100%",
    padding: "28px",
    animation: "fadeInScale 0.2s ease",
    maxHeight: "90vh",
    overflowY: "auto",
    textAlign: "left"
  }
};
