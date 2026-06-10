import React, { useState } from "react";
import { STATUS, STATUS_LABEL } from "./constants";
import { getCompletion, PERM, now, validateFillColumns, fmtDT } from "./helpers";
import { WorkflowStepper, StatusPill } from "./StatusPill";
import FillField from "./FillField";
import SubmitApprovalModal from "./SubmitApprovalModal";
import ApprovalActionModal from "./ApprovalActionModal";
import CalendarModal from "./CalendarModal";
import PaperSizeModal from "./PaperSizeModal";
import CloneModal from "./CloneModal";

export default function ChecklistEditor({ cl: initialCl, viewMode, user, auditLog, onSaveClose, onBack, showToast, addNotif, addAudit, bookmarks, setBookmarks, setChecklists }) {
  const [cl, setCl] = useState(() => {
    const c = { ...initialCl };
    if (!c.tableData) {
      const rows = c.rows || 5, cols = c.cols || 4;
      c.tableData = {
        headers: Array.from({ length: cols }, (_, i) => ({ text: `Checkpoint ${i + 1}`, isFill: false })),
        rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: "" }))),
      };
    }
    return c;
  });

  const completion = getCompletion(cl.tableData?.rows || []);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [calSelected, setCalSelected] = useState(null);
  const [approvalModal, setApprovalModal] = useState(null);
  const [paperModal, setPaperModal] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);

  const isView = viewMode;
  const isRecurring = ["Daily", "Weekly", "Monthly"].includes(cl.frequency);
  const editable = !isView && PERM.canEdit(cl, user);
  const canFin = !isView && PERM.canFinalize(cl, user);
  const canSub = !isView && PERM.canSubmit(cl, user);
  const canCancel = !isView && PERM.canCancelSubmit(cl, user);
  const canAR = !isView && PERM.canApproveReject(cl, user);

  function handleBackToDraft() {
    if (!window.confirm("Move checklist back to Draft?")) return;
    const updated = { ...cl, status: "draft" };
    setCl(updated);
    persist(updated);
    showToast("Checklist moved back to Draft");
  }

  function persist(updated) {
    setChecklists(prev => {
      const idx = prev.findIndex(l => l.id === updated.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
  }

  function updateCellValue(ri, ci, val) { setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row, r) => r === ri ? row.map((cell, c) => c === ci ? { ...cell, value: val } : cell) : row) } })); }
  function updateHeader(ci, text) { setCl(p => ({ ...p, tableData: { ...p.tableData, headers: p.tableData.headers.map((h, i) => i === ci ? { ...h, text } : h) } })); }
  function addRow() { setCl(p => { const cols = p.tableData.headers.length; return { ...p, tableData: { ...p.tableData, rows: [...p.tableData.rows, Array.from({ length: cols }, () => ({ value: "" }))] } }; }); }
  function removeRow() { setCl(p => { if (p.tableData.rows.length <= 1) return p; return { ...p, tableData: { ...p.tableData, rows: p.tableData.rows.slice(0, -1) } }; }); }
  function addCheckpointCol() { setCl(p => { const count = p.tableData.headers.filter(h => !h.isFill).length; const newH = [...p.tableData.headers]; const at = newH.findIndex(h => h.isFill); const idx = at === -1 ? newH.length : at; newH.splice(idx, 0, { text: `Checkpoint ${count + 1}`, isFill: false }); return { ...p, tableData: { headers: newH, rows: p.tableData.rows.map(r => { const n = [...r]; n.splice(idx, 0, { value: "" }); return n; }) } }; }); }
  function removeCheckpointCol() { setCl(p => { const idx = p.tableData.headers.map((h, i) => ({ h, i })).filter(x => !x.h.isFill).map(x => x.i); if (!idx.length) { showToast("No checkpoints to remove"); return p; } const last = idx[idx.length - 1]; return { ...p, tableData: { headers: p.tableData.headers.filter((_, i) => i !== last), rows: p.tableData.rows.map(r => r.filter((_, i) => i !== last)) } }; }); }
  function addFillCol() { setCl(p => { const count = p.tableData.headers.filter(h => h.isFill).length; return { ...p, tableData: { headers: [...p.tableData.headers, { text: `Fill ${count + 1}`, isFill: true }], rows: p.tableData.rows.map(r => [...r, { value: "" }]) } }; }); }
  function removeFillCol() { setCl(p => { const idx = p.tableData.headers.map((h, i) => ({ h, i })).filter(x => x.h.isFill).map(x => x.i); if (!idx.length) { showToast("No fill columns to remove"); return p; } const last = idx[idx.length - 1]; return { ...p, tableData: { headers: p.tableData.headers.filter((_, i) => i !== last), rows: p.tableData.rows.map(r => r.filter((_, i) => i !== last)) } }; }); }

  function updateRowRemark(ri, val) {
    setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row, r) => r === ri ? row.map((cell, ci) => ci === 0 ? { ...cell, remark: val } : cell) : row) } }));
  }

  function save(goBack) {
    if (!editable) { showToast("Checklist is locked"); return; }
    const updated = { ...cl, updatedAt: now() };
    if (cl.selectedDate) updated.dateEntries = { ...(cl.dateEntries || {}), [cl.selectedDate]: cl.tableData };
    persist(updated); setCl(updated);
    addAudit(cl.id, "Saved", user, "Data saved", cl.name);
    if (goBack) { showToast("Saved"); setTimeout(onSaveClose, 400); } else showToast("Saved!");
  }

  function handleFinalize() {
    const ts = now(); const updated = { ...cl, status: STATUS.FINALIZED, finalizedAt: ts, updatedAt: ts };
    if (cl.selectedDate) updated.dateEntries = { ...(cl.dateEntries || {}), [cl.selectedDate]: cl.tableData };
    persist(updated); setCl(updated);
    addAudit(cl.id, "Finalized", user, "All fields locked. Ready for submission.", cl.name);
    addNotif({ msg: `🔒 "${cl.name}" finalized by ${user.name}`, time: ts, read: false });
    showToast(" Checklist finalized!");
  }

  function handleSubmitConfirm(remarksOrObj) {
    const isObj = typeof remarksOrObj === "object" && remarksOrObj !== null;
    const approverName = isObj ? (remarksOrObj.approverName || cl.approverName || "") : (cl.approverName || "");
    const approverEmail = isObj ? (remarksOrObj.approverEmail || cl.approverEmail || "") : (cl.approverEmail || "");
    const remarks = isObj ? (remarksOrObj.remarks || "") : (remarksOrObj || "");
    const comments = isObj ? (remarksOrObj.comments || "") : "";

    const ts = now();
    const updated = { ...cl, status: STATUS.SUBMITTED, submittedAt: ts, updatedAt: ts, approverName, approverEmail, submissionRemarks: remarks, submissionComments: comments };
    if (cl.selectedDate) updated.dateEntries = { ...(cl.dateEntries || {}), [cl.selectedDate]: cl.tableData };
    persist(updated); setCl(updated);
    addAudit(cl.id, "Submitted", user, `Submitted to ${approverName || "approver"}.`, cl.name);
    addNotif({ msg: `📤 "${cl.name}" submitted by ${user.name}`, time: ts, read: false });
    showToast("📤 Submitted for Approval!");
    setShowSubmitModal(false);
    setTimeout(onSaveClose, 700);
  }

  function handleCancelSubmission() {
    if (!confirm("Cancel this submission?")) return;
    const ts = now(); const updated = { ...cl, status: STATUS.DRAFT, submittedAt: null, finalizedAt: null, updatedAt: ts };
    persist(updated); setCl(updated);
    addAudit(cl.id, "Submission Cancelled", user, "Submission cancelled", cl.name);
    showToast("Returned to Draft");
  }

  function handleApprovalConfirm({ remarks, reason }) {
    const { type } = approvalModal; const isApprove = type === "approve"; const ts = now();
    const updated = { ...cl, status: isApprove ? "approved" : "rejected", approvedAt: isApprove ? ts : undefined, rejectedAt: isApprove ? undefined : ts, approvedBy: isApprove ? user.name : undefined, rejectedBy: isApprove ? undefined : user.name, approvalRemarks: remarks, rejectionReason: isApprove ? undefined : reason, updatedAt: ts };
    persist(updated); setCl(updated);
    addAudit(cl.id, isApprove ? "Approved" : "Rejected", user, isApprove ? `Approved.` : `Rejected.`, cl.name);
    setApprovalModal(null);
    setTimeout(onSaveClose, 500);
  }
  // Add this missing function back into your ChecklistEditor component
  function handleBookmark() {
    if (bookmarks.find(b => b.id === cl.id)) { 
      showToast("Already bookmarked!"); 
      return; 
    }
    setBookmarks(prev => [...prev, { ...cl }]);
    showToast("📌 Bookmarked!");
  }

  const clAuditEntries = auditLog.filter(a => a.checklistId === cl.id);

  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">{cl.name} <span className="text-xs font-mono font-normal text-gray-400">({cl.id})</span></h2>
          <p className="text-[10px] text-gray-400 font-mono">Fill: {cl.fillType} · Schedule: {cl.frequency}</p>
        </div>
        <WorkflowStepper status={cl.status} />
      </div>

      <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex justify-between text-xs mb-1"><span className="font-semibold">Completion Progress</span><span>{completion}%</span></div>
        <div className="h-2 bg-gray-200 rounded"><div className="h-2 bg-green-500 rounded" style={{ width: `${completion}%` }} /></div>
      </div>
      
      <div className="action-bar flex flex-wrap items-center gap-2 mb-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <button onClick={onBack} className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold flex items-center gap-1.5">Back</button>

        {editable && <>
          <button onClick={addRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-semibold">+ Row</button>
          <button onClick={removeRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold">- Row</button>
          <button onClick={addCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">+ Col</button>
          <button onClick={removeCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold">- Col</button>
          <button onClick={addFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1e5c42] text-white font-semibold">+ Fill</button>
          <button onClick={removeFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold">- Fill</button>
          {isRecurring && <button onClick={() => { setCalViewDate(new Date()); setCalSelected(null); setShowCalModal(true); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 font-semibold">Calendar</button>}
          <button onClick={handleBookmark} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 font-semibold">Bookmark</button>
          <button onClick={() => save(false)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-semibold">Save</button>
          <button onClick={() => save(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#3D8B6E] text-white font-semibold">Save & Close</button>
        </>}

        {cl.status === "finalized" && (
          <button onClick={handleBackToDraft} className="text-[10px] px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-bold">↩ Back to Draft</button>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {canFin && <button onClick={handleFinalize} className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold">Finalize</button>}
          {canSub && <button onClick={() => { const missing = validateFillColumns(cl.tableData); if (missing.length > 0) { alert("⚠ Missing required fields:\n" + missing.join("\n")); return; } setShowSubmitModal(true); }} className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold">Submit</button>}
          {canCancel && <button onClick={handleCancelSubmission} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold">Cancel Submission</button>}
          {canAR && <>
            <button onClick={() => setApprovalModal({ type: "approve" })} className="text-[10px] px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold">Approve</button>
            <button onClick={() => setApprovalModal({ type: "reject" })} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold">Reject</button>
          </>}
          {PERM.canPrint(cl) && <button onClick={() => setPaperModal({ action: "print" })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-800 font-semibold">Print</button>}
          {PERM.canExport(cl) && <button onClick={() => setPaperModal({ action: "export" })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-800 font-semibold">Export PDF</button>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
          <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ background: "#4B9B7A", color: "white", border: "1px solid #d1d5db", padding: "4px 8px", fontSize: 11, width: "40px", textAlign: "center", position: "sticky", top: 0, zIndex: 10 }}>#</th>
                {cl.tableData.headers.map((h, ci) => (
                  <th key={ci} style={{ background: h.isFill ? "#1e5c42" : "#3D8B6E", color: "white", border: "1px solid #d1d5db", padding: "4px 8px", fontSize: 10, fontWeight: 600, width: h.isFill ? "120px" : "180px", position: "sticky", top: 0, zIndex: 10 }}>
                    {!editable ? h.text : (<span contentEditable suppressContentEditableWarning onBlur={e => updateHeader(ci, e.target.innerText)} style={{ display: "block", outline: "none" }}>{h.text}</span>)}
                  </th>
                ))}
                <th style={{ background: "#4a3a6b", color: "white", border: "1px solid #d1d5db", padding: "4px 8px", fontSize: 10, fontWeight: 600, width: "200px", position: "sticky", top: 0, zIndex: 10 }}>Remarks / Notes</th>
              </tr>
            </thead>
            <tbody>
  {cl.tableData.rows.map((row, ri) => (
    <tr key={ri} style={{ background: ri % 2 === 0 ? "white" : "#f9fafb", height: "auto" }}>
      {/* Index Number Column */}
      <td style={{ background: "#e5e7eb", color: "#6b7280", fontWeight: 700, border: "1px solid #d1d5db", padding: "8px", fontSize: 10, textAlign: "center", verticalAlign: "top" }}>{ri + 1}</td>
      
      {row.map((cell, ci) => {
        const isFill = cl.tableData.headers[ci]?.isFill;
        const cellLocked = !editable;
        
        return isFill ? (
          /* Fill Input Columns (e.g. Checkbox) */
          <td key={ci} style={{ background: cellLocked ? "#f3f4f6" : "#fffbeb", border: "1px solid #d1d5db", padding: "8px", verticalAlign: "top" }}>
            <FillField type={cl.fillType} opts={cl.customOptions} value={cell.value} onChange={v => updateCellValue(ri, ci, v)} disabled={cellLocked} />
          </td>
        ) : (
          /* Structural Checkpoint Description Columns */
          <td key={ci} style={{ border: "1px solid #d1d5db", padding: "8px", fontSize: 11, background: "white", verticalAlign: "top" }}>
            {/* Wrapper allows rows to expand dynamically downwards to wrap overflowing text clearly */}
            <div style={{ width: "100%", minHeight: "24px", wordBreak: "break-all", whiteSpace: "pre-wrap", overflow: "visible" }}>
              {cellLocked ? (
                cell.value
              ) : (
                <span 
                  contentEditable 
                  suppressContentEditableWarning 
                  
                  /* ContentEditable Key Limit Guard (Max 200 Chars) */
                  onKeyDown={e => {
                    const txt = e.target.innerText || "";
                    const isControl = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter"].includes(e.key);
                    if (txt.length >= 200 && !isControl) {
                      e.preventDefault(); // Typing block lag jata hai
                    }
                  }}
                  
                  /* Paste & Overflow Input Sanitizer (Max 200 Chars) */
                  onInput={e => {
                    if (e.target.innerText.length > 200) {
                      e.target.innerText = e.target.innerText.substring(0, 200);
                      // Cursor reposition reset
                      const range = document.createRange();
                      const sel = window.getSelection();
                      range.selectNodeContents(e.target);
                      range.collapse(false);
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                  }}
                  
                  onBlur={e => updateCellValue(ri, ci, e.target.innerText)} 
                  style={{ display: "inline-block", outline: "none", width: "100%" }}
                >
                  {cell.value}
                </span>
              )}
            </div>
          </td>
        );
      })}
      
      {/* Remarks / Notes Column Box (Strict 200 Chars Constraint) */}
      <td style={{ background: !editable ? "#f5f0ff" : "#faf5ff", border: "1px solid #d8b4fe", padding: "8px", verticalAlign: "top" }}>
        <div style={{ width: "100%", minHeight: "24px", wordBreak: "break-all", whiteSpace: "pre-wrap", overflow: "visible" }}>
          {!editable ? (
            <span style={{ fontSize: 11, color: "#5b21b6", fontStyle: "italic" }}>{row[0]?.remark || ""}</span>
          ) : (
            <textarea
              value={row[0]?.remark || ""}
              maxLength={200} // Hard input validation ceiling for 200 chars
              onChange={e => updateRowRemark(ri, e.target.value)}
              placeholder="Add remark…"
              rows={1}
              style={{ width: "100%", fontSize: 11, background: "transparent", border: "none", outline: "none", color: "#5b21b6", fontStyle: "italic", resize: "none", overflow: "hidden", height: "auto" }}
              onInput={e => {
                // Auto-grows input area height naturally downward
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
            />
          )}
        </div>
      </td>
    </tr>
  ))}
</tbody>
          </table>
        </div>

        {clAuditEntries.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 bg-[#f9fafb]">
            <p className="text-[10px] font-bold text-[#6B8A78] uppercase mb-2">Checklist Activity History</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {[...clAuditEntries].reverse().map(a => (
                <div key={a.id} className="flex text-[10px] gap-2 py-0.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-400 font-mono">{fmtDT(a.timestamp)}</span>
                  <span className="font-bold text-[#1A2E24]">{a.action}</span>
                  <span className="text-gray-500">by {a.userName} — {a.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSubmitModal && <SubmitApprovalModal cl={cl} onConfirm={handleSubmitConfirm} onClose={() => setShowSubmitModal(false)} />}
      {approvalModal && <ApprovalActionModal checklist={cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={() => setApprovalModal(null)} />}
      {showCalModal && <CalendarModal cl={cl} calViewDate={calViewDate} setCalViewDate={setCalViewDate} calSelected={calSelected} setCalSelected={setCalSelected} onClose={() => setShowCalModal(false)} onOpen={openCalDate} />}
      {paperModal && <PaperSizeModal action={paperModal.action} cl={cl} auditLog={clAuditEntries} onClose={() => setPaperModal(null)} />}
    </main>
  );
}