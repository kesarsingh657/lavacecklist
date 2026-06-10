import React, { useState } from "react";
import { PAPER_SIZES } from "./constants";
import { handlePrint, handleExportPDF } from "./helpers";

export default function PaperSizeModal({ action, cl, auditLog, onClose }) {
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