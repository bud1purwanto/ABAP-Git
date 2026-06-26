const BASE_URL = `http://${window.location.hostname}:8000`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  changePassword: (username, currentPassword, newPassword) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ username, current_password: currentPassword, new_password: newPassword }),
    }),

  listSandboxes: () => request("/api/sandboxes"),
  createSandbox: (data) => request("/api/sandboxes", { method: "POST", body: JSON.stringify(data) }),
  updateSandbox: (id, data) => request(`/api/sandboxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSandbox: (id, requestedBy) =>
    request(`/api/sandboxes/${id}?requested_by=${encodeURIComponent(requestedBy)}`, { method: "DELETE" }),

  getTCodes: (sandboxId) => request(`/api/sap/${sandboxId}/tcodes`),
  checkLogon: (sandboxId, author) => {
    const params = new URLSearchParams();
    if (author) params.append("author", author);
    return request(`/api/sap/${sandboxId}/logon-check?${params.toString()}`);
  },
  checkLock: (sandboxId, program) =>
    request(`/api/sap/${sandboxId}/lock-check?program=${encodeURIComponent(program)}`),
  validateLiveDeployment: (data) => request("/api/sap/validate_live_deployment", { method: "POST", body: JSON.stringify(data) }),
  deployToLive: (data) => request("/api/sap/deploy_live", { method: "POST", body: JSON.stringify(data) }),


  // AuthPrograms: (sandboxId) => request(`/api/sap/${sandboxId}/programs`),
  getPrograms: (sandboxId) => request(`/api/sap/${sandboxId}/programs`),
  getProgramIncludes: (sandboxId, program) => request(`/api/sap/${sandboxId}/program-includes?program=${encodeURIComponent(program)}`),

  readFromSap: (programName, sandboxId, versionId, author) => {
    const params = new URLSearchParams({ program_name: programName, sandbox_id: sandboxId });
    if (versionId) params.append("version_id", versionId);
    if (author) params.append("author", author);
    return request(`/api/sap/read?${params.toString()}`);
  },
  writeToSap: (data) => request("/api/sap/write", { method: "POST", body: JSON.stringify(data) }),

  generateCommit: (diff, programName) =>
    request("/api/ai/generate-commit", {
      method: "POST",
      body: JSON.stringify({ diff, program_name: programName }),
    }),

  commitVersion: (data) => request("/api/git/commit", { method: "POST", body: JSON.stringify(data) }),
  getHistory: (programName, author) => request(`/api/git/history?program_name=${encodeURIComponent(programName)}${author ? `&author=${encodeURIComponent(author)}` : ""}`),
  getVersion: (versionId) => request(`/api/git/version/${versionId}`),
  editCommit: (versionId, requestedBy, commitMessage) =>
    request(`/api/git/version/${versionId}`, {
      method: "PATCH",
      body: JSON.stringify({ requested_by: requestedBy, commit_message: commitMessage }),
    }),
  deleteCommit: (versionId, requestedBy) =>
    request(`/api/git/version/${versionId}?requested_by=${encodeURIComponent(requestedBy)}`, { method: "DELETE" }),
  renameProgram: (oldName, newName, requestedBy) =>
    request("/api/git/rename-program", {
      method: "POST",
      body: JSON.stringify({ old_name: oldName, new_name: newName, requested_by: requestedBy }),
    }),
  listPrograms: (search, author) => {
    let url = `/api/git/programs?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (author) url += `author=${encodeURIComponent(author)}`;
    return request(url);
  },

  getActivity: (limit = 50, author) => request(`/api/activity?limit=${limit}${author ? `&author=${encodeURIComponent(author)}` : ""}`),

  listUsers: () => request("/api/users"),
  createUser: (data) => request("/api/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id, requestedBy) => request(`/api/users/${id}?requested_by=${encodeURIComponent(requestedBy)}`, { method: "DELETE" }),
  resetPassword: (id, requestedBy, newPassword) =>
    request(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ requested_by: requestedBy, new_password: newPassword }),
    }),

  getOverviewStats: () => request("/api/stats/overview"),

  syncCompare: (sourceId, targetId, programName) =>
    request("/api/sap/sync/compare", {
      method: "POST",
      body: JSON.stringify({ source_id: Number(sourceId), target_id: Number(targetId), program_name: programName }),
    }),
  syncApply: (sourceId, targetId, programName, author) =>
    request("/api/sap/sync/apply", {
      method: "POST",
      body: JSON.stringify({ source_id: Number(sourceId), target_id: Number(targetId), program_name: programName, author }),
    }),
  compareServers: (leftId, rightId, programName) =>
    request("/api/sap/compare", {
      method: "POST",
      body: JSON.stringify({ left_id: Number(leftId), right_id: Number(rightId), program_name: programName }),
    }),
};
