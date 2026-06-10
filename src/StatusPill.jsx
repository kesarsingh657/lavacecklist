import React from "react";
import { STATUS_CLS, STATUS_LABEL } from "./constants";

export function WorkflowStepper({ status }) {
  const steps = ["Draft", "Finalized", "Submitted", "Approved"];
  const current =
    status === "draft" ? 0 :
    status === "finalized" ? 1 :
    status === "submitted" || status === "pending" ? 2 :
    status === "approved" ? 3 : 0;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {steps.map((s, i) => (
        <div key={s} className={`px-3 py-1 rounded-full text-xs font-bold ${i <= current ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
          {s}
        </div>
      ))}
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${STATUS_CLS[status]||STATUS_CLS.draft}`}>
      {STATUS_LABEL[status]||"Draft"}
    </span>
  );
}

export function FreqPill({ freq }) {
  const map={Daily:"bg-blue-100 text-blue-700",Weekly:"bg-purple-100 text-purple-700",Monthly:"bg-yellow-100 text-yellow-800","One Time":"bg-gray-100 text-gray-600"};
  return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${map[freq]||map["One Time"]}`}>{freq}</span>;
}