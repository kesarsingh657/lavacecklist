import React, { useState, useEffect, useRef } from "react";
import { STATUS } from "./constants";
import { getCompletion, PERM, now, fmtDT } from "./helpers";
import { WorkflowStepper } from "./StatusPill";
import FillField from "./FillField";
import CalendarModal from "./CalendarModal";

export default function ChecklistEditor({ cl: initialCl, viewMode, user, auditLog, onSaveClose, onBack, showToast, addNotif, addAudit, setChecklists }) {
  const [cl, setCl] = useState(() => {
    const c = { ...initialCl };
    if (!c.tableData) {
      c.tableData = {
        headers: [
          { text: "Checkpoint Parameter", isFill: false },
          { text: "Target Spec Limits", isFill: false }
        ],
        rows: [
          [ { value: "Machine Temperature" }, { value: "50°C - 70°C" } ],
          [ { value: "Oil Pressure Bar" }, { value: "2.5 - 4.0 Bar" } ]
        ]
      };
    }
    return c;
  });

  const [showCalModal, setShowCalModal] = useState(false);
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [calSelected, setCalSelected] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("Up to date");
  const saveTimeoutRef = useRef(null);

  // 🟢 IMMUTABILITY FILTER: Checks if the column context belongs to a past date log
  const checkIsPastColumn = (headerText) => {
    if (!headerText || h.isFill === false) return false;
    const matches = headerText.match(/\d{4}-\d{2}-\d{2}/);
    if (!matches) return false;
    return new Date(matches[0]).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
  };

  // Auto-Save Background Engine
  useEffect(() => {
    if (viewMode) return;
    setAutoSaveStatus("Saving changes...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      const updated = { ...cl, updatedAt: now() };
      setChecklists(prev => {
        const idx = prev.findIndex(l => l.id === updated.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });
      setAutoSaveStatus("🟢 Auto-saved to local draft");
    }, 2000);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [cl.tableData]);

  // Structural Modifier Functions for the Creator Matrix
  function updateCellValue(ri, ci, val) { setCl(p => ({ ...p, tableData: { ...p.tableData, rows: p.tableData.rows.map((row, r) => r === ri ? row.map((cell, c) => c === ci ? { ...cell, value: val } : cell) : row) } })); }
  function updateHeader(ci, text) { setCl(p => ({ ...p, tableData: { ...p.tableData, headers: p.tableData.headers.map((h, i) => i === ci ? { ...h, text } : h) } })); }
  function addRow() { setCl(p => ({ ...p, tableData: { ...p.tableData, rows: [...p.tableData.rows, Array.from({ length: p.tableData.headers.length }, () => ({ value: "" }))] } })); }
  function removeRow() { setCl(p => { if (p.tableData.rows.length <= 1) return p; return { ...p, tableData: { ...p.tableData, rows: p.tableData.rows.slice(0, -1) } }; }); }
  
  function addCheckpointCol() { 
    setCl(p => ({
      ...p,
      tableData: {
        headers: [...p.tableData.headers, { text: `New Parameter`, isFill: false }],
        rows: p.tableData.rows.map(r => [...r, { value: "" }])
      }
    }));
  }

  // 🟢 CALENDAR INJECTOR: Appends selected calendar date as a dynamic structural Fill column
  function handleInjectDateColumn() {
    if (!calSelected) return;
    setShowCalModal(false);

    // Prevents creating identical multi-columns for the same exact date context
    const exists = cl.tableData.headers.some(h => h.text.includes(calSelected));
    if (exists) { showToast("⚠️ Column for this date already exists!"); return; }

    setCl(p => ({
      ...p,
      tableData: {
        headers: [...p.tableData.headers, { text: `📅 ${calSelected}`, isFill: true, rawDate: calSelected }],
        rows: p.tableData.rows.map(r => [...r, { value: "" }])
      }
    }));
    showToast(`Added column for ${calSelected}`);
  }

  function saveAndClose() {
    const updated = { ...cl, status: STATUS.DRAFT, updatedAt: now() };
    setChecklists(prev => {
      const idx = prev.findIndex(l => l.id === updated.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
    showToast("Saved Successfully");
    setTimeout(onSaveClose, 300);
  }

  return (
    <main className="max-w-[1800px] mx-auto p-4 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#1A2E24]">{cl.name || "Custom Matrix Planner"}</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{autoSaveStatus} · Frequency: <span className="font-bold text-emerald-600">{cl.frequency}</span></p>
        </div>
        <WorkflowStepper status={cl.status} />
      </div>

      <div className="action-bar flex flex-wrap items-center gap-2 mb-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <button onClick={onBack} className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold">Back</button>
        
        {!viewMode && <>
          <button onClick={addRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e8f5ee] text-[#3D8B6E] font-bold">+ Add Row Parameter</button>
          <button onClick={removeRow} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">- Remove Row</button>
          <button onClick={addCheckpointCol} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">+ Add Spec Column</button>
          
          <button onClick={() => { setCalViewDate(new Date()); setCalSelected(null); setShowCalModal(true); }} 
            className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-sm transition-all ml-auto">
            📅 Select Calendar Date
          </button>
          
          <button onClick={saveAndClose} className="text-[10px] px-4 py-1.5 rounded-lg bg-[#3D8B6E] text-white font-bold hover:bg-[#2A6B52]">Save & Exit</button>
        </>}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
          <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ background: "#4B9B7A", color: "white", border: "1px solid #d1d5db", padding: "8px", fontSize: 11, width: "50px", textAlign: "center" }}>#</th>
                {cl.tableData.headers.map((h, ci) => (
                  <th key={ci} style={{ background: h.isFill ? "#1e5c42" : "#3D8B6E", color: "white", border: "1px solid #d1d5db", padding: "8px", fontSize: 11, fontWeight: 600, width: h.isFill ? "140px" : "220px" }}>
                    {h.isFill ? (
                      <span className="font-mono text-xs">{h.text}</span>
                    ) : (
                      <span contentEditable={!viewMode} suppressContentEditableWarning onBlur={e => updateHeader(ci, e.target.innerText)} style={{ display: "block", outline: "none" }}>{h.text}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cl.tableData.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50/80 transition-colors" style={{ background: ri % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td style={{ background: "#e5e7eb", color: "#6b7280", fontWeight: 700, border: "1px solid #d1d5db", padding: "8px", fontSize: 11, textAlign: "center" }}>{ri + 1}</td>
                  {row.map((cell, ci) => {
                    const header = cl.tableData.headers[ci];
                    const isFillColumn = header?.isFill;
                    
                    // 🟢 HISTORIC LOCK CONDITION: Past columns become 100% read-only automatically
                    const isPastColumn = isFillColumn && header.rawDate && new Date(header.rawDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                    const isCellDisabled = viewMode || isPastColumn;

                    return isFillColumn ? (
                      <td key={ci} style={{ background: isCellDisabled ? "#f3f4f6" : "#fffbeb", border: "1px solid #d1d5db", padding: "6px" }}>
                        <FillField type={cl.fillType || "Number Input"} opts={cl.customOptions} value={cell.value} onChange={v => updateCellValue(ri, ci, v)} disabled={isCellDisabled} />
                        {isPastColumn && <div className="text-[8px] text-gray-400 font-mono mt-0.5 text-center">🔒 Historical Log</div>}
                      </td>
                    ) : (
                      <td key={ci} style={{ border: "1px solid #d1d5db", padding: "8px", fontSize: 11, background: "white" }}>
                        <span contentEditable={!viewMode} suppressContentEditableWarning onBlur={e => updateCellValue(ri, ci, e.target.innerText)} style={{ display: "block", outline: "none", width: "100%", minHeight: "20px" }}>
                          {cell.value}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCalModal && (
        <CalendarModal 
          cl={cl} 
          calViewDate={calViewDate} 
          setCalViewDate={setCalViewDate} 
          calSelected={calSelected} 
          setCalSelected={setCalSelected} 
          onClose={() => setShowCalModal(false)} 
          onOpen={handleInjectDateColumn} 
        />
      )}
    </main>
  );
}