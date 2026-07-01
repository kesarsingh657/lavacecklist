/**
 * SubmitApprovalModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE: Digital Signature on Submission
 *
 * Change from old version:
 *  - approverName is NO LONGER a free-text input
 *  - It is auto-filled with the currently logged-in user's name
 *  - The field shows as read-only — cannot be changed
 *  - This ensures the signature is always tied to the authenticated user
 *
 * The `user` prop must be passed from ChecklistEditor:
 *   <SubmitApprovalModal cl={cl} user={user} onConfirm={handleSubmitConfirm} onClose={…} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from "react";

export default function SubmitApprovalModal({ cl, user, onConfirm, onClose }) {
  // DIGITAL SIGNATURE: approver name is locked to the logged-in user — no free text entry
  const approverName  = user?.name || "Unknown";
  const [approverEmail, setApproverEmail] = useState(cl.approverEmail || "");
  const [remarks,       setRemarks]       = useState("");
  const [err,           setErr]           = useState("");

  function handleSubmit() {
    if (!remarks.trim()) { setErr("Submission remarks are required."); return; }
    onConfirm({ approverName, approverEmail: approverEmail.trim(), remarks });
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">📤 Submit for Approval</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Checklist summary */}
          <div className="bg-[#f6faf8] rounded-xl p-3 text-xs border border-[#d0e8da] space-y-1.5">
            <div><span className="text-[#6B8A78]">Checklist:</span> <span className="font-semibold">{cl.name}</span></div>
            <div><span className="text-[#6B8A78]">ID:</span> <span className="font-mono text-[10px]">{cl.id}</span></div>
            <div><span className="text-[#6B8A78]">Department:</span> <span className="font-semibold">{cl.department}</span></div>
            <div><span className="text-[#6B8A78]">Schedule:</span> <span className="font-semibold">{cl.frequency || "One Time"}</span></div>
          </div>

          {/* DIGITAL SIGNATURE — read-only, auto-filled from logged-in user */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Submitted By (Digital Signature)
            </label>
            <div className="w-full border border-[#3D8B6E]/40 bg-[#f0fdf4] rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2E24] flex items-center gap-2">
              <span className="text-[#3D8B6E]">🔒</span>
              {approverName}
              <span className="text-[9px] text-[#6B8A78] ml-auto font-normal">Locked to your account</span>
            </div>
          </div>

          {/* Optional CC email */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Notify Email <span className="text-[#6B8A78] font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={approverEmail}
              onChange={e => setApproverEmail(e.target.value)}
              placeholder="approver@company.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-400"
            />
          </div>

          {/* Submission remarks */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Submission Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={e => { setRemarks(e.target.value); setErr(""); }}
              placeholder="Brief notes about this submission…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none outline-none focus:border-blue-400"
            />
          </div>

          {err && <p className="text-red-500 text-[11px] font-semibold">{err}</p>}

          <p className="text-[9px] text-gray-400">
            Submitting locks this checklist for editing until reviewed. Your name is recorded as the submitting authority.
          </p>

          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">📤 Confirm Submission</button>
            <button onClick={onClose}      className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}