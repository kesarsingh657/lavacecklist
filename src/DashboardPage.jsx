import React, { useState } from "react";
import { DEPTS } from "./constants";
import { PERM, now } from "./helpers";
import { FreqPill, StatusPill } from "./StatusPill";
import ApprovalActionModal from "./ApprovalActionModal";
import PaperSizeModal from "./PaperSizeModal";

export default function DashboardPage({ user, checklists, bookmarks, setChecklists, setBookmarks, addNotif, addAudit, showToast, setPage, setChecklistAction }) {
  const [tab, setTab] = useState("all");
  const [deptTab, setDeptTab] = useState("all");
  const [search, setSearch] = useState("");
  const [pageNum, setPageNum] = useState(0);
  const [approvalModal, setApprovalModal] = useState(null);
  const [paperModal, setPaperModal] = useState(null);
  const PAGE = 10;

  const today = new Date().toDateString();
  const todayLists = checklists.filter(l => new Date(l.createdAt).toDateString() === today);
  const statPending = checklists.filter(l => l.status === "pending" || l.status === "submitted").length;
  const statApproved = checklists.filter(l => l.status === "approved").length;
  const bIds = bookmarks.map(b => b.id);

  let filtered = [...checklists].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (user.role === "operator") filtered = filtered.filter(l => l.createdBy === user.name || l.createdById === user.id);
  if (tab === "today") filtered = filtered.filter(l => new Date(l.createdAt).toDateString() === today);
  if (tab === "pending") filtered = filtered.filter(l => l.status === "pending" || l.status === "submitted");
  if (tab === "approved") filtered = filtered.filter(l => l.status === "approved");
  if (tab === "rejected") filtered = filtered.filter(l => l.status === "rejected");
  if (tab === "bookmarked") filtered = filtered.filter(l => bIds.includes(l.id));
  
  // Instant Live Search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => l.name?.toLowerCase().includes(q) || l.id?.toLowerCase().includes(q) || l.createdBy?.toLowerCase().includes(q));
  }
  if (deptTab !== "all") { 
    filtered = filtered.filter(l => l.department === deptTab); 
  }
  
  const pages = Math.ceil(filtered.length / PAGE), pg = Math.min(pageNum, Math.max(0, pages - 1));
  const slice = filtered.slice(pg * PAGE, (pg + 1) * PAGE);

  function deleteChecklist(id) {
    if (!confirm("Delete this checklist?")) return;
    const cl = checklists.find(l => l.id === id);
    setChecklists(prev => prev.filter(l => l.id !== id));
    addAudit(id, "Deleted", user, `Checklist "${cl?.name}" deleted`, cl?.name);
    showToast("Deleted");
  }

  function handleApprovalConfirm({ remarks, reason }) {
    const { cl, type } = approvalModal; const isApprove = type === "approve"; const ts = now();
    setChecklists(prev => prev.map(l => l.id === cl.id ? { ...l, status: isApprove ? "approved" : "rejected", approvedAt: isApprove ? ts : undefined, rejectedAt: isApprove ? undefined : ts, approvedBy: isApprove ? user.name : undefined, rejectedBy: isApprove ? undefined : user.name, approvalRemarks: remarks, rejectionReason: isApprove ? undefined : reason, updatedAt: ts } : l));
    addAudit(cl.id, isApprove ? "Approved" : "Rejected", user, isApprove ? `Approved. Remarks: ${remarks}` : `Rejected. Reason: ${reason}. Remarks: ${remarks}`, cl.name);
    addNotif({ msg: isApprove ? `✅ "${cl.name}" approved by ${user.name}` : `❌ "${cl.name}" rejected by ${user.name}. Reason: ${reason}`, time: ts, read: false });
    showToast(isApprove ? "✅ Approved!" : "❌ Rejected");
    setApprovalModal(null);
  }

  const TABS = [["all", "All"], ["today", "Today"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["bookmarked", "🔖 Saved"]];
  
  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs text-[#6B8A78] font-mono">{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        {(user.role === "admin" || user.role === "operator") && (
          <button onClick={() => { setPage("checklist"); setChecklistAction({ type: "create" }); }}
            className="bg-[#3D8B6E] hover:bg-[#2A6B52] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all">+ New Checklist</button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[{ label: "Total", value: checklists.length, sub: "all checklists", icon: "📋", color: "bg-blue-50" }, { label: "Today", value: todayLists.length, sub: "created today", icon: "📅", color: "bg-indigo-50" }, { label: "Pending", value: statPending, sub: "awaiting review", icon: "⏳", color: "bg-yellow-50" }, { label: "Approved", value: statApproved, sub: "approved", icon: "✅", color: "bg-green-50" }, { label: "Bookmarked", value: bookmarks.length, sub: "templates", icon: "🔖", color: "bg-orange-50" }].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-[#6B8A78] font-semibold uppercase tracking-wide">{s.label}</span><div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center text-sm`}>{s.icon}</div></div>
            <div className="text-2xl font-bold text-[#1A2E24] font-mono">{s.value}</div>
            <div className="text-[10px] text-[#6B8A78] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 flex-wrap">{TABS.map(([t, l]) => <button key={t} onClick={() => { setTab(t); setPageNum(0); }} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${tab === t ? "bg-[#3D8B6E] text-white" : "text-gray-500 hover:bg-gray-100"}`}>{l}</button>)}</div>
          <div className="flex items-center gap-2 ml-auto">
            <input value={search} onChange={e => { setSearch(e.target.value); setPageNum(0); }} placeholder="Search checklist or user..." className="pl-3 pr-3 py-1.5 rounded-lg text-xs w-48 outline-none border border-gray-200" style={{ background: "#f6faf8" }} />
          </div>
          <div className="w-full flex gap-1 flex-wrap mt-2 pb-2">
            <button onClick={() => { setDeptTab("all"); setPageNum(0); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${deptTab === "all" ? "bg-[#3D8B6E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All Departments
            </button>
            {DEPTS.map(d => (
              <button key={d} onClick={() => { setDeptTab(d); setPageNum(0); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${deptTab === d ? "bg-[#3D8B6E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {d} ({checklists.filter(x => x.department === d).length})
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#f6faf8] text-[#6B8A78] border-y border-gray-100">
              <th className="px-4 py-2.5 text-left font-semibold">Checklist</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Dept</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">By</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Schedule</th>
              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Date</th>
              <th className="px-4 py-2.5 text-center font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {slice.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6B8A78]">
                  <div className="text-2xl mb-2 opacity-30">📥</div>No matching records found.
                </td></tr>
              ) : slice.map(l => {
                const dt = new Date(l.createdAt);
                const canFill = PERM.canEdit(l, user);
                const canAR = PERM.canApproveReject(l, user);
                return (
                  <tr key={l.id} className="border-t border-gray-50 hover:bg-green-50/40 cursor-pointer" onClick={() => { setPage("checklist"); setChecklistAction({ type: canFill ? "fill" : "view", id: l.id }); }}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#1A2E24]">{l.name || "—"} {bIds.includes(l.id) && <span className="text-orange-400 text-[9px]">🔖</span>}</div>
                      <div className="text-[10px] text-[#6B8A78] font-mono">{l.id}</div>
                      {l.rejectionReason && <div className="text-[9px] text-red-500 mt-0.5 max-w-[180px] truncate">↳ {l.rejectionReason}</div>}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-[#6B8A78]">{l.department || "—"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-[#6B8A78]">{l.createdBy || "—"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell"><FreqPill freq={l.frequency} /></td>
                    <td className="px-4 py-2.5"><StatusPill status={l.status} /></td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-[10px] text-[#6B8A78] font-mono">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}<br /><span className="opacity-70">{dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {canFill && <button onClick={() => { setPage("checklist"); setChecklistAction({ type: "fill", id: l.id }); }} className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center" title="Edit">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>}
                        <button onClick={() => { setPage("checklist"); setChecklistAction({ type: "view", id: l.id }); }} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center" title="View">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        {(user.role === "admin" || user.role === "operator") && <button onClick={() => { setPage("checklist"); setChecklistAction({ type: "clone", id: l.id }); }} className="w-6 h-6 rounded-md bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white flex items-center justify-center transition-all" title="Clone">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>}
                        {canAR && <>
                          <button onClick={() => setApprovalModal({ cl: l, type: "approve" })} className="w-6 h-6 rounded-md bg-green-50 text-green-700 hover:bg-green-600 hover:text-white flex items-center justify-center transition-all" title="Approve">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={() => setApprovalModal({ cl: l, type: "reject" })} className="w-6 h-6 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Reject">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </>}
                        {/* 🖨️ Open size modal on print click */}
                        {PERM.canPrint(l) && <button onClick={() => setPaperModal({ cl: l, action: "print" })} className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white flex items-center justify-center transition-all" title="Print">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>}
                        {/* 📄 Open size modal on export click */}
                        {PERM.canExport(l) && <button onClick={() => setPaperModal({ cl: l, action: "export" })} className="w-6 h-6 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all" title="Export PDF">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </button>}
                        {PERM.canDelete(l, user) && <button onClick={() => deleteChecklist(l.id)} className="w-6 h-6 rounded-md bg-red-50 text-red-500 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Delete">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10px] text-[#6B8A78] font-mono">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {approvalModal && <ApprovalActionModal checklist={approvalModal.cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={() => setApprovalModal(null)} />}
      
      {/* 🟢 FIXED & WIRED: Paper size layout pop-up handles actions properly now */}
      {paperModal && (
        <PaperSizeModal 
          action={paperModal.action} 
          cl={paperModal.cl} 
          auditLog={checklists.filter(a => a.checklistId === paperModal.cl.id)} 
          onClose={() => setPaperModal(null)} 
        />
      )}
    </main>
  );
}