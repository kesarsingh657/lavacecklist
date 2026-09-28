/**
 * constants.js — MES Enhanced Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES:
 *  - Added STATUS.REWORK  ("rework") — checklist sent back after rejection
 *  - Added STATUS_LABEL entry for rework
 *  - Added STATUS_CLS entry for rework (orange styling)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const USERS = {
  admin:    { password:"admin123", role:"admin",    name:"Admin Supervisor" },
  operator: { password:"op123",    role:"operator", name:"Operator"         },
  qc:       { password:"qc123",    role:"approver", name:"QC Approver"      },
  viewer:   { password:"view123",  role:"viewer",   name:"Viewer"           },
};

export const DEMO_ACCOUNTS = [
  { id:"admin",    pw:"admin123", label:"Supervisor" },
  { id:"operator", pw:"op123",    label:"Operator"   },
  { id:"qc",       pw:"qc123",    label:"QC Approver"},
  { id:"viewer",   pw:"view123",  label:"Read Only"  },
];

export const FILL_TYPES   = ["Text Input","Number Input","Checkbox","OK / NG","Pass / Fail","Yes / No","Custom Dropdown"];

// 12 plant departments of the manufacturing execution system
export const DEPTS = [
  "SMT",
  "Assembly",
  "Testing",
  "Packing",
  "Quality Assurance",
  "Incoming Quality",
  "Store & Warehouse",
  "Maintenance",
  "Production Planning",
  "Repair & Rework",
  "Dispatch & Logistics",
  "EHS & Facility",
];

// Shop-floor lines — a checklist is always filled against one line
export const LINES = [
  "Line 1","Line 2","Line 3","Line 4","Line 5","Line 6",
  "Line 7","Line 8","SMT Line A","SMT Line B","Pilot Line","Rework Bench",
];

export const SHIFTS       = ["Morning","Afternoon","Night"];
export const FREQS        = ["One Time","Hourly","Daily","Weekly","Monthly"];

// Hourly schedule — one checklist entry column per hour slot
export const HOURLY_INTERVALS = [1, 2, 3, 4];
export const SHIFT_HOURS = {
  Morning:   { start: 6,  end: 14 },
  Afternoon: { start: 14, end: 22 },
  Night:     { start: 22, end: 6  },
};

/** Hour slot labels ("06:00", "07:00", …) for a shift at the given interval. */
export function hourSlots(shift = "Morning", interval = 1) {
  const { start, end } = SHIFT_HOURS[shift] || SHIFT_HOURS.Morning;
  const span = (end - start + 24) % 24 || 24;
  const step = Math.max(1, parseInt(interval, 10) || 1);
  const slots = [];
  for (let h = 0; h < span; h += step) {
    slots.push(`${String((start + h) % 24).padStart(2, "0")}:00`);
  }
  return slots;
}
export const WEEK_DAYS    = ["Su","Mo","Tu","We","Th","Fr","Sa"];
export const PAPER_SIZES  = ["A4","A3"];

export const STATUS = {
  DRAFT:     "draft",
  FINALIZED: "finalized",
  SUBMITTED: "submitted",
  PENDING:   "pending",
  APPROVED:  "approved",
  REJECTED:  "rejected",
  CANCELLED: "cancelled",
  // NEW: rework status — checklist returned to operator after rejection for fixes
  REWORK:    "rework",
};

export const STATUS_LABEL = {
  draft:     "📝 Draft",
  finalized: "🔒 Finalized",
  submitted: "📤 Submitted",
  pending:   "⏳ Pending Approval",
  approved:  "✅ Approved",
  rejected:  "❌ Rejected",
  cancelled: "⊘ Cancelled",
  // NEW: rework label
  rework:    "🔄 In Rework",
};

export const STATUS_CLS = {
  draft:     "bg-gray-100 text-gray-600 border-gray-200",
  finalized: "bg-amber-100 text-amber-700 border-amber-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved:  "bg-green-100 text-green-700 border-green-200",
  rejected:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  // NEW: orange for rework — visually distinct from rejected
  rework:    "bg-orange-100 text-orange-700 border-orange-200",
};