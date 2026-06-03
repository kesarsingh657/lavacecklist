import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════
//  CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════
const USERS = {
  admin:    { password:"admin123", role:"admin",    name:"Admin Supervisor" },
  operator: { password:"op123",    role:"operator", name:"Operator"         },
  qc:       { password:"qc123",    role:"approver", name:"QC Approver"      },
  viewer:   { password:"view123",  role:"viewer",   name:"Viewer"           },
};
const DEMO_ACCOUNTS = [
  { id:"admin",    pw:"admin123", label:"Supervisor" },
  { id:"operator", pw:"op123",    label:"Operator"   },
  { id:"qc",       pw:"qc123",    label:"QC Approver"},
  { id:"viewer",   pw:"view123",  label:"Read Only"  },
];

const FILL_TYPES = ["Text Input","Number Input","Checkbox","OK / NG","Pass / Fail","Yes / No","Custom Dropdown"];
const DEPTS      = ["Production","Quality","Warehouse","Maintenance"];
const SHIFTS     = ["Morning","Afternoon","Night"];
const FREQS      = ["One Time","Daily","Weekly","Monthly"];
const WEEK_DAYS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const PAPER_SIZES = ["A4","A3"];

// ── Status system ────────────────────────────
const STATUS = {
  DRAFT:     "draft",
  FINALIZED: "finalized",
  SUBMITTED: "submitted",
  PENDING:   "pending",
  APPROVED:  "approved",
  REJECTED:  "rejected",
  CANCELLED: "cancelled",
};
const STATUS_LABEL = {
  draft:"📝 Draft", finalized:" Finalized", submitted:"📤 Submitted",
  pending:"⏳ Pending Approval", approved:"✅ Approved", rejected:"❌ Rejected", cancelled:"⊘ Cancelled",
};
const STATUS_CLS = {
  draft:"bg-gray-100 text-gray-600 border-gray-200",
  finalized:"bg-amber-100 text-amber-700 border-amber-200",
  submitted:"bg-blue-100 text-blue-700 border-blue-200",
  pending:"bg-yellow-100 text-yellow-800 border-yellow-200",
  approved:"bg-green-100 text-green-700 border-green-200",
  rejected:"bg-red-100 text-red-700 border-red-200",
  cancelled:"bg-gray-100 text-gray-500 border-gray-200",
};

// ── Helpers ──────────────────────────────────
function toDateStr(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function genId()       { return "CHK-" + Math.floor(Math.random()*100000); }
function genAuditId()  { return "AUD-" + Math.random().toString(36).slice(2,9).toUpperCase(); }
function now()         { return new Date().toISOString(); }
function fmtDT(iso)    { if(!iso)return"—"; return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
const getLS = (k,def)=>{ try{ return JSON.parse(localStorage.getItem(k))??def; }catch{ return def; } };
const setLS = (k,v)   => localStorage.setItem(k, JSON.stringify(v));

// ── Permission gates (backend-style validation) ──
const PERM = {
  canEdit:           (cl,u) => !["finalized","submitted","pending","approved","cancelled"].includes(cl.status) && (u.role==="admin"||u.role==="operator"),
  canFinalize:       (cl,u) => cl.status===STATUS.DRAFT  && (u.role==="admin"||u.role==="operator"),
  canSubmit:         (cl,u) => cl.status===STATUS.FINALIZED && (u.role==="admin"||u.role==="operator"),
  canCancelSubmit:   (cl,u) => (cl.status===STATUS.SUBMITTED||cl.status===STATUS.PENDING) && (u.role==="admin"||u.role==="operator"),
  canApproveReject:  (cl,u) => (cl.status===STATUS.SUBMITTED||cl.status===STATUS.PENDING) && u.role==="approver",
  canDelete:         (cl,u) => u.role==="admin",
  canExport:         (cl)   => ["finalized","submitted","pending","approved","rejected"].includes(cl.status),
  canPrint:          (cl)   => ["finalized","submitted","pending","approved","rejected"].includes(cl.status),
};

// ═══════════════════════════════════════════════════════
//  PDF / PRINT ENGINE
// ═══════════════════════════════════════════════════════
// ── buildPrintHTML ────────────────────────────────────────────
// Fixed: A3 @page directive, proper margins, table-only layout,
// remark column included, no whole-page browser chrome printed.
function buildPrintHTML(cl, auditEntries=[], paperSize="A4") {
  const isA3  = paperSize === "A3";
  const sc    = cl.status==="approved"  ? {bg:"#d1fae5",c:"#065f46"}
               :cl.status==="rejected"  ? {bg:"#fee2e2",c:"#991b1b"}
               :(cl.status==="submitted"||cl.status==="pending") ? {bg:"#dbeafe",c:"#1e40af"}
               : {bg:"#f3f4f6",c:"#374151"};

  const rows = cl.tableData?.rows || [];
  const hdrs = cl.tableData?.headers || [];

  // Count fill completeness
  const fillIdxs = hdrs.reduce((a,h,i)=>{ if(h.isFill) a.push(i); return a; }, []);
  const totalFill  = rows.length * fillIdxs.length;
  const filledFill = rows.reduce((a,r)=>a + fillIdxs.filter(ci=>r[ci]?.value).length, 0);
  const pct = totalFill > 0 ? Math.round(filledFill/totalFill*100) : 0;

  // Determine if any row has a remark value
  const hasRemarks = rows.some(r => r.some(c => c.remark));

  // Font size scales with paper
  const tblFont = isA3 ? "11px" : "10px";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${cl.name}</title>
<style>
/* ── Page setup: critical for A3 to actually print A3 ── */
@page {
  size: ${isA3 ? "A3" : "A4"} portrait;
  margin: 14mm 16mm 14mm 16mm;
}
/* Reset */
*{box-sizing:border-box;margin:0;padding:0;}
html,body{
  font-family:'Segoe UI',Arial,sans-serif;
  font-size:${tblFont};
  color:#1A2E24;
  background:#fff;
  /* Do NOT set width/height — let @page control paper */
}
/* Wrapper just for padding in browser preview */
.doc{padding:0;}

/* ── Header strip ── */
.dh{border-bottom:3px solid #3D8B6E;padding-bottom:10px;margin-bottom:12px;}
.brand{font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#6B8A78;margin-bottom:4px;}
.dtitle{font-size:${isA3?"22px":"18px"};font-weight:700;color:#1A2E24;margin-bottom:4px;line-height:1.2;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:8px;font-weight:700;text-transform:uppercase;background:${sc.bg};color:${sc.c};border:1px solid ${sc.c}44;}

/* ── Meta info grid ── */
.meta{display:grid;grid-template-columns:repeat(${isA3?5:4},1fr);gap:8px;background:#f6faf8;padding:10px;border-radius:8px;margin:10px 0;}
.mi label{display:block;font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#6B8A78;margin-bottom:1px;}
.mi span{font-size:10px;font-weight:600;color:#374151;}

/* ── Progress bar ── */
.prog{margin:8px 0;}
.prog-lbl{display:flex;justify-content:space-between;font-size:9px;color:#6B8A78;margin-bottom:3px;}
.prog-lbl strong{color:${pct===100?"#059669":"#3D8B6E"};}
.prog-bg{background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;}
.prog-fill{height:100%;background:${pct===100?"#059669":"#3D8B6E"};width:${pct}%;}

/* ── Section headings ── */
.sh{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#6B8A78;margin:14px 0 6px;padding-top:10px;border-top:1px solid #e5e7eb;}

/* ── Main checklist table — fills page width ── */
table.cl-tbl{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;   /* columns share width proportionally */
  font-size:${tblFont};
  margin-top:4px;
  page-break-inside:auto;
}
table.cl-tbl thead{display:table-header-group;} /* repeat header on page break */
table.cl-tbl th{
  background:#3D8B6E;color:#fff;
  padding:5px 6px;text-align:left;
  font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;
  border:1px solid #c5d9d1;
  word-break:break-word;
}
table.cl-tbl th.fh{background:#1e5c42;}
table.cl-tbl th.rh{background:#4a3a6b;} /* remark header — purple tint */
table.cl-tbl td{
  border:1px solid #d1d5db;
  padding:4px 6px;
  vertical-align:top;
  word-break:break-word;
}
table.cl-tbl tr:nth-child(even) td{background:#f9fafb;}
table.cl-tbl tr:nth-child(odd)  td{background:#fff;}
table.cl-tbl td.fill-cell{background:#fffde7 !important;}
table.cl-tbl td.rmk-cell{background:#f5f0ff !important;font-style:italic;color:#5b21b6;}
table.cl-tbl td.num-cell{text-align:center;font-weight:700;color:#6b7280;background:#e5e7eb !important;width:28px;}

/* ── Info boxes ── */
.ibox{border-radius:6px;padding:8px 12px;margin-top:8px;font-size:10px;}
.ibox-blue{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;}
.ibox-green{background:#f0fdf4;border:1px solid #86efac;color:#166534;}
.ibox-red{background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;}
.ibox strong{display:block;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}

/* ── Approval cards ── */
.apcards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;}
.apcard{background:#f6faf8;border:1px solid #d0e8da;border-radius:6px;padding:8px;}
.apcard label{display:block;font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#6B8A78;margin-bottom:2px;}
.apcard span{font-size:10px;font-weight:600;}

/* ── Audit trail ── */
.aud{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:9px;}
.aud-t{color:#9ca3af;flex-shrink:0;width:120px;}
.aud-a{font-weight:700;color:#1e3a5f;flex-shrink:0;width:100px;}
.aud-d{color:#6B8A78;flex:1;}

/* ── Footer ── */
.ft{margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af;}

/* ── Print: hide browser UI, use @page margins ── */
@media print{
  html,body{margin:0;padding:0;}
  .doc{padding:0;}
}
</style>
</head>
<body>
<div class="doc">

  <!-- Document header -->
  <div class="dh">
    <div class="brand">Manufacturing Checklist System · Official Record</div>
    <div class="dtitle">${cl.name}</div>
    <span class="badge">${(STATUS_LABEL[cl.status]||cl.status).replace(/[📝🔒📤⏳✅❌⊘]/g,"").trim()}</span>
    ${cl.clonedFrom?`<span style="margin-left:6px;font-size:8px;color:#6B8A78;">⎘ Clone</span>`:""}
  </div>

  <!-- Meta info -->
  <div class="meta">
    <div class="mi"><label>Checklist ID</label><span>${cl.id}</span></div>
    <div class="mi"><label>Department</label><span>${cl.department||"—"}</span></div>
    <div class="mi"><label>Shift</label><span>${cl.shift||"—"}</span></div>
    <div class="mi"><label>Schedule</label><span>${cl.frequency||"—"}</span></div>
    <div class="mi"><label>Created By</label><span>${cl.createdBy||"—"}</span></div>
    <div class="mi"><label>Fill Type</label><span>${cl.fillType||"—"}</span></div>
    ${cl.approverName?`<div class="mi"><label>Approver</label><span>${cl.approverName}</span></div>`:""}
    ${cl.createdAt?`<div class="mi"><label>Created</label><span>${fmtDT(cl.createdAt)}</span></div>`:""}
    ${cl.finalizedAt?`<div class="mi"><label>Finalized</label><span>${fmtDT(cl.finalizedAt)}</span></div>`:""}
    ${cl.submittedAt?`<div class="mi"><label>Submitted</label><span>${fmtDT(cl.submittedAt)}</span></div>`:""}
    ${cl.approvedAt?`<div class="mi"><label>Approved</label><span>${fmtDT(cl.approvedAt)}</span></div>`:""}
    ${cl.rejectedAt?`<div class="mi"><label>Rejected</label><span>${fmtDT(cl.rejectedAt)}</span></div>`:""}
    ${cl.selectedDate?`<div class="mi"><label>Fill Date</label><span>${cl.selectedDate}</span></div>`:""}
  </div>

  <!-- Fill completion progress -->
  <div class="prog">
    <div class="prog-lbl"><span>Fill Completion</span><strong>${filledFill}/${totalFill} cells · ${pct}%</strong></div>
    <div class="prog-bg"><div class="prog-fill"></div></div>
  </div>

  ${cl.submissionRemarks?`<div class="ibox ibox-blue"><strong>Submission Remarks</strong>${cl.submissionRemarks}</div>`:""}
  ${cl.submissionComments?`<div class="ibox ibox-blue" style="margin-top:4px;"><strong>Submission Comments</strong>${cl.submissionComments}</div>`:""}

  <!-- Approval / Rejection details -->
  ${(cl.status==="approved"||cl.status==="rejected")?`
  <div class="sh">${cl.status==="approved"?"Approval Details":"Rejection Details"}</div>
  <div class="apcards">
    <div class="apcard"><label>${cl.status==="approved"?"Approved By":"Rejected By"}</label><span>${cl.approvedBy||cl.rejectedBy||"—"}</span></div>
    <div class="apcard"><label>${cl.status==="approved"?"Approved At":"Rejected At"}</label><span>${fmtDT(cl.approvedAt||cl.rejectedAt)}</span></div>
    ${cl.rejectionReason?`<div class="apcard" style="grid-column:1/-1"><label>Rejection Reason</label><span>${cl.rejectionReason}</span></div>`:""}
    ${cl.approvalRemarks?`<div class="apcard" style="grid-column:1/-1"><label>Approver Remarks</label><span>${cl.approvalRemarks}</span></div>`:""}
  </div>`:""}

  <!-- ════ CHECKLIST TABLE ════ -->
  <div class="sh">Checklist Data</div>
  <table class="cl-tbl">
    <thead>
      <tr>
        <th style="width:24px;text-align:center;">#</th>
        ${hdrs.map(h=>`<th class="${h.isFill?"fh":""}">${h.text}</th>`).join("")}
        ${hasRemarks?`<th class="rh" style="width:${isA3?"160px":"120px"};">Remarks</th>`:""}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row,i)=>`
        <tr>
          <td class="num-cell">${i+1}</td>
          ${row.map((cell,ci)=>`<td class="${hdrs[ci]?.isFill?"fill-cell":""}">${cell.value??""}</td>`).join("")}
          ${hasRemarks?`<td class="rmk-cell">${row.find(c=>c.remark)?.remark||""}</td>`:""}
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Audit trail -->
  ${auditEntries.length?`
  <div class="sh">Audit Trail</div>
  ${auditEntries.map(a=>`<div class="aud"><span class="aud-t">${fmtDT(a.timestamp)}</span><span class="aud-a">${a.action}</span><span class="aud-d">${a.userName} — ${a.details}</span></div>`).join("")}
  `:""}

  <!-- Footer -->
  <div class="ft">
    <span>Generated: ${fmtDT(now())} · ${paperSize}</span>
    <span>ID: ${cl.id} · Manufacturing Checklist System</span>
  </div>

</div>
</body>
</html>`;
}

function handleExportPDF(cl, auditLog, paperSize="A4") {
  const entries = auditLog.filter(a=>a.checklistId===cl.id);
  const html = buildPrintHTML(cl, entries, paperSize);
  const blob = new Blob([html],{type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`checklist-${cl.id}-${paperSize}.html`; a.click();
  URL.revokeObjectURL(url);
}

function handlePrint(cl, auditLog, paperSize="A4") {
  const entries = auditLog.filter(a=>a.checklistId===cl.id);
  const html    = buildPrintHTML(cl, entries, paperSize);
  const win     = window.open("","_blank");
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ═══════════════════════════════════════════════════════
//  PAPER SIZE SELECTOR MODAL
// ═══════════════════════════════════════════════════════
function PaperSizeModal({ action, cl, auditLog, onClose }) {
  const [size, setSize] = useState("A4");
  function go() {
    if (action==="print") handlePrint(cl, auditLog, size);
    else handleExportPDF(cl, auditLog, size);
    onClose();
  }
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#3D8B6E] text-white px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold">{action==="print"?"🖨️ Print Checklist":"📄 Export as PDF"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#6B8A78] mb-4">Choose paper size for the {action==="print"?"printout":"exported file"}:</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {PAPER_SIZES.map(s=>(
              <button key={s} onClick={()=>setSize(s)}
                className={`py-4 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${size===s?"border-[#3D8B6E] bg-[#e8f5ee] text-[#3D8B6E]":"border-gray-200 text-gray-500 hover:border-[#3D8B6E]"}`}>
                <span className="text-2xl">{s==="A4"?"📄":"📰"}</span>
                <span>{s}</span>
                <span className="text-[9px] font-normal text-gray-400">{s==="A4"?"210×297mm":"297×420mm"}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={go} className="flex-1 py-2.5 bg-[#3D8B6E] hover:bg-[#2A6B52] text-white text-xs font-bold rounded-xl">
              {action==="print"?"🖨️ Print Now":"📄 Download File"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  STATUS PILL / FREQ PILL
// ═══════════════════════════════════════════════════════
function StatusPill({ status }) {
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${STATUS_CLS[status]||STATUS_CLS.draft}`}>
      {STATUS_LABEL[status]||"Draft"}
    </span>
  );
}
function FreqPill({ freq }) {
  const map={Daily:"bg-blue-100 text-blue-700",Weekly:"bg-purple-100 text-purple-700",Monthly:"bg-yellow-100 text-yellow-800","One Time":"bg-gray-100 text-gray-600"};
  return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${map[freq]||map["One Time"]}`}>{freq}</span>;
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
function Toast({ msg, show }) {
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] bg-[#1A2E24] text-white text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all duration-300 ${show?"opacity-100 translate-y-0":"opacity-0 translate-y-4 pointer-events-none"}`}>
      <span className="text-[#6FAF8F]">✓</span> {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  HEADER
// ═══════════════════════════════════════════════════════
function Header({ user, page, setPage, notifications, onClearNotifs, onMarkAllRead, onLogout }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef();
  useEffect(()=>{
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setNotifOpen(false); };
    document.addEventListener("click",h);
    return ()=>document.removeEventListener("click",h);
  },[]);
  const unread = notifications.filter(n=>!n.read).length;

  return (
    <header className="sticky top-0 z-50 bg-[#3D8B6E] border-b border-green-800 shadow-sm no-print">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-[#3D8B6E] flex items-center justify-center font-bold text-sm">✓</div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white leading-none">Smart Checklist</h1>
              <p className="text-[9px] text-green-200 font-mono">Manufacturing System v4.0</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {[["dashboard","Dashboard"],["checklist","Checklists"],["audit","Audit Log"]].map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${page===p?"bg-white text-[#3D8B6E] font-semibold":"text-white hover:bg-white/20"}`}>{l}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={ref}>
            <button onClick={e=>{e.stopPropagation();setNotifOpen(o=>!o);if(!notifOpen&&unread>0)onMarkAllRead();}}
              className="w-8 h-8 rounded-lg bg-[#2A6B52] text-white flex items-center justify-center hover:bg-[#235740] relative">
              🔔
              {unread>0&&<span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold px-0.5">{Math.min(unread,99)}</span>}
            </button>
            {notifOpen&&(
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="bg-[#3D8B6E] text-white px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">Notifications {unread>0&&<span className="ml-1 bg-red-500 rounded-full px-1.5 text-[9px]">{unread} new</span>}</span>
                  <button onClick={onClearNotifs} className="text-[10px] text-green-200 hover:text-white">Clear all</button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length===0
                    ? <p className="text-xs text-gray-400 text-center py-6">No notifications</p>
                    : notifications.slice(0,25).map((n,i)=>(
                        <div key={i} className={`px-3 py-2.5 ${n.read?"":"bg-green-50/60"}`}>
                          <p className="text-xs text-[#1A2E24] leading-relaxed">{n.msg}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{fmtDT(n.time)}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-[#2A6B52] rounded-lg px-2 py-1">
            <div className="w-6 h-6 rounded-md bg-[#6FAF8F] text-white flex items-center justify-center text-[10px] font-bold">{(user.name||"A")[0].toUpperCase()}</div>
            <div className="hidden sm:block leading-none">
              <span className="text-xs text-white block">{user.name?.split(" ")[0]||"User"}</span>
              <span className="text-[9px] text-green-300 capitalize">{user.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="px-2.5 py-1.5 rounded-lg bg-white text-[#3D8B6E] text-xs font-semibold hover:bg-green-50">Logout</button>
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════
//  LOGIN PAGE
// ═══════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [id,setId]=useState(""); const [pw,setPw]=useState(""); const [showPw,setShowPw]=useState(false); const [error,setError]=useState("");
  function handleSubmit(e){
    e.preventDefault();
    const u=USERS[id.trim()];
    if(u&&u.password===pw){onLogin({id:id.trim(),role:u.role,name:u.name});}
    else{setError("Invalid credentials. Try admin / admin123");setTimeout(()=>setError(""),3000);}
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{background:"linear-gradient(135deg,#e8f5ee 0%,#f0f7f3 50%,#dceee5 100%)"}}>
      <div className="w-full max-w-md rounded-3xl p-8 relative z-10" style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",border:"1px solid rgba(111,175,143,0.2)",boxShadow:"0 20px 60px rgba(61,139,110,0.12)"}}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg mb-4 text-3xl" style={{background:"linear-gradient(135deg,#6FAF8F,#3D8B6E)",color:"#fff"}}>✓</div>
          <h1 className="text-2xl font-bold text-[#1A2E24]">Smart Checklist</h1>
          <p className="text-sm text-[#6B8A78] mt-1">Manufacturing Management System</p>
          <div className="font-mono text-[10px] text-[#6FAF8F] mt-1 tracking-wider">v4.0 · Full Approval Workflow</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2E24] mb-1.5">Employee ID</label>
            <input value={id} onChange={e=>setId(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-xl text-sm outline-none text-[#1A2E24]" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}} placeholder="Enter Employee ID"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1A2E24] mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none text-[#1A2E24]" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}} placeholder="Enter Password"/>
              <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8A78] hover:text-[#3D8B6E] text-xs">{showPw?"🙈":"👁"}</button>
            </div>
          </div>
          {error&&<p className="text-red-500 text-[11px]">{error}</p>}
          <button type="submit" className="w-full text-white py-3 rounded-xl font-semibold text-sm" style={{background:"linear-gradient(135deg,#6FAF8F,#2A6B52)"}}>Sign In →</button>
        </form>
        <div className="mt-5 rounded-xl p-3 border" style={{background:"#f6faf8",borderColor:"#d0e8da"}}>
          <p className="text-[10px] font-semibold text-[#6B8A78] mb-2 uppercase tracking-wide">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map(a=>(
              <button key={a.id} onClick={()=>{setId(a.id);setPw(a.pw);}} className="text-left bg-white rounded-lg px-2 py-1.5 border text-[10px] hover:border-[#6FAF8F] hover:bg-[#e8f5ee] transition-all" style={{borderColor:"#d0e8da"}}>
                <span className="font-semibold text-[#3D8B6E]">{a.id}</span> / {a.pw}<span className="text-[9px] text-gray-400 block">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  APPROVAL ACTION MODAL (Approve / Reject)
// ═══════════════════════════════════════════════════════
function ApprovalActionModal({ checklist, type, onConfirm, onClose }) {
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

// ═══════════════════════════════════════════════════════
//  SUBMIT FOR APPROVAL MODAL
//  — Submitter can set/override approver name + email inline
//  — Rich message box for the approver
//  — Shows full checklist summary before confirming
// ═══════════════════════════════════════════════════════
function SubmitApprovalModal({ cl, onConfirm, onClose }) {
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

        {/* ── Header ── */}
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

          {/* ── Checklist summary ── */}
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

          {/* ── Approver Name ── */}
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

          {/* ── Approver Email ── */}
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

          {/* ── Message to approver ── */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              Message to Approver <span className="text-[#9ca3af] font-normal normal-case">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add context, observations, or any notes for the approver…&#10;e.g. Line 2 morning shift — all readings within spec. Please review fill columns 3–5."
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

          {/* ── Warning note ── */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-[10px] text-amber-700 leading-relaxed">
              After submission, <strong>all checklist fields lock</strong>. The approver will be able to Approve or Reject. You can cancel the submission to edit again if needed.
            </p>
          </div>

          {/* ── Actions ── */}
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

// ═══════════════════════════════════════════════════════
//  ASSIGN APPROVER MODAL
// ═══════════════════════════════════════════════════════
function AssignApproverModal({ cl, onSave, onClose }) {
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
        {/* Header */}
        <div className="bg-[#3D8B6E] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">👤 Assign Approver</h3>
            <p className="text-[10px] text-green-200 mt-0.5 font-mono">{cl.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current assignment banner */}
          {cl.approverName && (
            <div className="bg-[#f0fdf4] border border-[#86efac] rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span className="text-green-600 text-sm">✓</span>
              <div>
                <p className="text-[10px] font-bold text-green-800">Currently Assigned</p>
                <p className="text-xs text-green-700">{cl.approverName}{cl.approverEmail ? ` · ${cl.approverEmail}` : ""}</p>
              </div>
            </div>
          )}

          {/* Approval required toggle */}
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
            {/* Approver Name */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Approver Name <span className="text-red-500">*</span></label>
              <input value={approverName} onChange={e => { setApproverName(e.target.value); setErr(""); }}
                placeholder="e.g. Mr. Sharma / QC Manager"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Approver Email */}
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

// ═══════════════════════════════════════════════════════
//  AUDIT LOG PAGE
// ═══════════════════════════════════════════════════════
function AuditPage({ auditLog, checklists, user }) {
  const [search,setSearch]=useState(""); const [actionFilter,setActionFilter]=useState("");
  const actions=[...new Set(auditLog.map(a=>a.action))];
  const myLog = user.role==="viewer" ? auditLog.filter(a=>{const cl=checklists.find(c=>c.id===a.checklistId);return cl?.createdBy===user.name;}) : auditLog;
  const visible = myLog.filter(a=>
    (!search||a.details?.toLowerCase().includes(search.toLowerCase())||a.userName?.toLowerCase().includes(search.toLowerCase())||a.checklistName?.toLowerCase().includes(search.toLowerCase())) &&
    (!actionFilter||a.action===actionFilter)
  );
  const ACTION_CLR={Created:"bg-blue-50 text-blue-700",Finalized:"bg-amber-50 text-amber-700",Submitted:"bg-cyan-50 text-cyan-700",Approved:"bg-green-50 text-green-700",Rejected:"bg-red-50 text-red-700","Submission Cancelled":"bg-orange-50 text-orange-700",Saved:"bg-gray-50 text-gray-500",Deleted:"bg-red-100 text-red-700"};
  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1A2E24]">Audit Log</h2>
          <p className="text-xs text-[#6B8A78] font-mono">{visible.length} event{visible.length!==1?"s":""} · tamper-proof immutable record</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
            <option value="">All Actions</option>{actions.map(a=><option key={a}>{a}</option>)}
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search log…" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 outline-none w-44"/>
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {visible.length===0 ? (
          <div className="text-center text-xs text-gray-400 py-14"><div className="text-3xl mb-2 opacity-30">🗒️</div>No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-[#f6faf8] text-[#6B8A78] border-y border-gray-100">
                {["Timestamp","Action","User","Checklist","Details"].map(h=><th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {[...visible].reverse().map(a=>(
                  <tr key={a.id} className="border-t border-gray-50 hover:bg-green-50/30">
                    <td className="px-4 py-2 font-mono text-[10px] text-[#6B8A78] whitespace-nowrap">{fmtDT(a.timestamp)}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_CLR[a.action]||"bg-gray-50 text-gray-600"}`}>{a.action}</span></td>
                    <td className="px-4 py-2 font-semibold text-[#1A2E24]">{a.userName}</td>
                    <td className="px-4 py-2 text-[#6B8A78] max-w-[140px] truncate">{a.checklistName||a.checklistId}</td>
                    <td className="px-4 py-2 text-[#6B8A78] max-w-[300px]">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════════════
function DashboardPage({ user, checklists, bookmarks, setChecklists, setBookmarks, addNotif, addAudit, showToast, setPage, setChecklistAction }) {
  const [tab,setTab]=useState("all"); const [search,setSearch]=useState(""); const [dept,setDept]=useState(""); const [pageNum,setPageNum]=useState(0);
  const [approvalModal,setApprovalModal]=useState(null);
  const [paperModal,setPaperModal]=useState(null);
  const PAGE=10;

  const today=new Date().toDateString(); const hour=new Date().getHours();
  const greet=hour<12?"morning":hour<17?"afternoon":"evening";
  const todayLists=checklists.filter(l=>new Date(l.createdAt).toDateString()===today);
  const statPending=checklists.filter(l=>l.status==="pending"||l.status==="submitted").length;
  const statApproved=checklists.filter(l=>l.status==="approved").length;
  const bIds=bookmarks.map(b=>b.id);

  let filtered=[...checklists].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(user.role==="operator")filtered=filtered.filter(l=>l.createdBy===user.name||l.createdById===user.id);
  if(tab==="today")filtered=filtered.filter(l=>new Date(l.createdAt).toDateString()===today);
  if(tab==="pending")filtered=filtered.filter(l=>l.status==="pending"||l.status==="submitted");
  if(tab==="approved")filtered=filtered.filter(l=>l.status==="approved");
  if(tab==="rejected")filtered=filtered.filter(l=>l.status==="rejected");
  if(tab==="bookmarked")filtered=filtered.filter(l=>bIds.includes(l.id));
  if(search){const q=search.toLowerCase();filtered=filtered.filter(l=>l.name?.toLowerCase().includes(q)||l.id?.toLowerCase().includes(q)||l.createdBy?.toLowerCase().includes(q));}
  if(dept)filtered=filtered.filter(l=>l.department===dept);
  const pages=Math.ceil(filtered.length/PAGE), pg=Math.min(pageNum,Math.max(0,pages-1));
  const slice=filtered.slice(pg*PAGE,(pg+1)*PAGE);

  function deleteChecklist(id){
    if(!confirm("Delete this checklist?"))return;
    const cl=checklists.find(l=>l.id===id);
    setChecklists(prev=>prev.filter(l=>l.id!==id));
    addAudit(id,"Deleted",user,`Checklist "${cl?.name}" deleted`,cl?.name);
    showToast("Deleted");
  }

  function handleApprovalConfirm({remarks,reason}){
    const {cl,type}=approvalModal; const isApprove=type==="approve"; const ts=now();
    setChecklists(prev=>prev.map(l=>l.id===cl.id?{...l,status:isApprove?"approved":"rejected",approvedAt:isApprove?ts:undefined,rejectedAt:isApprove?undefined:ts,approvedBy:isApprove?user.name:undefined,rejectedBy:isApprove?undefined:user.name,approvalRemarks:remarks,rejectionReason:isApprove?undefined:reason,updatedAt:ts}:l));
    addAudit(cl.id,isApprove?"Approved":"Rejected",user,isApprove?`Approved. Remarks: ${remarks}`:`Rejected. Reason: ${reason}. Remarks: ${remarks}`,cl.name);
    addNotif({msg:isApprove?`✅ "${cl.name}" approved by ${user.name}`:`❌ "${cl.name}" rejected by ${user.name}. Reason: ${reason}`,time:ts,read:false});
    showToast(isApprove?"✅ Approved!":"❌ Rejected");
    setApprovalModal(null);
  }

  const TABS=[["all","All"],["today","Today"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["bookmarked","🔖 Saved"]];
  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1A2E24]">Good {greet}, {user.name?.split(" ")[0]||"User"} 👋</h2>
          <p className="text-xs text-[#6B8A78] font-mono">{new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        {(user.role==="admin"||user.role==="operator")&&(
          <button onClick={()=>{setPage("checklist");setChecklistAction({type:"create"});}}
            className="bg-[#3D8B6E] hover:bg-[#2A6B52] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all">+ New Checklist</button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[{label:"Total",value:checklists.length,sub:"all checklists",icon:"📋",color:"bg-blue-50"},{label:"Today",value:todayLists.length,sub:"created today",icon:"📅",color:"bg-indigo-50"},{label:"Pending",value:statPending,sub:"awaiting review",icon:"⏳",color:"bg-yellow-50"},{label:"Approved",value:statApproved,sub:"approved",icon:"✅",color:"bg-green-50"},{label:"Bookmarked",value:bookmarks.length,sub:"templates",icon:"🔖",color:"bg-orange-50"}].map(s=>(
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-[#6B8A78] font-semibold uppercase tracking-wide">{s.label}</span><div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center text-sm`}>{s.icon}</div></div>
            <div className="text-2xl font-bold text-[#1A2E24] font-mono">{s.value}</div>
            <div className="text-[10px] text-[#6B8A78] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 flex-wrap">{TABS.map(([t,l])=><button key={t} onClick={()=>{setTab(t);setPageNum(0);}} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${tab===t?"bg-[#3D8B6E] text-white":"text-gray-500 hover:bg-gray-100"}`}>{l}</button>)}</div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e=>{setSearch(e.target.value);setPageNum(0);}} placeholder="Search…" className="pl-3 pr-3 py-1.5 rounded-lg text-xs w-40 outline-none" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}}/>
            <select value={dept} onChange={e=>{setDept(e.target.value);setPageNum(0);}} className="px-2 py-1.5 rounded-lg text-xs outline-none" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}}>
              <option value="">All Depts</option>{DEPTS.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#f6faf8] text-[#6B8A78] border-y border-gray-100">
              <th className="px-4 py-2.5 text-left font-semibold">Checklist</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Dept</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">By</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Schedule</th>
              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Date</th>
              <th className="px-4 py-2.5 text-center font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {slice.length===0?(
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6B8A78]">
                  <div className="text-2xl mb-2 opacity-30">📥</div>No checklists yet.{" "}
                  {(user.role==="admin"||user.role==="operator")&&<button onClick={()=>{setPage("checklist");setChecklistAction({type:"create"});}} className="text-[#3D8B6E] font-semibold hover:underline">Create one</button>}
                </td></tr>
              ):slice.map(l=>{
                const dt=new Date(l.createdAt);
                const canFill=PERM.canEdit(l,user);
                const canAR=PERM.canApproveReject(l,user);
                return(
                  <tr key={l.id} className="border-t border-gray-50 hover:bg-green-50/40 cursor-pointer" onClick={()=>{setPage("checklist");setChecklistAction({type:canFill?"fill":"view",id:l.id});}}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#1A2E24]">{l.name||"—"} {bIds.includes(l.id)&&<span className="text-orange-400 text-[9px]">🔖</span>}</div>
                      <div className="text-[10px] text-[#6B8A78] font-mono">{l.id}</div>
                      {l.rejectionReason&&<div className="text-[9px] text-red-500 mt-0.5 max-w-[180px] truncate">↳ {l.rejectionReason}</div>}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-[#6B8A78]">{l.department||"—"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-[#6B8A78]">{l.createdBy||"—"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell"><FreqPill freq={l.frequency}/></td>
                    <td className="px-4 py-2.5"><StatusPill status={l.status}/></td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-[10px] text-[#6B8A78] font-mono">{dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}<br/><span className="opacity-70">{dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span></td>
                    <td className="px-4 py-2.5" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {/* Edit */}
                        {canFill&&<button onClick={()=>{setPage("checklist");setChecklistAction({type:"fill",id:l.id});}} className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center" title="Edit">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>}
                        {/* View */}
                        <button onClick={()=>{setPage("checklist");setChecklistAction({type:"view",id:l.id});}} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center" title="View">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        {/* Clone */}
                        {(user.role==="admin"||user.role==="operator")&&<button onClick={()=>{setPage("checklist");setChecklistAction({type:"clone",id:l.id});}} className="w-6 h-6 rounded-md bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white flex items-center justify-center transition-all" title="Clone for another line/shift">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>}
                        {/* Approve / Reject */}
                        {canAR&&<>
                          <button onClick={()=>setApprovalModal({cl:l,type:"approve"})} className="w-6 h-6 rounded-md bg-green-50 text-green-700 hover:bg-green-600 hover:text-white flex items-center justify-center transition-all" title="Approve">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={()=>setApprovalModal({cl:l,type:"reject"})} className="w-6 h-6 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Reject">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </>}
                        {/* Print */}
                        {PERM.canPrint(l)&&<button onClick={()=>setPaperModal({cl:l,action:"print"})} className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white flex items-center justify-center transition-all" title="Print">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>}
                        {/* Export PDF */}
                        {PERM.canExport(l)&&<button onClick={()=>setPaperModal({cl:l,action:"export"})} className="w-6 h-6 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all" title="Export PDF">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </button>}
                        {/* Delete */}
                        {PERM.canDelete(l,user)&&<button onClick={()=>deleteChecklist(l.id)} className="w-6 h-6 rounded-md bg-red-50 text-red-500 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Delete">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10px] text-[#6B8A78] font-mono">
            {filtered.length} record{filtered.length!==1?"s":""}{pages>1?` · Page ${pg+1} of ${pages}`:""}
          </span>
          {pages>1&&(
            <div className="flex items-center gap-1">
              {/* ← Prev */}
              <button
                onClick={()=>setPageNum(p=>Math.max(0,p-1))}
                disabled={pg===0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-[#e8f5ee] hover:border-[#3D8B6E] hover:text-[#3D8B6E] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Prev
              </button>

              {/* Page number buttons — max 5 visible with ellipsis */}
              {Array.from({length:pages},(_,i)=>i)
                .filter(i=>{
                  if(pages<=5) return true;
                  if(i===0||i===pages-1) return true;
                  if(Math.abs(i-pg)<=1) return true;
                  return false;
                })
                .reduce((acc,i,idx,arr)=>{
                  if(idx>0 && arr[idx-1]!==i-1) acc.push("…");
                  acc.push(i);
                  return acc;
                },[])
                .map((item,idx)=>
                  item==="…"
                    ? <span key={`e${idx}`} className="px-1 text-[11px] text-gray-400 select-none">…</span>
                    : <button
                        key={item}
                        onClick={()=>setPageNum(item)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition-all border ${item===pg?"bg-[#3D8B6E] text-white border-[#3D8B6E] shadow-sm":"bg-white text-gray-600 border-gray-200 hover:bg-[#e8f5ee] hover:border-[#3D8B6E] hover:text-[#3D8B6E]"}`}>
                        {item+1}
                      </button>
                )
              }

              {/* Next → */}
              <button
                onClick={()=>setPageNum(p=>Math.min(pages-1,p+1))}
                disabled={pg>=pages-1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-[#e8f5ee] hover:border-[#3D8B6E] hover:text-[#3D8B6E] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#1A2E24]">📌 Bookmarked Templates</h3>
          <button onClick={()=>{setPage("checklist");setChecklistAction({type:"bookmarks"});}} className="text-xs text-[#3D8B6E] font-semibold hover:underline">View all</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {bookmarks.length===0
            ?<div className="col-span-full bg-white border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400 py-8">No bookmarked templates yet</div>
            :bookmarks.slice(0,8).map(bm=>(
                <div key={bm.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:border-[#6FAF8F] hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-1 mb-2"><div><div className="text-xs font-semibold text-[#1A2E24]">{bm.name}</div><div className="text-[9px] text-[#6B8A78] mt-0.5">{bm.department||""} · {bm.frequency||""}</div></div><span className="text-orange-400 text-xs">🔖</span></div>
                  <div className="flex gap-1.5">
                    <button className="flex-1 bg-[#3D8B6E] hover:bg-[#2A6B52] text-white text-[10px] py-1.5 rounded-lg font-semibold" onClick={()=>{setPage("checklist");setChecklistAction({type:"template",id:bm.id});}}>Use Template</button>
                    <button className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 text-[10px]" onClick={()=>{setBookmarks(prev=>prev.filter(b=>b.id!==bm.id));showToast("Bookmark removed");}}>🗑</button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {user.role==="approver"&&checklists.filter(l=>l.status==="pending"||l.status==="submitted").length>0&&(
        <FloatingApprovalPanel checklists={checklists} onApprove={cl=>setApprovalModal({cl,type:"approve"})} onReject={cl=>setApprovalModal({cl,type:"reject"})}/>
      )}

      {approvalModal&&<ApprovalActionModal checklist={approvalModal.cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={()=>setApprovalModal(null)}/>}
      {paperModal&&<PaperSizeModal action={paperModal.action} cl={paperModal.cl} auditLog={[]} onClose={()=>setPaperModal(null)}/>}
    </main>
  );
}

function FloatingApprovalPanel({ checklists, onApprove, onReject }) {
  const [open,setOpen]=useState(true);
  const pending=checklists.filter(l=>l.status==="pending"||l.status==="submitted");
  if(!open||!pending.length)return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-[#3D8B6E] rounded-2xl shadow-xl p-4 w-80">
      <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold text-[#1A2E24]">⏳ Pending Approvals ({pending.length})</h4><button onClick={()=>setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button></div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {pending.map(l=>(
          <div key={l.id} className="flex items-center justify-between gap-2 bg-[#f6faf8] rounded-lg px-2 py-1.5">
            <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-[#1A2E24] truncate">{l.name}</div><div className="text-[9px] text-[#6B8A78]">{l.createdBy} · {l.department}</div></div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={()=>onApprove(l)} className="w-6 h-6 rounded-md bg-green-100 text-green-600 text-[10px] hover:bg-green-200" title="Approve">✓</button>
              <button onClick={()=>onReject(l)}  className="w-6 h-6 rounded-md bg-red-100 text-red-500 text-[10px] hover:bg-red-200"  title="Reject">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  FILL FIELD
// ═══════════════════════════════════════════════════════
function FillField({ type, opts, value, onChange, disabled }) {
  const cls="w-full text-[11px] bg-transparent border-none outline-none";
  switch(type){
    case "Number Input": return <input type="number" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="0" className={cls}/>;
    case "Checkbox":     return <div className="flex items-center justify-center"><input type="checkbox" checked={!!value} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#3D8B6E]"/></div>;
    case "OK / NG": case "Pass / Fail": case "Yes / No": {
      const options=type==="OK / NG"?["OK","NG"]:type==="Pass / Fail"?["Pass","Fail"]:["Yes","No"];
      return <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={cls+" cursor-pointer"}><option value="">—</option>{options.map(o=><option key={o}>{o}</option>)}</select>;
    }
    case "Custom Dropdown": return <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={cls+" cursor-pointer"}><option value="">—</option>{(opts||[]).map(o=><option key={o}>{o}</option>)}</select>;
    default: return <input type="text" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="—" className={cls}/>;
  }
}

// ═══════════════════════════════════════════════════════
//  CHECKLIST EDITOR
// ═══════════════════════════════════════════════════════
function ChecklistEditor({ cl:initialCl, viewMode, user, auditLog, onSaveClose, onBack, showToast, addNotif, addAudit, bookmarks, setBookmarks, setChecklists }) {
  const [cl,setCl]=useState(()=>{
    const c={...initialCl};
    if(!c.tableData){const rows=c.rows||5,cols=c.cols||4;c.tableData={headers:Array.from({length:cols},(_,i)=>({text:`Checkpoint ${i+1}`,isFill:false})),rows:Array.from({length:rows},()=>Array.from({length:cols},()=>({value:""})))};}
    return c;
  });
  const [showSubmitModal,setShowSubmitModal]=useState(false);
  const [showCalModal,setShowCalModal]=useState(false);
  const [calViewDate,setCalViewDate]=useState(new Date());
  const [calSelected,setCalSelected]=useState(null);
  const [approvalModal,setApprovalModal]=useState(null);
  const [paperModal,setPaperModal]=useState(null);
  const [showCloneModal,setShowCloneModal]=useState(false); // clone from inside editor

  const isView     = viewMode;
  const isRecurring= ["Daily","Weekly","Monthly"].includes(cl.frequency);
  const editable   = !isView && PERM.canEdit(cl,user);
  const canFin     = !isView && PERM.canFinalize(cl,user);
  const canSub     = !isView && PERM.canSubmit(cl,user);
  const canCancel  = !isView && PERM.canCancelSubmit(cl,user);
  const canAR      = !isView && PERM.canApproveReject(cl,user);
  const showLocked = ["finalized","submitted","pending","approved","rejected","cancelled"].includes(cl.status) && !editable && !isView;

  function persist(updated){
    setChecklists(prev=>{const idx=prev.findIndex(l=>l.id===updated.id);if(idx>=0){const n=[...prev];n[idx]=updated;return n;}return [...prev,updated];});
  }

  function updateCellValue(ri,ci,val){setCl(p=>({...p,tableData:{...p.tableData,rows:p.tableData.rows.map((row,r)=>r===ri?row.map((cell,c)=>c===ci?{...cell,value:val}:cell):row)}}));}
  function updateHeader(ci,text){setCl(p=>({...p,tableData:{...p.tableData,headers:p.tableData.headers.map((h,i)=>i===ci?{...h,text}:h)}}));}
  function addRow(){setCl(p=>{const cols=p.tableData.headers.length;return{...p,tableData:{...p.tableData,rows:[...p.tableData.rows,Array.from({length:cols},()=>({value:""}))]}};});}
  function removeRow(){setCl(p=>{if(p.tableData.rows.length<=1)return p;return{...p,tableData:{...p.tableData,rows:p.tableData.rows.slice(0,-1)}};});}
  function addCheckpointCol(){setCl(p=>{const count=p.tableData.headers.filter(h=>!h.isFill).length;const newH=[...p.tableData.headers];const at=newH.findIndex(h=>h.isFill);const idx=at===-1?newH.length:at;newH.splice(idx,0,{text:`Checkpoint ${count+1}`,isFill:false});return{...p,tableData:{headers:newH,rows:p.tableData.rows.map(r=>{const n=[...r];n.splice(idx,0,{value:""});return n;})}};});}
  function removeCheckpointCol(){setCl(p=>{const idx=p.tableData.headers.map((h,i)=>({h,i})).filter(x=>!x.h.isFill).map(x=>x.i);if(!idx.length){showToast("No checkpoints to remove");return p;}const last=idx[idx.length-1];return{...p,tableData:{headers:p.tableData.headers.filter((_,i)=>i!==last),rows:p.tableData.rows.map(r=>r.filter((_,i)=>i!==last))}};});}
  function addFillCol(){setCl(p=>{const count=p.tableData.headers.filter(h=>h.isFill).length;return{...p,tableData:{headers:[...p.tableData.headers,{text:`Fill ${count+1}`,isFill:true}],rows:p.tableData.rows.map(r=>[...r,{value:""}])}};});}
  function removeFillCol(){setCl(p=>{const idx=p.tableData.headers.map((h,i)=>({h,i})).filter(x=>x.h.isFill).map(x=>x.i);if(!idx.length){showToast("No fill columns to remove");return p;}const last=idx[idx.length-1];return{...p,tableData:{headers:p.tableData.headers.filter((_,i)=>i!==last),rows:p.tableData.rows.map(r=>r.filter((_,i)=>i!==last))}};});}

  // Update the row-level remark stored on row[0].remark
  // Using row[0] as a carrier is safe since we never allow 0 cols
  function updateRowRemark(ri, val) {
    setCl(p=>({
      ...p,
      tableData:{
        ...p.tableData,
        rows: p.tableData.rows.map((row,r)=>
          r===ri
            ? row.map((cell,ci)=> ci===0 ? {...cell, remark:val} : cell)
            : row
        )
      }
    }));
  }

  function save(goBack){
    if(!editable){showToast("Checklist is locked");return;}
    const updated={...cl,updatedAt:now()};
    if(cl.selectedDate)updated.dateEntries={...(cl.dateEntries||{}),[cl.selectedDate]:cl.tableData};
    persist(updated);setCl(updated);
    addAudit(cl.id,"Saved",user,"Data saved",cl.name);
    if(goBack){showToast("Saved");setTimeout(onSaveClose,400);}else showToast("Saved!");
  }

  function handleFinalize(){
    const ts=now(); const updated={...cl,status:STATUS.FINALIZED,finalizedAt:ts,updatedAt:ts};
    if(cl.selectedDate)updated.dateEntries={...(cl.dateEntries||{}),[cl.selectedDate]:cl.tableData};
    persist(updated);setCl(updated);
    addAudit(cl.id,"Finalized",user,"All fields locked. Ready for submission.",cl.name);
    addNotif({msg:`🔒 "${cl.name}" finalized by ${user.name}`,time:ts,read:false});
    showToast("🔒 Checklist finalized! Fields are now locked.");
  }

  function handleSubmitConfirm(remarksOrObj){
    // SubmitApprovalModal may pass a string (old) or object {approverName,approverEmail,remarks,comments}
    const isObj = typeof remarksOrObj === "object" && remarksOrObj !== null;
    const approverName  = isObj ? (remarksOrObj.approverName  || cl.approverName  || "") : (cl.approverName  || "");
    const approverEmail = isObj ? (remarksOrObj.approverEmail || cl.approverEmail || "") : (cl.approverEmail || "");
    const remarks       = isObj ? (remarksOrObj.remarks  || "") : (remarksOrObj || "");
    const comments      = isObj ? (remarksOrObj.comments || "") : "";

    const ts=now();
    const updated={
      ...cl,
      status:STATUS.SUBMITTED, submittedAt:ts, updatedAt:ts,
      approverName, approverEmail,
      submissionRemarks:remarks,
      submissionComments:comments,
    };
    if(cl.selectedDate)updated.dateEntries={...(cl.dateEntries||{}),[cl.selectedDate]:cl.tableData};
    persist(updated);setCl(updated);
    addAudit(cl.id,"Submitted",user,
      `Submitted to ${approverName||"approver"}. Remarks: ${remarks||"none"}${comments?`. Comments: ${comments}`:""}`,
      cl.name);
    addNotif({msg:`📤 "${cl.name}" submitted by ${user.name}${approverName?` to ${approverName}`:""}`,time:ts,read:false});
    showToast("📤 Submitted for Approval!");
    setShowSubmitModal(false);
    setTimeout(onSaveClose,700);
  }

  function handleCancelSubmission(){
    if(!confirm("Cancel this submission? The checklist will return to Draft and become editable."))return;
    const ts=now(); const updated={...cl,status:STATUS.DRAFT,submittedAt:null,finalizedAt:null,updatedAt:ts};
    persist(updated);setCl(updated);
    addAudit(cl.id,"Submission Cancelled",user,"Submission cancelled — returned to Draft",cl.name);
    addNotif({msg:`🚫 "${cl.name}" submission cancelled by ${user.name}`,time:ts,read:false});
    showToast("Submission cancelled. Checklist is now editable.");
  }

  function handleApprovalConfirm({remarks,reason}){
    const {type}=approvalModal; const isApprove=type==="approve"; const ts=now();
    const updated={...cl,status:isApprove?"approved":"rejected",approvedAt:isApprove?ts:undefined,rejectedAt:isApprove?undefined:ts,approvedBy:isApprove?user.name:undefined,rejectedBy:isApprove?undefined:user.name,approvalRemarks:remarks,rejectionReason:isApprove?undefined:reason,updatedAt:ts};
    persist(updated);setCl(updated);
    addAudit(cl.id,isApprove?"Approved":"Rejected",user,isApprove?`Approved. Remarks: ${remarks}`:`Rejected. Reason: ${reason}. Remarks: ${remarks}`,cl.name);
    addNotif({msg:isApprove?`✅ "${cl.name}" approved by ${user.name}`:`❌ "${cl.name}" rejected. Reason: ${reason}`,time:ts,read:false});
    showToast(isApprove?"✅ Approved!":"❌ Rejected");
    setApprovalModal(null);
    setTimeout(onSaveClose,500);
  }

  function handleBookmark(){
    if(bookmarks.find(b=>b.id===cl.id)){showToast("Already bookmarked!");return;}
    setBookmarks(prev=>[...prev,{...cl}]);
    showToast("📌 Bookmarked!");
  }

  function openCalDate(){
    if(!calSelected||!cl)return;
    setShowCalModal(false);
    const existing=cl.dateEntries?.[calSelected];
    setCl({...cl,selectedDate:calSelected,tableData:existing||cl.tableData});
    if(!existing)showToast("No data for this date — fill it now");
  }

  const clAuditEntries = auditLog.filter(a=>a.checklistId===cl.id);

  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      <div className="action-bar flex flex-wrap items-center gap-2 mb-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        {/* Back */}
        <button onClick={onBack} className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>

        {editable&&<>
          <button onClick={addRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] hover:bg-[#3D8B6E] hover:text-white font-semibold transition-all">+ Row</button>
          <button onClick={removeRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-semibold transition-all">- Row</button>
          <button onClick={addCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-500 hover:text-white font-semibold transition-all">+ Col</button>
          <button onClick={removeCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-semibold transition-all">- Col</button>
          <button onClick={addFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1e5c42] text-white hover:bg-[#14412e] font-semibold transition-all">+ Fill</button>
          <button onClick={removeFillCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-semibold transition-all">- Fill</button>
          {isRecurring&&(
            <button onClick={()=>{setCalViewDate(new Date());setCalSelected(null);setShowCalModal(true);}}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-500 hover:text-white font-semibold transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Calendar
            </button>
          )}
          {/* Bookmark */}
          <button onClick={handleBookmark} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-500 hover:text-white font-semibold transition-all flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Bookmark
          </button>
          {/* Save */}
          <button onClick={()=>save(false)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save
          </button>
          <button onClick={()=>save(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#3D8B6E] text-white hover:bg-[#2A6B52] font-semibold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save & Close
          </button>
        </>}

        {/* Clone button — visible always, even in view/locked mode, for quick duplication */}
        {(user.role==="admin"||user.role==="operator")&&(
          <button onClick={()=>setShowCloneModal(true)}
            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#1e5c42] hover:text-white font-semibold transition-all flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Clone
          </button>
        )}

        {isView&&<div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Only
        </div>}
        {showLocked&&<div className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-bold flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Locked — {STATUS_LABEL[cl.status]}
        </div>}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Finalize */}
          {canFin&&<button onClick={handleFinalize} className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Finalize
          </button>}
          {/* Submit */}
          {canSub&&<button onClick={()=>setShowSubmitModal(true)} className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit for Approval
          </button>}
          {/* Cancel submission */}
          {canCancel&&<button onClick={handleCancelSubmission} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Cancel Submission
          </button>}
          {/* Approve / Reject */}
          {canAR&&<>
            <button onClick={()=>setApprovalModal({type:"approve"})} className="text-[10px] px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Approve
            </button>
            <button onClick={()=>setApprovalModal({type:"reject"})} className="text-[10px] px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject
            </button>
          </>}
          {/* Print */}
          {PERM.canPrint(cl)&&<button onClick={()=>setPaperModal({action:"print"})} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-800 hover:bg-purple-600 hover:text-white font-semibold flex items-center gap-1 transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print
          </button>}
          {/* Export PDF */}
          {PERM.canExport(cl)&&<button onClick={()=>setPaperModal({action:"export"})} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-800 hover:bg-orange-500 hover:text-white font-semibold flex items-center gap-1 transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> Export PDF
          </button>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#3D8B6E] text-white px-4 py-2.5 flex flex-wrap gap-3 items-center text-[10px]">
          <span className="font-bold text-sm">{cl.name}</span>
          <span className="font-mono opacity-70">{cl.id}</span>
          <span>Dept: <b>{cl.department}</b></span>
          <span>Shift: <b>{cl.shift}</b></span>
          <span>Schedule: <b>{cl.frequency}</b></span>
          <span>Fill: <b>{cl.fillType}</b></span>
          {cl.clonedFrom&&<span className="bg-white/20 rounded px-2 py-0.5 font-mono text-[9px]">⎘ Clone</span>}
          {cl.selectedDate&&<span>📅 <b>{cl.selectedDate}</b></span>}
          <span className="ml-auto"><StatusPill status={cl.status}/></span>
        </div>

        {cl.status===STATUS.FINALIZED&&(
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
            <span className="font-bold">🔒 Finalized</span> on {fmtDT(cl.finalizedAt)} · All fields are locked. Click <b>Submit for Approval</b> to proceed.
          </div>
        )}
        {(cl.status===STATUS.SUBMITTED||cl.status===STATUS.PENDING)&&(
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-xs text-blue-800">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span>📤 <b>Submitted for approval</b> on {fmtDT(cl.submittedAt)} · Editing is locked until an approver acts.</span>
              {cl.submissionRemarks&&<span className="italic text-blue-600">Note: {cl.submissionRemarks}</span>}
            </div>
          </div>
        )}
        {cl.status===STATUS.APPROVED&&(
          <div className="bg-green-50 border-b border-green-200 px-4 py-2.5 text-xs text-green-900 space-y-0.5">
            <div>✅ <b>Approved</b> by <b>{cl.approvedBy}</b> on {fmtDT(cl.approvedAt)}</div>
            {cl.approvalRemarks&&<div className="text-green-700">Remarks: {cl.approvalRemarks}</div>}
          </div>
        )}
        {cl.status===STATUS.REJECTED&&(
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-xs text-red-900 space-y-0.5">
            <div>❌ <b>Rejected</b> by <b>{cl.rejectedBy}</b> on {fmtDT(cl.rejectedAt)}</div>
            {cl.rejectionReason&&<div><b>Reason:</b> {cl.rejectionReason}</div>}
            {cl.approvalRemarks&&<div>Remarks: {cl.approvalRemarks}</div>}
          </div>
        )}

        {cl.status===STATUS.APPROVED&&(
          <div className="border-t border-gray-100 px-4 py-3 bg-green-50">
            <p className="text-[10px] font-bold text-[#6B8A78] uppercase mb-2">Approval Details</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Approved By",cl.approvedBy||"—"],["Approved At",fmtDT(cl.approvedAt)],["Submitted By",cl.createdBy||"—"],["Department",cl.department||"—"]].map(([l,v])=>(
                <div key={l} className="bg-white rounded-lg px-3 py-2 border border-green-200">
                  <div className="text-[9px] text-[#6B8A78] uppercase tracking-wide mb-0.5">{l}</div>
                  <div className="text-xs font-semibold text-[#1A2E24]">{v}</div>
                </div>
              ))}
              {cl.approvalRemarks&&(
                <div className="col-span-full bg-white rounded-lg px-3 py-2 border border-green-200">
                  <div className="text-[9px] text-[#6B8A78] uppercase tracking-wide mb-0.5">Approval Remarks</div>
                  <div className="text-xs text-[#1A2E24]">{cl.approvalRemarks}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-auto" style={{maxHeight:"calc(100vh - 310px)"}}>
          <table style={{borderCollapse:"collapse",width:"max-content",minWidth:"100%"}}>
            <thead>
              <tr>
                <th style={{background:"#4B9B7A",color:"white",border:"1px solid #d1d5db",padding:"4px 8px",fontSize:11,minWidth:30,maxWidth:30,textAlign:"center",position:"sticky",top:0,zIndex:10}}>#</th>
                {cl.tableData.headers.map((h,ci)=>(
                  <th key={ci} style={{background:h.isFill?"#1e5c42":"#3D8B6E",color:"white",border:"1px solid #d1d5db",padding:"4px 8px",fontSize:10,fontWeight:600,minWidth:h.isFill?120:110,position:"sticky",top:0,zIndex:10}}>
                    {!editable?h.text:(<span contentEditable suppressContentEditableWarning onBlur={e=>updateHeader(ci,e.target.innerText)} style={{display:"block",outline:"none"}}>{h.text}</span>)}
                  </th>
                ))}
                {/* Remark column — always shown, auto-appended after fill columns */}
                <th style={{background:"#4a3a6b",color:"white",border:"1px solid #d1d5db",padding:"4px 8px",fontSize:10,fontWeight:600,minWidth:160,position:"sticky",top:0,zIndex:10}}>
                  Remarks / Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {cl.tableData.rows.map((row,ri)=>(
                <tr key={ri} style={{background:ri%2===0?"white":"#f9fafb"}}>
                  <td style={{background:"#e5e7eb",color:"#6b7280",fontWeight:700,border:"1px solid #d1d5db",padding:"4px 8px",fontSize:10,textAlign:"center",minWidth:30,maxWidth:30}}>{ri+1}</td>
                  {row.map((cell,ci)=>{
                    const isFill=cl.tableData.headers[ci]?.isFill;
                    const cellLocked=!editable;
                    return isFill?(
                      <td key={ci} style={{background:cellLocked?"#f3f4f6":"#fffbeb",border:"1px solid #d1d5db",padding:"4px 8px",minWidth:120}}>
                        <FillField type={cl.fillType} opts={cl.customOptions} value={cell.value} onChange={v=>updateCellValue(ri,ci,v)} disabled={cellLocked}/>
                      </td>
                    ):(
                      <td key={ci} style={{border:"1px solid #d1d5db",padding:"4px 8px",fontSize:11,background:"white",minWidth:100}}>
                        {cellLocked?cell.value:(<span contentEditable suppressContentEditableWarning onBlur={e=>updateCellValue(ri,ci,e.target.innerText)} style={{display:"block",outline:"none",whiteSpace:"pre-wrap"}}>{cell.value}</span>)}
                      </td>
                    );
                  })}
                  {/* Remark cell — editable input, persisted in row[0].remark (row-level) */}
                  <td style={{background:!editable?"#f5f0ff":"#faf5ff",border:"1px solid #d8b4fe",padding:"4px 8px",minWidth:160}}>
                    {!editable
                      ? <span style={{fontSize:11,color:"#5b21b6",fontStyle:"italic"}}>{row[0]?.remark||""}</span>
                      : <input
                          type="text"
                          value={row[0]?.remark||""}
                          onChange={e=>updateRowRemark(ri,e.target.value)}
                          placeholder="Add remark…"
                          style={{width:"100%",fontSize:11,background:"transparent",border:"none",outline:"none",color:"#5b21b6",fontStyle:"italic"}}
                        />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {clAuditEntries.length>0&&(cl.status===STATUS.APPROVED||cl.status===STATUS.REJECTED||isView)&&(
          <div className="border-t border-gray-100 px-4 py-3 bg-[#f9fafb]">
            <p className="text-[10px] font-bold text-[#6B8A78] uppercase mb-2">Audit Trail</p>
            <div className="space-y-0">
              {[...clAuditEntries].reverse().slice(0,10).map(a=>(
                <div key={a.id} className="flex items-start gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-[#3D8B6E] mt-1.5 flex-shrink-0"/>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#1A2E24]">{a.action}</span>
                      <span className="text-[9px] text-[#6B8A78]">{a.userName}</span>
                      <span className="text-[9px] text-gray-400 font-mono ml-auto">{fmtDT(a.timestamp)}</span>
                    </div>
                    <p className="text-[9px] text-[#6B8A78] mt-0.5">{a.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSubmitModal&&<SubmitApprovalModal cl={cl} onConfirm={handleSubmitConfirm} onClose={()=>setShowSubmitModal(false)}/>}
      {approvalModal&&<ApprovalActionModal checklist={cl} type={approvalModal.type} onConfirm={handleApprovalConfirm} onClose={()=>setApprovalModal(null)}/>}
      {showCalModal&&<CalendarModal cl={cl} calViewDate={calViewDate} setCalViewDate={setCalViewDate} calSelected={calSelected} setCalSelected={setCalSelected} onClose={()=>setShowCalModal(false)} onOpen={openCalDate}/>}
      {paperModal&&<PaperSizeModal action={paperModal.action} cl={cl} auditLog={clAuditEntries} onClose={()=>setPaperModal(null)}/>}
      {/* Clone from inside editor — operator can duplicate current checklist for another line without leaving */}
      {showCloneModal&&(
        <CloneModal
          source={cl}
          user={user}
          onClose={()=>setShowCloneModal(false)}
          onCreate={newCl=>{
            setChecklists(prev=>[...prev,newCl]);
            addAudit(newCl.id,"Cloned",user,`Cloned from "${cl.name}" (${cl.id})`,newCl.name);
            addNotif({msg:`⎘ "${newCl.name}" cloned from "${cl.name}" by ${user.name}`,time:now(),read:false});
            setShowCloneModal(false);
            showToast("⎘ Cloned! Opening new checklist…");
            // Navigate to the new clone
            setTimeout(()=>{ onSaveClose(); },300);
          }}
        />
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════
//  CALENDAR MODAL
// ═══════════════════════════════════════════════════════
function CalendarModal({ cl, calViewDate, setCalViewDate, calSelected, setCalSelected, onClose, onOpen }) {
  const today=new Date(); const todayStr=toDateStr(today);
  const year=calViewDate.getFullYear(); const month=calViewDate.getMonth();
  const filledDates=Object.keys(cl.dateEntries||{}); const weeklyDays=cl.weeklyDays||[]; const isWeekly=cl.frequency==="Weekly";
  const firstDay=new Date(year,month,1).getDay(); const daysInMonth=new Date(year,month+1,0).getDate();
  const days=[];
  for(let i=0;i<firstDay;i++)days.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dateObj=new Date(year,month,d); const dow=dateObj.getDay();
    days.push({d,dateStr,isToday:dateStr===todayStr,isFuture:dateObj>today&&dateStr!==todayStr,isFilled:filledDates.includes(dateStr),isWeekOff:isWeekly&&weeklyDays.length>0&&!weeklyDays.includes(dow),isSelected:dateStr===calSelected});
  }
  function getDayCls(day){
    if(!day)return"";
    if(day.isSelected)return"bg-[#1d4f38] text-white font-bold";
    if(day.isToday)return"bg-[#3D8B6E] text-white font-bold shadow-md";
    if(day.isWeekOff)return"bg-gray-100 text-gray-300 cursor-not-allowed";
    if(day.isFilled)return"bg-green-200 text-green-800 font-bold";
    if(day.isFuture)return"bg-blue-100 text-blue-400 cursor-not-allowed";
    return"bg-red-100 text-red-700 hover:brightness-90";
  }
  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-bold text-[#1A2E24]">📅 Select Date to Fill</h3><p className="text-[9px] text-[#6B8A78] font-mono mt-0.5">{cl.frequency} · {cl.name}</p></div><button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs">✕</button></div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={()=>setCalViewDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n;})} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[10px]">‹</button>
          <span className="text-xs font-bold text-[#1A2E24] font-mono">{calViewDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>setCalViewDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n;})} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[10px]">›</button>
        </div>
        <div className="grid grid-cols-7 mb-1 text-center">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} className="text-[9px] font-bold text-[#6B8A78] py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-0.5 mb-3">{days.map((day,i)=>day?(<div key={i} onClick={()=>(!day.isFuture&&!day.isWeekOff)&&setCalSelected(day.dateStr)} className={`w-8 h-8 mx-auto rounded-md flex items-center justify-center text-[11px] cursor-pointer transition-all relative ${getDayCls(day)}`}>{day.d}{day.isFilled&&!day.isSelected&&!day.isToday&&<span className="absolute top-0.5 right-0.5 text-[6px]">✓</span>}</div>):<div key={i}/>)}</div>
        <div className="flex gap-3 flex-wrap mb-3">{[["bg-[#3D8B6E]","Today"],["bg-green-200","Filled"],["bg-red-100","Past"],["bg-blue-100","Future"]].map(([c,l])=><div key={l} className="flex items-center gap-1 text-[9px] text-[#6B8A78]"><div className={`w-3 h-3 rounded-sm ${c}`}></div>{l}</div>)}</div>
        <div className="flex gap-2"><button onClick={onOpen} disabled={!calSelected} className="flex-1 py-2 bg-[#3D8B6E] text-white text-xs font-bold rounded-xl hover:bg-[#2A6B52] disabled:opacity-40 disabled:cursor-not-allowed">Open Date</button><button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">Cancel</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  CREATE MODAL — Approval settings removed
// ═══════════════════════════════════════════════════════
function CreateModal({ user, onClose, onCreate, prefill }) {
  const [form, setForm] = useState({
    name:          prefill ? prefill.name + " (Copy)" : "",
    createdBy:     prefill?.createdBy || user.name?.split(" ")[0] || "",
    department:    prefill?.department || "Production",
    shift:         prefill?.shift || "Morning",
    frequency:     prefill?.frequency || "One Time",
    weeklyDays:    prefill?.weeklyDays || [],
    rows:          prefill?.rows || 5,
    cols:          prefill?.cols || 4,
    fillType:      prefill?.fillType || "Text Input",
    customOptions: prefill?.customOptions?.join(", ") || "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleWday = d => setForm(p => ({
    ...p,
    weeklyDays: p.weeklyDays.includes(d)
      ? p.weeklyDays.filter(x => x !== d)
      : [...p.weeklyDays, d],
  }));

  function handleCreate() {
    if (!form.name.trim()) return;
    const opts = form.fillType === "Custom Dropdown"
      ? form.customOptions.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const rows = parseInt(form.rows) || 5;
    const cols = parseInt(form.cols) || 4;
    const cl = {
      id:            genId(),
      name:          form.name.trim(),
      createdBy:     form.createdBy || user.name,
      createdById:   user.id,
      createdByRole: user.role,
      department:    form.department,
      shift:         form.shift,
      frequency:     form.frequency,
      weeklyDays:    form.frequency === "Weekly" ? form.weeklyDays : [],
      rows,
      cols,
      fillType:      form.fillType,
      customOptions: opts,
      status:        STATUS.DRAFT,
      createdAt:     now(),
      tableData: {
        headers: Array.from({ length: cols }, (_, i) => ({ text: `Checkpoint ${i + 1}`, isFill: false })),
        rows:    Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: "" }))),
      },
      dateEntries: {},
    };
    onCreate(cl);
  }

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#3D8B6E] text-white px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold">✨ {prefill ? "Use Template" : "New Checklist"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            {/* Checklist Name */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Checklist Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="e.g. Daily Quality Check"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Created By */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Created By *</label>
              <input value={form.createdBy} onChange={e => set("createdBy", e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Department */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Department</label>
              <select value={form.department} onChange={e => set("department", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            {/* Shift */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Shift</label>
              <select value={form.shift} onChange={e => set("shift", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Schedule */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Schedule</label>
              <select value={form.frequency} onChange={e => set("frequency", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]">
                {FREQS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {/* Weekly days picker */}
            {form.frequency === "Weekly" && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Active Days</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {WEEK_DAYS.map((d, i) => {
                    const active = form.weeklyDays.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggleWday(i)}
                        className={`w-9 h-9 rounded-full text-xs font-semibold border-2 transition-all ${active ? "bg-[#3D8B6E] border-[#3D8B6E] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#3D8B6E]"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Rows */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Rows</label>
              <input type="number" value={form.rows} min={1} max={200}
                onChange={e => set("rows", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Cols */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Checkpoints (cols)</label>
              <input type="number" value={form.cols} min={1} max={50}
                onChange={e => set("cols", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Fill Type */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Fill Type</label>
              <select value={form.fillType} onChange={e => set("fillType", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]">
                {FILL_TYPES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {/* Custom Dropdown options */}
            {form.fillType === "Custom Dropdown" && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1">Custom Options (comma separated)</label>
                <input value={form.customOptions} onChange={e => set("customOptions", e.target.value)}
                  placeholder="Good,Average,Poor"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3D8B6E]"/>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={handleCreate}
            className="px-5 py-2.5 rounded-xl bg-[#3D8B6E] text-white text-xs font-bold hover:bg-[#2A6B52] transition-all flex items-center gap-2">
            ✨ Generate Checklist
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  CLONE / COPY CHECKLIST MODAL
//  Copies structure (headers, rows skeleton) — NOT the filled data.
//  User can change line name, shift, department before cloning.
//  Designed for "Line 1 → Line 2 → Line 3" manufacturing use-case.
// ═══════════════════════════════════════════════════════
function CloneModal({ source, user, onClose, onCreate }) {
 const [name, setName] = useState(source.name);
  const [dept,     setDept]     = useState(source.department);
  const [shift,    setShift]    = useState(source.shift);
  // keep filled values?

  function handleClone() {
    if (!name.trim()) return;
    // Build fresh empty rows with same header structure
   const clonedRows = source.tableData.rows.map(row =>
  row.map((cell, ci) => ({
    value: source.tableData.headers[ci]?.isFill ? "" : cell.value,
  }))
);

    const cl = {
      id:            genId(),
      name:          name.trim(),
      createdBy:     user.name,
      createdById:   user.id,
      createdByRole: user.role,
      department:    dept,
      shift:         shift,
      frequency:     source.frequency,
      weeklyDays:    source.weeklyDays || [],
      rows:          source.rows,
      cols:          source.cols,
      fillType:      source.fillType,
      customOptions: source.customOptions || [],
      status:        STATUS.DRAFT,
      createdAt:     now(),
      clonedFrom:    source.id,   // track lineage
      tableData: {
        headers: source.tableData.headers.map(h => ({ ...h })), // deep copy headers
        rows:    clonedRows,
      },
      dateEntries: {},
    };
    onCreate(cl);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e5c42] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="text-base">⎘</span> Clone Checklist
            </h3>
            <p className="text-[10px] text-green-200 mt-0.5 font-mono">
              Source: {source.name} · {source.id}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Source summary badge */}
          <div className="flex items-center gap-3 bg-[#f6faf8] border border-[#d0e8da] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-[#3D8B6E] text-white flex items-center justify-center text-base flex-shrink-0">⎘</div>
            <div>
              <p className="text-xs font-bold text-[#1A2E24]">{source.name}</p>
              <p className="text-[10px] text-[#6B8A78] font-mono">
                {source.tableData.headers.length} cols · {source.tableData.rows.length} rows · {source.fillType}
              </p>
            </div>
          </div>

          {/* New checklist name */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">
              New Checklist Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Daily Quality Check — Line 2"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E] focus:ring-1 focus:ring-[#3D8B6E]/20"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Department */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E]">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            {/* Shift */}
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E]">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          
          

          {/* What's copied info */}
          

          <div className="flex gap-2 pt-1">
            <button onClick={handleClone}
              className="flex-1 py-2.5 bg-[#1e5c42] hover:bg-[#14412e] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              <span className="text-sm">⎘</span> Clone & Open
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

// ═══════════════════════════════════════════════════════
//  CHECKLIST PAGE — with advanced filter + sort panel
// ═══════════════════════════════════════════════════════
function ChecklistPage({ user, checklists, bookmarks, setChecklists, setBookmarks, addNotif, addAudit, auditLog, showToast, initialAction, setPage }) {
  const [view,setView]           = useState("landing");
  const [activeCl,setActiveCl]   = useState(null);
  const [isViewMode,setIsViewMode]= useState(false);
  const [showCreate,setShowCreate]= useState(false);
  const [prefill,setPrefill]     = useState(null);
  const [cloneTarget,setCloneTarget]=useState(null);
  const [tab,setTab]             = useState("all");
  const [showFilters,setShowFilters]=useState(false); // toggle filter panel

  // ── Filter state ──
  const [search,    setSearch]    = useState("");
  const [freqFilter,setFreqFilter]= useState("");
  const [deptFilter,setDeptFilter]= useState("");
  const [shiftFilter,setShiftFilter]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [sortBy,    setSortBy]    = useState("newest"); // newest|oldest|name-az|name-za|status|dept

  const actionHandled=useRef(false);
  const bIds=bookmarks.map(b=>b.id);

  useEffect(()=>{
    if(initialAction&&!actionHandled.current){
      actionHandled.current=true;
      if(initialAction.type==="create") setShowCreate(true);
      else if(initialAction.type==="fill"&&initialAction.id)   openChecklist(initialAction.id,false);
      else if(initialAction.type==="view"&&initialAction.id)   openChecklist(initialAction.id,true);
      else if(initialAction.type==="clone"&&initialAction.id){ const cl=checklists.find(l=>l.id===initialAction.id); if(cl) setCloneTarget(cl); }
      else if(initialAction.type==="template"&&initialAction.id){ const bm=bookmarks.find(b=>b.id===initialAction.id); if(bm){setPrefill(bm);setShowCreate(true);} }
      else if(initialAction.type==="bookmarks") setTab("bookmarks");
    }
  },[initialAction]);

  function openChecklist(id,viewOnly){
    const cl=checklists.find(l=>l.id===id); if(!cl)return;
    setActiveCl({...cl}); setIsViewMode(viewOnly); setView("editor");
  }
  function deleteChecklist(id){
    if(!confirm("Delete?"))return;
    const cl=checklists.find(l=>l.id===id);
    setChecklists(prev=>prev.filter(l=>l.id!==id));
    addAudit(id,"Deleted",user,`"${cl?.name}" deleted`,cl?.name);
    showToast("Deleted");
  }

  // ── Filtering logic ──
  let filtered=[...checklists];
  if(user.role==="operator") filtered=filtered.filter(l=>l.createdBy===user.name||l.createdById===user.id);
  if(tab==="bookmarks")      filtered=filtered.filter(l=>bIds.includes(l.id));
  if(search){
    const q=search.toLowerCase();
    filtered=filtered.filter(l=>l.name?.toLowerCase().includes(q)||l.id?.toLowerCase().includes(q)||l.createdBy?.toLowerCase().includes(q)||l.department?.toLowerCase().includes(q));
  }
  if(freqFilter)   filtered=filtered.filter(l=>l.frequency===freqFilter);
  if(deptFilter)   filtered=filtered.filter(l=>l.department===deptFilter);
  if(shiftFilter)  filtered=filtered.filter(l=>l.shift===shiftFilter);
  if(statusFilter) filtered=filtered.filter(l=>l.status===statusFilter);
  if(dateFrom)     filtered=filtered.filter(l=>new Date(l.createdAt)>=new Date(dateFrom));
  if(dateTo)       filtered=filtered.filter(l=>new Date(l.createdAt)<=new Date(dateTo+"T23:59:59"));

  // ── Sorting ──
  filtered.sort((a,b)=>{
    if(sortBy==="newest")  return new Date(b.createdAt)-new Date(a.createdAt);
    if(sortBy==="oldest")  return new Date(a.createdAt)-new Date(b.createdAt);
    if(sortBy==="name-az") return (a.name||"").localeCompare(b.name||"");
    if(sortBy==="name-za") return (b.name||"").localeCompare(a.name||"");
    if(sortBy==="status")  return (a.status||"").localeCompare(b.status||"");
    if(sortBy==="dept")    return (a.department||"").localeCompare(b.department||"");
    return 0;
  });

  // Count active filters for badge
  const activeFilterCount = [freqFilter,deptFilter,shiftFilter,statusFilter,dateFrom,dateTo].filter(Boolean).length;

  function clearFilters(){
    setFreqFilter(""); setDeptFilter(""); setShiftFilter("");
    setStatusFilter(""); setDateFrom(""); setDateTo(""); setSortBy("newest");
  }

  if(view==="editor"&&activeCl){
    return <ChecklistEditor cl={activeCl} viewMode={isViewMode} user={user} auditLog={auditLog}
      onSaveClose={()=>setView("landing")} onBack={()=>setView("landing")}
      showToast={showToast} addNotif={addNotif} addAudit={addAudit}
      bookmarks={bookmarks} setBookmarks={setBookmarks} setChecklists={setChecklists}/>;
  }

  return (
    <main className="max-w-[1800px] mx-auto p-3 md:p-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#1A2E24]">Checklists
          <span className="ml-2 text-[10px] text-[#6B8A78] font-normal font-mono">{filtered.length} records</span>
        </h2>
      </div>

      {/* Tab + search + filter toggle bar */}
      <div className="flex flex-wrap gap-1.5 mb-2 items-center">
        {[["all","All"],["bookmarks","Bookmarks"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${tab===t?"bg-[#3D8B6E] text-white":"bg-white border border-gray-200 text-gray-500 hover:border-[#3D8B6E]"}`}>{l}</button>
        ))}
        <div className="flex-1"/>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, dept…" className="text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 outline-none w-48 focus:border-[#3D8B6E]" style={{background:"#f6faf8"}}/>
        </div>
        {/* Filter toggle */}
        <button onClick={()=>setShowFilters(s=>!s)}
          className={`relative text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${showFilters?"bg-[#3D8B6E] text-white border-[#3D8B6E]":"bg-white border-gray-200 text-gray-600 hover:border-[#3D8B6E]"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters
          {activeFilterCount>0&&<span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">{activeFilterCount}</span>}
        </button>
        {/* Sort */}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white focus:border-[#3D8B6E]">
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="name-az">Sort: Name A→Z</option>
          <option value="name-za">Sort: Name Z→A</option>
          <option value="status">Sort: Status</option>
          <option value="dept">Sort: Department</option>
        </select>
      </div>

      {/* Advanced filter panel — collapsible */}
      {showFilters&&(
        <div className="bg-white border border-[#d0e8da] rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[#3D8B6E] uppercase tracking-wide">Advanced Filters</p>
            {activeFilterCount>0&&(
              <button onClick={clearFilters} className="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear all ({activeFilterCount})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Department */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Department</label>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{DEPTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            {/* Shift */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Shift</label>
              <select value={shiftFilter} onChange={e=>setShiftFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{SHIFTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Schedule */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Schedule</label>
              <select value={freqFilter} onChange={e=>setFreqFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>{FREQS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            {/* Status */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Status</label>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E] bg-white">
                <option value="">All</option>
                {Object.entries(STATUS).map(([k,v])=><option key={v} value={v}>{k.charAt(0)+k.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            {/* Date From */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
            {/* Date To */}
            <div>
              <label className="block text-[9px] font-bold text-[#6B8A78] uppercase mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#3D8B6E]"/>
            </div>
          </div>
          {/* Active filter chips */}
          {activeFilterCount>0&&(
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
              {deptFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Dept: {deptFilter}<button onClick={()=>setDeptFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {shiftFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Shift: {shiftFilter}<button onClick={()=>setShiftFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {freqFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Schedule: {freqFilter}<button onClick={()=>setFreqFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {statusFilter&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">Status: {statusFilter}<button onClick={()=>setStatusFilter("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {dateFrom&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">From: {dateFrom}<button onClick={()=>setDateFrom("")} className="hover:text-red-500 ml-0.5">×</button></span>}
              {dateTo&&<span className="bg-[#e8f5ee] text-[#1e5c42] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">To: {dateTo}<button onClick={()=>setDateTo("")} className="hover:text-red-500 ml-0.5">×</button></span>}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length===0?(
          <div className="text-center text-xs text-gray-400 py-12"><div className="text-3xl mb-2 opacity-30">📥</div>{tab==="bookmarks"?"No bookmarks yet.":"No checklists found."}</div>
        ):filtered.map(cl=>{
          const isBookmarked=bIds.includes(cl.id);
          const filled=Object.keys(cl.dateEntries||{}).length;
          const dt=new Date(cl.createdAt);
          const canFill=PERM.canEdit(cl,user);
          return(
            <div key={cl.id} onClick={()=>openChecklist(cl.id,!canFill)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-green-50/50 cursor-pointer border-l-4 ${cl.frequency==="Daily"?"border-l-blue-400":cl.frequency==="Weekly"?"border-l-purple-400":cl.frequency==="Monthly"?"border-l-yellow-400":"border-l-transparent"}`}>
              <div className="w-9 h-9 rounded-xl bg-[#e8f5ee] flex items-center justify-center flex-shrink-0 text-sm">📋</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1A2E24] truncate">{cl.name}</span>
                  <FreqPill freq={cl.frequency}/><StatusPill status={cl.status}/>
                  {isBookmarked&&<span className="text-[9px] text-orange-400">🔖</span>}
                </div>
                <div className="text-[10px] text-[#6B8A78] font-mono mt-0.5">
                  {cl.id} · {cl.department} · Shift: {cl.shift} · by {cl.createdBy}{filled>0&&` · ${filled} date entries`}
                  {cl.clonedFrom&&<span className="ml-1.5 text-[#3D8B6E] font-semibold">· Cloned</span>}
                </div>
                {cl.rejectionReason&&<div className="text-[9px] text-red-500 mt-0.5">↳ {cl.rejectionReason}</div>}
              </div>
              <div className="text-[10px] text-[#6B8A78] font-mono text-right hidden sm:block flex-shrink-0">
                {dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}<br/>{dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
              </div>
              <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                {/* Edit — pencil, only when draft */}
                {canFill&&(
                  <button onClick={()=>openChecklist(cl.id,false)}
                    className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center"
                    title="Edit checklist">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                {/* View — eye */}
                <button onClick={()=>openChecklist(cl.id,true)}
                  className="w-7 h-7 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-200 flex items-center justify-center"
                  title="View checklist">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                {/* Clone — copy icon, visible to admin/operator */}
                {(user.role==="admin"||user.role==="operator")&&(
                  <button onClick={()=>setCloneTarget(cl)}
                    className="w-7 h-7 rounded-lg bg-[#e8f5ee] text-[#1e5c42] hover:bg-[#3D8B6E] hover:text-white flex items-center justify-center transition-all"
                    title="Clone this checklist (create copy for another line/shift)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                )}
                {/* Delete — trash, admin only */}
                {user.role==="admin"&&(
                  <button onClick={()=>deleteChecklist(cl.id)}
                    className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                    title="Delete checklist">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(user.role==="admin"||user.role==="operator")&&(
        <button onClick={()=>{setPrefill(null);setShowCreate(true);}} className="fab-btn fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#3D8B6E] text-white shadow-xl flex items-center justify-center text-xl hover:bg-[#2A6B52] hover:scale-105 transition-all z-40">+</button>
      )}
      {showCreate&&(
        <CreateModal user={user} prefill={prefill} onClose={()=>setShowCreate(false)}
          onCreate={cl=>{
            setChecklists(prev=>[...prev,cl]);
            addAudit(cl.id,"Created",user,`Checklist "${cl.name}" created`,cl.name);
            addNotif({msg:`📝 "${cl.name}" created by ${user.name}`,time:now(),read:false});
            setShowCreate(false);showToast("Checklist created!");
            setActiveCl(cl);setIsViewMode(false);setView("editor");
          }}/>
      )}
      {/* Clone Modal — appears when user clicks clone on a checklist row */}
      {cloneTarget&&(
        <CloneModal
          source={cloneTarget}
          user={user}
          onClose={()=>setCloneTarget(null)}
          onCreate={cl=>{
            setChecklists(prev=>[...prev,cl]);
            addAudit(cl.id,"Cloned",user,`Cloned from "${cloneTarget.name}" (${cloneTarget.id})`,cl.name);
            addNotif({msg:`⎘ "${cl.name}" cloned from "${cloneTarget.name}" by ${user.name}`,time:now(),read:false});
            setCloneTarget(null);
            showToast("⎘ Checklist cloned — ready to fill!");
            setActiveCl(cl);setIsViewMode(false);setView("editor");
          }}
        />
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]              = useState(()=>getLS("isLoggedIn",false)?getLS("currentUser",null):null);
  const [page,setPage]              = useState("dashboard");
  const [checklistAction,setCA]     = useState(null);
  const [checklists,setChecklists]  = useState(()=>getLS("checklists",[]));
  const [bookmarks,setBookmarks]    = useState(()=>getLS("bookmarkedTemplates",[]));
  const [notifications,setNotifs]   = useState(()=>getLS("notifications",[]));
  const [auditLog,setAuditLog]      = useState(()=>getLS("auditLog",[]));
  const [toast,setToast]            = useState({show:false,msg:""});
  const toastTimer = useRef();

  useEffect(()=>{setLS("checklists",checklists);},[checklists]);
  useEffect(()=>{setLS("bookmarkedTemplates",bookmarks);},[bookmarks]);
  useEffect(()=>{setLS("notifications",notifications);},[notifications]);
  useEffect(()=>{setLS("auditLog",auditLog);},[auditLog]);

  function showToast(msg){clearTimeout(toastTimer.current);setToast({show:true,msg});toastTimer.current=setTimeout(()=>setToast(t=>({...t,show:false})),2600);}
  function addNotif(notif){setNotifs(prev=>[{...notif,read:false},...prev].slice(0,60));}
  function addAudit(checklistId,action,u,details,checklistName=""){
    setAuditLog(prev=>[...prev,{id:genAuditId(),checklistId,checklistName,action,userId:u.id,userName:u.name,timestamp:now(),details}].slice(-600));
  }
  function markAllRead(){setNotifs(prev=>prev.map(n=>({...n,read:true})));}
  function handleLogin(u){setLS("isLoggedIn",true);setLS("currentUser",u);setUser(u);}
  function handleLogout(){localStorage.removeItem("isLoggedIn");localStorage.removeItem("currentUser");setUser(null);setPage("dashboard");}
  function handleSetPage(p){setPage(p);if(p!=="checklist")setCA(null);}

  if(!user)return(<><LoginPage onLogin={handleLogin}/><Toast msg={toast.msg} show={toast.show}/></>);

  return (
    <div className="min-h-screen" style={{background:"#F0F7F3",fontFamily:"DM Sans, sans-serif"}}>
      <Header user={user} page={page} setPage={handleSetPage}
        notifications={notifications}
        onClearNotifs={()=>{setNotifs([]);localStorage.removeItem("notifications");}}
        onMarkAllRead={markAllRead}
        onLogout={handleLogout}/>
      {page==="dashboard"&&(
        <DashboardPage user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit}
          showToast={showToast} setPage={handleSetPage} setChecklistAction={setCA}/>
      )}
      {page==="checklist"&&(
        <ChecklistPage user={user} checklists={checklists} bookmarks={bookmarks}
          setChecklists={setChecklists} setBookmarks={setBookmarks}
          addNotif={addNotif} addAudit={addAudit} auditLog={auditLog}
          showToast={showToast} initialAction={checklistAction} setPage={handleSetPage}/>
      )}
      {page==="audit"&&(
        <AuditPage auditLog={auditLog} checklists={checklists} user={user}/>
      )}
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}