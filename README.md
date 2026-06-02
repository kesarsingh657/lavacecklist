# Smart Checklist Pro v4.0
### Full Approval Workflow + Print/PDF Export

## Quick Start
```bash
npm install
npm run dev   # → http://localhost:5173
```

## Demo Accounts
| ID       | Password  | Role      |
|----------|-----------|-----------|
| admin    | admin123  | Admin     |
| operator | op123     | Operator  |
| qc       | qc123     | Approver  |
| viewer   | view123   | Viewer    |

## All 8 Feature Groups Implemented

### 1. Print & PDF Export
- 🖨️ Print button (opens browser print dialog, correct @page CSS)
- 📄 Export PDF (downloads professional HTML report)
- Paper size chooser: **A4** (210×297mm) or **A3** (297×420mm)
- Available once checklist is Finalized, Submitted, or Approved
- Includes: metadata, approval details, data table, audit trail
- Available in both editor view AND dashboard list

### 2. Checklist Locking
- Fields lock on **Finalize**
- Submitted → ALL fields + edit toolbar hidden; only **Cancel Submission** shown
- Cancel Submission returns to Draft (editable)
- `PERM.canEdit()` gate enforced on every cell, header, and control

### 3. Approval Workflow
- Approve/Reject buttons for QC role on Submitted/Pending checklists
- Both actions require mandatory remarks (validated, cannot submit empty)
- Reject additionally requires a rejection reason
- Approver name, timestamp, remarks all stored
- Full audit entry created per action

### 4. Status Flow
- Draft → Finalized → Submitted → Approved / Rejected
- Cancel returns Submitted → Draft
- StatusPill renders all 7 statuses with correct colors

### 5. Approved Checklist Features
- Permanently locked from all editing
- Green approval details panel shown in editor
- Approval: who, when, remarks
- Print + Export available

### 6. Notification System
- Bell with unread count badge
- Notifications for: Created, Finalized, Submitted, Approval Requested, Approved, Rejected, Cancelled
- Mark-all-read on open
- Clear all button

### 7. Security & Validation
- Role-based PERM gates: canEdit, canFinalize, canSubmit, canCancelSubmit, canApproveReject, canDelete, canExport, canPrint
- All modals validate required fields before confirming
- Audit log: immutable, persisted to localStorage, 600-entry rolling window
- Timestamps on every state transition

### 8. UI/UX
- Original green theme fully preserved
- Status banners in editor (blue/green/red/amber contextual)
- Approval details panel for approved checklists  
- Audit trail embedded in editor view
- Workflow guide banner on dashboard
- Responsive table with overflow-x-auto
- Floating QC approval panel
- Audit Log page (searchable, filterable)
