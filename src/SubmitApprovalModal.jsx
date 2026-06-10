import React, { useState } from "react";
import { fmtDT } from "./helpers";

export default function SubmitApprovalModal({ cl, onConfirm, onClose }) {
  const [approverName,  setApproverName]  = useState(cl.approverName  || "");
  const [approverEmail, setApproverEmail] = useState(cl.approverEmail || "");
  const [message,       setMessage]       = useState("");
  const [err, setErr] = useState("");

  function handleSubmit() {
    if (!approverName.trim()) { setErr("Approver name is required before submitting."); return; }
    onConfirm({ approverName: approverName.trim(), approverEmail: approverEmail.trim(), message });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1e5c42] text-white px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <h3 className="text-sm font-bold">Submit for Approval</h3>
            </div>
            <p className="text-[10px] text-green-200 font-mono">All fields lock until the approver acts</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold flex-shrink-0">✕</button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="bg-[#f6faf8] border border-[#d0e8da] rounded-xl px-4 py-3 text-xs space-y-1.5">
            <p className="text-[10px] font-bold text-[#6B8A78] uppercase tracking-wide mb-2">Checklist Being Submitted</p>
            <div className="flex items-center justify-between">
              <span className="text-[#6B8A78]">Name</span>
              <span className="font-semibold text-[#1A2E24]">{cl.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B8A78]">ID</span>
              <span className="font-mono text-[10px] text-[#1A2E24]">{cl.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B8A78]">Department</span>
              <span className="font-semibold text-[#1A2E24]">{cl.department}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B8A78]">Shift</span>
              <span className="font-semibold text-[#1A2E24]">{cl.shift}</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Approver Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8A78]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <input
                value={approverName}
                onChange={e => { setApproverName(e.target.value); setErr(""); }}
                placeholder="e.g. Mr. Sharma / QC Manager"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E] focus:ring-2 focus:ring-[#3D8B6E]/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Approver Email <span className="text-[#9ca3af] font-normal normal-case">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8A78]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <input
                type="email"
                value={approverEmail}
                onChange={e => setApproverEmail(e.target.value)}
                placeholder="approver@company.com"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E] focus:ring-2 focus:ring-[#3D8B6E]/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Message to Approver <span className="text-[#9ca3af] font-normal normal-case">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder=""
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs resize-none outline-none focus:border-[#3D8B6E] focus:ring-2 focus:ring-[#3D8B6E]/10 leading-relaxed"
            />
            <p className="text-[10px] text-[#9ca3af] mt-1">{message.length} characters</p>
          </div>

          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-red-600 text-[11px] font-semibold">{err}</p>
            </div>
          )}

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-[10px] text-amber-700 leading-relaxed">
              After submission, <strong>all checklist fields lock</strong>. The approver will be able to Approve or Reject. You can cancel the submission to edit again if needed.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-xl bg-[#1e5c42] hover:bg-[#14412e] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Submit for Approval
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}