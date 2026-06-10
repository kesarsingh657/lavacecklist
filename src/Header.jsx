import React, { useState, useEffect, useRef } from "react";
import { fmtDT } from "./helpers";

export default function Header({ user, page, setPage, notifications, onClearNotifs, onMarkAllRead, onLogout }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef();
  
  useEffect(()=>{
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setNotifOpen(false); };
    document.addEventListener("click",h);
    return ()=>document.removeEventListener("click",h);
  },[]);
  
  const unread = notifications.filter(n=>!n.read).length;

  return (
    <header className="sticky top-0 z-50 bg-[#3D8B6E] border-b border-green-800 shadow-sm no-print">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={()=>setPage("dashboard")}>
            <div className="w-8 h-8 rounded-lg bg-white text-[#3D8B6E] flex items-center justify-center font-bold text-sm">✓</div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white leading-none">Smart Checklist</h1>
              <p className="text-[9px] text-green-200 font-mono">Manufacturing System</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {[["dashboard","Dashboard"],["checklist","Checklists"],["audit","Audit Log"]].map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${page===p?"bg-white text-[#3D8B6E] font-semibold":"text-white hover:bg-white/20"}`}>{l}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={ref}>
            <button onClick={e=>{e.stopPropagation();setNotifOpen(o=>!o);if(!notifOpen&&unread>0)onMarkAllRead();}}
              className="w-8 h-8 rounded-lg bg-[#2A6B52] text-white flex items-center justify-center hover:bg-[#235740] relative">
              🔔
              {unread>0&&<span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold px-0.5">{Math.min(unread,99)}</span>}
            </button>
            {notifOpen&&(
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="bg-[#3D8B6E] text-white px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">Notifications {unread>0&&<span className="ml-1 bg-red-500 rounded-full px-1.5 text-[9px]">{unread} new</span>}</span>
                  <button onClick={onClearNotifs} className="text-[10px] text-green-200 hover:text-white">Clear all</button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length===0
                    ? <p className="text-xs text-gray-400 text-center py-6">No notifications</p>
                    : notifications.slice(0,25).map((n,i)=>(
                        <div key={i} className={`px-3 py-2.5 ${n.read?"":"bg-green-50/60"}`}>
                          <p className="text-xs text-[#1A2E24] leading-relaxed">{n.msg}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{fmtDT(n.time)}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-[#2A6B52] rounded-lg px-2 py-1">
            <div className="w-6 h-6 rounded-md bg-[#6FAF8F] text-white flex items-center justify-center text-[10px] font-bold">{(user.name||"A")[0].toUpperCase()}</div>
            <div className="hidden sm:block leading-none">
              <span className="text-xs text-white block">{user.name?.split(" ")[0]||"User"}</span>
              <span className="text-[9px] text-green-300 capitalize">{user.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="px-2.5 py-1.5 rounded-lg bg-white text-[#3D8B6E] text-xs font-semibold hover:bg-green-50">Logout</button>
        </div>
      </div>
    </header>
  );
}