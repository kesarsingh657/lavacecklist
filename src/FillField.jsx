import React from "react";

export default function FillField({ type, opts, value, onChange, disabled }) {
  const cls="w-full text-[11px] bg-transparent border-none outline-none";
  switch(type){
    case "Number Input": return <input type="number" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="0" className={cls}/>;
    case "Checkbox":     return <div className="fle items-center justify-center"><input type="checkbox" checked={!!value} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#3D8B6E]"/></div>;
    case "OK / NG": case "Pass / Fail": case "Yes / No": {
      const options=type==="OK / NG"?["OK","NG"]:type==="Pass / Fail"?["Pass","Fail"]:["Yes","No"];
      return <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={cls+" cursor-pointer"}><option value="">—</option>{options.map(o=><option key={o}>{o}</option>)}</select>;
    }
    case "Custom Dropdown": return <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} className={cls+" cursor-pointer"}><option value="">—</option>{(opts||[]).map(o=><option key={o}>{o}</option>)}</select>;
    default: return <input type="text" value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="—" className={cls}/>;
  }
}