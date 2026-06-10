import React, { useState } from "react";
import { USERS, DEMO_ACCOUNTS } from "./constants";

export default function LoginPage({ onLogin }) {
  const [id,setId]=useState(""); const [pw,setPw]=useState(""); const [showPw,setShowPw]=useState(false); const [error,setError]=useState("");
  
  function handleSubmit(e){
    e.preventDefault();
    const u=USERS[id.trim()];
    if(u&&u.password===pw){onLogin({id:id.trim(),role:u.role,name:u.name});}
    else{setError("Invalid credentials. Try admin / admin123");setTimeout(()=>setError(""),3000);}
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{background:"linear-gradient(135deg,#e8f5ee 0%,#f0f7f3 50%,#dceee5 100%)"}}>
      <div className="w-full max-w-md rounded-3xl p-8 relative z-10" style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",border:"1px solid rgba(111,175,143,0.2)",boxShadow:"0 20px 60px rgba(61,139,110,0.12)"}}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg mb-4 text-3xl" style={{background:"linear-gradient(135deg,#6FAF8F,#3D8B6E)",color:"#fff"}}>✓</div>
          <h1 className="text-2xl font-bold text-[#1A2E24]">Smart Checklist</h1>
          <p className="text-sm text-[#6B8A78] mt-1">Manufacturing Management System</p>
          <div className="font-mono text-[10px] text-[#6FAF8F] mt-1 tracking-wider">v4.0 · Full Approval Workflow</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2E24] mb-1.5">Employee ID</label>
            <input value={id} onChange={e=>setId(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-xl text-sm outline-none text-[#1A2E24]" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}} placeholder="Enter Employee ID"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1A2E24] mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none text-[#1A2E24]" style={{background:"#f6faf8",border:"1.5px solid #d0e8da"}} placeholder="Enter Password"/>
              <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8A78] hover:text-[#3D8B6E] text-xs">{showPw?"🙈":"👁"}</button>
            </div>
          </div>
          {error&&<p className="text-red-500 text-[11px]">{error}</p>}
          <button type="submit" className="w-full text-white py-3 rounded-xl font-semibold text-sm" style={{background:"linear-gradient(135deg,#6FAF8F,#2A6B52)"}}>Sign In →</button>
        </form>
        <div className="mt-5 rounded-xl p-3 border" style={{background:"#f6faf8",borderColor:"#d0e8da"}}>
          <p className="text-[10px] font-semibold text-[#6B8A78] mb-2 uppercase tracking-wide">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map(a=>(
              <button key={a.id} onClick={()=>{setId(a.id);setPw(a.pw);}} className="text-left bg-white rounded-lg px-2 py-1.5 border text-[10px] hover:border-[#6FAF8F] hover:bg-[#e8f5ee] transition-all" style={{borderColor:"#d0e8da"}}>
                <span className="font-semibold text-[#3D8B6E]">{a.id}</span> / {a.pw}<span className="text-[9px] text-gray-400 block">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}