import React, { useState } from "react";
import { fmtDT } from "./helpers";

export default function ApprovalActionModal({ checklist, type, onConfirm, onClose }) {
  const [remarks,setRemarks]=useState(""); const [reason,setReason]=useState(""); const [err,setErr]=useState("");
  const isApprove=type==="approve";
  
  function confirm(){
    if(!remarks.trim()){setErr("Remarks are required — mandatory field.");return;}
    if(!isApprove&&!reason.trim()){setErr("Rejection reason is required.");return;}
    onConfirm({remarks,reason});
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className={`px-5 py-3.5 flex items-center justify-between ${isApprove?"bg-[#3D8B6E]":"bg-red-600"}`}>
          <h3 className="text-sm font-bold text-white">{isApprove?"✅ Approve Checklist":"❌ Reject Checklist"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-bold">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#f6faf8] rounded-xl p-3 text-xs border border-[#d0e8da] space-y-1.5">
            <div><span className="text-[#6B8A78]">Checklist:</span> <span className="font-semibold">{checklist.name}</span></div>
            <div><span className="text-[#6B8A78]">ID:</span> <span className="font-mono text-[10px]">{checklist.id}</span></div>
            <div><span className="text-[#6B8A78]">Department:</span> <span className="font-semibold">{checklist.department}</span></div>
            <div><span className="text-[#6B8A78]">Submitted by:</span> <span className="font-semibold">{checklist.createdBy}</span></div>
            {checklist.submittedAt&&<div><span className="text-[#6B8A78]">Submitted at:</span> <span className="font-mono text-[10px]">{fmtDT(checklist.submittedAt)}</span></div>}
          </div>
          {!isApprove&&(
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
              <input value={reason} onChange={e=>{setReason(e.target.value);setErr("");}} placeholder="e.g. Incomplete entries, values out of spec…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-400"/>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              {isApprove?"Approval Remarks":"Additional Remarks"} <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={remarks} onChange={e=>{setRemarks(e.target.value);setErr("");}}
              placeholder={isApprove?"Approval notes, observations, conditions…":"Detailed feedback for the operator…"}
              className={`w-full border rounded-xl px-3 py-2 text-xs resize-none outline-none ${isApprove?"border-gray-200 focus:border-[#3D8B6E]":"border-gray-200 focus:border-red-400"}`}/>
          </div>
          {err&&<p className="text-red-500 text-[11px] font-semibold">{err}</p>}
          <p className="text-[9px] text-gray-400">This action is permanent and recorded in the Audit Trail with full timestamp.</p>
          <div className="flex gap-2">
            <button onClick={confirm} className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold ${isApprove?"bg-[#3D8B6E] hover:bg-[#2A6B52]":"bg-red-600 hover:bg-red-700"}`}>
              {isApprove?"Confirm Approval":"Confirm Rejection"}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}