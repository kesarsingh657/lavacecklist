import React, { useState } from "react";

export default function AssignApproverModal({ cl, onSave, onClose }) {
  const [approverName,  setApproverName]  = useState(cl.approverName  || "");
  const [approverEmail, setApproverEmail] = useState(cl.approverEmail || "");
  const [approvalRequired, setApprovalRequired] = useState(cl.approvalRequired ?? "yes");
  const [err, setErr] = useState("");

  function handleSave() {
    if (approvalRequired === "yes" && !approverName.trim()) {
      setErr("Approver name is required when approval is enabled.");
      return;
    }
    onSave({ approverName: approverName.trim(), approverEmail: approverEmail.trim(), approvalRequired });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#3D8B6E] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">👤 Assign Approver</h3>
            <p className="text-[10px] text-green-200 mt-0.5 font-mono">{cl.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {cl.approverName && (
            <div className="bg-[#f0fdf4] border border-[#86efac] rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span className="text-green-600 text-sm">✓</span>
              <div>
                <p className="text-[10px] font-bold text-green-800">Currently Assigned</p>
                <p className="text-xs text-green-700">{cl.approverName}{cl.approverEmail ? ` · ${cl.approverEmail}` : ""}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Approval Required</label>
            <div className="grid grid-cols-2 gap-2">
              {["yes","no"].map(v => (
                <button key={v} type="button" onClick={() => { setApprovalRequired(v); setErr(""); }}
                  className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${approvalRequired === v ? (v==="yes" ? "border-[#3D8B6E] bg-[#e8f5ee] text-[#3D8B6E]" : "border-red-400 bg-red-50 text-red-600") : "border-gray-200 text-gray-400 hover:border-gray-300"}`}>
                  {v === "yes" ? "✅ Yes" : "⊘ No"}
                </button>
              ))}
            </div>
          </div>

          {approvalRequired === "yes" && <>
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Approver Name <span className="text-red-500">*</span></label>
              <input value={approverName} onChange={e => { setApproverName(e.target.value); setErr(""); }}
                placeholder="e.g. Mr. Sharma / QC Manager"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Approver Email <span className="text-[#6B8A78] font-normal">(optional)</span></label>
              <input type="email" value={approverEmail} onChange={e => setApproverEmail(e.target.value)}
                placeholder="approver@company.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
          </>}

          {err && <p className="text-red-500 text-[11px] font-semibold">{err}</p>}
          <p className="text-[9px] text-gray-400 leading-relaxed">
            The assigned approver will be shown when submitting. They can Approve or Reject after the checklist is finalized and submitted.
          </p>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave}
              className="flex-1 py-2.5 bg-[#3D8B6E] hover:bg-[#2A6B52] text-white text-xs font-bold rounded-xl transition-all">
              💾 Save Approver
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}