import React, { useState } from "react";
import { fmtDT } from "./helpers";

export default function AuditPage({ auditLog, checklists, user }) {
  const [search,setSearch]=useState(""); const [actionFilter,setActionFilter]=useState("");
  const actions=[...new Set(auditLog.map(a=>a.action))];
  const myLog = user.role==="viewer" ? auditLog.filter(a=>{const cl=checklists.find(c=>c.id===a.checklistId);return cl?.createdBy===user.name;}) : auditLog;
  const visible = myLog.filter(a=>
    (!search||a.details?.toLowerCase().includes(search.toLowerCase())||a.userName?.toLowerCase().includes(search.toLowerCase())||a.checklistName?.toLowerCase().includes(search.toLowerCase())) &&
    (!actionFilter||a.action===actionFilter)
  );
  const ACTION_CLR={Created:"bg-blue-50 text-blue-700",Finalized:"bg-amber-50 text-amber-700",Submitted:"bg-cyan-50 text-cyan-700",Approved:"bg-green-50 text-green-700",Rejected:"bg-red-50 text-red-700","Submission Cancelled":"bg-orange-50 text-orange-700",Saved:"bg-gray-50 text-gray-500",Deleted:"bg-red-100 text-red-700"};
  
  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-[#1A2E24]">Manufacturing Checklist Dashboard</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
            <option value="">All Actions</option>{actions.map(a=><option key={a}>{a}</option>)}
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search log…" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 outline-none w-44"/>
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {visible.length===0 ? (
          <div className="text-center text-xs text-gray-400 py-14"><div className="text-3xl mb-2 opacity-30">🗒️</div>No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-[#f6faf8] text-[#6B8A78] border-y border-gray-100">
                {["Timestamp","Action","User","Checklist","Details"].map(h=><th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {[...visible].reverse().map(a=>(
                  <tr key={a.id} className="border-t border-gray-50 hover:bg-green-50/30">
                    <td className="px-4 py-2 font-mono text-[10px] text-[#6B8A78] whitespace-nowrap">{fmtDT(a.timestamp)}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_CLR[a.action]||"bg-gray-50 text-gray-600"}`}>{a.action}</span></td>
                    <td className="px-4 py-2 font-semibold text-[#1A2E24]">{a.userName}</td>
                    <td className="px-4 py-2 text-[#6B8A78] max-w-[140px] truncate">{a.checklistName||a.checklistId}</td>
                    <td className="px-4 py-2 text-[#6B8A78] max-w-[300px]">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}