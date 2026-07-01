/**
 * AnalyticsDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE: Dashboard Analytics for MES
 *
 * Shows:
 *  1. Completion rate per department (approved / total)
 *  2. Completion rate per shift
 *  3. Overdue count (Daily checklists with missing today entry)
 *  4. Status distribution donut (text-based bar charts — no chart library needed)
 *  5. Weekly activity trend (last 7 days — how many created/approved per day)
 *  6. Top operators by submission count
 *
 * How to wire into App:
 *  - Add "analytics" to Header nav: ["analytics","Analytics"]
 *  - In App.jsx render: {page==="analytics" && <AnalyticsDashboard checklists={checklists} user={user}/>}
 *
 * Usage:
 *  <AnalyticsDashboard checklists={checklists} user={user} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useMemo } from "react";
import { DEPTS, SHIFTS } from "./constants";

// ── Simple horizontal bar ─────────────────────────────────────────────────────
function Bar({ pct, color = "bg-[#3D8B6E]", label, value }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-[#1A2E24] font-medium">{label}</span>
        <span className="text-[10px] text-[#6B8A78] font-mono">{value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, dot }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        {dot && <span style={{ width:7, height:7, borderRadius:"50%", background:dot, display:"inline-block" }} />}
        <span className="text-[10px] text-[#6B8A78] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono text-[#1A2E24]">{value}</div>
      {sub && <div className="text-[10px] text-[#6B8A78] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsDashboard({ checklists, user }) {
  // Operators see only their own checklists
  const myLists = user.role === "operator"
    ? checklists.filter(l => l.createdById === user.id || l.createdBy === user.name)
    : checklists;

  // ── Overdue detection ─────────────────────────────────────────────────────
  // A Daily checklist is overdue if today's date column has no entries
  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return myLists.filter(cl => {
      if (cl.frequency !== "Daily" || !cl.horizontalStructure) return false;
      if (!cl.horizontalStructure.dates.includes(today)) return false;
      const matrix = cl.horizontalStructure.matrixData || {};
      return !cl.horizontalStructure.rows.some(row => {
        const v = matrix[row.id]?.[today];
        return v !== undefined && v !== "" && v !== false;
      });
    }).length;
  }, [myLists]);

  // ── Department completion rates ────────────────────────────────────────────
  const deptStats = useMemo(() => DEPTS.map(dept => {
    const lists    = myLists.filter(l => l.department === dept);
    const approved = lists.filter(l => l.status === "approved").length;
    const pct      = lists.length ? Math.round(approved / lists.length * 100) : 0;
    return { dept, total: lists.length, approved, pct };
  }), [myLists]);

  // ── Shift completion rates ────────────────────────────────────────────────
  const shiftStats = useMemo(() => SHIFTS.map(shift => {
    const lists    = myLists.filter(l => l.shift === shift);
    const approved = lists.filter(l => l.status === "approved").length;
    const pct      = lists.length ? Math.round(approved / lists.length * 100) : 0;
    return { shift, total: lists.length, approved, pct };
  }), [myLists]);

  // ── Status distribution ───────────────────────────────────────────────────
  const statusDist = useMemo(() => {
    const counts = { draft:0, finalized:0, submitted:0, pending:0, approved:0, rejected:0 };
    myLists.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [myLists]);

  // ── Last 7 days activity ──────────────────────────────────────────────────
  const weeklyActivity = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d    = new Date();
      d.setDate(d.getDate() - i);
      const ds   = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit" });
      const created  = myLists.filter(l => l.createdAt?.split("T")[0] === ds).length;
      const approved = myLists.filter(l => l.approvedAt?.split("T")[0] === ds).length;
      days.push({ label, created, approved });
    }
    return days;
  }, [myLists]);

  const maxWeekly = Math.max(...weeklyActivity.map(d => Math.max(d.created, d.approved)), 1);

  // ── Top operators ─────────────────────────────────────────────────────────
  const topOperators = useMemo(() => {
    const counts = {};
    myLists.forEach(l => {
      if (!l.createdBy) return;
      counts[l.createdBy] = (counts[l.createdBy] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [myLists]);

  const total = myLists.length;
  const approvedTotal = myLists.filter(l=>l.status==="approved").length;
  const overallRate   = total ? Math.round(approvedTotal / total * 100) : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">📊 Analytics Dashboard</h2>
          <p className="text-[10px] text-[#6B8A78] mt-0.5">MES performance overview · {total} checklists total</p>
        </div>
      </div>

      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"        value={total}          sub="all checklists"   dot="#3b82f6" />
        <StatCard label="Approved"     value={approvedTotal}  sub={`${overallRate}% completion`} dot="#22c55e" />
        <StatCard label="Pending"      value={statusDist.pending + statusDist.submitted} sub="awaiting review" dot="#eab308" />
        <StatCard label="Overdue Today" value={overdueCount}  sub="daily entries missing" dot="#ef4444" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

        {/* ── Department completion ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-[#6B8A78] uppercase tracking-wider mb-3">Completion by Department</h3>
          {deptStats.map(d => (
            <Bar key={d.dept} label={d.dept} value={`${d.approved}/${d.total} · ${d.pct}%`} pct={d.pct}
              color={d.pct === 100 ? "bg-green-500" : d.pct > 50 ? "bg-[#3D8B6E]" : d.pct > 0 ? "bg-yellow-400" : "bg-gray-200"} />
          ))}
        </div>

        {/* ── Shift completion ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-[#6B8A78] uppercase tracking-wider mb-3">Completion by Shift</h3>
          {shiftStats.map(s => (
            <Bar key={s.shift} label={s.shift + " Shift"} value={`${s.approved}/${s.total} · ${s.pct}%`} pct={s.pct}
              color={s.pct === 100 ? "bg-green-500" : s.pct > 50 ? "bg-purple-500" : s.pct > 0 ? "bg-yellow-400" : "bg-gray-200"} />
          ))}

          {/* Status distribution */}
          <h3 className="text-[11px] font-bold text-[#6B8A78] uppercase tracking-wider mt-4 mb-3">Status Distribution</h3>
          {[
            { key:"approved",  label:"Approved",  dot:"#22c55e" },
            { key:"rejected",  label:"Rejected",  dot:"#ef4444" },
            { key:"pending",   label:"Pending",   dot:"#eab308" },
            { key:"submitted", label:"Submitted", dot:"#3b82f6" },
            { key:"finalized", label:"Finalized", dot:"#f59e0b" },
            { key:"draft",     label:"Draft",     dot:"#9ca3af" },
          ].map(s => (
            <div key={s.key} className="flex items-center gap-2 mb-1.5">
              <span style={{width:7,height:7,borderRadius:"50%",background:s.dot,flexShrink:0,display:"inline-block"}}/>
              <span className="text-[11px] text-[#1A2E24] flex-1">{s.label}</span>
              <span className="text-[10px] font-mono text-[#6B8A78]">{statusDist[s.key]}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Weekly activity trend ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-5">
        <h3 className="text-[11px] font-bold text-[#6B8A78] uppercase tracking-wider mb-4">Last 7 Days Activity</h3>
        <div className="flex items-end gap-2 h-28">
          {weeklyActivity.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {/* Created bar */}
              <div className="w-full flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-[#3D8B6E] rounded-t"
                  style={{ height: `${Math.round(d.created / maxWeekly * 80)}px`, minHeight: d.created ? 4 : 0 }}
                  title={`Created: ${d.created}`}
                />
                <div
                  className="w-full bg-green-300 rounded-t"
                  style={{ height: `${Math.round(d.approved / maxWeekly * 80)}px`, minHeight: d.approved ? 4 : 0 }}
                  title={`Approved: ${d.approved}`}
                />
              </div>
              <span className="text-[9px] text-gray-400 font-mono text-center">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#3D8B6E] rounded inline-block"/><span className="text-[9px] text-[#6B8A78]">Created</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-2 bg-green-300 rounded inline-block"/><span className="text-[9px] text-[#6B8A78]">Approved</span></div>
        </div>
      </div>

      {/* ── Top operators ── */}
      {topOperators.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-[#6B8A78] uppercase tracking-wider mb-3">Top Creators</h3>
          {topOperators.map((op, i) => (
            <div key={op.name} className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-[#6B8A78] w-4">{i + 1}</span>
              <span className="flex-1 text-[12px] font-semibold text-[#1A2E24]">{op.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 mx-2">
                <div className="bg-[#3D8B6E] h-1.5 rounded-full" style={{ width: `${Math.round(op.count / topOperators[0].count * 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono text-[#6B8A78]">{op.count}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}