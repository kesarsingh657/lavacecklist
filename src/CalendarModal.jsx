import React from "react";
import { toDateStr } from "./helpers";

export default function CalendarModal({ cl, calViewDate, setCalViewDate, calSelected, setCalSelected, onClose, onOpen }) {
  const today=new Date(); const todayStr=toDateStr(today);
  const year=calViewDate.getFullYear(); const month=calViewDate.getMonth();
  const filledDates=Object.keys(cl.dateEntries||{}); const weeklyDays=cl.weeklyDays||[]; const isWeekly=cl.frequency==="Weekly";
  const firstDay=new Date(year,month,1).getDay(); const daysInMonth=new Date(year,month+1,0).getDate();
  const days=[];
  for(let i=0;i<firstDay;i++)days.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dateObj=new Date(year,month,d); const dow=dateObj.getDay();
    days.push({d,dateStr,isToday:dateStr===todayStr,isFuture:dateObj>today&&dateStr!==todayStr,isFilled:filledDates.includes(dateStr),isWeekOff:isWeekly&&weeklyDays.length>0&&!weeklyDays.includes(dow),isSelected:dateStr===calSelected});
  }
  function getDayCls(day){
    if(!day)return"";
    if(day.isSelected)return"bg-[#1d4f38] text-white font-bold";
    if(day.isToday)return"bg-[#3D8B6E] text-white font-bold shadow-md";
    if(day.isWeekOff)return"bg-gray-100 text-gray-300 cursor-not-allowed";
    if(day.isFilled)return"bg-green-200 text-green-800 font-bold";
    if(day.isFuture)return"bg-blue-100 text-blue-400 cursor-not-allowed";
    return"bg-red-100 text-red-700 hover:brightness-90";
  }
  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-bold text-[#1A2E24]">📅 Select Date to Fill</h3><p className="text-[9px] text-[#6B8A78] font-mono mt-0.5">{cl.frequency} · {cl.name}</p></div><button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs">✕</button></div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={()=>setCalViewDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n;})} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[10px]">‹</button>
          <span className="text-xs font-bold text-[#1A2E24] font-mono">{calViewDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>setCalViewDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n;})} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[10px]">›</button>
        </div>
        <div className="grid grid-cols-7 mb-1 text-center">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} className="text-[9px] font-bold text-[#6B8A78] py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-0.5 mb-3">{days.map((day,i)=>day?(<div key={i} onClick={()=>(!day.isFuture&&!day.isWeekOff)&&setCalSelected(day.dateStr)} className={`w-8 h-8 mx-auto rounded-md flex items-center justify-center text-[11px] cursor-pointer transition-all relative ${getDayCls(day)}`}>{day.d}{day.isFilled&&!day.isSelected&&!day.isToday&&<span className="absolute top-0.5 right-0.5 text-[6px]">✓</span>}</div>):<div key={i}/>)}</div>
        <div className="flex gap-3 flex-wrap mb-3">{[["bg-[#3D8B6E]","Today"],["bg-green-200","Filled"],["bg-red-100","Past"],["bg-blue-100","Future"]].map(([c,l])=><div key={l} className="flex items-center gap-1 text-[9px] text-[#6B8A78]"><div className={`w-3 h-3 rounded-sm ${c}`}></div>{l}</div>)}</div>
        <div className="flex gap-2"><button onClick={onOpen} disabled={!calSelected} className="flex-1 py-2 bg-[#3D8B6E] text-white text-xs font-bold rounded-xl hover:bg-[#2A6B52] disabled:opacity-40 disabled:cursor-not-allowed">Open Date</button><button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200">Cancel</button></div>
      </div>
    </div>
  );
}