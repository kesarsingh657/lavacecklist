import React, { useState } from "react";
import { DEPTS, SHIFTS, STATUS } from "./constants";
import { genId, now } from "./helpers";

export default function CloneModal({ source, user, onClose, onCreate }) {
  const [name, setName] = useState(source.name);
  const [dept,     setDept]     = useState(source.department);
  const [shift,    setShift]    = useState(source.shift);

  const isRecurring = ["Hourly", "Daily", "Weekly", "Monthly"].includes(source.frequency);

  function handleClone() {
    if (!name.trim()) return;

    let clonedData = {};

    if (isRecurring && source.horizontalStructure) {
      const hs = source.horizontalStructure;
      clonedData = {
        horizontalStructure: {
          checkpointColumns: hs.checkpointColumns.map(c => ({ ...c })),
          rows: hs.rows.map(r => ({
            id: `row-${Math.random().toString(36).slice(2, 7)}`,
            metaValues: { ...r.metaValues },
          })),
          dates: [...hs.dates],
          matrixData:  {},
          remarksData: {},
        },
      };
    } else if (!isRecurring && source.tableData) {
      clonedData = {
        tableData: {
          headers: source.tableData.headers.map(h => ({ ...h })),
          rows: source.tableData.rows.map(row =>
            row.map((cell, ci) => ({
              value: source.tableData.headers[ci]?.isFill ? "" : cell.value,
            }))
          ),
        },
      };
    }

    const cl = {
      id:            genId(),
      name:          name.trim(),
      createdBy:     user.name,
      createdById:   user.id,
      createdByRole: user.role,
      department:    dept,
      shift:         shift,
      frequency:     source.frequency,
      line:          source.line,
      hourlyInterval: source.hourlyInterval || 1,
      weeklyDays:    source.weeklyDays || [],
      rows:          source.rows,
      cols:          source.cols,
      fillType:      source.fillType,
      customOptions: source.customOptions || [],
      status:        STATUS.DRAFT,
      createdAt:     now(),
      clonedFrom:    source.id,
      dateEntries:   {},
      ...clonedData,
    };
    onCreate(cl);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#FF0047] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="text-base">⎘</span> Clone Checklist</h3>
            <p className="text-[10px] text-white/70 mt-0.5 font-mono">Source: {source.name} · {source.id}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 bg-[#fafafc] border border-[#e6e7ef] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF0047] text-white flex items-center justify-center text-base flex-shrink-0">⎘</div>
            <div>
              <p className="text-xs font-bold text-[#14141B]">{source.name}</p>
              <p className="text-[10px] text-[#7A7A8C] font-mono">{source.tableData?.headers?.length || source.cols} cols · {source.tableData?.rows?.length || source.rows} rows · {source.fillType}</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1.5">New Checklist Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Quality Check — Line 2" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#FF0047] focus:ring-1 focus:ring-[#FF0047]/20"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1.5">Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#FF0047]">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1.5">Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#FF0047]">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleClone} className="flex-1 py-2.5 bg-[#FF0047] hover:bg-[#14412e] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              <span className="text-sm">⎘</span> Clone & Open
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}