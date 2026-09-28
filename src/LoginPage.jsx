import React, { useState } from "react";
import api from "./api";
import LavaLogo from "./LavaLogo.jsx";

export default function LoginPage({ onLogin }) {
  const [id,setId]=useState(""); const [pw,setPw]=useState(""); const [showPw,setShowPw]=useState(false); const [error,setError]=useState("");
  
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e){
    e.preventDefault();
    if (!id.trim() || !pw.trim()) { setError("Please enter username and password"); return; }
    setLoading(true); setError("");
    try {
      const data = await api.auth.login(id.trim(), pw);
      onLogin(data.user);
    } catch(err) {
      setError(err.message || "Invalid credentials");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
         style={{background:"radial-gradient(900px 500px at 15% -10%, rgba(255,0,71,.14), transparent 60%), radial-gradient(800px 500px at 100% 110%, rgba(255,0,71,.10), transparent 60%), #F5F6FA"}}>

      {/* Brand watermark */}
      <div className="pointer-events-none absolute -right-24 -bottom-16 opacity-[0.045] select-none">
        <LavaLogo height={260}/>
      </div>

      <div className="w-full max-w-md rounded-3xl p-8 relative z-10 animate-fade-up"
           style={{background:"rgba(255,255,255,0.94)",backdropFilter:"blur(20px)",border:"1px solid #EDEEF5",boxShadow:"0 30px 80px -30px rgba(255,0,71,0.35), 0 2px 8px rgba(20,20,27,0.05)"}}>
        <div className="h-1 w-full rounded-full bg-lava-grad mb-7"/>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5"><LavaLogo height={34}/></div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Smart Checklist</h1>
          <p className="text-sm text-muted mt-1">Manufacturing Execution System</p>
          <div className="font-mono text-[10px] text-lava-400 mt-1.5 tracking-wider">v4.0 · FULL APPROVAL WORKFLOW</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Employee ID</label>
            <input value={id} onChange={e=>setId(e.target.value)} className="field py-3 text-sm" placeholder="Enter Employee ID"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} className="field py-3 pr-10 text-sm" placeholder="Enter Password"/>
              <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-lava-500 text-xs">{showPw?"🙈":"👁"}</button>
            </div>
          </div>
          {error&&<p className="text-lava-600 bg-lava-50 border border-lava-100 rounded-lg px-3 py-2 text-[11px]">{error}</p>}
          <button type="submit" disabled={loading} className="btn-lava w-full justify-center py-3 text-sm">{loading?"Signing in…":"Sign In →"}</button>
        </form>
        <p className="text-center text-[10px] text-muted mt-7">Copyright © Lava International Limited</p>
      </div>
    </div>
  );
}