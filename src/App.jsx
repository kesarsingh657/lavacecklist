/**
 * App.jsx — Backend Connected Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM LOCALSTORAGE VERSION:
 *
 * 1. Checklists → loaded from Python backend on login (api.checklists.list())
 * 2. Templates  → loaded from Python backend on login (api.templates.list())
 * 3. Audit log  → loaded from Python backend on login (api.auditLog.list())
 * 4. Login      → handled by LoginPage using api.auth.login() — token stored
 * 5. Logout     → clears token from localStorage via api.auth.logout()
 *
 * STILL USING LOCALSTORAGE (for now — simple, low priority):
 * - Bookmarks (user preference, not critical data)
 * - Notifications (ephemeral, per-session)
 *
 * HOW DATA FLOWS:
 * Login → fetch all data from backend → store in React state
 * Any change (create/update/delete) → React state updated immediately (optimistic)
 *   AND the same change is sent to backend in background
 * This means the UI stays fast and the database stays in sync.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useRef } from "react";
import { getLS, setLS, genAuditId, now } from "./helpers";
import api from "./api"; // ← NEW: our Python backend API service
import Header from "./Header.jsx";
import LoginPage from "./LoginPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import ChecklistPage from "./ChecklistPage.jsx";
import AuditPage from "./AuditPage.jsx";
import TemplatesPage from "./TemplatesPage.jsx";
import Toast from "./Toast.jsx";

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────
  // User object comes from the backend on login (contains id, name, role)
  const [user, setUser] = useState(() =>
    getLS("isLoggedIn", false) ? getLS("currentUser", null) : null
  );

  // ── Navigation ────────────────────────────────────────────────────────
  const [page, setPage]             = useState("dashboard");
  const [dashKey, setDashKey]       = useState(0);
  const [checklistAction, setCA]    = useState(null);

  // ── App data ─────────────────────────────────────────────────────────
  // Checklists now come from backend, not localStorage
  const [checklists,    setChecklists]   = useState([]);
  const [templates,     setTemplates]    = useState([]);
  const [auditLog,      setAuditLog]     = useState([]);
  // Bookmarks and notifications stay in localStorage (user prefs, not business data)
  const [bookmarks,     setBookmarks]    = useState(() => getLS("bookmarkedTemplates", []));
  const [notifications, setNotifs]       = useState(() => getLS("notifications", []));

  const [loading,  setLoading]  = useState(false); // shows loading while fetching data
  const [toast,    setToast]    = useState({ show: false, msg: "" });
  const toastTimer = useRef();

  // ── Persist bookmarks and notifications to localStorage ──────────────
  useEffect(() => { setLS("bookmarkedTemplates", bookmarks);   }, [bookmarks]);
  useEffect(() => { setLS("notifications",       notifications);}, [notifications]);

  // ── Load all data from backend when user logs in ─────────────────────
  useEffect(() => {
    if (!user) return; // not logged in, nothing to load

    async function loadData() {
      setLoading(true);
      try {
        // Fetch all three data sources in parallel (faster than sequential)
        const [cls, tpls, logs] = await Promise.all([
          api.checklists.list(),   // GET /api/checklists/
          api.templates.list(),    // GET /api/templates/
          api.auditLog.list(),     // GET /api/audit/
        ]);

        // Convert backend snake_case to frontend camelCase
        setChecklists(cls.map(backendToFrontend));
        setTemplates(tpls.map(tplBackendToFrontend));
        setAuditLog(logs.map(auditBackendToFrontend));

      } catch (err) {
        console.error("Failed to load data:", err);
        showToast("Failed to load data from server");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]); // re-runs whenever user changes (login/logout)

  // ── CONVERTERS: backend snake_case → frontend camelCase ─────────────
  // Backend uses: fill_type, table_data, created_by_name etc.
  // Frontend uses: fillType, tableData, createdBy etc.
  function backendToFrontend(cl) {
    return {
      id:                   cl.id,
      name:                 cl.name,
      department:           cl.department,
      shift:                cl.shift,
      frequency:            cl.frequency,
      fillType:             cl.fill_type,
      customOptions:        cl.custom_options || [],
      status:               cl.status,
      rows:                 cl.rows,
      cols:                 cl.cols,
      tableData:            cl.table_data            || {},
      horizontalStructure:  cl.horizontal_structure  || {},
      approverName:         cl.approver_name,
      approverEmail:        cl.approver_email,
      approvalRequired:     cl.approval_required,
      submissionRemarks:    cl.submission_remarks,
      rejectionReason:      cl.rejection_reason,
      approvalRemarks:      cl.approval_remarks,
      approvedBy:           cl.approved_by,
      rejectedBy:           cl.rejected_by,
      reworkCount:          cl.rework_count || 0,
      createdBy:            cl.created_by_name,
      createdById:          cl.created_by_id,
      clonedFrom:           cl.cloned_from,
      createdAt:            cl.created_at,
      updatedAt:            cl.updated_at,
      finalizedAt:          cl.finalized_at,
      submittedAt:          cl.submitted_at,
      approvedAt:           cl.approved_at,
      rejectedAt:           cl.rejected_at,
      reworkAt:             cl.rework_at,
      comments:             [],
      attachments:          [],
    };
  }

  function tplBackendToFrontend(t) {
    return {
      id:                   t.id,
      name:                 t.name,
      description:          t.description,
      department:           t.department,
      shift:                t.shift,
      frequency:            t.frequency,
      fillType:             t.fill_type,
      customOptions:        t.custom_options || [],
      rows:                 t.rows,
      cols:                 t.cols,
      sourceId:             t.source_id,
      tableData:            t.table_data           || {},
      horizontalStructure:  t.horizontal_structure || {},
      usageCount:           t.usage_count || 0,
      createdBy:            t.created_by,
      createdAt:            t.created_at,
    };
  }

  function auditBackendToFrontend(a) {
    return {
      id:             a.id,
      checklistId:    a.checklist_id,
      checklistName:  a.checklist_name,
      action:         a.action,
      userId:         a.user_id,
      userName:       a.user_name,
      details:        a.details,
      timestamp:      a.timestamp,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast({ show: true, msg });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2600);
  }

  function addNotif(notif) {
    setNotifs(prev => [{ ...notif, read: false }, ...prev].slice(0, 60));
  }

  // Audit: write to backend AND update local state immediately
  async function addAudit(checklistId, action, u, details, checklistName = "") {
    const entry = {
      id:             genAuditId(),
      checklistId,
      checklistName,
      action,
      userId:         u.id,
      userName:       u.name,
      details,
      timestamp:      now(),
    };
    // Update local state immediately (optimistic)
    setAuditLog(prev => [...prev, entry].slice(-600));
    // Also save to backend in background
    try {
      await api.auditLog.create({
        id:             entry.id,
        checklist_id:   checklistId,
        checklist_name: checklistName,
        action,
        user_id:        u.id,
        user_name:      u.name,
        details,
      });
    } catch (err) {
      console.warn("Audit log backend sync failed:", err);
    }
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleLogin(u) {
    // u comes from api.auth.login() response — has id, name, role from database
    setLS("isLoggedIn", true);
    setLS("currentUser", u);
    setUser(u);
  }

  function handleLogout() {
    api.auth.logout(); // clears token from localStorage
    setUser(null);
    setPage("dashboard");
    // Clear data from state on logout (security)
    setChecklists([]);
    setTemplates([]);
    setAuditLog([]);
  }

  function handleSetPage(p) {
    setPage(p);
    if (p !== "checklist") setCA(null);
    if (p === "dashboard") setDashKey(k => k + 1);
  }

  // ── Loading screen ────────────────────────────────────────────────────
  if (!user) return (
    <>
      <LoginPage onLogin={handleLogin}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F0F7F3" }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#3D8B6E] text-white flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
        <p className="text-[#3D8B6E] font-semibold text-sm">Loading your data…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F0F7F3", fontFamily: "DM Sans, sans-serif" }}>
      <Header
        user={user} page={page} setPage={handleSetPage}
        notifications={notifications}
        onClearNotifs={() => { setNotifs([]); localStorage.removeItem("notifications"); }}
        onMarkAllRead={markAllRead}
        onLogout={handleLogout}
      />

      {page === "dashboard" && (
        <DashboardPage key={dashKey}
          user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit} showToast={showToast}
          setPage={handleSetPage} setChecklistAction={setCA}
        />
      )}

      {page === "checklist" && (
        <ChecklistPage
          user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit} auditLog={auditLog}
          showToast={showToast} initialAction={checklistAction} setPage={handleSetPage}
          templates={templates} setTemplates={setTemplates}
        />
      )}

      {page === "audit" && (
        <AuditPage auditLog={auditLog} checklists={checklists} user={user}/>
      )}

      {page === "templates" && (
        <TemplatesPage
          user={user} templates={templates} setTemplates={setTemplates}
          checklists={checklists} setChecklists={setChecklists}
          showToast={showToast} setPage={handleSetPage} setChecklistAction={setCA}
        />
      )}

      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}