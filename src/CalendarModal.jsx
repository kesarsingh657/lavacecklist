import React from "react";

export default function CalendarModal({ cl, calViewDate, setCalViewDate, calSelected, setCalSelected, onClose, onOpen }) {
  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  const startDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysArr = Array.from({ length: totalDays }, (_, i) => i + 1);
  const blanks = Array.from({ length: startDay }, (_, i) => i);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrev = () => setCalViewDate(new Date(year, month - 1, 1));
  const handleNext = () => setCalViewDate(new Date(year, month + 1, 1));

  // 🟢 DYNAMIC INDUSTRIAL COLOR LOGIC
  const getDayStyles = (dayNum) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const targetDate = new Date(year, month, dayNum);
    targetDate.setHours(0,0,0,0);

    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const hasData = cl.dateEntries && cl.dateEntries[dateKey];

    // 🔵 FUTURE DATE: Strictly blue and unclickable
    if (targetDate > today) {
      return { cls: "bg-blue-100 text-blue-500 cursor-not-allowed pointer-events-none opacity-60", disabled: true };
    }
    
    // 🟡 TODAY: Pulsing yellow sign for present logging
    if (targetDate.getTime() === today.getTime()) {
      return { cls: "bg-yellow-400 text-gray-900 font-bold shadow-md ring-2 ring-yellow-600 animate-pulse", disabled: false };
    }

    // 🔴 PAST DATE: Green if data exists, else solid Red (Overdue)
    if (targetDate < today) {
      if (hasData) {
        return { cls: "bg-green-100 text-green-800 border border-green-300 font-semibold", disabled: false };
      }
      return { cls: "bg-red-100 text-red-600 border border-red-300 font-semibold", disabled: false };
    }

    return { cls: "bg-white text-gray-700 hover:bg-gray-100", disabled: false };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-xs font-bold">◀</button>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono">{monthNames[month]} {year}</h3>
          <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-xs font-bold">▶</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
            <span key={d} className="text-[9px] font-bold text-gray-400 uppercase font-mono py-1">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {blanks.map(b => <div key={`b-${b}`} />)}
          {daysArr.map(d => {
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const config = getDayStyles(d);
            const isSelected = calSelected === dateKey;

            return (
              <button
                key={d}
                disabled={config.disabled}
                onClick={() => setCalSelected(dateKey)}
                className={`h-8 rounded-lg text-xs font-mono flex flex-col items-center justify-center transition-all ${config.cls} ${isSelected ? "ring-2 ring-black font-black scale-105 z-10" : ""}`}
              >
                <span>{d}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600">Cancel</button>
          <button
            disabled={!calSelected}
            onClick={onOpen}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold text-white transition-all ${calSelected ? "bg-[#3D8B6E] hover:bg-[#2A6B52] shadow-sm" : "bg-gray-300 cursor-not-allowed"}`}
          >
            Select & Add Date Column
          </button>
        </div>
      </div>
    </div>
  );
}