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

  listSandboxes: () => request("/api/sandboxes"),
  createSandbox: (data) => request("/api/sandboxes", { method: "POST", body: JSON.stringify(data) }),
  deleteSandbox: (id) => request(`/api/sandboxes/${id}`, { method: "DELETE" }),

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
  listPrograms: (search, author) => {
    let url = `/api/git/programs?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (author) url += `author=${encodeURIComponent(author)}`;
    return request(url);
  },

  getActivity: (limit = 50, author) => request(`/api/activity?limit=${limit}${author ? `&author=${encodeURIComponent(author)}` : ""}`),

  listUsers: () => request("/api/users"),
  createUser: (data) => request("/api/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),

  getOverviewStats: () => request("/api/stats/overview"),
};
