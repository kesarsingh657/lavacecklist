import React, { useState, useMemo } from "react";
import { DEPTS } from "./constants";
import { PERM, now } from "./helpers";
import ApprovalActionModal from "./ApprovalActionModal";
import PaperSizeModal from "./PaperSizeModal";

const currentShift = () => {
  const h = new Date().getHours();
  if (h >= 6  && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Afternoon";
  return "Night";
};

const FREQ_META = {
  "Daily":    { dot: "#3b82f6" },
  "Weekly":   { dot: "#8b5cf6" },
  "Monthly":  { dot: "#f59e0b" },
  "One Time": { dot: "#9ca3af" },
};
const DEPT_ICON = { Production:"🏭", Quality:"🔬", Warehouse:"📦", Maintenance:"🔧" };
const STATUS_DOT = { draft:"#9ca3af", finalized:"#f59e0b", submitted:"#3b82f6", pending:"#eab308", approved:"#22c55e", rejected:"#ef4444" };

const Ic = {
  folder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  list:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  today:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  star:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  clock:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chevR:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  search: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  sort:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>,
};

function MiniStatus({ status }) {
  const dot = STATUS_DOT[status] || "#9ca3af";
  const labels = { draft:"Draft", finalized:"Finalized", submitted:"Submitted", pending:"Pending", approved:"Approved", rejected:"Rejected" };
  const bgs = { draft:"bg-gray-100 text-gray-500", finalized:"bg-amber-50 text-amber-700", submitted:"bg-blue-50 text-blue-700", pending:"bg-yellow-50 text-yellow-800", approved:"bg-green-50 text-green-700", rejected:"bg-red-50 text-red-600" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${bgs[status]||bgs.draft}`}>
      <span style={{width:5,height:5,borderRadius:"50%",background:dot,display:"inline-block",flexShrink:0}}/>
      {labels[status]||status}
    </span>
  );
}

function TreeFolder({ label, icon, isOpen, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-semibold text-[#1A2E24] hover:bg-[#e8f5ee] transition-all select-none">
      <span className="text-[#3D8B6E]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className={`text-gray-400 transition-transform duration-200 ${isOpen?"rotate-90":""}`}>{Ic.chevR}</span>
    </button>
  );
}

function TreeLeaf({ label, dot, count, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-lg text-[12px] transition-all select-none ${isActive?"bg-[#3D8B6E] text-white font-semibold":"text-[#4B6B5A] hover:bg-[#e8f5ee] font-medium"}`}>
      {dot && <span style={{width:6,height:6,borderRadius:"50%",background:isActive?"white":dot,flexShrink:0,display:"inline-block"}}/>}
      <span className="flex-1 text-left truncate">{label}</span>
      {count!==undefined && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive?"bg-white/25 text-white":"bg-gray-100 text-gray-500"}`}>{count}</span>}
    </button>
  );
}

function TreeTop({ label, icon, count, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-medium transition-all select-none ${isActive?"bg-[#3D8B6E] text-white":"text-[#1A2E24] hover:bg-[#e8f5ee]"}`}>
      <span className={isActive?"text-white":"text-[#3D8B6E]"}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count!==undefined && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive?"bg-white/25 text-white":"bg-gray-100 text-gray-500"}`}>{count}</span>}
    </button>
  );
}

export default function DashboardPage({ user, checklists, bookmarks, setChecklists, setBookmarks, addNotif, addAudit, showToast, setPage, setChecklistAction }) {
  const [approvalModal, setApprovalModal] = useState(null);
  const [paperModal, setPaperModal]       = useState(null);
  const [selected, setSelected]           = useState("welcome"); // ← starts on welcome
  const [openFolders, setOpenFolders]     = useState({ freq:true, dept:false, status:false });
  const [listSearch, setListSearch]       = useState("");
  const [sortBy, setSortBy]               = useState("newest");

  const bIds  = bookmarks.map(b => b.id);
  const today = new Date().toDateString();
  const shift = currentShift();

  const myLists   = user.role==="operator" ? checklists.filter(l=>l.createdById===user.id||l.createdBy===user.name) : checklists;
  const byFreq    = f => myLists.filter(l=>l.frequency===f);
  const byDept    = d => myLists.filter(l=>l.department===d);
  const byStatus  = s => myLists.filter(l=>l.status===s);
  const pendingAR = checklists.filter(l=>PERM.canApproveReject(l,user));

  const stats = useMemo(()=>({
    total:    myLists.length,
    today:    myLists.filter(l=>new Date(l.createdAt).toDateString()===today).length,
    pending:  myLists.filter(l=>["pending","submitted"].includes(l.status)).length,
    approved: myLists.filter(l=>l.status==="approved").length,
    rejected: myLists.filter(l=>l.status==="rejected").length,
    draft:    myLists.filter(l=>l.status==="draft").length,
  }),[myLists]);

  // apply sort
  const applySort = (list) => {
    const sorted = [...list];
    if (sortBy==="newest")  sorted.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if (sortBy==="oldest")  sorted.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    if (sortBy==="az")      sorted.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    if (sortBy==="za")      sorted.sort((a,b)=>(b.name||"").localeCompare(a.name||""));
    return sorted;
  };

  const displayList = useMemo(()=>{
    let list = myLists;
    if (selected==="bookmarks")             list = myLists.filter(l=>bIds.includes(l.id));
    else if (selected==="pending-approval") list = pendingAR;
    else if (selected==="today")            list = myLists.filter(l=>new Date(l.createdAt).toDateString()===today);
    else if (selected.startsWith("freq:"))  list = byFreq(selected.replace("freq:",""));
    else if (selected.startsWith("dept:"))  list = byDept(selected.replace("dept:",""));
    else if (selected.startsWith("status:"))list = byStatus(selected.replace("status:",""));
    if (listSearch) { const q=listSearch.toLowerCase(); list=list.filter(l=>l.name?.toLowerCase().includes(q)||l.id?.toLowerCase().includes(q)||l.department?.toLowerCase().includes(q)); }
    return applySort(list);
  },[selected,myLists,bIds,listSearch,sortBy]);

  const toggle = k => setOpenFolders(p=>({...p,[k]:!p[k]}));

  function handleApprovalConfirm({ remarks, reason }) {
    const { cl, type } = approvalModal; const isApprove=type==="approve"; const ts=now();
    setChecklists(prev=>prev.map(l=>l.id===cl.id?{...l,status:isApprove?"approved":"rejected",approvedAt:isApprove?ts:undefined,rejectedAt:isApprove?undefined:ts,approvedBy:isApprove?user.name:undefined,rejectedBy:isApprove?undefined:user.name,approvalRemarks:remarks,rejectionReason:isApprove?undefined:reason,updatedAt:ts}:l));
    addAudit(cl.id,isApprove?"Approved":"Rejected",user,isApprove?`Approved. Remarks: ${remarks}`:`Rejected. Reason: ${reason}`,cl.name);
    addNotif({msg:isApprove?`✅ "${cl.name}" approved`:`❌ "${cl.name}" rejected`,time:ts,read:false});
    showToast(isApprove?"✅ Approved!":"❌ Rejected"); setApprovalModal(null);
  }

  // ── List row ──────────────────────────────────────────────────────────────
  function ListRow({ l }) {
    const canFill = PERM.canEdit(l, user);
    const canAR   = PERM.canApproveReject(l, user);
    const dot     = FREQ_META[l.frequency]?.dot || "#9ca3af";
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-[#f6faf8] transition-all">
        <span style={{width:8,height:8,borderRadius:"50%",background:dot,flexShrink:0}}/>

        {/* Name + meta — clickable to open */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>{setPage("checklist");setChecklistAction({type:canFill?"fill":"view",id:l.id});}}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#1A2E24] truncate max-w-[240px]">{l.name}</span>
            <MiniStatus status={l.status}/>
            {bIds.includes(l.id) && <span className="text-orange-400 text-xs">★</span>}
          </div>
          <div className="text-[11px] text-[#6B8A78] font-mono mt-0.5">{l.id} · {l.department} · {l.createdBy}</div>
        </div>

        {/* Always-visible action buttons */}
        <div className="flex gap-1 flex-shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
          {/* Open / Edit */}
          <button
            onClick={() => { setPage("checklist"); setChecklistAction({ type: canFill ? "fill" : "view", id: l.id }); }}
            className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold transition-all">
            {canFill ? "✏️ Edit" : "👁 View"}
          </button>
          {/* Clone */}
          {(user.role === "admin" || user.role === "operator") && (
            <button
              onClick={() => { setPage("checklist"); setChecklistAction({ type: "clone", id: l.id }); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white font-semibold transition-all">
              ⎘ Clone
            </button>
          )}
          {/* Approve / Reject */}
          {canAR && <>
            <button onClick={() => setApprovalModal({cl:l,type:"approve"})} className="text-[10px] px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white font-semibold transition-all">✓ Approve</button>
            <button onClick={() => setApprovalModal({cl:l,type:"reject"})}  className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-semibold transition-all">✕ Reject</button>
          </>}
          {/* Print */}
          {PERM.canPrint(l) && (
            <button onClick={() => setPaperModal({cl:l,action:"print"})} className="text-[10px] px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white font-semibold transition-all">🖨 Print</button>
          )}
        </div>

        {/* Date/time */}
        <div className="text-[11px] text-gray-400 font-mono flex-shrink-0 hidden sm:block text-right">
          <div>{new Date(l.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</div>
          <div>{new Date(l.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>
    );
  }

  // ── Welcome screen ────────────────────────────────────────────────────────
  function WelcomePanel() {
    return (
      <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
        <span className="text-[13px] font-semibold text-[#1A2E24]">
          Welcome, <span className="text-[#3D8B6E]">{user.name}</span> — Dashboard
        </span>
        <span className="text-[12px] font-mono text-[#6B8A78]">
          {new Date().toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"})} · {new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
        </span>
      </div>
    );
  }

  // ── List panel ────────────────────────────────────────────────────────────
  function ListPanel() {
    const labelMap={bookmarks:"Bookmarks",today:"Created Today","pending-approval":"Pending Approval",all:"All Checklists"};
    const label = labelMap[selected]
      ||(selected.startsWith("freq:")?`${selected.replace("freq:","")} Checklists`:"")
      ||(selected.startsWith("dept:")?`${selected.replace("dept:","")} Department`:"")
      ||(selected.startsWith("status:")?`${selected.replace("status:","").charAt(0).toUpperCase()+selected.replace("status:","").slice(1)} Checklists`:"All Checklists");

    const SORT_OPTIONS = [
      {val:"newest", label:"Newest First"},
      {val:"oldest", label:"Oldest First"},
      {val:"az",     label:"A → Z"},
      {val:"za",     label:"Z → A"},
    ];

    return (
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#1A2E24]">{label}</h3>
            <span className="text-[11px] text-[#6B8A78] font-mono bg-white border border-gray-100 rounded-lg px-2 py-0.5">{displayList.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
              <span className="text-gray-400">{Ic.sort}</span>
              <select
                value={sortBy}
                onChange={e=>setSortBy(e.target.value)}
                className="text-[12px] text-[#1A2E24] font-medium outline-none bg-transparent cursor-pointer"
              >
                {SORT_OPTIONS.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            {/* Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{Ic.search}</div>
              <input
                value={listSearch}
                onChange={e=>setListSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-xl outline-none focus:border-[#3D8B6E] bg-white w-44"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {displayList.length===0
            ?<div className="text-center py-14 text-gray-400 text-sm">No records found</div>
            :displayList.map(l=><ListRow key={l.id} l={l}/>)
          }
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" style={{background:"#F0F7F3"}}>

      {/* SIDEBAR */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
        {(user.role==="admin"||user.role==="operator")&&(
          <div className="p-3 border-b border-gray-100">
            <button onClick={()=>{setPage("checklist");setChecklistAction({type:"create"});}} className="w-full bg-[#3D8B6E] hover:bg-[#2A6B52] text-white py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Checklist
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          <TreeTop label="All Checklists"   icon={Ic.list}  count={stats.total}         isActive={selected==="all"}              onClick={()=>setSelected("all")}/>
          <TreeTop label="Today"            icon={Ic.today} count={stats.today}          isActive={selected==="today"}            onClick={()=>setSelected("today")}/>
          {bIds.length>0       && <TreeTop label="Bookmarks"       icon={Ic.star}  count={bIds.length}         isActive={selected==="bookmarks"}        onClick={()=>setSelected("bookmarks")}/>}
          {pendingAR.length>0  && <TreeTop label="Pending Approval" icon={Ic.clock} count={pendingAR.length}   isActive={selected==="pending-approval"}  onClick={()=>setSelected("pending-approval")}/>}

          <div className="pt-1">
            <TreeFolder label="By Schedule" icon={Ic.folder} isOpen={openFolders.freq} onClick={()=>toggle("freq")}/>
            {openFolders.freq&&(
              <div className="ml-3 border-l-2 border-[#e8f5ee] pl-1 space-y-0.5 mt-0.5">
                <TreeLeaf label="Daily"    dot="#3b82f6" count={byFreq("Daily").length}    isActive={selected==="freq:Daily"}    onClick={()=>setSelected("freq:Daily")}/>
                <TreeLeaf label="Weekly"   dot="#8b5cf6" count={byFreq("Weekly").length}   isActive={selected==="freq:Weekly"}   onClick={()=>setSelected("freq:Weekly")}/>
                <TreeLeaf label="Monthly"  dot="#f59e0b" count={byFreq("Monthly").length}  isActive={selected==="freq:Monthly"}  onClick={()=>setSelected("freq:Monthly")}/>
                <TreeLeaf label="One Time" dot="#9ca3af" count={byFreq("One Time").length} isActive={selected==="freq:One Time"} onClick={()=>setSelected("freq:One Time")}/>
              </div>
            )}
          </div>

          <div>
            <TreeFolder label="By Department" icon={Ic.folder} isOpen={openFolders.dept} onClick={()=>toggle("dept")}/>
            {openFolders.dept&&(
              <div className="ml-3 border-l-2 border-[#e8f5ee] pl-1 space-y-0.5 mt-0.5">
                {DEPTS.map(d=><TreeLeaf key={d} label={d} dot="#3D8B6E" count={byDept(d).length} isActive={selected===`dept:${d}`} onClick={()=>setSelected(`dept:${d}`)}/>)}
              </div>
            )}
          </div>

          <div>
            <TreeFolder label="By Status" icon={Ic.folder} isOpen={openFolders.status} onClick={()=>toggle("status")}/>
            {openFolders.status&&(
              <div className="ml-3 border-l-2 border-[#e8f5ee] pl-1 space-y-0.5 mt-0.5">
                {[["draft","#9ca3af","Draft"],["finalized","#f59e0b","Finalized"],["submitted","#3b82f6","Submitted"],["approved","#22c55e","Approved"],["rejected","#ef4444","Rejected"]].map(([s,dot,lb])=>(
                  <TreeLeaf key={s} label={lb} dot={dot} count={byStatus(s).length} isActive={selected===`status:${s}`} onClick={()=>setSelected(`status:${s}`)}/>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <div className="text-[12px] font-semibold text-[#1A2E24]">{user.name?.split(" ")[0]}</div>
          <div className="text-[10px] text-[#6B8A78] capitalize">{user.role} · {shift} Shift</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto p-5">
        {selected==="welcome" ? <WelcomePanel/> : <ListPanel/>}
      </main>

      {approvalModal&&<ApprovalActionModal checklist={approvalModal.cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={()=>setApprovalModal(null)}/>}
      {paperModal&&<PaperSizeModal action={paperModal.action} cl={paperModal.cl} auditLog={[]} onClose={()=>setPaperModal(null)}/>}
    </div>
  );
}