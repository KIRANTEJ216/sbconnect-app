# Development Notes — Future Feature Roadmap
## Generated: 2026-07-09

---

## Objective
Document expert recommendations for making the SB Connect Attendance &
Membership webapp more robust and giving admins greater control to diagnose
and resolve issues directly from the admin panel.

---

## Phase 1 — Critical Security & Foundation

### 1. Set Firebase Auth Custom Claims
- **What**: When `users/{uid}.role` is updated (via admin promote, self-serve
  code, or auto-promotion), call `admin.auth().setCustomUserClaims(uid, { role })`
  from a Cloud Function (Firestore trigger on `users/{uid}.role`).
- **Why**: Firestore security rules check `request.auth.token.role`, but the
  app currently only writes the role to Firestore — custom claims are never
  set. This means Firestore security rules do NOT actually enforce admin
  access. Any authenticated user could potentially bypass client-side checks.
- **Priority**: P0 — Security vulnerability.
- **Status**: Pending

### 2. Admin Action Audit Log
- **What**: Log every admin action (verify profile, delete meeting, delete
  profile, resolve issue report, award deal, change user role, create/delete
  notification, send bulk notification) to a new `adminAuditLog` collection
  with fields: `actorUid`, `actorEmail`, `action` (string enum), `targetId`,
  `targetType` (collection name), `details` (JSON blob), `timestamp`.
- **Why**: Accountability, compliance, ability to investigate incidents and
  rollback.
- **Priority**: P1
- **Status**: Pending

### 3. Membership Auto-Expiry (Cloud Function)
- **What**: Scheduled Cloud Function (e.g. `every day 00:00`) that queries
  `profiles` where `membershipExpiry < now && membershipStatus === 'active'`
  and sets `membershipStatus = 'expired'`.
- **Why**: Currently membership expiry is a display-only calculation. Members
  whose membership has lapsed remain marked as `active`. This also enables
  automated notifications to expiring members.
- **Priority**: P1
- **Status**: Pending

### 4. Soft-Delete / Undo System
- **What**: Replace hard-delete operations with a `deleted: true` flag on
  profiles, meetings, requests, notifications. Add a "Deleted Items" tab in
  admin panel showing recently deleted records with a "Restore" button.
  Auto-purge after 30 days via Cloud Function.
- **Why**: Accidental deletion of a meeting, profile, or request currently
  has no recovery path. Support requests for "I accidentally deleted X" are
  unrecoverable.
- **Priority**: P1
- **Status**: Pending

---

## Phase 2 — Admin Empowerment

### 5. Bulk Operations Panel
- **What**: Multi-select checkboxes on verification requests, profiles,
  notifications, and requests tables with batch actions:
  - Verify selected profiles (bulk approve)
  - Send notification to selected members or member groups
  - Export selected profiles as CSV
  - Delete selected (bulk soft-delete)
- **Why**: Admins currently must approve/delete one item at a time. With
  dozens of pending verifications this is tedious.
- **Priority**: P2
- **Status**: Pending

### 6. Server-Side Rate Limiting
- **What**: Move rate limiting from localStorage (trivially bypassed) to
  Firestore-based or Cloud Function-based using `counters/{key}` with
  TTL. Key operations: login attempts, report issue submissions, sign-up
  attempts.
- **Why**: localStorage rate limiting provides no real protection against
  abuse — a user can clear localStorage or bypass client-side code entirely.
- **Priority**: P2
- **Status**: Pending

### 7. Notification Targeting & Filtering
- **What**: Instead of broadcast-only notifications, allow admin to target:
  - Membership expiring in N days
  - Attendance compliance (below threshold)
  - Business category
  - Individual member
- **UI**: Popover/modal with filter builder when sending notification.
- **Why**: Broadcast-only notifications are noise for most members. Targeted
  messages (e.g. "Your membership expires in 7 days") are more actionable.
- **Priority**: P2
- **Status**: Pending

### 8. Issue Report Auto-Triage & Alerting
- **What**:
  - Auto-categorize by page URL
  - Show trending issues (same page + similar subject) grouped with count
  - Highlight new reports since last admin visit
  - Option to email/Slack webhook on new critical report
- **Why**: Currently reports are a flat list with no signal. A single bug can
  generate dozens of duplicate reports with no aggregation.
- **Priority**: P2
- **Status**: Pending

### 9. Error Monitoring — Persistent Aggregation
- **What**: Replace localStorage error tracker with a `serverErrors`
  collection in Firestore. Errors from `errorTracker.ts` get forwarded there
  (or Sentry initialised). Admin sees aggregated error counts, grouped by
  message/source, with timestamps.
- **Why**: localStorage errors are per-device — the admin sees only their own
  machine's errors. Centralised storage catches all users' errors.
- **Priority**: P2
- **Status**: Pending

### 10. Data Backup & Restore
- **What**: "Export All Data" button in admin that downloads a JSON blob of
  all collections (users, profiles, meetings, requests, deals, attendance,
  notifications, loginLogs, issueReports). "Import" button to restore from a
  previously exported JSON.
- **Why**: No disaster recovery path currently exists. A compromised
  Firestore write (or accidental mass delete) is unrecoverable.
- **Priority**: P2
- **Status**: Pending

---

## Phase 3 — Advanced Admin Capabilities

### 11. User Impersonation ("View As User")
- **What**: Admin can select a user from a searchable list and enter a
  read-only view showing exactly what that user sees: dashboard, profile,
  attendance status, requests, RSVPs. Banner at top says "Viewing as
  {user.name} — Exit" (no write operations allowed).
- **Why**: Support/debugging of user-reported issues currently requires
  asking the user for screenshots or sharing passwords. Impersonation lets
  admin see the problem directly.
- **Priority**: P3
- **Status**: Pending

### 12. Admin Dashboard / Home Tab
- **What**: Summary cards on the admin landing view:
  - Pending verifications count (with link to Members tab)
  - Open issue reports count (with link to Updates tab)
  - Memberships expiring in 30 days (with link to Members tab > Membership)
  - Total active / expired members
  - Upcoming meeting count
  - Recent admin audit log entries
- **Why**: Admin currently lands on the Members tab with no summary of
  what needs attention. A dashboard reduces context-switching.
- **Priority**: P3
- **Status**: Pending

### 13. Payment Admin Panel
- **What**: When payments (Razorpay) are integrated, add:
  - Payment history table per member
  - Manual payment recording (cash/cheque) by admin
  - Mark membership as paid with expiry date
  - Payment receipt download
  - Dues tracking
- **Why**: Currently `Payments.tsx` is a placeholder. The admin has no
  ability to manage or record payments.
- **Priority**: P3
- **Status**: Pending

### 14. Global Admin Search
- **What**: Search bar in admin header that searches across users (email,
  name), profiles (company name, owner name), meetings (label), requests
  (title). Results shown in a dropdown with links.
- **Why**: Finding a specific member or meeting currently requires scrolling
  through tables or navigating to the profile URL manually.
- **Priority**: P3
- **Status**: Pending

### 15. Attendance Reconciliation
- **What**: Allow admin to manually mark attendance for a user who forgot to
  scan QR code. Form: select meeting + select user → record attendance with
  `scannedAt`, `markedByAdmin: true`.
- **Why**: "I attended but forgot to scan" is a common user complaint.
  Currently there is no way to retroactively correct this.
- **Priority**: P3
- **Status**: Pending

---

## Phase 4 — Nice-to-Have

| # | Feature | Rationale |
|---|---------|-----------|
| 16 | Chat monitoring — admin read-only view, message flagging, user ban | Moderation |
| 17 | Meeting auto-reminder — Cloud Function: notify yes-RSVPs 24h before | Reduce no-shows |
| 18 | Profile version history — subcollection per edit, admin revert | Content moderation |
| 19 | Request auto-close — Cloud Function: close past-deadline requests | Housekeeping |
| 20 | CSV import / bulk member add | Migration convenience |
| 21 | PWA push notifications via service worker | Better engagement |
| 22 | Deal reversal — un-award + reopen request | Mistake recovery |
| 23 | 2FA for admin accounts | Defense-in-depth |
| 24 | Analytics tab — member growth, attendance rates, deal volume, churn | BI |
| 25 | Auto-promotion audit — log every admin promotion/demotion with reason | Governance |
| 26 | Configurable compliance rule — admin can set N-of-M attendance rule | Flexibility |

---

## Technical Debt Items

- **Self-serve admin access** (`/admin-access`): current implementation allows
  any authenticated user to generate a code and become admin without verifying
  their identity beyond code possession. Consider replacing with email-verified
  flow or super-admin approval.
- **Firebase Admin SDK**: Cloud Functions need admin SDK access to set custom
  claims. Verify service account permissions and deploy the function.
- **No test suite**: Add Vitest for unit tests + Playwright for E2E.
- **No CI/CD pipeline**: Add GitHub Actions for lint → test → build → deploy.

---

*End of document*
