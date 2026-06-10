import React, { useState, useEffect, useRef } from "react";
import { STATUS, DEPTS, SHIFTS, FREQS } from "./constants";
import { PERM, now } from "./helpers";
import { FreqPill, StatusPill } from "./StatusPill";
import ChecklistEditor from "./ChecklistEditor";
import CreateModal from "./CreateModal";
import CloneModal from "./CloneModal";

export default function ChecklistPage({ user, checklists, bookmarks, setChecklists, setBookmarks, addNotif, addAudit, auditLog, showToast, initialAction, setPage }) {
  const [view,setView]           = useState("landing");
  const [activeCl,setActiveCl]   = useState(null);
  const [isViewMode,setIsViewMode]= useState(false);
  const [showCreate,setShowCreate]= useState(false);
  const [prefill,setPrefill]     = useState(null);
  const [cloneTarget,setCloneTarget]=useState(null);
  const [tab,setTab]              = useState("all");
  const [showFilters,setShowFilters]=useState(false);

  const [search, setSearch] = useState("");
  const [freqFilter,setFreqFilter]= useState("");
  const [deptFilter,setDeptFilter]= useState("");
  const [shiftFilter,setShiftFilter]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [dateFrom, setDateFrom]  = useState("");
  const [dateTo, setDateTo]    = useState("");
  const [sortBy, setSortBy]    = useState("newest");

  const actionHandled=useRef(false);
  const bIds=bookmarks.map(b=>b.id);

  useEffect(()=>{
    if(initialAction&&!actionHandled.current){
      actionHandled.current=true;
      if(initialAction.type==="create") setShowCreate(true);
      else if(initialAction.type==="fill"&&initialAction.id)   openChecklist(initialAction.id,false);
      else if(initialAction.type==="view"&&initialAction.id)   openChecklist(initialAction.id,true);
      else if(initialAction.type==="clone"&&initialAction.id){ const cl=checklists.find(l=>l.id===initialAction.id); if(cl) setCloneTarget(cl); }
      else if(initialAction.type==="template"&&initialAction.id){ const bm=bookmarks.find(b=>b.id===initialAction.id); if(bm){setPrefill(bm);setShowCreate(true);} }
      else if(initialAction.type==="bookmarks") setTab("bookmarks");
    }
  },[initialAction]);

  function openChecklist(id,viewOnly){
    const cl=checklists.find(l=>l.id===id); if(!cl)return;
    setActiveCl({...cl}); setIsViewMode(viewOnly); setView("editor");
  }
  function deleteChecklist(id){
    if(!confirm("Delete?"))return;
    const cl=checklists.find(l=>l.id===id);
    setChecklists(prev=>prev.filter(l=>l.id!==id));
    addAudit(id,"Deleted",user,`"${cl?.name}" deleted`,cl?.name);
    showToast("Deleted");
  }

  let filtered=[...checklists];
  if(user.role==="operator") filtered=filtered.filter(l=>l.createdBy===user.name||l.createdById===user.id);
  if(tab==="bookmarks")      filtered=filtered.filter(l=>bIds.includes(l.id));
  if(search){
    const q=search.toLowerCase();
    filtered=filtered.filter(l=>l.name?.toLowerCase().includes(q)||l.id?.toLowerCase().includes(q)||l.createdBy?.toLowerCase().includes(q)||l.department?.toLowerCase().includes(q));
  }
  if(freqFilter)   filtered=filtered.filter(l=>l.frequency===freqFilter);
  if(deptFilter)   filtered=filtered.filter(l=>l.department===deptFilter);
  if(shiftFilter)  filtered=filtered.filter(l=>l.shift===shiftFilter);
  if(statusFilter) filtered=filtered.filter(l=>l.status===statusFilter);
  if(dateFrom)     filtered=filtered.filter(l=>new Date(l.createdAt)>=new Date(dateFrom));
  if(dateTo)       filtered=filtered.filter(l=>new Date(l.createdAt)<=new Date(dateTo+"T23:59:59"));

  filtered.sort((a,b)=>{
    if(sortBy==="newest")  return new Date(b.createdAt)-new Date(a.createdAt);
    if(sortBy==="oldest")  return new Date(a.createdAt)-new Date(b.createdAt);
    if(sortBy==="name-az") return (a.name||"").localeCompare(b.name||"");
    if(sortBy==="name-za") return (b.name||"").localeCompare(a.name||"");
    if(sortBy==="status")  return (a.status||"").localeCompare(b.status||"");
    if(sortBy==="dept")    return (a.department||"").localeCompare(b.department||"");
    return 0;
  });

  const activeFilterCount = [freqFilter,deptFilter,shiftFilter,statusFilter,dateFrom,dateTo].filter(Boolean).length;

  function clearFilters(){
    setFreqFilter(""); setDeptFilter(""); setShiftFilter("");
    setStatusFilter(""); setDateFrom(""); setDateTo(""); setSortBy("newest");
  }

  if(view==="editor"&&activeCl){
    return <ChecklistEditor
      cl={activeCl} viewMode={isViewMode} user={user} auditLog={auditLog}
      onSaveClose={()=>setView("landing")}
      showToast={showToast} addNotif={addNotif} addAudit={addAudit}
      bookmarks={bookmarks} setBookmarks={setBookmarks} setChecklists={setChecklists}
      onBack={()=>{ setPrefill(activeCl); setShowCreate(true); setView("landing"); }}
    />;
  }

  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#1A2E24]">Checklists
          <span className="ml-2 text-[10px] text-[#6B8A78] font-normal font-mono">{filtered.length} records</span>
        </h2>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2 items-center">
        {[["all","All"],["bookmarks","Bookmarks"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${tab===t?"bg-[#3D8B6E] text-white":"bg-white border border-gray-200 text-gray-500 hover:border-[#3D8B6E]"}`}>{l}</button>
        ))}
        <div className="flex-1"/>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, dept…" className="text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 outline-none w-48 focus:border-[#3D8B6E]" style={{background:"#f6faf8"}}/>
        </div>
        <button onClick={()=>setShowFilters(s=>!s)}
          className={`relative text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${showFilters?"bg-[#3D8B6E] text-white border-[#3D8B6E]":"bg-white border-gray-200 text-gray-600 hover:border-[#3D8B6E]"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters
          {activeFilterCount>0&&<span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">{activeFilterCount}</span>}
        </button>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white focus:border-[#3D8B6E]">
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="name-az">Sort: Name A→Z</option>
          <option value="name-za">Sort: Name Z→A</option>
          <option value="status">Sort: Status</option>
          <option value="dept">Sort: Department</option>
        </select>
      </div>

      {showFilters&&(
        <div className="bg-white border border-[#d0e8da] rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[#3D8B6E] uppercase tracking-wide">Advanced Filters</p>
            {activeFilterCount>0&&(
              <button onClick={clearFilters} className="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear all ({activeFilterCount})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Department</label>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{DEPTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Shift</label>
              <select value={shiftFilter} onChange={e=>setShiftFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{SHIFTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Schedule</label>
              <select value={freqFilter} onChange={e=>setFreqFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{FREQS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Status</label>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>
                {Object.entries(STATUS).map(([k,v])=><option key={v} value={v}>{k.charAt(0)+k.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
          </div>
          {activeFilterCount>0&&(
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
              {deptFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Dept: {deptFilter}<button onClick={()=>setDeptFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {shiftFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Shift: {shiftFilter}<button onClick={()=>setShiftFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {freqFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Schedule: {freqFilter}<button onClick={()=>setFreqFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {statusFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Status: {statusFilter}<button onClick={()=>setStatusFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {dateFrom&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">From: {dateFrom}<button onClick={()=>setDateFrom("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {dateTo&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">To: {dateTo}<button onClick={()=>setDateTo("")} className="hover:text-red-500 ml-0.5">×</button></span>}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length===0?(
          <div className="text-center text-xs text-gray-400 py-12"><div className="text-3xl mb-2 opacity-30">📥</div>{tab==="bookmarks"?"No bookmarks yet.":"No checklists found."}</div>
        ):filtered.map(cl=>{
          const isBookmarked=bIds.includes(cl.id);
          const filled=Object.keys(cl.dateEntries||{}).length;
          const dt=new Date(cl.createdAt);
          const canFill=PERM.canEdit(cl,user);
          return(
            <div key={cl.id} onClick={()=>openChecklist(cl.id,!canFill)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-green-50/50 cursor-pointer border-l-4 ${cl.frequency==="Daily"?"border-l-blue-400":cl.frequency==="Weekly"?"border-l-purple-400":cl.frequency==="Monthly"?"border-l-yellow-400":"border-l-transparent"}`}>
              <div className="w-9 h-9 rounded-xl bg-[#e8f5ee] flex items-center justify-center flex-shrink-0 text-sm">📋</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1A2E24] truncate">{cl.name}</span>
                  <FreqPill freq={cl.frequency}/><StatusPill status={cl.status}/>
                  {isBookmarked&&<span className="text-[9px] text-orange-400">🔖</span>}
                </div>
                <div className="text-[10px] text-[#6B8A78] font-mono mt-0.5">
                  {cl.id} · {cl.department} · Shift: {cl.shift} · by {cl.createdBy}{filled>0&&` · ${filled} date entries`}
                  {cl.clonedFrom&&<span className="ml-1.5 text-[#3D8B6E] font-semibold">· Cloned</span>}
                </div>
                {cl.rejectionReason&&<div className="text-[9px] text-red-500 mt-0.5">↳ {cl.rejectionReason}</div>}
              </div>
              <div className="text-[10px] text-[#6B8A78] font-mono text-right hidden sm:block flex-shrink-0">
                {dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}<br/>{dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
              </div>
              <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                {canFill&&(
                  <button onClick={()=>openChecklist(cl.id,false)} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center" title="Edit checklist">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                <button onClick={()=>openChecklist(cl.id,true)} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-200 flex items-center justify-center" title="View checklist">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                {(user.role==="admin"||user.role==="operator")&&(
                  <button onClick={()=>setCloneTarget(cl)} className="w-7 h-7 rounded-lg bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white flex items-center justify-center transition-all" title="Clone this checklist">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                )}
                {user.role==="admin"&&(
                  <button onClick={()=>deleteChecklist(cl.id)} className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all" title="Delete checklist">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(user.role==="admin"||user.role==="operator")&&(
        <button onClick={()=>{setPrefill(null);setShowCreate(true);}} className="fab-btn fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#3D8B6E] text-white shadow-xl flex items-center justify-center text-xl hover:bg-[#2A6B52] hover:scale-105 transition-all z-40">+</button>
      )}
      {showCreate&&(
        <CreateModal user={user} prefill={prefill} onClose={()=>setShowCreate(false)}
          onCreate={cl=>{
            setChecklists(prev => {
              const exists = prev.find(x => x.id === cl.id);
              if (exists) { return prev.map(x => x.id === cl.id ? cl : x); }
              return [...prev, cl];
            });
            addAudit(cl.id,"Created",user,`Checklist "${cl.name}" created`,cl.name);
            addNotif({msg:`📝 "${cl.name}" created by ${user.name}`,time:now(),read:false});
            setShowCreate(false);showToast("Checklist created!");
            setActiveCl(cl);setIsViewMode(false);setView("editor");
          }}/>
      )}
      {cloneTarget&&(
        <CloneModal source={cloneTarget} user={user} onClose={()=>setCloneTarget(null)}
          onCreate={cl=>{
            setChecklists(prev=>[...prev,cl]);
            addAudit(cl.id,"Cloned",user,`Cloned from "${cloneTarget.name}" (${cloneTarget.id})`,cl.name);
            addNotif({msg:`⎘ "${cl.name}" cloned from "${cloneTarget.name}" by ${user.name}`,time:now(),read:false});
            setCloneTarget(null); showToast("⎘ Checklist cloned — ready to fill!");
            setActiveCl(cl);setIsViewMode(false);setView("editor");
          }}
        />
      )}
    </main>
  );
}