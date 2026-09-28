/**
 * Header.jsx — MES Enhanced Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES:
 *  - Logo + title click → navigates to dashboard (resets welcome screen)
 *  - Analytics nav item added
 *  - Templates nav item added
 *  - Nav items: Dashboard | Checklists | Analytics | Templates | Audit Log
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useRef } from "react";
import { fmtDT } from "./helpers";
import LavaLogo from "./LavaLogo.jsx";

export default function Header({ user, page, setPage, notifications, onClearNotifs, onMarkAllRead, onLogout }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  // Nav items — visible to all roles
  const navItems = [
    ["dashboard",  "Dashboard"],
    ["checklist",  "Checklists"],
    ["templates",  "Templates"],
    ["audit",      "Audit Log"],
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-[#E7E8F0] shadow-[0_1px_0_rgba(255,0,71,.08),0_8px_24px_-20px_rgba(20,20,27,.4)] no-print">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-2">

        <div className="flex items-center gap-5">
          {/* Logo — click navigates to dashboard */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setPage("dashboard")}
          >
            <LavaLogo height={20} className="transition-transform duration-200 group-hover:scale-105"/>
            <span className="hidden sm:block w-px h-7 bg-[#E7E8F0]"/>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-ink leading-none tracking-tight">Checklist</h1>
              <p className="text-[9px] text-muted font-mono tracking-wide mt-0.5">MANUFACTURING EXECUTION</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(([p, l]) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3.5 py-2 rounded-xl text-xs transition-all duration-200 ${
                  page === p
                    ? "bg-lava-grad text-white font-semibold shadow-lava"
                    : "text-muted font-medium hover:text-lava-600 hover:bg-lava-50"
                }`}
              >
                {l}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <div className="relative" ref={ref}>
            <button
              onClick={e => { e.stopPropagation(); setNotifOpen(o => !o); if (!notifOpen && unread > 0) onMarkAllRead(); }}
              className="w-9 h-9 rounded-xl bg-lava-50 text-lava-600 border border-lava-100 flex items-center justify-center hover:bg-lava-100 transition-all relative"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold px-0.5">
                  {Math.min(unread, 99)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-11 w-80 bg-white border border-[#E7E8F0] rounded-2xl shadow-cardHover z-50 overflow-hidden animate-pop-in">
                <div className="bg-lava-grad text-white px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    Notifications {unread > 0 && <span className="ml-1 bg-red-500 rounded-full px-1.5 text-[9px]">{unread} new</span>}
                  </span>
                  <button onClick={onClearNotifs} className="text-[10px] text-white/70 hover:text-white">Clear all</button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length === 0
                    ? <p className="text-xs text-gray-400 text-center py-6">No notifications</p>
                    : notifications.slice(0, 25).map((n, i) => (
                        <div key={i} className={`px-3 py-2.5 ${n.read ? "" : "bg-lava-50"}`}>
                          <p className="text-xs text-[#14141B] leading-relaxed">{n.msg}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{fmtDT(n.time)}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* User badge */}
          <div className="flex items-center gap-2 bg-white border border-[#E7E8F0] rounded-xl px-2 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-lava-grad text-white flex items-center justify-center text-[11px] font-bold">
              {(user.name || "A")[0].toUpperCase()}
            </div>
            <div className="hidden sm:block leading-none">
              <span className="text-xs text-ink font-semibold block">{user.name?.split(" ")[0] || "User"}</span>
              <span className="text-[9px] text-lava-500 font-semibold capitalize">{user.role}</span>
            </div>
          </div>

          <button onClick={onLogout} className="btn-ghost px-3 py-2 text-xs">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}