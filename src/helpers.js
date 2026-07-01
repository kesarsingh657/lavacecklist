/**
 * helpers.js — MES Enhanced Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES:
 *  - PERM.canRework added — operator/admin can rework a rejected checklist
 *  - PERM.canEdit updated — rework status is now also editable
 *  - bulkFinalize / bulkDelete helpers added for bulk actions feature
 *  - isOverdueToday utility exported so DashboardPage can use it too
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { STATUS_LABEL } from "./constants";

export function toDateStr(d)   { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export function genId()        { return "CHK-" + Math.floor(Math.random() * 100000); }
export function genAuditId()   { return "AUD-" + Math.random().toString(36).slice(2,9).toUpperCase(); }
export function now()          { return new Date().toISOString(); }
export function fmtDT(iso)     { if (!iso) return "—"; return new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
export const getLS = (k,def)  => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
export const setLS = (k,v)    => localStorage.setItem(k, JSON.stringify(v));

// ── Fill-column validation (unchanged) ───────────────────────────────────────
export function validateFillColumns(tableData) {
  const missing = [];
  if (!tableData?.rows) return missing;
  tableData.rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const h = tableData.headers?.[ci];
      if (h?.isFill && (cell.value === "" || cell.value == null)) {
        missing.push(`Row ${ri + 1} - ${h.text}`);
      }
    });
  });
  return missing;
}

// ── OVERDUE DETECTION (exported so DashboardPage & AnalyticsDashboard can use) ─
// Returns true if a Daily checklist has no entries for today
export function isOverdueToday(cl) {
  if (cl.frequency !== "Daily" || !cl.horizontalStructure) return false;
  const today = new Date().toISOString().split("T")[0];
  if (!cl.horizontalStructure.dates?.includes(today)) return false;
  const matrix = cl.horizontalStructure.matrixData || {};
  return !cl.horizontalStructure.rows?.some(row => {
    const v = matrix[row.id]?.[today];
    return v !== undefined && v !== "" && v !== false;
  });
}

// ── Permissions ───────────────────────────────────────────────────────────────
export const PERM = {
  // canEdit: rework status is now also editable (operator can fix after rejection)
  canEdit:          (cl, u) => !["finalized","submitted","pending","approved","cancelled"].includes(cl.status)
                               && (u.role === "admin" || u.role === "operator"),

  canFinalize:      (cl, u) => cl.status === "draft"
                               && (u.role === "admin" || u.role === "operator"),

  canSubmit:        (cl, u) => cl.status === "finalized"
                               && (u.role === "admin" || u.role === "operator"),

  canCancelSubmit:  (cl, u) => (cl.status === "submitted" || cl.status === "pending")
                               && (u.role === "admin" || u.role === "operator"),

  canApproveReject: (cl, u) => (cl.status === "submitted" || cl.status === "pending")
                               && u.role === "approver",

  // NEW: canRework — operator/admin can reset a rejected checklist to draft for fixes
  canRework:        (cl, u) => cl.status === "rejected"
                               && (u.role === "admin" || u.role === "operator"),

  canDelete:        (cl, u) => u.role === "admin",

  canExport:        (cl)    => ["finalized","submitted","pending","approved","rejected"].includes(cl.status),
  canPrint:         (cl)    => ["finalized","submitted","pending","approved","rejected"].includes(cl.status),
};

// ── BULK ACTIONS ──────────────────────────────────────────────────────────────
// These are called from ChecklistPage when user selects multiple rows

/**
 * bulkFinalize: finalize all selected draft checklists at once
 * @param {string[]} ids       - selected checklist IDs
 * @param {object[]} prev      - current checklists array
 * @param {object}   user      - current user
 * @returns {object[]}         - updated checklists array
 */
export function bulkFinalize(ids, prev, user) {
  const ts = now();
  return prev.map(cl => {
    if (!ids.includes(cl.id)) return cl;
    if (cl.status !== "draft") return cl; // only finalize drafts
    if (!PERM.canFinalize(cl, user)) return cl;
    return { ...cl, status: "finalized", finalizedAt: ts, updatedAt: ts };
  });
}

/**
 * bulkDelete: delete all selected checklists (admin only)
 * @param {string[]} ids  - selected checklist IDs
 * @param {object[]} prev - current checklists array
 * @param {object}   user - current user
 * @returns {object[]}    - filtered checklists array
 */
export function bulkDelete(ids, prev, user) {
  if (user.role !== "admin") return prev; // guard
  return prev.filter(cl => !ids.includes(cl.id));
}

// ── Print / Export (unchanged) ────────────────────────────────────────────────
export function buildPrintHTML(cl, auditEntries=[], paperSize="A4") {
  const isA3 = paperSize === "A3";
  const sc   = cl.status==="approved" ? {bg:"#d1fae5",c:"#065f46"}
             : cl.status==="rejected" ? {bg:"#fee2e2",c:"#991b1b"}
             : {bg:"#f3f4f6",c:"#374151"};

  const isRecurring = ["Daily","Weekly","Monthly"].includes(cl.frequency);
  let innerTableHTML = "";

  if (isRecurring) {
    const hs  = cl.horizontalStructure || {};
    const cps = hs.checkpointColumns || [];
    const rows= hs.rows              || [];
    const dates=hs.dates             || [];
    const mat = hs.matrixData        || {};
    const rmk = hs.remarksData       || {};

    // Compute column widths to avoid overlap
    const idxW  = 3;
    const leftW = Math.max(10, Math.min(18, Math.floor(40 / (cps.length || 1))));
    const rmkW  = 10;
    const usedW = idxW + cps.length * leftW + rmkW;
    const avail = Math.max(100 - usedW, dates.length * 3);
    const dateW = dates.length ? Math.max(3, Math.floor(avail / dates.length)) : 8;

    innerTableHTML = `
      <table class="cl-tbl" style="table-layout:fixed;width:100%;">
        <thead><tr>
          <th style="width:${idxW}%;text-align:center;">Sr.</th>
          ${cps.map(c=>`<th style="width:${leftW}%;">${c.text}</th>`).join("")}
          ${dates.map(d=>`<th class="date-hdr" style="width:${dateW}%;text-align:center;font-size:10px;">${d}</th>`).join("")}
          <th style="width:${rmkW}%;background:#4a3a6b!important;">Remarks</th>
        </tr></thead>
        <tbody>
          ${rows.map((row,ri)=>`<tr>
            <td class="num-cell" style="text-align:center;">${ri+1}</td>
            ${cps.map(c=>`<td>${row.metaValues?.[c.id]||"—"}</td>`).join("")}
            ${dates.map(dStr=>{let v=mat[row.id]?.[dStr]??"";if(cl.fillType==="Checkbox")v=v?'<span style="display:inline-block;width:14px;height:14px;border:2px solid #161616;background:#161616;color:#fff;font-size:11px;line-height:13px;text-align:center;font-weight:900;">✓</span>':'<span style="display:inline-block;width:14px;height:14px;border:2px solid #525252;background:#fff;"></span>';return`<td class="date-val">${v||"—"}</td>`;}).join("")}
            <td class="rmk-cell">${rmk[row.id]||""}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  } else {
    const td  = cl.tableData || { headers:[], rows:[] };
    const iw  = 5, rw = 15;
    const cw  = td.headers.length ? Math.floor((100-iw-rw)/td.headers.length) : 100-iw-rw;

    innerTableHTML = `
      <table class="cl-tbl" style="table-layout:fixed;width:100%;">
        <thead><tr>
          <th style="width:${iw}%;text-align:center;">Sr.</th>
          ${td.headers.map(h=>`<th class="${h.isFill?"date-hdr":""}" style="width:${cw}%;">${h.text}</th>`).join("")}
          <th style="width:${rw}%;background:#4a3a6b!important;">Remarks</th>
        </tr></thead>
        <tbody>
          ${td.rows.map((row,ri)=>`<tr>
            <td class="num-cell" style="text-align:center;">${ri+1}</td>
            ${row.map((cell,ci)=>{const isFill=td.headers[ci]?.isFill;let v=cell.value??"";if(isFill&&cl.fillType==="Checkbox")v=v?'<span style="display:inline-block;width:14px;height:14px;border:2px solid #161616;background:#161616;color:#fff;font-size:11px;line-height:13px;text-align:center;font-weight:900;">✓</span>':'<span style="display:inline-block;width:14px;height:14px;border:2px solid #525252;background:#fff;"></span>';return`<td class="${isFill?"date-val":""}">${v||"—"}</td>`;}).join("")}
            <td class="rmk-cell">${row[0]?.remark||""}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>${cl.name||"Checklist"}</title>
<style>
@page{size:${isA3?"A3":"A4"} landscape;margin:8mm!important;}
html,body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;color:#1A2E24;background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
.doc-wrapper{width:100%;padding:5px;box-sizing:border-box;}
.dh{border-bottom:2px solid #e0e0e0;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;}
.dtitle{font-size:18px;font-weight:700;color:#161616;margin:0;}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:8px;font-weight:700;background:${sc.bg};color:${sc.c};border:1px solid ${sc.c}44;}
.meta{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;background:#f4f4f4;padding:8px;border-radius:4px;margin:8px 0;}
.mi label{display:block;font-size:9px;text-transform:uppercase;color:#525252;letter-spacing:0.04em;}
.mi span{font-size:12px;font-weight:600;color:#161616;}
table.cl-tbl{width:100%!important;border-collapse:collapse!important;margin-top:8px;border:1.5px solid #c6c6c6!important;}
table.cl-tbl th{background:#f4f4f4!important;color:#161616!important;padding:7px 10px;font-size:11px;font-weight:700;border-bottom:2px solid #c6c6c6!important;border-right:1px solid #e0e0e0!important;text-align:left;letter-spacing:0.02em;}
table.cl-tbl th.date-hdr{background:#e8e8e8!important;text-align:center;}
table.cl-tbl td{border-bottom:1px solid #e0e0e0!important;border-right:1px solid #e0e0e0!important;padding:7px 10px;font-size:11px;vertical-align:top!important;word-wrap:break-word!important;word-break:break-word!important;overflow-wrap:break-word!important;}
table.cl-tbl td.num-cell{text-align:center;font-weight:700;background:#f4f4f4!important;color:#161616;font-size:11px;}
table.cl-tbl td.date-val{text-align:center;background:#fafafa!important;vertical-align:middle!important;}
table.cl-tbl td.rmk-cell{background:#fafafa!important;font-style:italic;color:#525252;font-size:11px;}
.ft{margin-top:15px;padding-top:6px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;}
</style></head><body>
<div class="doc-wrapper">
  <div class="dh">
    <div>
      <div style="font-size:8px;text-transform:uppercase;color:#6B8A78;">Manufacturing System · Official Print</div>
      <div class="dtitle">${cl.name||"Unnamed"}</div>
    </div>
    <span class="badge">${(STATUS_LABEL[cl.status]||cl.status).replace(/[📝🔒📤⏳✅❌⊘🔄]/g,"").trim()}</span>
  </div>
  <div class="meta">
    <div class="mi"><label>ID</label><span>${cl.id}</span></div>
    <div class="mi"><label>Department</label><span>${cl.department||"—"}</span></div>
    <div class="mi"><label>Shift</label><span>${cl.shift||"—"}</span></div>
    <div class="mi"><label>Schedule</label><span>${cl.frequency||"—"}</span></div>
    <div class="mi"><label>Created By</label><span>${cl.createdBy||"—"}</span></div>
  </div>
  ${innerTableHTML}
  <div class="ft">
    <span>Generated: ${fmtDT(now())} · ${paperSize} Landscape</span>
    <span>ID: ${cl.id}</span>
  </div>
</div></body></html>`;
}

export function handleExportPDF(cl, auditLog, paperSize="A4") {
  const html = buildPrintHTML(cl, auditLog, paperSize);
  const blob = new Blob([html], { type:"text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `checklist-${cl.id}-${paperSize}.html`; a.click();
  URL.revokeObjectURL(url);
}

export function handlePrint(cl, auditLog, paperSize="A4") {
  const html = buildPrintHTML(cl, auditLog, paperSize);
  const win  = window.open("","_blank");
  win.document.write(html); win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}