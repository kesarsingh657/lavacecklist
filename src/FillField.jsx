import React from "react";

export default function FillField({ type, opts, value, onChange, disabled }) {
  const cls = "w-full text-[11px] bg-transparent border-none outline-none font-semibold";
  
  // Custom helper to dynamically style high-priority dropdown outcomes
  const getDropdownCls = (val) => {
    if (val === "NG" || val === "Fail" || val === "No") return " text-red-600 bg-red-50 p-1 rounded";
    if (val === "OK" || val === "Pass" || val === "Yes") return " text-green-600 bg-green-50 p-1 rounded";
    return "";
  };

  switch(type){
    case "Number Input": 
      return <input type="number" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="0" className={cls}/>;
    case "Checkbox":     
      return <div className="flex items-center justify-center"><input type="checkbox" checked={!!value} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#3D8B6E]"/></div>;
    case "OK / NG": case "Pass / Fail": case "Yes / No": {
      const options = type === "OK / NG" ? ["OK","NG"] : type === "Pass / Fail" ? ["Pass","Fail"] : ["Yes","No"];
      return (
        <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={`${cls} cursor-pointer ${getDropdownCls(value)}`}>
          <option value="" className="text-gray-400">—</option>
          {options.map(o=><option key={o} value={o} className="text-gray-900 bg-white font-normal">{o}</option>)}
        </select>
      );
    }
    case "Custom Dropdown": 
      return (
        <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={cls+" cursor-pointer"}>
          <option value="">—</option>
          {(opts||[]).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      );
    default: 
      return <input type="text" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="—" className={cls}/>;
  }
}