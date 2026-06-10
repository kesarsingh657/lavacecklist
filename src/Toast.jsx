import React from "react";

export default function Toast({ msg, show }) {
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] bg-[#1A2E24] text-white text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
      <span className="text-[#6FAF8F]">✓</span> {msg}
    </div>
  );
}