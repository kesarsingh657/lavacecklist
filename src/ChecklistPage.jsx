/**
 * ChecklistPage.jsx — MES Enhanced Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FEATURES:
 *
 * 1. BULK ACTIONS
 *    - Checkbox on each row to select multiple checklists
 *    - "Select All" checkbox in header
 *    - Bulk action toolbar appears when ≥1 selected:
 *        • Bulk Finalize (all selected drafts → finalized)
 *        • Bulk Delete   (admin only)
 *        • Clear selection
 *    - Uses bulkFinalize / bulkDelete from helpers.js
 *
 * 2. OVERDUE BADGE
 *    - Daily checklists with missing today entry show a red "Overdue" badge
 *    - Uses isOverdueToday() from helpers.js
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from "react";
import { STATUS, DEPTS, SHIFTS, FREQS } from "./constants";
import { PERM, now, isOverdueToday, bulkFinalize, bulkDelete } from "./helpers";
import { FreqPill, StatusPill } from "./StatusPill";
import ChecklistEditor from "./ChecklistEditor";
import CreateModal from "./CreateModal";
import CloneModal from "./CloneModal";
import PaperSizeModal from "./PaperSizeModal";
import api from "./api"; // ← talks to Python backend

export default function ChecklistPage({
  user, checklists, bookmarks, setChecklists, setBookmarks,
  addNotif, addAudit, auditLog, showToast, initialAction, setPage,
  // NEW: templates props passed through from App
  templates, setTemplates,
}) {
  const [view,        setView]        = useState("landing");
  const [activeCl,    setActiveCl]    = useState(null);
  const [isViewMode,  setIsViewMode]  = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [prefill,     setPrefill]     = useState(null);
  const [cloneTarget, setCloneTarget] = useState(null);
  const [paperModal,   setPaperModal]   = useState(null);
  const [tab,         setTab]         = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search,      setSearch]      = useState("");
  const [freqFilter,  setFreqFilter]  = useState("");
  const [deptFilter,  setDeptFilter]  = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [statusFilter,setStatusFilter]= useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [sortBy,      setSortBy]      = useState("newest");

  // BULK ACTIONS: track selected checklist IDs
  const [selected, setSelected] = useState(new Set());

  const bIds = bookmarks.map(b => b.id);

  useEffect(() => {
    if (!initialAction) return;
    if (initialAction.type === "create")    setShowCreate(true);
    else if (initialAction.type === "fill"  && initialAction.id) openChecklist(initialAction.id, false);
    else if (initialAction.type === "view"  && initialAction.id) openChecklist(initialAction.id, true);
    else if (initialAction.type === "clone" && initialAction.id) {
      const cl = checklists.find(l => l.id === initialAction.id);
      if (cl) setCloneTarget(cl);
    }
    else if (initialAction.type === "template" && initialAction.id) {
      // Use template: find it in templates array and open CloneModal
      const tpl = templates?.find(t => t.id === initialAction.id);
      if (tpl) setCloneTarget(tpl);
    }
    else if (initialAction.type === "bookmarks") setTab("bookmarks");
  }, [initialAction]);

  function openChecklist(id, viewOnly) {
    const cl = checklists.find(l => l.id === id);
    if (!cl) return;
    setActiveCl({ ...cl }); setIsViewMode(viewOnly); setView("editor");
  }

  function deleteChecklist(id) {
    if (!confirm("Delete?")) return;
    const cl = checklists.find(l => l.id === id);
    setChecklists(prev => prev.filter(l => l.id !== id));
    addAudit(id, "Deleted", user, `"${cl?.name}" deleted`, cl?.name);
    showToast("Deleted");
  }

  // ── BULK: toggle a single row ─────────────────────────────────────────────
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── BULK: select / deselect all visible ──────────────────────────────────
  function toggleSelectAll(ids) {
    setSelected(prev => {
      if (ids.every(id => prev.has(id))) {
        // All already selected → deselect all
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      }
      // Select all
      return new Set([...prev, ...ids]);
    });
  }

  // ── BULK FINALIZE ─────────────────────────────────────────────────────────
  function handleBulkFinalize() {
    if (!selected.size) return;
    const ids = [...selected];
    setChecklists(prev => bulkFinalize(ids, prev, user));
    ids.forEach(id => {
      const cl = checklists.find(l => l.id === id);
      if (cl?.status === "draft") addAudit(id, "Finalized", user, `"${cl.name}" bulk finalized`, cl.name);
    });
    showToast(`✅ ${ids.length} checklist(s) finalized`);
    setSelected(new Set());
  }

  // ── BULK DELETE ───────────────────────────────────────────────────────────
  function handleBulkDelete() {
    if (!selected.size || user.role !== "admin") return;
    if (!confirm(`Delete ${selected.size} checklist(s)?`)) return;
    const ids = [...selected];
    setChecklists(prev => bulkDelete(ids, prev, user));
    ids.forEach(id => {
      const cl = checklists.find(l => l.id === id);
      addAudit(id, "Deleted", user, `"${cl?.name}" bulk deleted`, cl?.name);
    });
    showToast(`🗑 ${ids.length} checklist(s) deleted`);
    setSelected(new Set());
  }

  // ── Filter pipeline ───────────────────────────────────────────────────────
  let filtered = [...checklists];
  if (user.role === "operator") filtered = filtered.filter(l => l.createdBy === user.name || l.createdById === user.id);
  if (tab === "bookmarks")      filtered = filtered.filter(l => bIds.includes(l.id));
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => l.name?.toLowerCase().includes(q) || l.id?.toLowerCase().includes(q) || l.createdBy?.toLowerCase().includes(q) || l.department?.toLowerCase().includes(q));
  }
  if (freqFilter)   filtered = filtered.filter(l => l.frequency  === freqFilter);
  if (deptFilter)   filtered = filtered.filter(l => l.department === deptFilter);
  if (shiftFilter)  filtered = filtered.filter(l => l.shift      === shiftFilter);
  if (statusFilter) filtered = filtered.filter(l => l.status     === statusFilter);
  if (dateFrom)     filtered = filtered.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo)       filtered = filtered.filter(l => new Date(l.createdAt) <= new Date(dateTo + "T23:59:59"));

  filtered.sort((a, b) => {
    if (sortBy==="newest")  return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy==="oldest")  return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy==="name-az") return (a.name||"").localeCompare(b.name||"");
    if (sortBy==="name-za") return (b.name||"").localeCompare(a.name||"");
    if (sortBy==="status")  return (a.status||"").localeCompare(b.status||"");
    if (sortBy==="dept")    return (a.department||"").localeCompare(b.department||"");
    return 0;
  });

  const activeFilterCount = [freqFilter,deptFilter,shiftFilter,statusFilter,dateFrom,dateTo].filter(Boolean).length;
  const visibleIds        = filtered.map(l => l.id);
  const allSelected       = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  function clearFilters() {
    setFreqFilter(""); setDeptFilter(""); setShiftFilter("");
    setStatusFilter(""); setDateFrom(""); setDateTo(""); setSortBy("newest");
  }

  // ── Editor view ───────────────────────────────────────────────────────────
  if (view === "editor" && activeCl) {
    return (
      <ChecklistEditor
        cl={activeCl}
        viewMode={isViewMode}
        user={user}
        auditLog={auditLog}
        onSaveClose={() => setView("landing")}
        showToast={showToast}
        addNotif={addNotif}
        addAudit={addAudit}
        bookmarks={bookmarks}
        setBookmarks={setBookmarks}
        setChecklists={setChecklists}
        templates={templates}
        setTemplates={setTemplates}
        onBack={() => { setPrefill(activeCl); setShowCreate(true); setView("landing"); }}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#1A2E24]">
          Checklists
          <span className="ml-2 text-[10px] text-[#6B8A78] font-normal font-mono">{filtered.length} records</span>
        </h2>
      </div>

      {/* ── BULK ACTION TOOLBAR — appears when ≥1 selected ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-[12px] font-bold text-blue-700">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {/* Bulk Finalize — only for operator/admin */}
            {(user.role === "admin" || user.role === "operator") && (
              <button onClick={handleBulkFinalize} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all">
                🔒 Finalize Selected
              </button>
            )}
            {/* Bulk Delete — admin only */}
            {user.role === "admin" && (
              <button onClick={handleBulkDelete} className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-all">
                🗑 Delete Selected
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Tabs + Search + Filters row */}
      <div className="flex flex-wrap gap-1.5 mb-2 items-center">
        {[["all","All"],["bookmarks","Bookmarks"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${tab===t?"bg-[#3D8B6E] text-white":"bg-white border border-gray-200 text-gray-500 hover:border-[#3D8B6E]"}`}>{l}</button>
        ))}
        <div className="flex-1"/>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none w-40 focus:border-[#3D8B6E]"/>
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
          <option value="newest">Newest</option><option value="oldest">Oldest</option>
          <option value="name-az">A→Z</option><option value="name-za">Z→A</option>
          <option value="status">Status</option><option value="dept">Dept</option>
        </select>
        <button onClick={()=>setShowFilters(f=>!f)} className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${activeFilterCount>0?"border-[#3D8B6E] bg-[#e8f5ee] text-[#3D8B6E]":"border-gray-200 bg-white text-gray-500 hover:border-[#3D8B6E]"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters {activeFilterCount>0&&<span className="bg-[#3D8B6E] text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              [freqFilter,setFreqFilter,"Schedule",FREQS],
              [deptFilter,setDeptFilter,"Department",DEPTS],
              [shiftFilter,setShiftFilter,"Shift",SHIFTS],
            ].map(([val,set,label,opts])=>(
              <div key={label}>
                <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">{label}</label>
                <select value={val} onChange={e=>set(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                  <option value="">All</option>{opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Status</label>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>
                {Object.entries(STATUS).map(([k,v])=><option key={v} value={v}>{k.charAt(0)+k.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          {activeFilterCount>0&&<button onClick={clearFilters} className="mt-2 text-[10px] text-red-500 hover:underline">Clear all filters</button>}
        </div>
      )}

      {/* ── CHECKLIST LIST ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Select-all header row */}
        {filtered.length > 0 && (user.role === "admin" || user.role === "operator") && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => toggleSelectAll(visibleIds)}
              className="w-3.5 h-3.5 accent-[#3D8B6E] cursor-pointer"
            />
            <span className="text-[10px] text-[#6B8A78] font-semibold">Select All</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-12">
            <div className="text-3xl mb-2 opacity-30">📥</div>
            {tab==="bookmarks" ? "No bookmarks yet." : "No checklists found."}
          </div>
        ) : filtered.map(cl => {
          const isBookmarked = bIds.includes(cl.id);
          const canFill      = PERM.canEdit(cl, user);
          const overdue      = isOverdueToday(cl); // OVERDUE DETECTION
          const isSelected   = selected.has(cl.id);
          const dt           = new Date(cl.createdAt);

          return (
            <div
              key={cl.id}
              onClick={() => openChecklist(cl.id, !canFill)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-green-50/50 cursor-pointer border-l-4 ${
                overdue ? "border-l-red-500 bg-red-50/30" :
                cl.frequency==="Daily"   ? "border-l-blue-400"   :
                cl.frequency==="Weekly"  ? "border-l-purple-400" :
                cl.frequency==="Monthly" ? "border-l-yellow-400" : "border-l-transparent"
              } ${isSelected ? "bg-blue-50/40" : ""}`}
            >
              {/* Bulk select checkbox */}
              {(user.role === "admin" || user.role === "operator") && (
                <div onClick={e => { e.stopPropagation(); toggleSelect(cl.id); }}>
                  <input type="checkbox" checked={isSelected} onChange={()=>{}} className="w-3.5 h-3.5 accent-[#3D8B6E] cursor-pointer"/>
                </div>
              )}

              <div className="w-9 h-9 rounded-xl bg-[#e8f5ee] flex items-center justify-center flex-shrink-0 text-sm">📋</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1A2E24] truncate">{cl.name}</span>
                  <FreqPill freq={cl.frequency}/>
                  <StatusPill status={cl.status}/>
                  {/* OVERDUE BADGE */}
                  {overdue && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">⚠ Overdue</span>
                  )}
                  {/* Rework count badge */}
                  {cl.reworkCount > 0 && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🔄 Rework #{cl.reworkCount}</span>
                  )}
                  {isBookmarked && <span className="text-orange-400 text-xs">🔖</span>}
                  {/* Comment count badge */}
                  {cl.comments?.length > 0 && (
                    <span className="text-[8px] text-[#6B8A78] font-mono">💬 {cl.comments.length}</span>
                  )}
                  {/* Attachment count badge */}
                  {cl.attachments?.length > 0 && (
                    <span className="text-[8px] text-[#6B8A78] font-mono">📎 {cl.attachments.length}</span>
                  )}
                </div>
                <div className="text-[10px] text-[#6B8A78] font-mono mt-0.5">
                  {cl.id} · {cl.department} · {cl.shift} · {cl.createdBy}
                </div>
                {cl.rejectionReason && (
                  <div className="text-[9px] text-red-500 mt-0.5">↳ Rejected: {cl.rejectionReason}</div>
                )}
              </div>

              <div className="text-[10px] text-[#6B8A78] font-mono text-right hidden sm:block flex-shrink-0">
                {dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                <br/>{dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
              </div>

              {/* Row action buttons — always visible, context-aware */}
              <div className="flex gap-1 flex-shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
                {/* EDIT — draft only */}
                {canFill && (
                  <button onClick={() => openChecklist(cl.id, false)}
                    className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white text-[10px] font-semibold transition-all">
                    ✏️ Edit
                  </button>
                )}
                {/* FINALIZE — draft only */}
                {cl.status === "draft" && PERM.canFinalize(cl, user) && (
                  <button onClick={async () => {
                    const ts = now();
                    setChecklists(prev => prev.map(l => l.id === cl.id ? { ...l, status: "finalized", finalizedAt: ts, updatedAt: ts } : l));
                    addAudit(cl.id, "Finalized", user, `"${cl.name}" finalized`, cl.name);
                    showToast("🔒 Finalized");
                    try { await api.checklists.finalize(cl.id); }
                    catch(err) { console.warn("Backend finalize failed:", err); }
                  }} className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white text-[10px] font-semibold transition-all">
                    🔒 Finalize
                  </button>
                )}
                {/* SUBMIT — finalized only */}
                {cl.status === "finalized" && PERM.canSubmit(cl, user) && (
                  <button onClick={async () => {
                    const ts = now();
                    setChecklists(prev => prev.map(l => l.id === cl.id ? { ...l, status: "submitted", submittedAt: ts, updatedAt: ts } : l));
                    addAudit(cl.id, "Submitted", user, `"${cl.name}" submitted for approval`, cl.name);
                    addNotif({ msg: `📤 "${cl.name}" submitted by ${user.name}`, time: ts, read: false });
                    showToast("📤 Submitted!");
                    try { await api.checklists.submit(cl.id, { approverName: cl.approverName || "", approverEmail: cl.approverEmail || "", remarks: "" }); }
                    catch(err) { console.warn("Backend submit failed:", err); }
                  }} className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-semibold transition-all">
                    📤 Submit
                  </button>
                )}
                {/* VIEW — always */}
                <button onClick={() => openChecklist(cl.id, true)}
                  className="px-2 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-200 text-[10px] font-semibold transition-all">
                  👁 View
                </button>
                {/* PRINT */}
                {PERM.canPrint(cl) && (
                  <button onClick={() => setPaperModal({ cl, action: "print" })}
                    className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white text-[10px] font-semibold transition-all">
                    🖨 Print
                  </button>
                )}
                {/* CLONE */}
                {(user.role === "admin" || user.role === "operator") && (
                  <button onClick={() => setCloneTarget(cl)}
                    className="px-2 py-1 rounded-lg bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white text-[10px] font-semibold transition-all">
                    ⎘ Clone
                  </button>
                )}
                {/* DELETE — admin only */}
                {user.role === "admin" && (
                  <button onClick={async () => {
                    if (!confirm("Delete this checklist?")) return;
                    const c = checklists.find(l => l.id === cl.id);
                    setChecklists(p => p.filter(l => l.id !== cl.id));
                    addAudit(cl.id, "Deleted", user, `"${c?.name}" deleted`, c?.name);
                    showToast("Deleted");
                    try { await api.checklists.delete(cl.id); }
                    catch(err) { console.warn("Backend delete failed:", err); }
                  }} className="px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white text-[10px] font-semibold transition-all">
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      {(user.role==="admin"||user.role==="operator") && (
        <button onClick={()=>{setPrefill(null);setShowCreate(true);}} className="fab-btn fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#3D8B6E] text-white shadow-xl flex items-center justify-center text-xl hover:bg-[#2A6B52] hover:scale-105 transition-all z-40">+</button>
      )}

      {showCreate && (
        <CreateModal user={user} prefill={prefill} onClose={()=>setShowCreate(false)}
          onCreate={async cl => {
            // 1. Update UI immediately (optimistic — feels instant)
            setChecklists(prev => { const ex=prev.find(x=>x.id===cl.id); if(ex) return prev.map(x=>x.id===cl.id?cl:x); return [...prev,cl]; });
            addAudit(cl.id,"Created",user,`"${cl.name}" created`,cl.name);
            addNotif({msg:`📝 "${cl.name}" created by ${user.name}`,time:now(),read:false});
            // 2. Save to backend database in background
            try { await api.checklists.create(cl); }
            catch(err) { console.warn("Backend sync failed (create):", err); }
            setShowCreate(false); showToast("Checklist created!");
            setActiveCl(cl); setIsViewMode(false); setView("editor");
          }}
        />
      )}

      {cloneTarget && (
        <CloneModal source={cloneTarget} user={user} onClose={()=>setCloneTarget(null)}
          onCreate={async cl => {
            setChecklists(prev=>[...prev,cl]);
            addAudit(cl.id,"Cloned",user,`Cloned from "${cloneTarget.name}"`,cl.name);
            addNotif({msg:`⎘ "${cl.name}" cloned by ${user.name}`,time:now(),read:false});
            // Save clone to backend
            try { await api.checklists.create(cl); }
            catch(err) { console.warn("Backend sync failed (clone):", err); }
            setCloneTarget(null); showToast("⎘ Cloned!");
            setActiveCl(cl); setIsViewMode(false); setView("editor");
          }}
        />
      )}
      {paperModal && (
        <PaperSizeModal action={paperModal.action} cl={paperModal.cl} auditLog={auditLog||[]} onClose={() => setPaperModal(null)} />
      )}
    </main>
  );
}