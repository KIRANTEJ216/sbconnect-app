# Changelog — 2026-07-09

## Summary
Major robustness, security, and admin-control improvements across the application. Includes new audit/compliance systems, health monitoring, issue reporting, storage fixes, and admin panel UX overhaul.

---

## New Features

### Admin Panel — Tab-Based Navigation
- Converted the Admin panel from a long scrollable page with collapsible sections to a 6-tab layout: Members, Meetings, Updates, Requests, Reports, Security
- Removed `CollapsibleSection` and `TiltCard` dependencies
- All existing functionality, state, handlers, and data loading preserved identically

### Audit & Compliance Report (`src/lib/auditReport.ts`)
- `generateAuditReport()` — generates comprehensive JSON report including:
  - All member profiles with membership dates/expiry
  - 3/6 attendance rule compliance check per member
  - Meeting attendance data
  - Deal activity with amounts
  - Revenue leaderboard
  - Login logs
  - Admin role overview
- `downloadReport()` — saves report as timestamped JSON file
- Admin panel: "Generate & Download Report" button under Reports tab

### System Health Dashboard (`src/lib/healthCheck.ts`)
- `runHealthCheck()` — runs 8 diagnostics:
  - Firestore read/write connectivity
  - Auth service check
  - Membership data integrity (expiry dates)
  - RSVP data integrity
  - Attendance data integrity
  - Deal amount validation
  - Request deadline validation
- Returns `HealthReport` with per-check status (healthy/degraded/unhealthy), collection counts, warnings, and overall system status
- Admin panel: "Run Health Check" button, results display with collection counts grid, service checks list, warnings, error log viewer, and last-checked timestamp

### Client-Side Error Tracker (`src/lib/errorTracker.ts`)
- `trackError(message, source)` — captures errors to localStorage (`sbconnect_errors`)
- `loadErrors()` — loads all stored errors
- `clearErrors()` — clears error log
- `getRecentErrors(hours)` — filters errors within time window
- Global: wired to `window.onerror` and `window.onunhandledrejection` in App.tsx
- Admin panel: recent errors display (up to 20, with source and timestamp) in System Health section

### Client-Side Rate Limiter (`src/lib/rateLimit.ts`)
- `checkRateLimit(key, maxAttempts, windowMs)` — localStorage-based rate limiting
- `getRateLimitRemaining(key, maxAttempts, windowMs)` — query remaining attempts
- Returns `{ allowed, remaining, resetAt }`

### Issue Report System
- New `IssueReport` type in `types.ts` (fields: id, uid, userEmail, userDisplayName, companyName, page, subject, description, status, adminNote, createdAt)
- Firestore CRUD: `reportIssue()`, `getIssueReports()`, `resolveIssueReport()`, `deleteIssueReport()`
- Floating "Report Issue" button + modal (`components/ReportIssue.tsx`) — globally wired in AppLayout
- Admin panel: "Issue Reports" section in Updates tab — refresh, view, resolve with admin note, delete
- `firestore.rules` updated: `issueReports` collection — read/create/update/delete rules

### Image Upload Verification & Storage Fixes
- Confirmed image upload is real Firebase Storage (`uploadBytes` → `getDownloadURL`), not a fake button
- `storage.rules:9` — changed `delete: if false` to `allow delete: if request.auth != null && request.auth.uid == userId`
- Replaced `deleteProfilePhoto()`/`deleteProfileCatalog()` (silent `.catch(() => {})`) with:
  - `deleteStorageFile(url)` — deletes file at given Firebase Storage URL
  - `replaceProfilePhoto(uid, file, currentPhotoURL)` — deletes old photo before upload
- `Profile.tsx` — uses `replaceProfilePhoto` to clean up old photo on re-upload

### Security Fixes
- `AttendanceScan.tsx:7` — fixed open redirect: `meetingId` validated with regex `/^[a-zA-Z0-9_-]{10,}$/` before constructing redirect URL
- `src/lib/firestore.ts` — added `requireAdmin()` client-side guard to 9 functions:
  - `createMeeting`, `deleteMeeting`, `addNotification`, `deleteNotification`
  - `setUserRole`, `verifyBusinessProfile`, `closeRequest`, `deleteRequest`, `awardDeal`
  - `getIssueReports`, `resolveIssueReport`, `deleteIssueReport`

### Admin Panel Tab Additions
- **Members tab**: Verification Requests, Business Directory, Membership Expiry (all with existing CSV exports)
- **Meetings tab**: Meeting Management (create/list/view/delete), Meeting Attendance (RSVP table with CSV export)
- **Updates tab**: Send Update/Notification, Issue Reports
- **Requests tab**: Full request table with open/close/award/delete actions
- **Reports tab**: Audit & Compliance Report, System Health dashboard
- **Security tab**: Login Activity, Admin Management (super only)

### Future Features Roadmap (`docs/future-features/2026-07-09-robustness-and-admin-control-roadmap.md`)
- 26 prioritized improvements across 4 phases:
  - Phase 1 (Critical): Custom claims, audit log, auto-expiry, soft-delete
  - Phase 2 (Admin): Bulk ops, server-side rate limiting, notification targeting, error aggregation
  - Phase 3 (Advanced): User impersonation, dashboard, payments, global search, attendance reconciliation
  - Phase 4 (Nice-to-have): Chat monitoring, auto-reminders, profile versions, analytics, 2FA

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Admin.tsx` | Major refactor: CollapsibleSection → 6-tab layout, added all new sections |
| `src/lib/firestore.ts` | +64 lines: `requireAdmin()`, issue report CRUD, audit report support |
| `src/lib/auditReport.ts` | New: audit report generation + download |
| `src/lib/healthCheck.ts` | New: system health diagnostics (8 checks) |
| `src/lib/errorTracker.ts` | New: localStorage error tracking |
| `src/lib/rateLimit.ts` | New: client-side rate limiter |
| `src/lib/storage.ts` | +22 lines: `deleteStorageFile()`, `replaceProfilePhoto()` |
| `src/components/ReportIssue.tsx` | New: floating report issue button + modal |
| `src/components/layout/AppLayout.tsx` | +2 lines: wired ReportIssue globally |
| `src/App.tsx` | +24 lines: global error handlers (onerror, unhandledrejection) |
| `src/pages/AttendanceScan.tsx` | +7 lines: open redirect fix |
| `src/pages/Profile.tsx` | +4 lines: uses replaceProfilePhoto |
| `src/types.ts` | +14 lines: IssueReport interface |
| `firestore.rules` | +8 lines: issueReports collection rule |
| `storage.rules` | +2 lines: delete permission fix |
| `docs/future-features/2026-07-09-robustness-and-admin-control-roadmap.md` | New: 26-item feature roadmap |
| `remotion-demo-prompt.md` | New: website design prompt |

---

## Known Issues / What's Not Working

1. **Firestore security rules vs custom claims**: Security rules check `request.auth.token.role`, but the app never sets Firebase Auth custom claims — only writes to Firestore `users/{uid}.role`. The `requireAdmin()` client-side guard works, but Firestore-level enforcement is broken for admin-restricted collections.

2. **Self-serve admin access**: `/admin-access` allows any authenticated user to generate a code and become admin without identity verification beyond code possession.

3. **No automated tests** — test framework not configured.

4. **No CI/CD pipeline** — no GitHub Actions or similar.

5. **No image/media cleanup on deletion**: When a meeting or profile is deleted, associated QR codes/catalog images are not cleaned up from Storage.

6. **Marquee bar**: Shows only the first notification text — intended scroll animation (`marquee-bounce`) not implemented.

---

## Stats
- **20 files changed**, 2969 insertions, 556 deletions
- **New files**: 8 (auditReport, healthCheck, errorTracker, rateLimit, ReportIssue, future features roadmap, remotion-demo-prompt, output/pdf/)
- **Modified files**: 8 (Admin.tsx, firestore.ts, storage.ts, App.tsx, AppLayout.tsx, AttendanceScan.tsx, Profile.tsx, types.ts, firestore.rules, storage.rules)
- **New admin features**: 6 (Audit Report, Health Dashboard, Error Tracker, Issue Reports, Storage Fixes, Tab Navigation)

---

*Generated: 2026-07-09*
