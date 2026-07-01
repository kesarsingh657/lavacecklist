// =============================================================================
// api.js  — DROP THIS IN YOUR React src/ FOLDER
// =============================================================================
//
// WHAT IS THIS?
//   This file replaces localStorage with real API calls to your Python backend.
//   Instead of: localStorage.setItem("checklists", JSON.stringify(data))
//   You do:     await api.checklists.create(data)
//
// HOW IT WORKS:
//   Every function here sends an HTTP request to your Python server.
//   The server processes it, saves to the real database, and returns data.
//
// SETUP:
//   1. Start your Python backend: python main.py
//   2. Import this file in your React components
//   3. Replace localStorage calls with api.xxx() calls
//
// AUTHENTICATION:
//   After login, we store the JWT token in localStorage.
//   Every request automatically includes it in the Authorization header.
//   The server uses this token to know who you are.
//
// =============================================================================

const BASE_URL = "http://localhost:8000/api"; // your Python server address

// =============================================================================
// CORE FETCH HELPER
// All API calls go through this function.
// It automatically adds the auth token and handles errors.
// =============================================================================

async function request(method, path, body = null) {
  // Get the token that was saved after login
  const token = localStorage.getItem("authToken");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      // Add token to every request so server knows who we are
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
  };

  // Add request body for POST/PUT/PATCH requests
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  // If token expired or invalid, log user out and redirect to login
  if (response.status === 401) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    window.location.href = "/"; // redirect to login
    throw new Error("Session expired. Please log in again.");
  }

  // For other errors, throw with the server's error message
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }

  // Return parsed JSON (or null for 204 No Content)
  if (response.status === 204) return null;
  return response.json();
}

// =============================================================================
// AUTH API
// =============================================================================
export const auth = {

  /**
   * Login with username and password.
   * Stores token and user in localStorage on success.
   *
   * Usage in React:
   *   const { user } = await auth.login("admin", "admin123");
   *   setUser(user);
   */
  async login(username, password) {
    // Login uses form data format (not JSON) - FastAPI requirement
    const response = await fetch(`${BASE_URL}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Login failed");
    }

    const data = await response.json();

    // Save token for future requests
    localStorage.setItem("authToken",    data.access_token);
    localStorage.setItem("currentUser",  JSON.stringify(data.user));
    localStorage.setItem("isLoggedIn",   "true");

    return data; // { access_token, token_type, user }
  },

  logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isLoggedIn");
  },

  async getMe() {
    return request("GET", "/users/me");
  },

  async register(userData) {
    return request("POST", "/users/register", userData);
  },

  async listUsers() {
    return request("GET", "/users/");
  },

  /**
   * Seed default users (call once on fresh install)
   * Usage: await auth.seed();
   */
  async seed() {
    const response = await fetch(`${BASE_URL}/users/seed`, { method: "POST" });
    return response.json();
  },
};

// =============================================================================
// CHECKLISTS API
// =============================================================================
export const checklists = {

  /**
   * Get all checklists with optional filters.
   *
   * Usage:
   *   const all    = await checklists.list();
   *   const daily  = await checklists.list({ frequency: "Daily" });
   *   const search = await checklists.list({ search: "quality" });
   */
  async list(filters = {}) {
    const params = new URLSearchParams();
    if (filters.department) params.set("department", filters.department);
    if (filters.status)     params.set("status",     filters.status);
    if (filters.frequency)  params.set("frequency",  filters.frequency);
    if (filters.shift)      params.set("shift",      filters.shift);
    if (filters.search)     params.set("search",     filters.search);
    const query = params.toString();
    return request("GET", `/checklists/${query ? "?" + query : ""}`);
  },

  /**
   * Get a single checklist by ID.
   * Usage: const cl = await checklists.get("CHK-12345");
   */
  async get(id) {
    return request("GET", `/checklists/${id}`);
  },

  /**
   * Create a new checklist.
   * Usage: const newCl = await checklists.create(checklistData);
   */
  async create(data) {
    // Convert React's camelCase to backend's snake_case
    return request("POST", "/checklists/", {
      id:                   data.id,
      name:                 data.name,
      department:           data.department,
      shift:                data.shift,
      frequency:            data.frequency,
      fill_type:            data.fillType,
      custom_options:       data.customOptions || [],
      rows:                 data.rows,
      cols:                 data.cols,
      table_data:           data.tableData           || {},
      horizontal_structure: data.horizontalStructure || {},
      created_by_name:      data.createdBy,
      cloned_from:          data.clonedFrom || null,
    });
  },

  /**
   * Auto-save changes to a checklist.
   * Usage: await checklists.update("CHK-123", { table_data: {...} });
   */
  async update(id, updates) {
    // Convert camelCase keys to snake_case for the backend
    const body = {};
    if (updates.tableData           !== undefined) body.table_data           = updates.tableData;
    if (updates.horizontalStructure !== undefined) body.horizontal_structure = updates.horizontalStructure;
    if (updates.name                !== undefined) body.name                 = updates.name;
    if (updates.status              !== undefined) body.status               = updates.status;
    return request("PATCH", `/checklists/${id}`, body);
  },

  async delete(id) {
    return request("DELETE", `/checklists/${id}`);
  },

  // ── Workflow actions ──────────────────────────────────────────────────────

  async finalize(id) {
    return request("POST", `/checklists/${id}/finalize`);
  },

  async submit(id, { approverName, approverEmail, remarks }) {
    return request("POST", `/checklists/${id}/submit`, {
      approverName, approverEmail, remarks
    });
  },

  async approve(id, remarks) {
    return request("POST", `/checklists/${id}/approve`, { remarks });
  },

  async reject(id, reason, remarks) {
    return request("POST", `/checklists/${id}/reject`, { reason, remarks });
  },

  async rework(id) {
    return request("POST", `/checklists/${id}/rework`);
  },

  async cancelSubmission(id) {
    return request("POST", `/checklists/${id}/cancel`);
  },

  // ── Comments ──────────────────────────────────────────────────────────────

  async getComments(checklistId) {
    return request("GET", `/checklists/${checklistId}/comments`);
  },

  async addComment(checklistId, comment) {
    return request("POST", `/checklists/${checklistId}/comments`, comment);
  },

  // ── Attachments ───────────────────────────────────────────────────────────

  async getAttachments(checklistId) {
    return request("GET", `/checklists/${checklistId}/attachments`);
  },

  async addAttachment(checklistId, attachment) {
    return request("POST", `/checklists/${checklistId}/attachments`, attachment);
  },

  async removeAttachment(checklistId, attachmentId) {
    return request("DELETE", `/checklists/${checklistId}/attachments/${attachmentId}`);
  },
};

// =============================================================================
// AUDIT LOG API
// =============================================================================
export const auditLog = {

  async list(filters = {}) {
    const params = new URLSearchParams();
    if (filters.checklist_id) params.set("checklist_id", filters.checklist_id);
    if (filters.action)       params.set("action",       filters.action);
    const query = params.toString();
    return request("GET", `/audit/${query ? "?" + query : ""}`);
  },

  // Save an audit entry to the backend
  async create(entry) {
    return request("POST", "/audit/", entry);
  },
};

// =============================================================================
// TEMPLATES API
// =============================================================================
export const templates = {

  async list() {
    return request("GET", "/templates/");
  },

  async create(template) {
    return request("POST", "/templates/", {
      id:                   template.id,
      name:                 template.name,
      description:          template.description || "",
      department:           template.department,
      shift:                template.shift,
      frequency:            template.frequency,
      fill_type:            template.fillType,
      custom_options:       template.customOptions || [],
      rows:                 template.rows,
      cols:                 template.cols,
      source_id:            template.sourceId || null,
      table_data:           template.tableData           || {},
      horizontal_structure: template.horizontalStructure || {},
    });
  },

  async delete(id) {
    return request("DELETE", `/templates/${id}`);
  },

  async incrementUsage(id) {
    return request("POST", `/templates/${id}/increment-usage`);
  },
};

// =============================================================================
// DEFAULT EXPORT - use as: import api from './api'
// Then: api.checklists.list(), api.auth.login(), etc.
// =============================================================================
const api = { auth, checklists, auditLog, templates };
export default api;
