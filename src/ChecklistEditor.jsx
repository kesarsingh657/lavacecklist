import React, { useState, useEffect, useRef } from "react";
import { STATUS } from "./constants";
import { PERM, now, validateFillColumns } from "./helpers";
import { WorkflowStepper } from "./StatusPill";
import FillField from "./FillField";
import SubmitApprovalModal from "./SubmitApprovalModal";
import ApprovalActionModal from "./ApprovalActionModal";
import PaperSizeModal from "./PaperSizeModal";

export default function ChecklistEditor({ cl: initialCl, viewMode, user, auditLog, onSaveClose, onBack, showToast, addAudit, addNotif, setChecklists, bookmarks, setBookmarks }) {
  
  // 🟢 CORE COMPLIANCE TIMELINE RESOLVERS
  const getTodayString = () => new Date().toISOString().split("T")[0];
  const getCurrentMonthString = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date(); return `${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const isRecurring = ["Daily", "Weekly", "Monthly"].includes(initialCl.frequency);

  // Dual Matrix Unified State State Engine
  const [cl, setCl] = useState(() => {
    const c = { ...initialCl };

    // MODE A: Recurring Chronological Interface Map Framework
    if (isRecurring && !c.horizontalStructure) {
      const freq = c.frequency || "Daily";
      const generatedDates = [];
      const baseDate = c.createdAt ? new Date(c.createdAt) : new Date();
      const currentYear = baseDate.getFullYear();
      const currentMonth = baseDate.getMonth();

      if (freq === "Daily") {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          generatedDates.push(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
        }
      } else if (freq === "Weekly") {
        const rollingDate = new Date(baseDate);
        for (let w = 0; w < 16; w++) {
          generatedDates.push(rollingDate.toISOString().split("T")[0]);
          rollingDate.setDate(rollingDate.getDate() + 7);
        }
      } else if (freq === "Monthly") {
        const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        monthsList.forEach(m => generatedDates.push(`${m}-${currentYear}`));
      }

      const initialCPCols = [
        { id: "col-1", text: "Checkpoint Name" },
        { id: "col-2", text: "Specification Target" },
        { id: "col-3", text: "Control Method" },
        { id: "col-4", text: "Equipment Ref" }
      ];

      const initialRowCount = parseInt(c.rows, 10) || 5;
      const initialRows = Array.from({ length: initialRowCount }, () => ({
        id: `row-${Math.random().toString(36).slice(2, 7)}`,
        metaValues: {}
      }));

      c.horizontalStructure = {
        checkpointColumns: initialCPCols,
        rows: initialRows,
        dates: generatedDates,
        matrixData: {},
        remarksData: {}
      };
    } 
    
    // MODE B: Standalone Baseline Setup (One Time Checklist Layout Restore)
    else if (!isRecurring && !c.tableData) {
      const rows = parseInt(c.rows, 10) || 5, cols = parseInt(c.cols, 10) || 4;
      c.tableData = {
        headers: Array.from({ length: cols }, (_, i) => ({ text: `Checkpoint ${i + 1}`, isFill: false })),
        rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: "" }))),
      };
    }
    return c;
  });

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [approvalModal, setApprovalModal] = useState(null);
  const [paperModal, setPaperModal] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("Up to date");
  const saveTimeoutRef = useRef(null);

  const isView = viewMode;
  const editable = !isView && PERM.canEdit(cl, user);

  const canFin    = !isView && PERM.canFinalize(cl, user);
  const canSub    = !isView && PERM.canSubmit(cl, user);
  const canCancel = !isView && PERM.canCancelSubmit(cl, user);
  const canAR     = !isView && PERM.canApproveReject(cl, user);

  // 🟢 CHROMATIC RECURRING TIMELINE AUTO-LOCK VALS
  function getTimelineLockContext(dateHeaderStr) {
    if (!isRecurring) return { type: "present", editable: true };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    if (cl.frequency === "Monthly") {
      const monthsShorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [mName, yStr] = dateHeaderStr.split("-");
      const targetMonthIdx = monthsShorts.indexOf(mName);
      const targetYear = parseInt(yStr, 10);
      const currentMonthIdx = today.getMonth();

      if (targetYear < currentYear || (targetYear === currentYear && targetMonthIdx < currentMonthIdx)) return { type: "past", editable: false };
      if (targetYear === currentYear && targetMonthIdx === currentMonthIdx) return { type: "present", editable: true };
      return { type: "future", editable: false };
    }

    const targetDate = new Date(dateHeaderStr + "T00:00:00");
    if (cl.frequency === "Weekly") {
      const nextWeekLimit = new Date(targetDate); nextWeekLimit.setDate(nextWeekLimit.getDate() + 7);
      if (today >= targetDate && today < nextWeekLimit) return { type: "present", editable: true };
      if (today < targetDate) return { type: "future", editable: false };
      return { type: "past", editable: false };
    }

    if (targetDate.getTime() === today.getTime()) return { type: "present", editable: true };
    if (targetDate < today) return { type: "past", editable: false };
    return { type: "future", editable: false };
  }

  // Auto-Save Workspace state mutations throttling loop
  useEffect(() => {
    if (!editable) return;
    setAutoSaveStatus("Saving changes...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      persist({ ...cl, updatedAt: now() });
      setAutoSaveStatus("🟢 Saved to workspace core");
    }, 1500);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [cl.horizontalStructure, cl.tableData]);

  function persist(updated) {
    setChecklists(prev => {
      const idx = prev.findIndex(l => l.id === updated.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
  }

  // 🟢 OPERATIONS DATA HANDLERS - SHARED AXIS MODIFIERS
  // Mode A Handlers (Recurring Multi-Axis Grid)
  function addHRow() { const nextRows = [...cl.horizontalStructure.rows, { id: `row-${Math.random().toString(36).slice(2, 7)}`, metaValues: {} }]; setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows: nextRows } })); }
  function removeHRow() { if (cl.horizontalStructure.rows.length <= 1) return; setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows: p.horizontalStructure.rows.slice(0, -1) } })); }
  function addLeftHeadingCol() { const nextCols = [...cl.horizontalStructure.checkpointColumns, { id: `col-${Math.random().toString(36).slice(2, 7)}`, text: `Header ${cl.horizontalStructure.checkpointColumns.length + 1}` }]; setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: nextCols } })); }
  function removeLeftHeadingCol() { if (cl.horizontalStructure.checkpointColumns.length <= 1) return; setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: p.horizontalStructure.checkpointColumns.slice(0, -1) } })); }
  function updateLeftMetaVal(rowId, colId, txt) { const nextRows = cl.horizontalStructure.rows.map(r => r.id === rowId ? { ...r, metaValues: { ...r.metaValues, [colId]: txt } } : r); setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows: nextRows } })); }
  function updateLeftHeaderLabel(colId, txt) { const nextCols = cl.horizontalStructure.checkpointColumns.map(c => c.id === colId ? { ...c, text: txt } : c); setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: nextCols } })); }
  function updateMatrixDataCell(rowId, dStr, val) { setCl(p => { const nextM = { ...p.horizontalStructure.matrixData }; if (!nextM[rowId]) nextM[rowId] = {}; nextM[rowId][dStr] = val; return { ...p, horizontalStructure: { ...p.horizontalStructure, matrixData: nextM } }; }); }
  function updateHRowRemark(rowId, val) { setCl(p => { const nextR = { ...p.horizontalStructure.remarksData }; nextR[rowId] = val; return { ...p, horizontalStructure: { ...p.horizontalStructure, remarksData: nextR } }; }); }

  // Mode B Handlers (One-Time Static Forms)
  function updateCellValue(ri, ci, val) { setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row, r) => r === ri ? row.map((cell, c) => c === ci ? { ...cell, value: val } : cell) : row) } })); }
  function updateHeader(ci, text) { setCl(p => ({ ...p, tableData: { ...p.tableData, headers: p.tableData.headers.map((h, i) => i === ci ? { ...h, text } : h) } })); }
  function addRow() { setCl(p => { const cols = p.tableData.headers.length; return { ...p, tableData: { ...p.tableData, rows: [...p.tableData.rows, Array.from({ length: cols }, () => ({ value: "" }))] } }; }); }
  function removeRow() { setCl(p => { if (p.tableData.rows.length <= 1) return p; return { ...p, tableData: { ...p.tableData, rows: p.tableData.rows.slice(0, -1) } }; }); }
  function addCheckpointCol() { setCl(p => { const count = p.tableData.headers.filter(h => !h.isFill).length; const newH = [...p.tableData.headers]; const at = newH.findIndex(h => h.isFill); const idx = at === -1 ? newH.length : at; newH.splice(idx, 0, { text: `Checkpoint ${count + 1}`, isFill: false }); return { ...p, tableData: { headers: newH, rows: p.tableData.rows.map(r => { const n = [...r]; n.splice(idx, 0, { value: "" }); return n; }) } }; }); }
  function removeCheckpointCol() { setCl(p => { const idx = p.tableData.headers.map((h, i) => ({ h, i })).filter(x => !x.h.isFill).map(x => x.i); if (!idx.length) return p; const last = idx[idx.length - 1]; return { ...p, tableData: { headers: p.tableData.headers.filter((_, i) => i !== last), rows: p.tableData.rows.map(r => r.filter((_, i) => i !== last)) } }; }); }
  function addFillCol() { setCl(p => { const count = p.tableData.headers.filter(h => h.isFill).length; return { ...p, tableData: { headers: [...p.tableData.headers, { text: `Fill ${count + 1}`, isFill: true }], rows: p.tableData.rows.map(r => [...r, { value: "" }]) } }; }); }
  function removeFillCol() { setCl(p => { const idx = p.tableData.headers.map((h, i) => ({ h, i })).filter(x => x.h.isFill).map(x => x.i); if (!idx.length) return p; const last = idx[idx.length - 1]; return { ...p, tableData: { headers: p.tableData.headers.filter((_, i) => i !== last), rows: p.tableData.rows.map(r => r.filter((_, i) => i !== last)) } }; }); }
  function updateRowRemark(ri, val) { setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row, r) => r === ri ? row.map((cell, ci) => ci === 0 ? { ...cell, remark: val } : cell) : row) } })); }

  function saveManual(goBack) {
    persist({ ...cl, updatedAt: now() });
    if (goBack) { showToast("Saved into database core!"); setTimeout(onSaveClose, 300); } else showToast("Saved OK");
  }

  function handleFinalize() {
    const ts = now();
    const updated = { ...cl, status: STATUS.FINALIZED, finalizedAt: ts, updatedAt: ts };
    persist(updated); setCl(updated);
    addAudit && addAudit(cl.id, "Finalized", user, `"${cl.name}" finalized`, cl.name);
    showToast("Checklist finalized.");
  }

  function handleSubmitConfirm(obj) {
    const ts = now();
    const updated = { ...cl, status: STATUS.SUBMITTED, submittedAt: ts, updatedAt: ts, approverName: obj.approverName, approverEmail: obj.approverEmail, submissionRemarks: obj.remarks };
    persist(updated); setCl(updated);
    addAudit && addAudit(cl.id, "Submitted", user, `"${cl.name}" submitted to ${obj.approverName}`, cl.name);
    addNotif && addNotif({ msg: `📤 "${cl.name}" submitted by ${user.name} to ${obj.approverName}`, time: ts, read: false });
    setShowSubmitModal(false);
    setTimeout(onSaveClose, 300);
  }

  function handleCancelSubmission() {
    const updated = { ...cl, status: STATUS.DRAFT, submittedAt: null, finalizedAt: null, updatedAt: now() };
    persist(updated); setCl(updated);
    addAudit && addAudit(cl.id, "Submission Cancelled", user, `"${cl.name}" submission cancelled`, cl.name);
    showToast("Returned to Draft");
  }

  function handleApprovalConfirm({ remarks, reason }) {
    const { type } = approvalModal;
    const isApprove = type === "approve";
    const ts = now();
    const updated = { ...cl, status: isApprove ? "approved" : "rejected", approvalRemarks: remarks, rejectionReason: isApprove ? undefined : reason, approvedAt: isApprove ? ts : undefined, rejectedAt: isApprove ? undefined : ts, approvedBy: isApprove ? user.name : undefined, rejectedBy: isApprove ? undefined : user.name, updatedAt: ts };
    persist(updated); setCl(updated);
    addAudit && addAudit(cl.id, isApprove ? "Approved" : "Rejected", user, isApprove ? `Approved. Remarks: ${remarks}` : `Rejected. Reason: ${reason}. Remarks: ${remarks}`, cl.name);
    addNotif && addNotif({ msg: isApprove ? `✅ "${cl.name}" approved by ${user.name}` : `❌ "${cl.name}" rejected. Reason: ${reason}`, time: ts, read: false });
    setApprovalModal(null);
    setTimeout(onSaveClose, 300);
  }

  const clAuditEntries = (auditLog || []).filter(a => a.checklistId === cl.id);

  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">{cl.name}</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
            Active Frequency Routing: <span className="text-[#3D8B6E] font-bold uppercase">{cl.frequency || "One Time"}</span> · {autoSaveStatus}
          </p>
        </div>
        <WorkflowStepper status={cl.status} />
      </div>

      {/* DYNAMIC ACTION BUTTON TOOLBARS ACCORDING TO FREQUENCY TYPE ROUTERS */}
      <div className="action-bar flex flex-wrap items-center gap-2 mb-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <button onClick={onBack} className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-semibold">Back</button>
        
        {editable && (
          <>
            <div className="h-4 w-[1px] bg-gray-200 mx-1" />
            {isRecurring ? (
              // Mode A Toolbars: Recurring Timeline Multi Axis Controllers
              <>
                <button onClick={addHRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-bold">➕ Add Row</button>
                <button onClick={removeHRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">➖ Remove Row</button>
                <button onClick={addLeftHeadingCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">➕ Add Left Heading Column</button>
                <button onClick={removeLeftHeadingCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">➖ Remove Left Col</button>
              </>
            ) : (
              // Mode B Toolbars: One-Time Checklist Form Operators (Restored Screenshot 6 elements as requested)
              <>
                <button onClick={addRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-bold">+ Row</button>
                <button onClick={removeRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Row</button>
                <button onClick={addCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">+ Col</button>
                <button onClick={removeCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Col</button>
                <button onClick={addFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1e5c42] text-white font-bold">+ Fill</button>
                <button onClick={removeFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Fill</button>
              </>
            )}
            <button onClick={() => {
                const isBookmarked = bookmarks?.some(b => b.id === cl.id);
                if (isBookmarked) { setBookmarks(prev => prev.filter(b => b.id !== cl.id)); showToast("Bookmark removed"); }
                else { setBookmarks(prev => [...prev, { ...cl }]); showToast("🔖 Bookmarked!"); }
              }} className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold ml-auto flex items-center gap-1 ${bookmarks?.some(b => b.id === cl.id) ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500"}`}>
              {bookmarks?.some(b => b.id === cl.id) ? "🔖 Bookmarked" : "🔖 Bookmark"}
            </button>
            <button onClick={() => saveManual(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#3D8B6E] text-white font-bold">Save & Close</button>
          </>
        )}

        <div className={`${editable ? "" : "ml-auto"} flex items-center gap-2 flex-wrap`}>
          {canFin    && <button onClick={handleFinalize} className="text-[10px] px-3 py-1.5 rounded-lg text-white font-bold bg-amber-500 shadow-sm">Finalize</button>}
          {canSub    && <button onClick={() => { if (!isRecurring) { const missing = validateFillColumns(cl.tableData); if (missing.length > 0) { alert("Missing required fields:\n" + missing.join("\n")); return; } } setShowSubmitModal(true); }} className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold">Submit</button>}
          {canCancel && <button onClick={handleCancelSubmission} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold">Cancel Submission</button>}
          {canAR && (
            <>
              <button onClick={() => setApprovalModal({ type: "approve" })} className="text-[10px] px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold">Approve</button>
              <button onClick={() => setApprovalModal({ type: "reject"  })} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-600   text-white font-bold">Reject</button>
            </>
          )}
          {PERM.canPrint(cl)  && <button onClick={() => setPaperModal({ action: "print"  })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-800 font-semibold">🖨️ Print</button>}
          {PERM.canExport(cl) && <button onClick={() => setPaperModal({ action: "export" })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-800 font-semibold">📄 Export PDF</button>}
        </div>
      </div>

      {/* RENDERING SCREEN MATRIX VIEWS SEGMENTS BLOCKS */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
          
          {isRecurring ? (
            // 📊 GRID VIEW A: AUTOMATED RECURRING TIMELINE MATRIX SHEET
            <table style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ background: "#4B9B7A", color: "white", padding: "6px 8px", fontSize: 10, width: "38px", textAlign: "center", position: "sticky", top: 0, left: 0, zIndex: 40 }}>#</th>
                  {cl.horizontalStructure.checkpointColumns.map((col, cIdx) => {
                    const leftOffset = 38 + cIdx * 140;
                    return (
                      <th key={col.id} style={{ background: "#3D8B6E", color: "white", padding: "6px 8px", fontSize: 10, width: "140px", position: "sticky", top: 0, left: `${leftOffset}px`, zIndex: 40 }}>
                        {!editable ? col.text : (
                          <span contentEditable suppressContentEditableWarning onBlur={e => updateLeftHeaderLabel(col.id, e.target.innerText)} style={{ display: "block", outline: "none" }}>{col.text}</span>
                        )}
                      </th>
                    );
                  })}
                  {cl.horizontalStructure.dates.map(dStr => {
                    const lockCtx = getTimelineLockContext(dStr);
                    let badgeColors = "bg-gray-100 text-gray-700 border-gray-300";
                    if (lockCtx.type === "present") badgeColors = "bg-yellow-400 text-gray-900 font-black ring-2 ring-yellow-600 animate-pulse";
                    if (lockCtx.type === "past") badgeColors = "bg-red-600 text-white font-semibold border-red-700";
                    if (lockCtx.type === "future") badgeColors = "bg-blue-600 text-white font-semibold border-blue-700";

                    return (
                      <th key={dStr} style={{ padding: "5px 6px", width: "110px", textAlign: "center", position: "sticky", top: 0, zIndex: 10 }} className="bg-gray-50">
                        <div className={`text-[10px] px-2.5 py-1 rounded font-mono border ${badgeColors}`}>{dStr}</div>
                      </th>
                    );
                  })}
                  <th style={{ background: "#4a3a6b", color: "white", padding: "6px 8px", fontSize: 10, width: "160px", position: "sticky", top: 0, zIndex: 10 }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {cl.horizontalStructure.rows.map((row, rIdx) => (
                  <tr key={row.id}>
                    <td style={{ background: "#e5e7eb", color: "#6b7280", fontWeight: 700, padding: "6px", fontSize: 10, textAlign: "center", position: "sticky", left: 0, zIndex: 20 }}>{rIdx + 1}</td>
                    {cl.horizontalStructure.checkpointColumns.map((col, cIdx) => {
                      const leftOffset = 38 + cIdx * 140;
                      const cellVal = row.metaValues[col.id] || "";
                      return (
                        <td key={col.id} style={{ background: "#f9fafb", padding: "6px 8px", fontSize: 10, fontWeight: 600, position: "sticky", left: `${leftOffset}px`, zIndex: 20 }}>
                          {!editable ? (
                            <div className="break-all whitespace-pre-wrap">{cellVal || "—"}</div>
                          ) : (
                            <span contentEditable suppressContentEditableWarning
                              onKeyDown={e => {
                                const txt = e.target.innerText || "";
                                if (txt.length >= 250 && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault();
                              }}
                              onBlur={e => {
                                let val = e.target.innerText || "";
                                if (val.length > 250) { val = val.substring(0, 250); e.target.innerText = val; }
                                updateLeftMetaVal(row.id, col.id, val);
                              }}
                              style={{ display: "block", outline: "none", width: "100%", minHeight: "18px" }}>{cellVal}</span>
                          )}
                        </td>
                      );
                    })}
                    {cl.horizontalStructure.dates.map(dStr => {
                      const lockCtx = getTimelineLockContext(dStr);
                      const currentInputCellVal = cl.horizontalStructure.matrixData[row.id]?.[dStr] || "";
                      const elementDisabled = !lockCtx.editable || isView;

                      let cellBgStyle = "bg-white";
                      if (lockCtx.type === "past") cellBgStyle = "bg-red-100/70 text-red-900 font-bold";
                      if (lockCtx.type === "future") cellBgStyle = "bg-blue-100/50 text-blue-900 pointer-events-none";
                      if (lockCtx.type === "present" && !elementDisabled) cellBgStyle = "bg-yellow-50/40 border-yellow-200";

                      return (
                        <td key={dStr} className={`p-2 transition-all ${cellBgStyle}`} style={{ verticalAlign: "middle" }}>
                          <div className={elementDisabled ? "opacity-80 select-none" : ""}>
                            <FillField type={cl.fillType} opts={cl.customOptions} value={currentInputCellVal} onChange={v => updateMatrixDataCell(row.id, dStr, v)} disabled={elementDisabled} />
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "6px", background: "#faf5ff", verticalAlign: "top", cursor: "text" }} onClick={e => e.currentTarget.querySelector("textarea")?.focus()}>
                      <textarea value={cl.horizontalStructure.remarksData[row.id] || ""} disabled={isView} maxLength={100} onChange={e => updateHRowRemark(row.id, e.target.value)} placeholder="Add notes..." rows={2} style={{ minHeight: "36px", height: "auto", overflowY: "visible" }} className="w-full text-xs bg-transparent border-none outline-none text-[#5b21b6] italic resize-none leading-relaxed cursor-text" />
                      {!isView && <div className="text-[8px] text-right text-purple-300 font-mono">{(cl.horizontalStructure.remarksData[row.id] || "").length}/100</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // 📊 GRID VIEW B: ORIGINAL ONE-TIME STATIC FORM SHEETS Restored
            <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ background: "#4B9B7A", color: "white", padding: "6px 8px", fontSize: 10, width: "38px", textAlign: "center", position: "sticky", top: 0, zIndex: 10 }}>#</th>
                  {cl.tableData.headers.map((h, ci) => (
                    <th key={ci} style={{ background: h.isFill ? "#1e5c42" : "#3D8B6E", color: "white", padding: "6px 8px", fontSize: 10, fontWeight: 600, width: h.isFill ? "110px" : "160px", position: "sticky", top: 0, zIndex: 10 }}>
                      {!editable ? h.text : (<span contentEditable suppressContentEditableWarning onBlur={e => updateHeader(ci, e.target.innerText)} style={{ display: "block", outline: "none" }}>{h.text}</span>)}
                    </th>
                  ))}
                  <th style={{ background: "#4a3a6b", color: "white", padding: "6px 8px", fontSize: 10, fontWeight: 600, width: "160px", position: "sticky", top: 0, zIndex: 10 }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {cl.tableData.rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50/40">
                    <td style={{ background: "#e5e7eb", color: "#6b7280", fontWeight: 700, padding: "6px", fontSize: 10, textAlign: "center" }}>{ri + 1}</td>
                    {row.map((cell, ci) => {
                      const isFill = cl.tableData.headers[ci]?.isFill;
                      return isFill ? (
                        <td key={ci} style={{ padding: "6px" }} className={!editable ? "bg-gray-100/50" : "bg-amber-50/30"}>
                          <FillField type={cl.fillType} opts={cl.customOptions} value={cell.value} onChange={v => updateCellValue(ri, ci, v)} disabled={!editable} />
                        </td>
                      ) : (
                        <td key={ci} style={{ padding: "6px 8px", fontSize: 10 }} className="wrap-text">
                          {!editable ? (
                            <div>{cell.value || "—"}</div>
                          ) : (
                            <span contentEditable suppressContentEditableWarning
                              onKeyDown={e => {
                                const txt = e.target.innerText || "";
                                if (txt.length >= 250 && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault();
                              }}
                              onBlur={e => {
                                let val = e.target.innerText || "";
                                if (val.length > 250) { val = val.substring(0, 250); e.target.innerText = val; }
                                updateCellValue(ri, ci, val);
                              }}
                              style={{ display: "block", outline: "none", width: "100%", minHeight: "20px" }}>{cell.value}</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: "6px", background: "#fbf8ff", verticalAlign: "top", cursor: "text" }} onClick={e => e.currentTarget.querySelector("textarea")?.focus()}>
                      {!editable ? (
                        <span style={{ fontSize: 10, color: "#5b21b6", fontStyle: "italic" }}>{row[0]?.remark || ""}</span>
                      ) : (
                        <>
                          <textarea value={row[0]?.remark || ""} maxLength={100} onChange={e => updateRowRemark(ri, e.target.value)} placeholder="Add notes..." rows={2} style={{ minHeight: "36px", height: "auto", overflowY: "visible" }} className="w-full text-xs bg-transparent border-none outline-none text-[#5b21b6] font-normal italic resize-none leading-relaxed cursor-text" />
                          <div className="text-[8px] text-right text-purple-300 font-mono">{(row[0]?.remark || "").length}/100</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>

      {showSubmitModal && <SubmitApprovalModal cl={cl} onConfirm={handleSubmitConfirm} onClose={() => setShowSubmitModal(false)} />}
      {approvalModal   && <ApprovalActionModal checklist={cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={() => setApprovalModal(null)} />}
      {paperModal      && <PaperSizeModal action={paperModal.action} cl={cl} auditLog={clAuditEntries} onClose={() => setPaperModal(null)} />}
    </main>
  );
}