/**
 * CommentsThread.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE: Back-and-forth comment thread on a checklist.
 *
 * How it works:
 *  - Comments are stored inside the checklist object as `cl.comments[]`
 *  - Each comment: { id, authorId, authorName, role, text, timestamp }
 *  - Any logged-in user (operator, approver, admin) can post a comment
 *  - Thread is shown below the grid in ChecklistEditor
 *  - Comments persist via the normal persist() → localStorage flow
 *
 * Usage in ChecklistEditor:
 *   <CommentsThread cl={cl} user={user} onAddComment={handleAddComment} />
 *
 * handleAddComment (in ChecklistEditor):
 *   function handleAddComment(text) {
 *     const comment = {
 *       id: "CMT-" + Math.random().toString(36).slice(2,8).toUpperCase(),
 *       authorId:   user.id,
 *       authorName: user.name,
 *       role:       user.role,
 *       text,
 *       timestamp:  now(),
 *     };
 *     const updated = { ...cl, comments: [...(cl.comments || []), comment], updatedAt: now() };
 *     persist(updated);
 *     setCl(updated);
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useEffect } from "react";
import { fmtDT } from "./helpers";

// Role colour mapping so each participant has a distinct badge
const ROLE_CLS = {
  admin:    "bg-purple-100 text-purple-700",
  operator: "bg-blue-100   text-blue-700",
  approver: "bg-green-100  text-green-700",
  viewer:   "bg-gray-100   text-gray-500",
};

export default function CommentsThread({ cl, user, onAddComment, isView }) {
  const [text, setText]   = useState("");
  const [err,  setErr]    = useState("");
  const bottomRef         = useRef(null);
  const comments          = cl.comments || [];

  // Auto-scroll to newest comment when thread updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  function handlePost() {
    const trimmed = text.trim();
    if (!trimmed) { setErr("Comment cannot be empty."); return; }
    if (trimmed.length > 500) { setErr("Max 500 characters."); return; }
    onAddComment(trimmed);
    setText("");
    setErr("");
  }

  function handleKeyDown(e) {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handlePost();
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mt-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-[#f6faf8]">
        <span className="text-[11px] font-bold text-[#1A2E24] flex items-center gap-1.5">
          💬 Comments &amp; Discussion
        </span>
        <span className="text-[10px] text-[#6B8A78] font-mono">{comments.length} message{comments.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Thread body */}
      <div className="max-h-56 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            No comments yet — start the discussion below.
          </p>
        )}
        {comments.map(c => (
          <div key={c.id} className={`flex gap-2.5 ${c.authorId === user.id ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-[#3D8B6E] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {(c.authorName || "?")[0].toUpperCase()}
            </div>
            {/* Bubble */}
            <div className={`max-w-[70%] ${c.authorId === user.id ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-[#1A2E24]">{c.authorName}</span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full capitalize ${ROLE_CLS[c.role] || ROLE_CLS.viewer}`}>
                  {c.role}
                </span>
              </div>
              <div className={`px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
                c.authorId === user.id
                  ? "bg-[#3D8B6E] text-white rounded-tr-none"
                  : "bg-gray-100 text-[#1A2E24] rounded-tl-none"
              }`}>
                {c.text}
              </div>
              <span className="text-[9px] text-gray-400 font-mono">{fmtDT(c.timestamp)}</span>
            </div>
          </div>
        ))}
        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input area — hidden in pure view mode */}
      {!isView && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setErr(""); }}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… (Ctrl+Enter to send)"
            maxLength={500}
            rows={2}
            className="w-full text-[11px] border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:border-[#3D8B6E] bg-white"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9px] text-gray-400 font-mono">{text.length}/500</span>
            <div className="flex items-center gap-2">
              {err && <span className="text-[10px] text-red-500 font-semibold">{err}</span>}
              <button
                onClick={handlePost}
                className="px-3 py-1.5 bg-[#3D8B6E] hover:bg-[#2A6B52] text-white text-[11px] font-bold rounded-lg transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}