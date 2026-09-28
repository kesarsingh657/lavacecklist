import React, { useState } from "react";
import { DEPTS, LINES, SHIFTS, FREQS, WEEK_DAYS, FILL_TYPES, HOURLY_INTERVALS, STATUS, hourSlots } from "./constants";
import { genId, now } from "./helpers";

export default function CreateModal({ user, prefill, onClose, onCreate }) {
  const isEditMode = !!prefill;
  const [form, setForm] = useState({
    name:          prefill ? prefill.name : "",
    createdBy:     prefill?.createdBy || user.name?.split(" ")[0] || "",
    department:    prefill?.department || DEPTS[0],
    line:          prefill?.line || LINES[0],
    shift:         prefill?.shift || "Morning",
    frequency:     prefill?.frequency || "One Time",
    hourlyInterval: prefill?.hourlyInterval || 1,
    weeklyDays:    prefill?.weeklyDays || [],
    rows:          prefill?.rows || 5,
    cols:          prefill?.cols || 1,
    fillType:      prefill?.fillType || "Text Input",
    customOptions: prefill?.customOptions?.join(", ") || "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleWday = d => setForm(p => ({
    ...p,
    weeklyDays: p.weeklyDays.includes(d) ? p.weeklyDays.filter(x => x !== d) : [...p.weeklyDays, d],
  }));

  function handleCreate() {
    if (!form.name.trim()) return;
    const opts = form.fillType === "Custom Dropdown" ? form.customOptions.split(",").map(s => s.trim()).filter(Boolean) : [];
    const rows = parseInt(form.rows) || 5;
    const cols = parseInt(form.cols) || 4;

    if (!form.name.trim()) { alert("Checklist Name is required"); return; }
    if (form.name.trim().length < 3) { alert("Checklist Name must be at least 3 characters"); return; }
    if (rows < 1) { alert("Rows must be greater than 0"); return; }
    if (cols < 1) { alert("Checkpoints must be greater than 0"); return; }

    const cl = {
      id: prefill?.id || genId(),
      name:          form.name.trim(),
      createdBy:     form.createdBy || user.name,
      createdById:   user.id,
      createdByRole: user.role,
      department:    form.department,
      line:          form.line,
      shift:         form.shift,
      frequency:     form.frequency,
      hourlyInterval: form.frequency === "Hourly" ? parseInt(form.hourlyInterval, 10) || 1 : 1,
      weeklyDays:    form.frequency === "Weekly" ? form.weeklyDays : [],
      rows,
      cols,
      fillType:      form.fillType,
      customOptions: opts,
      status:        STATUS.DRAFT,
      createdAt:     prefill?.createdAt || now(),
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
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-cardHover overflow-hidden max-h-[90vh] flex flex-col animate-pop-in">
        <div className="bg-lava-grad text-white px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold">✨ {isEditMode ? "Edit Checklist" : "New Checklist"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Checklist Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Daily Quality Check" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Created By *</label>
              <input value={form.createdBy} onChange={e => set("createdBy", e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Department</label>
              <select value={form.department} onChange={e => set("department", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Line</label>
              <select value={form.line} onChange={e => set("line", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                {LINES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Shift</label>
              <select value={form.shift} onChange={e => set("shift", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Schedule</label>
              <select value={form.frequency} onChange={e => set("frequency", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                {FREQS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {form.frequency === "Hourly" && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Every</label>
                <select value={form.hourlyInterval} onChange={e => set("hourlyInterval", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                  {HOURLY_INTERVALS.map(h => <option key={h} value={h}>{h === 1 ? "1 hour" : `${h} hours`}</option>)}
                </select>
                <p className="mt-2 text-[10px] text-muted leading-relaxed">
                  {hourSlots(form.shift, form.hourlyInterval).length} checklist slots in the {form.shift.toLowerCase()} shift:{" "}
                  <span className="font-mono text-lava-600">{hourSlots(form.shift, form.hourlyInterval).join(" · ")}</span>
                </p>
              </div>
            )}
            {form.frequency === "Weekly" && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Active Days</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {WEEK_DAYS.map((d, i) => {
                    const active = form.weeklyDays.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggleWday(i)} className={`w-9 h-9 rounded-full text-xs font-semibold border-2 transition-all ${active ? "bg-[#FF0047] border-[#FF0047] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#FF0047]"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Rows</label>
              <input type="number" value={form.rows} min={1} max={200} onChange={e => set("rows", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Checkpoints (cols)</label>
              <input type="number" value={form.cols} min={1} max={50} onChange={e => set("cols", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]"/>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Fill Type</label>
              <select value={form.fillType} onChange={e => set("fillType", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]">
                {FILL_TYPES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {form.fillType === "Custom Dropdown" && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#7A7A8C] uppercase mb-1">Custom Options (comma separated)</label>
                <input value={form.customOptions} onChange={e => set("customOptions", e.target.value)} placeholder="Good,Average,Poor" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#FF0047]"/>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={handleCreate} className="btn-lava px-5 py-2.5 text-xs">
            {isEditMode ? "Update Checklist" : "Generate Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}