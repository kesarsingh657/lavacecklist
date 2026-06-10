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

export const FILL_TYPES = ["Text Input","Number Input","Checkbox","OK / NG","Pass / Fail","Yes / No","Custom Dropdown"];
export const DEPTS      = ["Production","Quality","Warehouse","Maintenance"];
export const SHIFTS     = ["Morning","Afternoon","Night"];
export const FREQS      = ["One Time","Daily","Weekly","Monthly"];
export const WEEK_DAYS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];
export const PAPER_SIZES = ["A4","A3"];

export const STATUS = {
  DRAFT:     "draft",
  FINALIZED: "finalized",
  SUBMITTED: "submitted",
  PENDING:   "pending",
  APPROVED:  "approved",
  REJECTED:  "rejected",
  CANCELLED: "cancelled",
};

export const STATUS_LABEL = {
  draft:"📝 Draft", finalized:" Finalized", submitted:"📤 Submitted",
  pending:"⏳ Pending Approval", approved:"✅ Approved", rejected:"❌ Rejected", cancelled:"⊘ Cancelled",
};

export const STATUS_CLS = {
  draft:"bg-gray-100 text-gray-600 border-gray-200",
  finalized:"bg-amber-100 text-amber-700 border-amber-200",
  submitted:"bg-blue-100 text-blue-700 border-blue-200",
  pending:"bg-yellow-100 text-yellow-800 border-yellow-200",
  approved:"bg-green-100 text-green-700 border-green-200",
  rejected:"bg-red-100 text-red-700 border-red-200",
  cancelled:"bg-gray-100 text-gray-500 border-gray-200",
};