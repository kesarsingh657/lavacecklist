import { STATUS_LABEL } from "./constants";

export function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function genId() { return "CHK-" + Math.floor(Math.random() * 100000); }
export function genAuditId() { return "AUD-" + Math.random().toString(36).slice(2, 9).toUpperCase(); }
export function now() { return new Date().toISOString(); }
export function fmtDT(iso) { if (!iso) return "—"; return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
export const getLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
export const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export function getCompletion(rows) {
    let total = 0;
    let filled = 0;
    rows.forEach(row => {
        row.forEach(cell => {
            total++;
            if (cell.value !== "" && cell.value !== null && cell.value !== undefined) {
                filled++;
            }
        });
    });
    return total > 0 ? Math.round((filled / total) * 100) : 0;
}

export function validateFillColumns(tableData) {
    const missing = [];
    tableData.rows.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const header = tableData.headers[colIndex];
            if (header?.isFill && (cell.value === "" || cell.value === null || cell.value === undefined)) {
                missing.push(`Row ${rowIndex + 1} - ${header.text}`);
            }
        });
    });
    return missing;
}

export const PERM = {
    canEdit: (cl, u) => !["finalized", "submitted", "pending", "approved", "cancelled"].includes(cl.status) && (u.role === "admin" || u.role === "operator"),
    canFinalize: (cl, u) => cl.status === "draft" && (u.role === "admin" || u.role === "operator"),
    canSubmit: (cl, u) => cl.status === "finalized" && (u.role === "admin" || u.role === "operator"),
    canCancelSubmit: (cl, u) => (cl.status === "submitted" || cl.status === "pending") && (u.role === "admin" || u.role === "operator"),
    canApproveReject: (cl, u) => (cl.status === "submitted" || cl.status === "pending") && u.role === "approver",
    canDelete: (cl, u) => u.role === "admin",
    canExport: (cl) => ["finalized", "submitted", "pending", "approved", "rejected"].includes(cl.status),
    canPrint: (cl) => ["finalized", "submitted", "pending", "approved", "rejected"].includes(cl.status),
};

export function buildPrintHTML(cl, auditEntries=[], paperSize="A4") {
  const isA3  = paperSize === "A3";
  const sc    = cl.status==="approved"  ? {bg:"#d1fae5",c:"#065f46"}
               :cl.status==="rejected"  ? {bg:"#fee2e2",c:"#991b1b"}
               :(cl.status==="submitted"||cl.status==="pending") ? {bg:"#dbeafe",c:"#1e40af"}
               : {bg:"#f3f4f6",c:"#374151"};

  const rows = cl.tableData?.rows || [];
  const hdrs = cl.tableData?.headers || [];

  const fillIdxs = hdrs.reduce((a,h,i)=>{ if(h.isFill) a.push(i); return a; }, []);
  const totalFill  = rows.length * fillIdxs.length;
  const filledFill = rows.reduce((a,r)=>a + fillIdxs.filter(ci=>r[ci]?.value).length, 0);
  const pct = totalFill > 0 ? Math.round(filledFill/totalFill*100) : 0;

  const hasRemarks = rows.some(r => r.some(c => c.remark));
  
  // Hardcoded absolute width distribution matrix to completely freeze columns
  const fillColsCount = hdrs.filter(h => h.isFill).length || 1;
  const checkpointColsCount = hdrs.filter(h => !h.isFill).length || 1;

  // Assign explicit percentage widths
  const indexWidth = 5; // 5%
  const remarksWidth = hasRemarks ? 20 : 0; // 20%
  const fillWidth = 12; // 12% per input box
  
  const usedWidth = indexWidth + remarksWidth + (fillColsCount * fillWidth);
  const remainingWidth = 100 - usedWidth;
  const checkpointWidth = Math.floor(remainingWidth / checkpointColsCount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${cl.name}</title>
<style>
/* ── FORCE PRINT PAGE BOX METRICS ── */
@page { 
  size: ${isA3 ? "A3" : "A4"} portrait; 
  margin: 10mm !important; 
}

html, body { 
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Arial, sans-serif; 
  color: #1A2E24; 
  background: #fff;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* This fixes the stretching on browser screens/new tabs */
.doc-wrapper {
  width: ${isA3 ? "1122px" : "794px"} !important; /* Perfect standard pixel limits for A4/A3 portrait sheets */
  max-width: 100%;
  margin: 0 auto !important;
  padding: 10px;
  box-sizing: border-box;
}

.dh{border-bottom:3px solid #3D8B6E;padding-bottom:8px;margin-bottom:12px;}
.brand{font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#6B8A78;margin-bottom:4px;}
.dtitle{font-size: 18px;font-weight:700;color:#1A2E24;margin-bottom:4px;line-height:1.2;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:8px;font-weight:700;text-transform:uppercase;background:${sc.bg};color:${sc.c};border:1px solid ${sc.c}44;}
.meta{display:grid;grid-template-columns: repeat(4, 1fr);gap:8px;background:#f6faf8;padding:10px;border-radius:8px;margin:10px 0;}
.mi label{display:block;font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#6B8A78;margin-bottom:1px;}
.mi span{font-size:10px;font-weight:600;color:#374151;}
.prog{margin:8px 0;}
.prog-lbl{display:flex;justify-content:space-between;font-size:9px;color:#6B8A78;margin-bottom:3px;}
.prog-lbl strong{color:${pct===100?"#059669":"#3D8B6E"};}
.prog-bg{background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;}
.prog-fill{height:100%;background:${pct===100?"#059669":"#3D8B6E"};width:${pct}%;}
.sh{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#6B8A78;margin:14px 0 4px;padding-top:8px;}

/* ── TOTAL WIDTH LOCKDOWN ── */
table.cl-tbl {
  width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important; /* Compels strict matrix cell containment */
  margin-top: 8px;
}
table.cl-tbl thead { display: table-header-group; }
table.cl-tbl th {
  background: #3D8B6E !important;
  color: #fff !important;
  padding: 8px;
  text-align: left;
  font-size: 9px;
  font-weight: 700;
  border: 1px solid #c5d9d1 !important;
}
table.cl-tbl th.fh { background: #1e5c42 !important; text-align: center; }
table.cl-tbl th.rh { background: #4a3a6b !important; }

table.cl-tbl tr {
  page-break-inside: avoid !important;
  height: auto !important;
}

table.cl-tbl td {
  border: 1px solid #d1d5db !important;
  padding: 8px;
  vertical-align: top !important;
  font-size: 10px;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  word-break: break-all !important; /* Forces any text strings downward instantly */
}
table.cl-tbl tr:nth-child(even) td { background: #f9fafb !important; }
table.cl-tbl tr:nth-child(odd)  td { background: #fff !important; }
table.cl-tbl td.fill-cell { background: #fffde7 !important; text-align: center; vertical-align: middle !important; }
table.cl-tbl td.rmk-cell { background: #f5f0ff !important; font-style: italic; color: #5b21b6; }
table.cl-tbl td.num-cell { text-align: center; font-weight: 700; color: #6b7280; background: #e5e7eb !important; vertical-align: middle !important; }
.ft{margin-top:20px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af;}

/* Media rule ensures pixels translate smoothly to paper margins */
@media print {
  .doc-wrapper {
    width: 100% !important;
    padding: 0 !important;
  }
}
</style>
</head>
<body>
<div class="doc-wrapper">

  <div class="dh">
    <div class="brand">Manufacturing Checklist System · Official Record</div>
    <div class="dtitle">${cl.name}</div>
    <span class="badge">${(STATUS_LABEL[cl.status]||cl.status).replace(/[📝🔒📤⏳✅❌⊘]/g,"").trim()}</span>
  </div>

  <div class="meta">
    <div class="mi"><label>Checklist ID</label><span>${cl.id}</span></div>
    <div class="mi"><label>Department</label><span>${cl.department||"—"}</span></div>
    <div class="mi"><label>Shift</label><span>${cl.shift||"—"}</span></div>
    <div class="mi"><label>Schedule</label><span>${cl.frequency||"—"}</span></div>
    <div class="mi"><label>Created By</label><span>${cl.createdBy||"—"}</span></div>
    <div class="mi"><label>Fill Type</label><span>${cl.fillType||"—"}</span></div>
    ${cl.createdAt?`<div class="mi"><label>Created</label><span>${fmtDT(cl.createdAt)}</span></div>`:""}
    ${cl.finalizedAt?`<div class="mi"><label>Finalized</label><span>${fmtDT(cl.finalizedAt)}</span></div>`:""}
  </div>

  <div class="prog">
    <div class="prog-lbl"><span>Fill Completion</span><strong>${filledFill}/${totalFill} cells · ${pct}%</strong></div>
    <div class="prog-bg"><div class="prog-fill"></div></div>
  </div>

  <div class="sh">Checklist Data</div>
  <table class="cl-tbl">
    <thead>
      <tr>
        <th style="width: ${indexWidth}%; text-align: center;">#</th>
        ${hdrs.map(h => {
          if (h.isFill) {
            return `<th class="fh" style="width: ${fillWidth}%; text-align: center;">${h.text}</th>`;
          } else {
            return `<th style="width: ${checkpointWidth}%; text-align: left;">${h.text}</th>`;
          }
        }).join("")}
        ${hasRemarks ? `<th class="rh" style="width: ${remarksWidth}%;">Remarks</th>` : ""}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, i) => `
        <tr>
          <td class="num-cell">${i+1}</td>
          ${row.map((cell, ci) => {
            const isFill = hdrs[ci]?.isFill;
            let displayValue = cell.value ?? "";

            if (isFill && cl.fillType === "Checkbox") {
              if (cell.value === true || cell.value === "true") {
                displayValue = '<span style="font-size: 13px; color: #3D8B6E; font-weight: bold;">☑</span>';
              } else {
                displayValue = ''; 
              }
            } else if (!isFill) {
              displayValue = String(cell.value || "").trim();
              if (!displayValue) displayValue = "—";
            }

            return `<td class="${isFill ? 'fill-cell' : ''}">${displayValue}</td>`;
          }).join("")}
          ${hasRemarks ? `<td class="rmk-cell">${row[0]?.remark || ""}</td>` : ""}
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="ft">
    <span>Generated: ${fmtDT(now())} · ${paperSize}</span>
    <span>ID: ${cl.id} · Manufacturing Checklist System</span>
  </div>

</div>
</body>
</html>`;
}
export function handleExportPDF(cl, auditLog, paperSize = "A4") {
    const entries = auditLog.filter(a => a.checklistId === cl.id);
    const html = buildPrintHTML(cl, entries, paperSize);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `checklist-${cl.id}-${paperSize}.html`; a.click();
    URL.revokeObjectURL(url);
}

export function handlePrint(cl, auditLog, paperSize = "A4") {
    const entries = auditLog.filter(a => a.checklistId === cl.id);
    const html = buildPrintHTML(cl, entries, paperSize);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
}