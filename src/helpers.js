import { STATUS_LABEL } from "./constants";

export function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function genId() { return "CHK-" + Math.floor(Math.random() * 100000); }
export function genAuditId() { return "AUD-" + Math.random().toString(36).slice(2, 9).toUpperCase(); }
export function now() { return new Date().toISOString(); }
export function fmtDT(iso) { if (!iso) return "—"; return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
export const getLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
export const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// 🟢 RESTORED & FIXED: validateFillColumns validation pipeline
export function validateFillColumns(tableData) {
    const missing = [];
    if (!tableData || !tableData.rows) return missing;
    
    tableData.rows.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const header = tableData.headers?.[colIndex];
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
               : {bg:"#f3f4f6",c:"#374151"};

  const isRecurring = ["Daily", "Weekly", "Monthly"].includes(cl.frequency);

  let innerTableHTML = "";

  if (isRecurring) {
    const hs = cl.horizontalStructure || {};
    const checkpointColumns = hs.checkpointColumns || [];
    const rows              = hs.rows              || [];
    const dates             = hs.dates             || [];
    const matrixData        = hs.matrixData        || {};
    const remarksData       = hs.remarksData       || {};

    const idxW      = 4;
    const leftColW  = 14;
    const rmkW      = 12;
    const usedW     = idxW + checkpointColumns.length * leftColW + rmkW;
    const remaining = Math.max(100 - usedW, 10);
    const dateColW  = dates.length > 0 ? Math.floor(remaining / dates.length) : 10;

    innerTableHTML = `
      <table class="cl-tbl" style="table-layout: fixed; width: 100%;">
        <thead>
          <tr>
            <th style="width: ${idxW}%; text-align:center;">#</th>
            ${checkpointColumns.map(col => `<th style="width: ${leftColW}%;">${col.text}</th>`).join("")}
            ${dates.map(d => `<th class="date-hdr" style="width: ${dateColW}%; text-align:center;">${d}</th>`).join("")}
            <th style="width: ${rmkW}%; background:#4a3a6b!important;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rIdx) => `
            <tr>
              <td class="num-cell" style="text-align:center;">${rIdx + 1}</td>
              ${checkpointColumns.map(col => `<td>${row.metaValues?.[col.id] || "—"}</td>`).join("")}
              ${dates.map(dStr => {
                let val = matrixData[row.id]?.[dStr] ?? "";
                if (cl.fillType === "Checkbox") val = val ? "☑" : "☐";
                return `<td class="date-val">${val !== "" ? val : "—"}</td>`;
              }).join("")}
              <td class="rmk-cell">${remarksData[row.id] || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } else {
    const tData = cl.tableData || { headers: [], rows: [] };
    const indexWidth = 5;
    const remarksWidth = 15;
    const sharedWidth = 100 - (indexWidth + remarksWidth);
    const colWidth = Math.floor(sharedWidth / (tData.headers.length || 1));

    innerTableHTML = `
      <table class="cl-tbl" style="table-layout: fixed; width: 100%;">
        <thead>
          <tr>
            <th style="width: ${indexWidth}%; text-align:center;">#</th>
            ${tData.headers.map(h => `<th class="${h.isFill ? 'date-hdr' : ''}" style="width: ${colWidth}%;">${h.text}</th>`).join("")}
            <th style="width: ${remarksWidth}%; background:#4a3a6b!important;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${tData.rows.map((row, ri) => `
            <tr>
              <td class="num-cell" style="text-align:center;">${ri + 1}</td>
              ${row.map((cell, ci) => {
                const isFill = tData.headers[ci]?.isFill;
                let displayVal = cell.value ?? "";
                if (isFill && cl.fillType === "Checkbox") displayVal = displayVal ? "☑" : "☐";
                return `<td class="${isFill ? 'date-val' : ''}">${displayVal || "—"}</td>`;
              }).join("")}
              <td class="rmk-cell">${row[0]?.remark || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${cl.name || "Checklist Matrix Report"}</title>
<style>
@page { size: ${isA3 ? "A3" : "A4"} landscape; margin: 8mm !important; }
html, body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #1A2E24; background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.doc-wrapper { width: 100%; padding: 5px; box-sizing: border-box; }
.dh{border-bottom:3px solid #3D8B6E; padding-bottom:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:flex-end;}
.dtitle{font-size: 16px; font-weight:700; color:#1A2E24; margin:0;}
.badge{display:inline-block; padding:2px 8px; border-radius:20px; font-size:8px; font-weight:700; background:${sc.bg}; color:${sc.c}; border:1px solid ${sc.c}44;}
.meta{display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; background:#f6faf8; padding:8px; border-radius:8px; margin:8px 0;}
.mi label{display:block; font-size:7px; text-transform:uppercase; color:#6B8A78;}
.mi span{font-size:9px; font-weight:600;}
table.cl-tbl { width: 100% !important; border-collapse: collapse !important; margin-top: 8px;}
table.cl-tbl th { background: #3D8B6E !important; color: #fff !important; padding: 6px; font-size: 9px; border: 1px solid #2d3748 !important; text-align: left; }
table.cl-tbl th.date-hdr { background: #1e5c42 !important; text-align: center; }
table.cl-tbl td { border: 1px solid #2d3748 !important; padding: 6px; font-size: 9px; vertical-align: middle !important; word-wrap: break-word !important; word-break: break-all !important; }
table.cl-tbl td.num-cell { text-align: center; font-weight:700; background: #e5e7eb !important; }
table.cl-tbl td.date-val { text-align: center; background: #fffbeb !important; }
table.cl-tbl td.rmk-cell { background: #f5f0ff !important; font-style: italic; color: #5b21b6; }
.ft{margin-top:15px; padding-top:6px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:8px; color:#9ca3af;}
</style>
</head>
<body>
<div class="doc-wrapper">
  <div class="dh">
    <div>
      <div style="font-size:8px; text-transform:uppercase; color:#6B8A78;">Manufacturing System Logbook · Official Print Document</div>
      <div class="dtitle">${cl.name || "Unnamed Report"}</div>
    </div>
    <span class="badge">${(STATUS_LABEL[cl.status]||cl.status).replace(/[📝🔒📤⏳✅❌⊘]/g,"").trim()}</span>
  </div>

  <div class="meta">
    <div class="mi"><label>Checklist ID</label><span>${cl.id}</span></div>
    <div class="mi"><label>Department</label><span>${cl.department||"—"}</span></div>
    <div class="mi"><label>Shift</label><span>${cl.shift||"—"}</span></div>
    <div class="mi"><label>Schedule Type</label><span>${cl.frequency||"—"}</span></div>
    <div class="mi"><label>Created By</label><span>${cl.createdBy||"—"}</span></div>
  </div>

  ${innerTableHTML}

  <div class="ft">
    <span>Generated Report Date: ${fmtDT(now())} · Landscape ${paperSize}</span>
    <span>System Key: ${cl.id}</span>
  </div>
</div>
</body>
</html>`;
}

export function handleExportPDF(cl, auditLog, paperSize = "A4") {
    const html = buildPrintHTML(cl, auditLog, paperSize);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `checklist-report-${cl.id}-${paperSize}.html`; a.click();
    URL.revokeObjectURL(url);
}

export function handlePrint(cl, auditLog, paperSize = "A4") {
    const html = buildPrintHTML(cl, auditLog, paperSize);
    const win = window.open("", "_blank");
    win.document.write(html); win.document.close();
    win.onload = () => { win.focus(); win.print(); };
}