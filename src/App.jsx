import React, { useState, useEffect, useRef } from "react";
import { getLS, setLS, genAuditId, now } from "./helpers";
import Header from "./Header.jsx";
import LoginPage from "./LoginPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import ChecklistPage from "./ChecklistPage.jsx";
import Toast from "./Toast.jsx";

export default function App() {
  const [user, setUser] = useState(() => getLS("isLoggedIn", false) ? getLS("currentUser", null) : null);
  const [page, setPage] = useState("dashboard");
  const [dashKey, setDashKey] = useState(0);
  const [checklistAction, setCA] = useState(null);
  const [checklists, setChecklists] = useState(() => getLS("checklists", []));
  const [bookmarks, setBookmarks] = useState(() => getLS("bookmarkedTemplates", []));
  const [notifications, setNotifs] = useState(() => getLS("notifications", []));
  const [auditLog, setAuditLog] = useState(() => getLS("auditLog", []));
  const [toast, setToast] = useState({ show: false, msg: "" });
  const toastTimer = useRef();

  useEffect(() => { setLS("checklists", checklists); }, [checklists]);
  useEffect(() => { setLS("bookmarkedTemplates", bookmarks); }, [bookmarks]);
  useEffect(() => { setLS("notifications", notifications); }, [notifications]);
  useEffect(() => { setLS("auditLog", auditLog); }, [auditLog]);

  function showToast(msg) { clearTimeout(toastTimer.current); setToast({ show: true, msg }); toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2600); }
  function addNotif(notif) { setNotifs(prev => [{ ...notif, read: false }, ...prev].slice(0, 60)); }
  function addAudit(checklistId, action, u, details, checklistName = "") {
    setAuditLog(prev => [...prev, { id: genAuditId(), checklistId, checklistName, action, userId: u.id, userName: u.name, timestamp: now(), details }].slice(-600));
  }
  function markAllRead() { setNotifs(prev => prev.map(n => ({ ...n, read: true }))); }
  function handleLogin(u) { setLS("isLoggedIn", true); setLS("currentUser", u); setUser(u); }
  function handleLogout() { localStorage.removeItem("isLoggedIn"); localStorage.removeItem("currentUser"); setUser(null); setPage("dashboard"); }
  function handleSetPage(p) { setPage(p); if (p !== "checklist") setCA(null); if (p === "dashboard") setDashKey(k => k + 1); }

  if (!user) return (<><LoginPage onLogin={handleLogin}/><Toast msg={toast.msg} show={toast.show}/></>);

  return (
    <div className="min-h-screen" style={{ background: "#F0F7F3", fontFamily: "DM Sans, sans-serif" }}>
      <Header user={user} page={page} setPage={handleSetPage}
        notifications={notifications}
        onClearNotifs={() => { setNotifs([]); localStorage.removeItem("notifications"); }}
        onMarkAllRead={markAllRead}
        onLogout={handleLogout}/>
      {page === "dashboard" && (
        <DashboardPage key={dashKey} user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit}
          showToast={showToast} setPage={handleSetPage} setChecklistAction={setCA}/>
      )}
      {page === "checklist" && (
        <ChecklistPage user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit} auditLog={auditLog}
          showToast={showToast} initialAction={checklistAction} setPage={handleSetPage}/>
      )}
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}