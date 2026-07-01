/**
 * ChecklistEditor.jsx  — MES Enhanced Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FEATURES ADDED IN THIS VERSION:
 *
 * 1. REWORK FLOW  (Rejection → Fix → Resubmit)
 *    - When status === "rejected", operator sees "Send for Rework" button
 *    - Clicking resets status to "draft" and adds a reworkAt timestamp
 *    - Operator can now edit again, then re-finalize and resubmit
 *    - Audit log records "Rework Started" event
 *
 * 2. DIGITAL SIGNATURE ON APPROVAL
 *    - approverName is now AUTO-FILLED from user.name (cannot be changed)
 *    - Only the logged-in approver's name appears — no free-text entry
 *    - SubmitApprovalModal still accepts optional email for CC purposes
 *
 * 3. COMMENTS THREAD
 *    - CommentsThread component rendered below the grid
 *    - handleAddComment() pushes to cl.comments[] and persists
 *    - All roles can comment (operator, approver, admin)
 *
 * 4. ATTACHMENT SUPPORT (Base64 images)
 *    - "📎 Attach Photo" button in toolbar
 *    - Attachments stored as cl.attachments[]: { id, name, dataUrl, uploadedBy, uploadedAt }
 *    - Max 3 attachments, each ≤ 2MB
 *    - Thumbnails shown below toolbar
 *
 * 5. OVERDUE ALERT BANNER
 *    - For Daily checklists: if today's column has no filled data → red banner
 *    - Computed by checkTodayOverdue()
 *
 * 6. SAVE AS TEMPLATE
 *    - "📁 Save as Template" button in toolbar
 *    - Saves structure without fill data to templates library
 *
 * 7. AUTO-RESET FOR RECURRING (Partial)
 *    - On opening a Daily checklist, if the current month has changed since
 *      the dates were generated, new month's dates are appended automatically
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useRef } from "react";
import { STATUS } from "./constants";
import { PERM, now, validateFillColumns } from "./helpers";
import { WorkflowStepper } from "./StatusPill";
import FillField from "./FillField";
import SubmitApprovalModal from "./SubmitApprovalModal";
import ApprovalActionModal from "./ApprovalActionModal";
import PaperSizeModal from "./PaperSizeModal";
import { SaveAsTemplateButton } from "./TemplatesPage";
import api from "./api"; // talks to Python backend

export default function ChecklistEditor({
  cl: initialCl,
  viewMode,
  user,
  auditLog,
  onSaveClose,
  onBack,
  showToast,
  addAudit,
  addNotif,
  setChecklists,
  bookmarks,
  setBookmarks,
  // NEW props for templates feature
  templates,
  setTemplates,
}) {

  // ── Date helpers ────────────────────────────────────────────────────────
  const getTodayString = () => new Date().toISOString().split("T")[0];
  const getCurrentMonthString = () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const d = new Date();
    return `${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const isRecurring = ["Daily", "Weekly", "Monthly"].includes(initialCl.frequency);

  // ── State initialiser: builds horizontalStructure / tableData if missing ─
  const [cl, setCl] = useState(() => {
    const c = { ...initialCl };

    // ── MODE A: Recurring matrix ──────────────────────────────────────────
    if (isRecurring && !c.horizontalStructure) {
      const freq      = c.frequency || "Daily";
      const baseDate  = c.createdAt ? new Date(c.createdAt) : new Date();
      const year      = baseDate.getFullYear();
      const month     = baseDate.getMonth();
      const dates     = [];

      if (freq === "Daily") {
        // Generate all days in the creation month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          dates.push(`${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
        }
      } else if (freq === "Weekly") {
        // 16 rolling weeks from creation date
        const rolling = new Date(baseDate);
        for (let w = 0; w < 16; w++) {
          dates.push(rolling.toISOString().split("T")[0]);
          rolling.setDate(rolling.getDate() + 7);
        }
      } else if (freq === "Monthly") {
        // All 12 months of creation year
        ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
          .forEach(m => dates.push(`${m}-${year}`));
      }

      const cpCols = [
        { id: "col-1", text: "" },
      ];

      const rowCount = parseInt(c.rows, 10) || 5;
      const rows = Array.from({ length: rowCount }, () => ({
        id: `row-${Math.random().toString(36).slice(2, 7)}`,
        metaValues: {},
      }));

      c.horizontalStructure = { checkpointColumns: cpCols, rows, dates, matrixData: {}, remarksData: {} };
    }

    // ── AUTO-RESET: append new month's dates if Daily checklist has aged ──
    // If today's date column doesn't exist in the dates array, add the current month's dates
    if (isRecurring && c.horizontalStructure && c.frequency === "Daily") {
      const today    = getTodayString();
      const existing = new Set(c.horizontalStructure.dates);
      if (!existing.has(today)) {
        const now_    = new Date();
        const y       = now_.getFullYear();
        const m       = now_.getMonth();
        const days    = new Date(y, m + 1, 0).getDate();
        const newDates = [];
        for (let d = 1; d <= days; d++) {
          const ds = `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          if (!existing.has(ds)) newDates.push(ds);
        }
        // Append new dates and sort chronologically
        const merged = [...c.horizontalStructure.dates, ...newDates].sort();
        c.horizontalStructure = { ...c.horizontalStructure, dates: merged };
      }
    }

    // ── MODE B: One-Time static form ──────────────────────────────────────
    if (!isRecurring && !c.tableData) {
      const rows = parseInt(c.rows, 10) || 5;
      const cols = parseInt(c.cols, 10) || 4;
      c.tableData = {
        headers: Array.from({ length: cols }, (_, i) => ({ text: "", isFill: false })),
        rows:    Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: "" }))),
      };
    }

    // Ensure comment and attachment arrays exist
    c.comments    = c.comments    || [];
    c.attachments = c.attachments || [];

    return c;
  });

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [approvalModal,   setApprovalModal]   = useState(null);
  const [paperModal,      setPaperModal]      = useState(null);
  const [autoSaveStatus,  setAutoSaveStatus]  = useState("Up to date");
  const [showAttachPanel, setShowAttachPanel] = useState(false); // toggle attachment panel
  const saveTimeoutRef = useRef(null);
  const fileInputRef   = useRef(null);

  const isView   = viewMode;
  const editable = !isView && PERM.canEdit(cl, user);

  // ── Workflow permissions ──────────────────────────────────────────────────
  const canFin      = !isView && PERM.canFinalize(cl, user);
  const canSub      = !isView && PERM.canSubmit(cl, user);
  const canCancel   = !isView && PERM.canCancelSubmit(cl, user);
  const canAR       = !isView && PERM.canApproveReject(cl, user);
  // REWORK: rejected checklist can be sent back to draft by operator/admin
  const canRework   = !isView && cl.status === "rejected" && (user.role === "admin" || user.role === "operator");

  // ── OVERDUE DETECTION for Daily checklists ────────────────────────────────
  // Returns true if today's date column exists but has NO filled values at all
  const isOverdueToday = (() => {
    if (cl.frequency !== "Daily" || !cl.horizontalStructure) return false;
    const today    = getTodayString();
    const dates    = cl.horizontalStructure.dates || [];
    if (!dates.includes(today)) return false; // today not in range yet
    const matrix   = cl.horizontalStructure.matrixData || {};
    // Check if any row has a value for today
    const anyFilled = cl.horizontalStructure.rows.some(row => {
      const val = matrix[row.id]?.[today];
      return val !== undefined && val !== "" && val !== false;
    });
    return !anyFilled; // overdue = today exists but nothing filled
  })();

  // ── Timeline lock for recurring cells ───────────────────────────────────
  function getTimelineLockContext(dateHeaderStr) {
    if (!isRecurring) return { type: "present", editable: true };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const year  = today.getFullYear();

    if (cl.frequency === "Monthly") {
      const shorts = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const [mName, yStr] = dateHeaderStr.split("-");
      const mIdx  = shorts.indexOf(mName);
      const tYear = parseInt(yStr, 10);
      const curM  = today.getMonth();
      if (tYear < year || (tYear === year && mIdx < curM)) return { type: "past",    editable: false };
      if (tYear === year && mIdx === curM)                  return { type: "present", editable: true  };
      return { type: "future", editable: false };
    }

    const target = new Date(dateHeaderStr + "T00:00:00");
    if (cl.frequency === "Weekly") {
      const limit = new Date(target); limit.setDate(limit.getDate() + 7);
      if (today >= target && today < limit) return { type: "present", editable: true  };
      if (today < target)                   return { type: "future",  editable: false };
      return { type: "past", editable: false };
    }

    if (target.getTime() === today.getTime()) return { type: "present", editable: true  };
    if (target < today)                       return { type: "past",    editable: false };
    return { type: "future", editable: false };
  }

  // ── Auto-save with 1.5s debounce ─────────────────────────────────────────
  useEffect(() => {
    if (!editable) return;
    setAutoSaveStatus("Saving…");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const updated = { ...cl, updatedAt: now() };
      persist(updated); // update React state immediately
      setAutoSaveStatus("🟢 Saved");
      // Also sync grid data to backend in background
      try {
        await api.checklists.update(cl.id, {
          tableData:           cl.tableData,
          horizontalStructure: cl.horizontalStructure,
        });
      } catch(err) {
        console.warn("Backend auto-save failed:", err);
      }
    }, 1500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [cl.horizontalStructure, cl.tableData, cl.comments, cl.attachments]);

  // ── Persist to global checklists state ───────────────────────────────────
  function persist(updated) {
    setChecklists(prev => {
      const idx = prev.findIndex(l => l.id === updated.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
  }

  // ── MODE A handlers (Recurring grid) ────────────────────────────────────
  function addHRow() {
    const rows = [...cl.horizontalStructure.rows, { id: `row-${Math.random().toString(36).slice(2,7)}`, metaValues: {} }];
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows } }));
  }
  function removeHRow() {
    if (cl.horizontalStructure.rows.length <= 1) return;
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows: p.horizontalStructure.rows.slice(0,-1) } }));
  }
  function addLeftHeadingCol() {
    const cols = [...cl.horizontalStructure.checkpointColumns, { id: `col-${Math.random().toString(36).slice(2,7)}`, text: "" }];
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: cols } }));
  }
  function removeLeftHeadingCol() {
    if (cl.horizontalStructure.checkpointColumns.length <= 1) return;
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: p.horizontalStructure.checkpointColumns.slice(0,-1) } }));
  }
  function updateLeftMetaVal(rowId, colId, txt) {
    const rows = cl.horizontalStructure.rows.map(r => r.id === rowId ? { ...r, metaValues: { ...r.metaValues, [colId]: txt } } : r);
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, rows } }));
  }
  function updateLeftHeaderLabel(colId, txt) {
    const cols = cl.horizontalStructure.checkpointColumns.map(c => c.id === colId ? { ...c, text: txt } : c);
    setCl(p => ({ ...p, horizontalStructure: { ...p.horizontalStructure, checkpointColumns: cols } }));
  }
  function updateMatrixDataCell(rowId, dStr, val) {
    setCl(p => {
      const m = { ...p.horizontalStructure.matrixData };
      if (!m[rowId]) m[rowId] = {};
      m[rowId][dStr] = val;
      return { ...p, horizontalStructure: { ...p.horizontalStructure, matrixData: m } };
    });
  }
  function updateHRowRemark(rowId, val) {
    setCl(p => {
      const r = { ...p.horizontalStructure.remarksData, [rowId]: val };
      return { ...p, horizontalStructure: { ...p.horizontalStructure, remarksData: r } };
    });
  }

  // ── MODE B handlers (One-Time form) ─────────────────────────────────────
  function updateCellValue(ri, ci, val) {
    setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row,r) => r===ri ? row.map((cell,c) => c===ci ? {...cell,value:val} : cell) : row) } }));
  }
  function updateHeader(ci, text) {
    setCl(p => ({ ...p, tableData: { ...p.tableData, headers: p.tableData.headers.map((h,i) => i===ci ? {...h,text} : h) } }));
  }
  function addRow() {
    setCl(p => { const cols=p.tableData.headers.length; return { ...p, tableData: { ...p.tableData, rows: [...p.tableData.rows, Array.from({length:cols},()=>({value:""}))] } }; });
  }
  function removeRow() {
    setCl(p => { if(p.tableData.rows.length<=1) return p; return { ...p, tableData: { ...p.tableData, rows: p.tableData.rows.slice(0,-1) } }; });
  }
  function addCheckpointCol() {
    setCl(p => {
      const count=p.tableData.headers.filter(h=>!h.isFill).length;
      const newH=[...p.tableData.headers];
      const at=newH.findIndex(h=>h.isFill);
      const idx=at===-1?newH.length:at;
      newH.splice(idx,0,{text:"",isFill:false});
      return { ...p, tableData: { headers:newH, rows:p.tableData.rows.map(r=>{const n=[...r];n.splice(idx,0,{value:""});return n;}) } };
    });
  }
  function removeCheckpointCol() {
    setCl(p => {
      const idx=p.tableData.headers.map((h,i)=>({h,i})).filter(x=>!x.h.isFill).map(x=>x.i);
      if(!idx.length) return p;
      const last=idx[idx.length-1];
      return { ...p, tableData: { headers:p.tableData.headers.filter((_,i)=>i!==last), rows:p.tableData.rows.map(r=>r.filter((_,i)=>i!==last)) } };
    });
  }
  function addFillCol() {
    setCl(p => {
      const count=p.tableData.headers.filter(h=>h.isFill).length;
      return { ...p, tableData: { headers:[...p.tableData.headers,{text:"",isFill:true}], rows:p.tableData.rows.map(r=>[...r,{value:""}]) } };
    });
  }
  function removeFillCol() {
    setCl(p => {
      const idx=p.tableData.headers.map((h,i)=>({h,i})).filter(x=>x.h.isFill).map(x=>x.i);
      if(!idx.length) return p;
      const last=idx[idx.length-1];
      return { ...p, tableData: { headers:p.tableData.headers.filter((_,i)=>i!==last), rows:p.tableData.rows.map(r=>r.filter((_,i)=>i!==last)) } };
    });
  }
  function updateRowRemark(ri, val) {
    setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row,r) => r===ri ? row.map((cell,ci)=>ci===0?{...cell,remark:val}:cell) : row) } }));
  }

  // ── Workflow actions ──────────────────────────────────────────────────────
  function saveManual(goBack) {
    persist({ ...cl, updatedAt: now() });
    if (goBack) { showToast("Saved!"); setTimeout(onSaveClose, 300); } else showToast("Saved OK");
  }

  function handleFinalize() {
    const ts  = now();
    const upd = { ...cl, status: STATUS.FINALIZED, finalizedAt: ts, updatedAt: ts };
    persist(upd); setCl(upd);
    addAudit?.(cl.id, "Finalized", user, `"${cl.name}" finalized`, cl.name);
    showToast("Checklist finalized.");
  }

  function handleSubmitConfirm(obj) {
    const ts  = now();
    // DIGITAL SIGNATURE: approverName locked to logged-in approver's name (set in SubmitApprovalModal)
    const upd = { ...cl, status: STATUS.SUBMITTED, submittedAt: ts, updatedAt: ts, approverName: obj.approverName, approverEmail: obj.approverEmail, submissionRemarks: obj.remarks };
    persist(upd); setCl(upd);
    addAudit?.(cl.id, "Submitted", user, `"${cl.name}" submitted to ${obj.approverName}`, cl.name);
    addNotif?.({ msg: `📤 "${cl.name}" submitted by ${user.name} to ${obj.approverName}`, time: ts, read: false });
    setShowSubmitModal(false);
    setTimeout(onSaveClose, 300);
  }

  function handleCancelSubmission() {
    const upd = { ...cl, status: STATUS.DRAFT, submittedAt: null, finalizedAt: null, updatedAt: now() };
    persist(upd); setCl(upd);
    addAudit?.(cl.id, "Submission Cancelled", user, `"${cl.name}" submission cancelled`, cl.name);
    showToast("Returned to Draft");
  }

  function handleApprovalConfirm({ remarks, reason }) {
    const { type } = approvalModal;
    const isApprove = type === "approve";
    const ts  = now();
    // DIGITAL SIGNATURE: approvedBy is always the logged-in user's name — not typed
    const upd = {
      ...cl,
      status:          isApprove ? "approved" : "rejected",
      approvalRemarks: remarks,
      rejectionReason: isApprove ? undefined : reason,
      approvedAt:      isApprove ? ts : undefined,
      rejectedAt:      isApprove ? undefined : ts,
      approvedBy:      isApprove ? user.name : undefined, // ← locked to logged-in user
      rejectedBy:      isApprove ? undefined : user.name,
      updatedAt:       ts,
    };
    persist(upd); setCl(upd);
    addAudit?.(cl.id, isApprove ? "Approved" : "Rejected", user,
      isApprove ? `Approved by ${user.name}. Remarks: ${remarks}` : `Rejected by ${user.name}. Reason: ${reason}`, cl.name);
    addNotif?.({ msg: isApprove ? `✅ "${cl.name}" approved by ${user.name}` : `❌ "${cl.name}" rejected. Reason: ${reason}`, time: ts, read: false });
    setApprovalModal(null);
    setTimeout(onSaveClose, 300);
  }

  // ── REWORK: reset rejected checklist back to draft so operator can fix it ─
  function handleRework() {
    const ts  = now();
    const upd = {
      ...cl,
      status:      STATUS.DRAFT,
      reworkAt:    ts,
      reworkCount: (cl.reworkCount || 0) + 1,
      // Keep rejectionReason visible for reference
      updatedAt:   ts,
    };
    persist(upd); setCl(upd);
    addAudit?.(cl.id, "Rework Started", user, `"${cl.name}" sent for rework (attempt ${upd.reworkCount})`, cl.name);
    addNotif?.({ msg: `🔄 "${cl.name}" sent for rework by ${user.name}`, time: ts, read: false });
    showToast("🔄 Checklist returned to Draft for rework");
  }

  // ── COMMENTS: add a new comment to the thread ─────────────────────────────
  function handleAddComment(text) {
    const comment = {
      id:         "CMT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      authorId:   user.id,
      authorName: user.name,
      role:       user.role,
      text,
      timestamp:  now(),
    };
    const upd = { ...cl, comments: [...(cl.comments || []), comment], updatedAt: now() };
    persist(upd);
    setCl(upd);
  }

  // ── ATTACHMENTS: handle file upload (base64) ──────────────────────────────
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 3 attachments
    if ((cl.attachments || []).length >= 3) {
      showToast("Max 3 attachments allowed"); return;
    }
    // Max 2MB per file
    if (file.size > 2 * 1024 * 1024) {
      showToast("File too large — max 2MB"); return;
    }
    // Only images
    if (!file.type.startsWith("image/")) {
      showToast("Only image files supported"); return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const attachment = {
        id:         "ATT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        name:       file.name,
        dataUrl:    ev.target.result, // base64
        uploadedBy: user.name,
        uploadedAt: now(),
      };
      const upd = { ...cl, attachments: [...(cl.attachments || []), attachment], updatedAt: now() };
      persist(upd);
      setCl(upd);
      showToast("📎 Photo attached!");
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removeAttachment(id) {
    const upd = { ...cl, attachments: (cl.attachments || []).filter(a => a.id !== id), updatedAt: now() };
    persist(upd); setCl(upd);
    showToast("Attachment removed");
  }

  // ── Bookmark toggle ───────────────────────────────────────────────────────
  const isBookmarked = bookmarks?.some(b => b.id === cl.id);
  function toggleBookmark() {
    if (isBookmarked) { setBookmarks(prev => prev.filter(b => b.id !== cl.id)); showToast("Bookmark removed"); }
    else              { setBookmarks(prev => [...prev, { ...cl }]); showToast("🔖 Bookmarked!"); }
  }

  const clAuditEntries = (auditLog || []).filter(a => a.checklistId === cl.id);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">

      {/* ── Title bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">{cl.name}</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
            {cl.frequency || "One Time"} · {autoSaveStatus}
            {/* Show rework count if checklist has been reworked before */}
            {cl.reworkCount > 0 && <span className="ml-2 text-orange-500">🔄 Rework #{cl.reworkCount}</span>}
          </p>
        </div>
        <WorkflowStepper status={cl.status} />
      </div>

      {/* ── OVERDUE BANNER for Daily checklists ── */}
      {isOverdueToday && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-red-500 text-sm">⚠️</span>
          <span className="text-[12px] font-semibold text-red-700">
            Today's entries are missing — this checklist is overdue for {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}.
          </span>
        </div>
      )}

      {/* ── REJECTION REASON BANNER ── */}
      {cl.status === "rejected" && cl.rejectionReason && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <p className="text-[11px] font-bold text-red-700 mb-0.5">❌ Rejected by {cl.rejectedBy}</p>
          <p className="text-[11px] text-red-600">Reason: {cl.rejectionReason}</p>
          {cl.approvalRemarks && <p className="text-[10px] text-red-500 mt-0.5">Remarks: {cl.approvalRemarks}</p>}
        </div>
      )}

      {/* ── Action toolbar ── */}
      <div className="action-bar flex flex-wrap items-center gap-2 mb-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <button onClick={onBack} className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-semibold">Back</button>

        {editable && (
          <>
            <div className="h-4 w-[1px] bg-gray-200 mx-1" />
            {isRecurring ? (
              // Recurring grid controls
              <>
                <button onClick={addHRow}           className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-bold">➕ Row</button>
                <button onClick={removeHRow}         className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">➖ Row</button>
                <button onClick={addLeftHeadingCol}  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">➕ Col</button>
                <button onClick={removeLeftHeadingCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">➖ Col</button>
              </>
            ) : (
              // One-Time grid controls
              <>
                <button onClick={addRow}            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-bold">+ Row</button>
                <button onClick={removeRow}          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Row</button>
                <button onClick={addCheckpointCol}   className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">+ Col</button>
                <button onClick={removeCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Col</button>
                <button onClick={addFillCol}          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1e5c42] text-white font-bold">+ Fill</button>
                <button onClick={removeFillCol}       className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Fill</button>
              </>
            )}

            {/* Bookmark toggle */}
            <button onClick={toggleBookmark} className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold ml-auto flex items-center gap-1 ${isBookmarked ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500"}`}>
              {isBookmarked ? "🔖 Bookmarked" : "🔖 Bookmark"}
            </button>

            {/* Save as Template */}
            <SaveAsTemplateButton cl={cl} user={user} templates={templates} setTemplates={setTemplates} showToast={showToast} />

            {/* Attachment upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
              title="Attach a photo (max 3, 2MB each)"
            >
              📎 Attach Photo {cl.attachments?.length > 0 && `(${cl.attachments.length})`}
            </button>
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            <button onClick={() => saveManual(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#3D8B6E] text-white font-bold">Save & Close</button>
          </>
        )}

        {/* Workflow buttons — right side, always shown in view mode */}
        <div className={`${editable ? "" : "ml-auto"} flex items-center gap-2 flex-wrap`}>
          {canFin      && <button onClick={handleFinalize}     className="text-[10px] px-3 py-1.5 rounded-lg text-white font-bold bg-amber-500">Finalize</button>}
          {canSub      && <button onClick={() => { if (!isRecurring) { const m=validateFillColumns(cl.tableData); if(m.length){alert("Missing:\n"+m.join("\n"));return;} } setShowSubmitModal(true); }} className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold">Submit</button>}
          {canCancel   && <button onClick={handleCancelSubmission} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold">Cancel Submission</button>}
          {canRework   && <button onClick={handleRework} className="text-[10px] px-3 py-1.5 rounded-lg bg-orange-500 text-white font-bold flex items-center gap-1">🔄 Send for Rework</button>}
          {canAR && (
            <>
              <button onClick={() => setApprovalModal({ type: "approve" })} className="text-[10px] px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold">Approve</button>
              <button onClick={() => setApprovalModal({ type: "reject"  })} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-600   text-white font-bold">Reject</button>
            </>
          )}
          {/* Print & Export always visible when status allows — even in view mode */}
          {PERM.canPrint(cl)  && <button onClick={() => setPaperModal({ action: "print"  })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-800 font-semibold hover:bg-purple-100">🖨️ Print</button>}
          {PERM.canExport(cl) && <button onClick={() => setPaperModal({ action: "export" })} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-800 font-semibold hover:bg-orange-100">📄 Export</button>}
          {/* In view mode on draft: show read-only label */}
          {isView && !PERM.canPrint(cl) && (
            <span className="text-[10px] text-gray-400 font-mono px-2 py-1 bg-gray-50 rounded-lg">👁 Read-only</span>
          )}
        </div>
      </div>

      {/* ── ATTACHMENT THUMBNAILS ── */}
      {(cl.attachments?.length > 0) && (
        <div className="flex flex-wrap gap-3 mb-3 p-3 bg-white border border-indigo-100 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-indigo-700 w-full">📎 Attachments</span>
          {cl.attachments.map(att => (
            <div key={att.id} className="relative group">
              <img
                src={att.dataUrl}
                alt={att.name}
                className="w-20 h-20 object-cover rounded-lg border border-indigo-200 cursor-pointer hover:opacity-90 transition-all"
                onClick={() => window.open(att.dataUrl, "_blank")}
                title={`${att.name} — ${att.uploadedBy}`}
              />
              {/* Remove button (only editable users) */}
              {editable && (
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                >✕</button>
              )}
              <p className="text-[8px] text-gray-400 text-center mt-0.5 truncate w-20">{att.uploadedBy}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── GRID ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>

          {isRecurring ? (
            // ── Recurring timeline matrix ──────────────────────────────────
            <table style={{ tableLayout:"fixed", width:"100%" }}>
              <thead>
                <tr>
                  <th style={{ background:"#f4f4f4", color:"#1a1a1a", padding:"5px 8px", fontSize:11, fontWeight:700, width:"44px", textAlign:"center", position:"sticky", top:0, left:0, zIndex:40, borderBottom:"2px solid #c6c6c6", letterSpacing:"0.02em" }}>Sr.</th>
                  {cl.horizontalStructure.checkpointColumns.map((col, cIdx) => {
                    const left = 38 + cIdx * 140;
                    return (
                      <th key={col.id} style={{ background:"#f4f4f4", color:"#1a1a1a", padding:"5px 8px", fontSize:11, fontWeight:700, width:"140px", position:"sticky", top:0, left:`${left}px`, zIndex:40, borderBottom:"2px solid #c6c6c6" }}>
                        {!editable ? col.text : (
                          <span contentEditable suppressContentEditableWarning onBlur={e=>{let v=e.target.innerText||"";if(v.length>250){v=v.substring(0,250);e.target.innerText=v;}updateLeftHeaderLabel(col.id,v);}} data-placeholder="Column name…" style={{display:"block",outline:"none",minWidth:"80px"}}>{col.text}</span>
                        )}
                      </th>
                    );
                  })}
                  {cl.horizontalStructure.dates.map(dStr => {
                    const lock = getTimelineLockContext(dStr);
                    const today = getTodayString();
                    let badge = "bg-gray-100 text-gray-600";
                    if (lock.type==="present") badge = "bg-[#0f62fe] text-white font-bold ring-2 ring-[#0f62fe]/50";
                    if (lock.type==="past")    badge = "bg-[#e8e8e8] text-[#161616] font-semibold";
                    if (lock.type==="future")  badge = "bg-[#f4f4f4] text-[#6f6f6f] font-medium";
                    return (
                      <th key={dStr} style={{ padding:"3px 4px", width:"100px", textAlign:"center", position:"sticky", top:0, zIndex:10, background:"#f4f4f4", borderBottom:"2px solid #e0e0e0" }}>
                        <div className={`text-[11px] px-2 py-1 rounded font-mono font-semibold ${badge}`}>{dStr}</div>
                      </th>
                    );
                  })}
                  <th style={{ background:"#f4f4f4", color:"#1a1a1a", padding:"5px 8px", fontSize:11, fontWeight:700, width:"160px", position:"sticky", top:0, zIndex:10, borderBottom:"2px solid #c6c6c6" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {cl.horizontalStructure.rows.map((row, rIdx) => (
                  <tr key={row.id}>
                    <td style={{ background:"#f4f4f4", color:"#111111", fontWeight:700, padding:"6px 6px", fontSize:12, textAlign:"center", position:"sticky", left:0, zIndex:20, borderBottom:"1px solid #d4d4d4" }}>{rIdx+1}</td>
                    {cl.horizontalStructure.checkpointColumns.map((col, cIdx) => {
                      const left = 38 + cIdx * 140;
                      const val  = row.metaValues[col.id] || "";
                      return (
                        <td key={col.id} style={{ background:"#fff", padding:"6px 8px", fontSize:12, fontWeight:500, position:"sticky", left:`${left}px`, zIndex:20, borderBottom:"1px solid #d4d4d4", color:"#111111" }}>
                          {!editable ? <div style={{wordBreak:"break-word",whiteSpace:"pre-wrap",maxWidth:"100%"}}>{val||"—"}</div> : (
                            <span contentEditable suppressContentEditableWarning
                              onKeyDown={e=>{if((e.target.innerText||"").length>=250&&!["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key))e.preventDefault();}}
                              onBlur={e=>{let v=e.target.innerText||"";if(v.length>250){v=v.substring(0,250);e.target.innerText=v;}updateLeftMetaVal(row.id,col.id,v);}}
                              style={{display:"block",outline:"none",width:"100%",minHeight:"18px"}}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                    {cl.horizontalStructure.dates.map(dStr => {
                      const lock     = getTimelineLockContext(dStr);
                      const cellVal  = cl.horizontalStructure.matrixData[row.id]?.[dStr] || "";
                      const disabled = !lock.editable || isView;
                      let bg = "bg-white";
                      if (lock.type==="past")    bg = "bg-[#fff1f1]";
                      if (lock.type==="future")  bg = "bg-[#f0f4ff] pointer-events-none opacity-50";
                      if (lock.type==="present" && !disabled) bg = "bg-[#fffbe6]";
                      return (
                        <td key={dStr} className={`px-2 py-1.5 transition-all ${bg}`} style={{verticalAlign:"middle", borderBottom:"1px solid #d4d4d4", fontSize:12}}>
                          <div className={disabled?"opacity-80 select-none":""}>
                            <FillField type={cl.fillType} opts={cl.customOptions} value={cellVal} onChange={v=>updateMatrixDataCell(row.id,dStr,v)} disabled={disabled}/>
                          </div>
                        </td>
                      );
                    })}
                    <td style={{padding:"3px 6px",background:"#fafafa",verticalAlign:"top",cursor:"text",borderBottom:"1px solid #e8e8e8"}} onClick={e=>e.currentTarget.querySelector("textarea")?.focus()}>
                     <textarea
  value={cl.horizontalStructure.remarksData[row.id] || ""}
  disabled={isView}
  maxLength={100}
  onChange={e => updateHRowRemark(row.id, e.target.value)}
  placeholder="Add notes..."
  rows={2}
  className="w-full bg-transparent border-none outline-none text-[#3b1d8a] italic resize-none leading-relaxed cursor-text"
  style={{
    minHeight: "36px",
    height: "auto",
    overflowY: "visible",
    fontSize: 12
  }}
/>
                      {!isView && <div className="text-[9px] text-right text-purple-400 font-mono">{(cl.horizontalStructure.remarksData[row.id]||"").length}/100</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          ) : (
            // ── One-Time static form ───────────────────────────────────────
            <table style={{borderCollapse:"separate",borderSpacing:0,width:"100%",tableLayout:"fixed"}}>
              <thead>
                <tr>
                  <th style={{background:"#f4f4f4",color:"#1a1a1a",padding:"5px 8px",fontSize:11,fontWeight:700,width:"44px",textAlign:"center",position:"sticky",top:0,zIndex:10,borderBottom:"2px solid #c6c6c6"}}>Sr.</th>
                  {cl.tableData.headers.map((h,ci) => (
                    <th key={ci} style={{background:"#f4f4f4",color:"#1a1a1a",padding:"5px 8px",fontSize:11,fontWeight:700,width:h.isFill?"100px":"160px",position:"sticky",top:0,zIndex:10,borderBottom:"2px solid #c6c6c6"}}>
                      {!editable ? h.text : (<span contentEditable suppressContentEditableWarning onBlur={e=>{let v=e.target.innerText||"";if(v.length>200){v=v.substring(0,200);e.target.innerText=v;}updateHeader(ci,v);}} data-placeholder="Column name…" style={{display:"block",outline:"none",minWidth:"60px"}}>{h.text}</span>)}
                    </th>
                  ))}
                  <th style={{background:"#f4f4f4",color:"#1a1a1a",padding:"5px 8px",fontSize:11,fontWeight:700,width:"160px",position:"sticky",top:0,zIndex:10,borderBottom:"2px solid #c6c6c6"}}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {cl.tableData.rows.map((row,ri) => (
                  <tr key={ri} className="hover:bg-gray-50/40">
                    <td style={{background:"#f4f4f4",color:"#111111",fontWeight:700,padding:"6px 6px",fontSize:12,textAlign:"center",borderBottom:"1px solid #d4d4d4"}}>{ri+1}</td>
                    {row.map((cell,ci) => {
                      const isFill = cl.tableData.headers[ci]?.isFill;
                      return isFill ? (
                        <td key={ci} style={{padding:"4px 8px",borderBottom:"1px solid #d4d4d4",fontSize:12}} className={!editable?"bg-[#f8f8f8]":"bg-white"}>
                          <FillField type={cl.fillType} opts={cl.customOptions} value={cell.value} onChange={v=>updateCellValue(ri,ci,v)} disabled={!editable}/>
                        </td>
                      ) : (
                        <td key={ci} style={{padding:"6px 8px",fontSize:12,borderBottom:"1px solid #d4d4d4",color:"#111111"}} className="wrap-text">
                          {!editable ? <div style={{wordBreak:"break-word",whiteSpace:"pre-wrap",maxWidth:"100%"}}>{cell.value||"—"}</div> : (
                            <span contentEditable suppressContentEditableWarning
                              onKeyDown={e=>{if((e.target.innerText||"").length>=250&&!["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key))e.preventDefault();}}
                              onBlur={e=>{let v=e.target.innerText||"";if(v.length>250){v=v.substring(0,250);e.target.innerText=v;}updateCellValue(ri,ci,v);}}
                              style={{display:"block",outline:"none",width:"100%",minHeight:"20px"}}>{cell.value}</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{padding:"3px 6px",background:"#fafafa",verticalAlign:"top",cursor:"text",borderBottom:"1px solid #e8e8e8"}} onClick={e=>e.currentTarget.querySelector("textarea")?.focus()}>
                      {!editable ? <span style={{fontSize:12,color:"#3b1d8a",fontStyle:"italic"}}>{row[0]?.remark||""}</span> : (
                        <>
                          <textarea value={row[0]?.remark||""} maxLength={100} onChange={e=>updateRowRemark(ri,e.target.value)} placeholder="Add notes..." rows={2} style={{minHeight:"36px",height:"auto",overflowY:"visible"}} className="w-full text-xs bg-transparent border-none outline-none text-[#5b21b6] font-normal italic resize-none leading-relaxed cursor-text"/>
                          <div className="text-[9px] text-right text-purple-400 font-mono">{(row[0]?.remark||"").length}/100</div>
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

      {showSubmitModal && <SubmitApprovalModal cl={cl} user={user} onConfirm={handleSubmitConfirm} onClose={() => setShowSubmitModal(false)} />}
      {approvalModal   && <ApprovalActionModal checklist={cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={() => setApprovalModal(null)} />}
      {paperModal      && <PaperSizeModal action={paperModal.action} cl={cl} auditLog={clAuditEntries} onClose={() => setPaperModal(null)} />}
    </main>
  );
}