/**
 * TemplatesPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE: Dedicated Templates Library (separate from active checklists).
 *
 * Problem it solves:
 *  - Previously bookmarks doubled as templates → confusing
 *  - Now templates are stored in localStorage key "checklistTemplates"
 *  - A template is a frozen snapshot: no status, no fill data, just structure
 *
 * Template object shape:
 *  {
 *    id:            "TPL-xxxxx",
 *    name:          "Daily Line Inspection",
 *    description:   "Used for morning shift QC sign-off",
 *    department:    "Production",
 *    shift:         "Morning",
 *    frequency:     "Daily",
 *    fillType:      "OK / NG",
 *    customOptions: [],
 *    rows:          5,
 *    cols:          4,
 *    tableData:     { headers:[…], rows:[…] },        // One-Time
 *    horizontalStructure: { … },                      // Recurring
 *    createdBy:     "Admin",
 *    createdAt:     ISO string,
 *    usageCount:    0,   // incremented each time a checklist is spawned from it
 *  }
 *
 * How to wire into App.jsx:
 *  const [templates, setTemplates] = useState(() => getLS("checklistTemplates", []));
 *  useEffect(() => { setLS("checklistTemplates", templates); }, [templates]);
 *  // Pass templates + setTemplates to TemplatesPage and to ChecklistEditor
 *
 * How to use a template:
 *  - "Use Template" button calls onUseTemplate(template)
 *  - App opens CloneModal pre-filled with template data
 *  - CloneModal creates a real checklist and opens ChecklistEditor
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from "react";
import { DEPTS, SHIFTS, FREQS } from "./constants";
import { genId, now } from "./helpers";

// ── Frequency badge colours ──────────────────────────────────────────────────
const FREQ_CLS = {
  "Daily":    "bg-blue-100 text-blue-700",
  "Weekly":   "bg-purple-100 text-purple-700",
  "Monthly":  "bg-yellow-100 text-yellow-800",
  "One Time": "bg-gray-100 text-gray-600",
};

export default function TemplatesPage({ user, templates, setTemplates, checklists, setChecklists, showToast, setPage, setChecklistAction }) {

  const [search,     setSearch]     = useState("");
  const [freqFilter, setFreqFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // ── Filter ───────────────────────────────────────────────────────────────
  const visible = templates
    .filter(t => !freqFilter || t.frequency === freqFilter)
    .filter(t => !deptFilter || t.department === deptFilter)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.name?.toLowerCase().includes(q) || t.department?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // ── Save current checklist as template ──────────────────────────────────
  // Called from ChecklistEditor via "Save as Template" button
  function saveAsTemplate(cl) {
    const tpl = {
      id:          "TPL-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      name:        cl.name + " (Template)",
      description: "",
      department:  cl.department,
      shift:       cl.shift,
      frequency:   cl.frequency,
      fillType:    cl.fillType,
      customOptions: cl.customOptions || [],
      rows:        cl.rows,
      cols:        cl.cols,
      // Deep-copy tableData but wipe fill values
      tableData: cl.tableData ? {
        headers: cl.tableData.headers.map(h => ({ ...h })),
        rows: cl.tableData.rows.map(row =>
          row.map((cell, ci) => ({ value: cl.tableData.headers[ci]?.isFill ? "" : cell.value }))
        ),
      } : undefined,
      // Deep-copy horizontalStructure but wipe filled data
      horizontalStructure: cl.horizontalStructure ? {
        checkpointColumns: cl.horizontalStructure.checkpointColumns.map(c => ({ ...c })),
        rows: cl.horizontalStructure.rows.map(r => ({
          id: "row-" + Math.random().toString(36).slice(2, 7),
          metaValues: { ...r.metaValues }, // keep left-column text (checkpoint names)
        })),
        dates: [...cl.horizontalStructure.dates],
        matrixData:  {}, // wipe all filled readings
        remarksData: {}, // wipe all remarks
      } : undefined,
      createdBy:  user.name,
      createdAt:  now(),
      usageCount: 0,
    };
    setTemplates(prev => [...prev, tpl]);
    showToast("📁 Saved as template!");
  }

  // ── Spawn a checklist from a template ────────────────────────────────────
  function useTemplate(tpl) {
    // Increment usage counter on the template
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, usageCount: (t.usageCount || 0) + 1 } : t));
    // Set the action FIRST, then navigate — so ChecklistPage gets the action on mount
    setChecklistAction({ type: "template", id: tpl.id });
    setPage("checklist");
  }

  // ── Delete template ───────────────────────────────────────────────────────
  function deleteTemplate(id) {
    if (!confirm("Delete this template?")) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    showToast("Template deleted");
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">📁 Templates Library</h2>
          <p className="text-[10px] text-[#6B8A78] mt-0.5">Reusable checklist structures. No fill data — just the skeleton.</p>
        </div>
        {(user.role === "admin" || user.role === "operator") && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#3D8B6E] hover:bg-[#2A6B52] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            + New Template
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search templates…"
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 outline-none w-44 focus:border-[#3D8B6E]"
        />
        <select value={freqFilter} onChange={e => setFreqFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
          <option value="">All Schedules</option>
          {FREQS.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
          <option value="">All Depts</option>
          {DEPTS.map(d => <option key={d}>{d}</option>)}
        </select>
        {(freqFilter || deptFilter || search) && (
          <button onClick={() => { setFreqFilter(""); setDeptFilter(""); setSearch(""); }} className="text-xs px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg">Clear</button>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 opacity-30">📁</div>
          <p className="text-sm font-semibold">No templates yet</p>
          <p className="text-xs mt-1">Save any checklist as a template from the editor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {visible.map(tpl => (
            <div key={tpl.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#3D8B6E]/30 transition-all">
              {/* Top row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#1A2E24] truncate">{tpl.name}</p>
                  {tpl.description && <p className="text-[10px] text-[#6B8A78] mt-0.5 line-clamp-2">{tpl.description}</p>}
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${FREQ_CLS[tpl.frequency] || FREQ_CLS["One Time"]}`}>
                  {tpl.frequency}
                </span>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#6B8A78] mb-3">
                <span>🏭 {tpl.department}</span>
                <span>🕐 {tpl.shift}</span>
                <span>📝 {tpl.fillType}</span>
                <span>Used {tpl.usageCount || 0}×</span>
              </div>

              {/* Structure summary */}
              <div className="bg-[#f6faf8] rounded-lg px-2.5 py-1.5 text-[10px] text-[#6B8A78] mb-3 font-mono">
                {tpl.horizontalStructure
                  ? `${tpl.horizontalStructure.rows?.length || 0} rows · ${tpl.horizontalStructure.checkpointColumns?.length || 0} left cols`
                  : `${tpl.tableData?.headers?.length || 0} cols · ${tpl.tableData?.rows?.length || 0} rows`
                }
                {" · "}{tpl.createdBy}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => useTemplate(tpl)}
                  className="flex-1 py-2 bg-[#3D8B6E] hover:bg-[#2A6B52] text-white text-[11px] font-bold rounded-xl transition-all"
                >
                  Use Template
                </button>
                {user.role === "admin" && (
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl text-[11px] transition-all"
                    title="Delete template"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * SaveAsTemplateButton — drop this inside ChecklistEditor's toolbar
 *
 * Props: cl (checklist), user, templates, setTemplates, showToast
 *
 * Example usage in toolbar:
 *   <SaveAsTemplateButton cl={cl} user={user} templates={templates} setTemplates={setTemplates} showToast={showToast} />
 */
export function SaveAsTemplateButton({ cl, user, templates, setTemplates, showToast }) {
  // Only admin/operator can save templates; only from finalized/approved checklists
  if (!["admin","operator"].includes(user.role)) return null;

  const alreadySaved = templates?.some(t => t.sourceId === cl.id);

  function save() {
    if (alreadySaved) { showToast("Already saved as template"); return; }
    const tpl = {
      id:          "TPL-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      sourceId:    cl.id, // track origin
      name:        cl.name,
      description: "",
      department:  cl.department,
      shift:       cl.shift,
      frequency:   cl.frequency,
      fillType:    cl.fillType,
      customOptions: cl.customOptions || [],
      rows:        cl.rows,
      cols:        cl.cols,
      tableData: cl.tableData ? {
        headers: cl.tableData.headers.map(h => ({ ...h })),
        rows: cl.tableData.rows.map(row =>
          row.map((cell, ci) => ({ value: cl.tableData.headers[ci]?.isFill ? "" : cell.value }))
        ),
      } : undefined,
      horizontalStructure: cl.horizontalStructure ? {
        checkpointColumns: cl.horizontalStructure.checkpointColumns.map(c => ({ ...c })),
        rows: cl.horizontalStructure.rows.map(r => ({
          id: "row-" + Math.random().toString(36).slice(2, 7),
          metaValues: { ...r.metaValues },
        })),
        dates: [...cl.horizontalStructure.dates],
        matrixData:  {},
        remarksData: {},
      } : undefined,
      createdBy:  user.name,
      createdAt:  now(),
      usageCount: 0,
    };
    setTemplates(prev => [...prev, tpl]);
    showToast("📁 Saved as template!");
  }

  return (
    <button
      onClick={save}
      className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all ${
        alreadySaved ? "bg-gray-100 text-gray-400 cursor-default" : "bg-[#e8f5ee] text-[#3D8B6E] hover:bg-[#3D8B6E] hover:text-white"
      }`}
    >
      {alreadySaved ? "📁 Saved" : "📁 Save as Template"}
    </button>
  );
}