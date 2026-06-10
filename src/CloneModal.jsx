import React, { useState } from "react";
import { DEPTS, SHIFTS, STATUS } from "./constants";
import { genId, now } from "./helpers";

export default function CloneModal({ source, user, onClose, onCreate }) {
  const [name, setName] = useState(source.name);
  const [dept,     setDept]     = useState(source.department);
  const [shift,    setShift]    = useState(source.shift);

  const isRecurring = ["Daily", "Weekly", "Monthly"].includes(source.frequency);

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
        <div className="bg-[#1e5c42] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="text-base">⎘</span> Clone Checklist</h3>
            <p className="text-[10px] text-green-200 mt-0.5 font-mono">Source: {source.name} · {source.id}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 bg-[#f6faf8] border border-[#d0e8da] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-[#3D8B6E] text-white flex items-center justify-center text-base flex-shrink-0">⎘</div>
            <div>
              <p className="text-xs font-bold text-[#1A2E24]">{source.name}</p>
              <p className="text-[10px] text-[#6B8A78] font-mono">{source.tableData?.headers?.length || source.cols} cols · {source.tableData?.rows?.length || source.rows} rows · {source.fillType}</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">New Checklist Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Quality Check — Line 2" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E] focus:ring-1 focus:ring-[#3D8B6E]/20"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E]">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#6B8A78] uppercase mb-1.5">Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#3D8B6E]">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleClone} className="flex-1 py-2.5 bg-[#1e5c42] hover:bg-[#14412e] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              <span className="text-sm">⎘</span> Clone & Open
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}