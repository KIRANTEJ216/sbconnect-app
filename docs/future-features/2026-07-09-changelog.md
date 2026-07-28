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

## Bug Fixes

### RSVP Not Updating in Admin's Meeting Attendance Table
- **Root cause**: `useAllRsvpsByMeeting` (admin) and `getUserRSVPs` (user dashboard) used `collectionGroup(db, 'rsvps')` queries that required composite indexes never defined in `firestore.indexes.json`. The queries silently failed, so the admin's Meeting Attendance table always showed 0/empty and user's existing RSVPs didn't persist on page refresh.
- **Fix**: Replaced both `collectionGroup` queries with per-meeting reads using `getMeetingRSVPs(m.id)` (direct subcollection path — no index needed).
- **Files**: `src/hooks/useFirebaseQuery.ts`, `src/lib/firestore.ts`
- **Additional**: Set `staleTime: 0` + `refetchInterval: 15s` on `useAllRsvpsByMeeting` so admin sees RSVP updates in near-real-time.

---

## Improvements

### Meeting Attendance Table — Flat Per-RSVP Format
- **What**: Replaced the per-meeting summary table (showing attendee names as inline badges) with a flat table where each RSVP record gets its own row
- **Columns**: Meeting, Date, Member, Company, Response (Going/Not Going/Maybe), Responded At
- **CSV export** updated to include all columns in the flat format
- **Added**: Footer showing total RSVP count across all meetings
- **Why**: Easier to scan, filter, and export — each member's attendance is a single row

### Webhook / Google Sheets Sync System
- **What**: New webhook export system in the Reports tab
- **Firestore functions** (`firestore.ts`):
  - `saveWebhookUrl(url)` — saves webhook URL to `config/webhook` doc
  - `getWebhookUrl()` — reads saved webhook URL
  - `triggerWebhookExport()` — reads ALL collections (users, profiles, meetings, requests, deals, attendance, notifications, loginLogs, issueReports) and POSTs as JSON to the webhook URL
- **Admin UI**: URL input with Save button + Sync Now button with status feedback
- **Use case**: Connect to Google Apps Script, Zapier, n8n, or Make to write data to Google Sheets as a local backup
- **Firestore rules**: Added `config` collection rule (admin read/write only)

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
- **24 files changed**, ~3040 insertions, ~570 deletions
- **New files**: 8 (auditReport, healthCheck, errorTracker, rateLimit, ReportIssue, future features roadmap, remotion-demo-prompt, output/pdf/)
- **Modified files**: 12 (Admin.tsx, firestore.ts, useFirebaseQuery.ts, storage.ts, App.tsx, AppLayout.tsx, AttendanceScan.tsx, Profile.tsx, types.ts, firestore.rules, storage.rules, changelog)
- **New admin features**: 7 (Audit Report, Health Dashboard, Error Tracker, Issue Reports, Storage Fixes, Tab Navigation, Webhook Sync)
- **Bugs fixed**: 1 (RSVP not updating in admin panel — missing collectionGroup index)
- **UI improvements**: 1 (Meeting Attendance table — flat per-RSVP rows)

---

## Progressive Updates (2026-07-11)

### 2026-07-11 — Permission Model Restructure & Issue Reply System
**Commit**: `16ac907` → `c47dffa` → `6e1274b`

#### Permission Model: Admin = Read-Only, Super Admin = Full Write
- **`src/lib/admin.ts`**: Added `isAdminViewer(role)` and `isSuperAdminRole(role)` helpers
- **`src/lib/firestore.ts`**: Replaced all 14 `requireAdmin()` calls with `requireSuperAdmin()` — only super_admin can now perform writes
- **`src/pages/Admin.tsx`**: `canWrite` gates 16+ buttons (Approve, Create/Delete Meeting, Send/Delete Update, Resolve/Delete Issue, Deal Closed, Close/Delete Request, Save URL, Sync Now, Confirm Deal, Add/Remove Admin); read-only banner shown when `!canWrite`
- **`firestore.rules`**: Every `admin` write rule changed to `super_admin`; admin retains all read access; owner writes preserved
- **`src/pages/Profile.tsx`**: `canEdit` and edit-count bypass now require `isSuperAdminUser` (admin can view but not edit profiles)

#### Issue Reply / Conversation System
- **`src/types.ts`**: Added `IssueReply` type (`id`, `text`, `authorUid`, `authorName`, `authorRole`, `createdAt`); added `replies: IssueReply[]` to `IssueReport`; `UserNotification.type` adds `'issue_reply'`
- **`src/lib/firestore.ts`**: 
  - `addIssueReply(issueId, text, authorUid, authorName, authorRole)` — appends reply via `arrayUnion`, notifies reporter (super_admin) or all admins (user reply) via `sendUserNotification`/`notifyAdmins`
  - `getUserIssueReports(uid)` — fetches user's own reports with replies
  - `notifyAdmins(type, title, message, relatedId)` — broadcasts to all admin/super_admin users
- **`src/pages/Admin.tsx`**: Reports tab shows threaded replies + reply input (gated by `canWrite`)
- **`src/pages/Dashboard.tsx`**: "My Reports" section with reply capability; notification badge shows "New Reply" with warning color
- **`firestore.rules`**: Issue owner can read+update own reports for replies; super_admin full access

#### Cloud Functions for Custom Claims Sync
- **`functions/src/index.ts`**:
  - `onUserCreate` (`beforeUserCreated` blocking function) — sets initial `customClaims.role` on signup (super_admin for `kktej3d@gmail.com`, user for others)
  - `syncUserRole` (`onDocumentWritten` on `users/{uid}`) — syncs Firestore `role` to Auth custom claims on any change
  - `verifyAdminCode` updated — calls `setCustomUserClaims(uid, { role: 'admin' })` immediately after promotion
- **Purpose**: Makes `request.auth.token.role` resolve in Firestore rules, eliminating fallback reads

---

### 2026-07-11 — Firestore Rules Fix + Membership Paid Date + Drip Emails
**Commit**: `d4359ac` → `6e1274b`

#### Firestore Rules — Token.Role Fallback to Firestore Read
- **`firestore.rules`**: Added `isSuperAdmin()` and `isAdminOrSuperAdmin()` helpers
  - Check `request.auth.token.role` FIRST (fast path after functions deploy)
  - Fall back to `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role` (works immediately without custom claims)
- **Result**: ALL super_admin write operations now work (profile verification, meetings, notifications, etc.) WITHOUT requiring Cloud Functions deployment

#### Membership Payment Date System
- **`src/types.ts`**: Added `paidDate: number` (payment timestamp) + `dripSentDays: number[]` (tracks notified intervals)
- **`src/lib/firestore.ts`**:
  - `createBusinessProfile`: Sets `membershipDate=0`, `membershipStatus='inactive'`, `paidDate=0`, `dripSentDays=[]` — admin must set paid date
  - New `updateMembershipDates(uid, paidDate)` — super_admin only; sets `paidDate`, `membershipDate=paidDate`, `membershipExpiry=paidDate+364 days`, `membershipStatus='active'`, resets `dripSentDays`
- **`src/pages/Admin.tsx`**: "Set Paid" button in Business Directory for profiles without `paidDate` → date picker dialog → calls `updateMembershipDates`
- **`src/pages/Profile.tsx`**: Membership edit form uses "Date Paid" field; auto-computes and shows expiry date; saves `paidDate`, `membershipDate`, `membershipExpiry` together

#### Drip Email Notifications (Resend)
- **`functions/src/index.ts`**: `checkMembershipExpiry` scheduler now sends drip emails at **90, 60, 30, 14, 7, 1, 0** days before expiry
- **Tracking**: Uses `dripSentDays` array on profile to avoid duplicate sends
- **Templates**: `DRIP_SUBJECTS` + `dripBody()` per interval; includes company name and days remaining
- **Welcome email**: Could be sent immediately when `paidDate` is set (client-side or callable function)

---

*Updated: 2026-07-12*

---

### 2026-07-12 — Catalog Download, Referred By, Guest Count, Phone Split, Location Autocomplete

#### Catalog Download (replaces open-in-tab)
- **`src/lib/storage.ts`**: Added `downloadCatalogFile(url, index)` — fetches file as blob, creates `URL.createObjectURL()`, triggers download via temp `<a download>`, fallback to `window.open`
- **`src/pages/Profile.tsx`**: Both PDF and image catalog items changed from `<a href={url} target="_blank">` to `<button onClick={() => downloadCatalogFile(url, i)}>`

#### Referred By (phone-validated from existing members)
- **`src/types.ts`**: Added `referredByPhone: string`, `referredByName: string` to `BusinessProfile`
- **`src/lib/firestore.ts`**: Added `referredByPhone`/`referredByName` to DEFAULTS and createBusinessProfile. New `getProfilesForReferral(limitCount=5)` fetches most recent profiles for top-5 chips.
- **`src/pages/CreateProfile.tsx`**: Top-5 clickable referral chips + text input with datalist autocomplete. On blur, validates via `getProfileByPhone()`. Submits both `referredByPhone` and `referredByName`.
- **`src/pages/Profile.tsx`**: Same chips + input in edit mode. View mode shows "Referred by [Name]" below location.
- **`src/pages/Admin.tsx`**: "Referred By" column in Business Directory table.

#### Guest Count (Bringing to Meeting)
- **`src/types.ts`**: Added `guestCount: number` to `MeetingRSVP`
- **`src/lib/firestore.ts`**: `submitRSVP()` accepts `guestCount` param (default 0), stored in create/update paths.
- **`src/components/DashboardUpdates.tsx`**: Guest count `<select>` (0–10) below Yes/No buttons. After "Going", shows badge "Going +3" with edit icon. Re-submits RSVP on guest count change.
- **`src/pages/Admin.tsx`**: "Estimated Headcount" stat card in meeting detail. Guest count column in RSVP lists. CSV exports include guest count. Detailed table has Guests column + total headcount footer.

#### Referral Chips + Location Autocomplete (UX polish)
- **`src/pages/CreateProfile.tsx` + `src/pages/Profile.tsx`**: Top-5 referral chips + datalist autocomplete for referred-by. Location replaced `<datalist>` with filter-as-you-type dropdown (all 100+ cities, show on type).

#### Phone — Country Code Badge + Digits-Only Input
- **`src/types.ts`**: Added `countryCode: string` to `BusinessProfile`
- **`src/lib/firestore.ts`**: `countryCode: '+91'` in DEFAULTS/createBusinessProfile. `fillDefaults()` strips `+91-` prefix from legacy data. `getProfileByPhone()` fallback queries both new (digits-only) and legacy (`+91-{digits}`) formats.
- **`src/pages/CreateProfile.tsx` + `src/pages/Profile.tsx`**: Phone input split into `+91` badge + 10-digit input. Auto-strips non-digits, max 10 chars. View mode shows `+91 {phone}`.

#### Production Scrub Guide
- **`docs/future-features/scrub-deletedata-for-prod-deply.md`**: New guide for clearing test data from Firestore (profiles, deals, meetings, requests, etc.) for production deployment.

#### Files Changed (2026-07-12 session)

| File | Change |
|------|--------|
| `src/types.ts` | +3 fields: `countryCode`, `referredByPhone`, `referredByName`, `guestCount` on MeetingRSVP |
| `src/lib/firestore.ts` | `getProfilesForReferral()`, `getProfileByPhone()` backward-compat, `submitRSVP()` guestCount, DEFAULTS update |
| `src/lib/storage.ts` | `downloadCatalogFile()` |
| `src/pages/CreateProfile.tsx` | Referred chips + location autocomplete + phone country code split |
| `src/pages/Profile.tsx` | Same 3 updates in edit mode + view mode phone/referred-by display |
| `src/pages/Admin.tsx` | Referred By column + guest count in meeting stats/RSVPs/CSV + headcount footer |
| `src/components/DashboardUpdates.tsx` | Guest count dropdown with edit |
| `docs/future-features/scrub-deletedata-for-prod-deply.md` | New: production data scrub guide |

---

### 2026-07-12 — Name Fields Merge, Login Cleanup, Referrals Leaderboard

#### Register Form — Single "Full Name" Field
- **`src/pages/Register.tsx`**: Replaced split "First Name" + "Surname" inputs with single "Full Name" field; stores as `displayName`, passes empty `surname` to `signUp()`

#### CreateProfile Form — Single "Full Name" Field
- **`src/pages/CreateProfile.tsx`**: Merged "Name" + "Surname" into single "Full Name" auto-populated from `profile.displayName`; `ownerSurname` saved as empty in new profiles. Removed from progress completion check and save logic.

#### Login UI — Clean Label + Fixed Phone Resolution
- **`src/pages/Login.tsx`**: Label changed from `"Email or Phone"` to `"Email"`, placeholder to `"Email address"`
- **`src/lib/auth.ts`**: Fixed `resolvePhoneToEmail()` — normalizes input to digits-only, queries both raw-digits and `+91-{digits}` formats so phone login actually works with any stored format

#### Referrals Leaderboard (Admin Panel)
- **`src/pages/Admin.tsx`**: New "Referrals" tab in admin panel (visible to all admin/super_admin). Computes leaderboard from existing profiles data — groups by `referredByPhone`, looks up referrer's profile to show name/surname, sorts by count descending. No new Firestore queries needed.

#### Referred By — Chips Removed, Phone-Only Lookup
- **`src/pages/CreateProfile.tsx`**: Removed top-5 referral chips and `<datalist>` autocomplete. Referred By now works solely by typing a phone number — on blur, looks up via `getProfileByPhone()` and shows matched name. Placeholder: `"Search by Phone Number"`

#### Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | No changes (backward compatible) |
| `src/lib/auth.ts` | Fixed `resolvePhoneToEmail()` with digit normalization + multi-format fallback |
| `src/pages/Register.tsx` | First Name + Surname → single Full Name; `-8 lines` |
| `src/pages/CreateProfile.tsx` | Merged name fields, removed chips/datalist, phone-only lookup; `-6 lines` |
| `src/pages/Login.tsx` | Label/placeholder cleanup |
| `src/pages/Admin.tsx` | New Referrals leaderboard tab; `+71 lines` |

---

### 2026-07-12 (late) — Restore Two-Column Names, Fix Permissions & Input Filtering

#### Two-Column Name Layout Restored
- **`src/pages/Register.tsx`** + **`src/pages/CreateProfile.tsx`**: Split back to "Full Name" + "Surname" columns with proper auto-population from `profile.surname`
- Surname captured during registration stored in `users/{uid}.surname`

#### Permission Fix — Award Deal Ownership
- **`src/lib/firestore.ts`**: `awardDeal()` now allows request owner to award their own deal without super_admin; only requires `requireSuperAdmin()` when a different user awards

#### Input Filtering (Create Request)
- **`src/pages/CreateRequest.tsx`**: Title/description filtered to alphanumeric + basic punctuation; budget field digits-only

#### Website URL Normalization
- **`src/pages/CreateProfile.tsx`**, **`src/pages/Profile.tsx`**: Website auto-prepends `https://` when no protocol is entered (e.g., `example.com` → `https://example.com`)

#### Simplified Interest Transaction
- **`src/lib/firestore.ts`**: `expressInterest()` simplified from `runTransaction` to direct reads/writes (removed `interestCount: increment(1)`)

**Files Changed:**

| File | Change |
|------|--------|
| `src/lib/firestore.ts` | Simplified `expressInterest()`, owner-can-award in `awardDeal()` |
| `src/pages/CreateProfile.tsx` | Two-column name, website normalization |
| `src/pages/Register.tsx` | Two-column name layout restored |
| `src/pages/CreateRequest.tsx` | Input filtering (title, description, budget) |
| `src/pages/Profile.tsx` | Website normalization in edit + view |

---

### 2026-07-14 — Admin UX, Audit Report HTML, Phone Pre-fill, Website Flexibility

#### Audit Report — HTML + Print-to-PDF
- **`src/lib/auditReport.ts`**: Replaced JSON download with styled HTML report page. Opens in new tab with formatted summary stats grid, attendance compliance section, member directory (color-coded status badges), meetings table, deals table, and admin list. Uses `window.print()` for save-as-PDF. Fallback to file download when popup blocked.

#### Admin Panel — Date Columns & Sorting
- **`src/pages/Admin.tsx`**:
  - **Requests tab**: Added "Date" column showing `DD-MM-YYYY` creation date (already sorted by latest first)
  - **Members tab → Business Directory**: Added "Registered" column showing profile creation date; profiles sorted by `createdAt` descending so newest members appear first
  - **Meeting Attendance**: Summary footer redesigned from plain text into a gradient stat bar with icons, bold numbers for "Total RSVPs" and "Estimated Headcount"

#### Phone Auto-Populate from Registration
- **`src/pages/CreateProfile.tsx`**: Phone number from registration (`profile.phone`) now auto-fills the business profile phone field, stripping any `+91-` prefix. Works alongside existing email/name auto-population.

#### Website Input — Flexible Format
- **`src/pages/CreateProfile.tsx`**, **`src/pages/Profile.tsx`**: Changed from `type="url"` to `type="text"` so users can enter `www.example.com`, `https://example.com`, or `example.com` without browser validation blocking. Existing `https://` normalization still works on submit.

#### Storage Rules — Catalog Subdirectory Support
- **`storage.rules`**: Path pattern widened from `profiles/{userId}/{fileName}` to `profiles/{userId}/{allPaths=**}` to allow nested catalog file uploads (e.g., `profiles/{uid}/catalog/image.jpg`)

#### Dev Dependency
- **`package.json`**: Added `@playwright/test` dev dependency

**Files Changed:**

| File | Change |
|------|--------|
| `src/lib/auditReport.ts` | HTML report generation with print-to-PDF; `+268 lines` |
| `src/pages/Admin.tsx` | Date column in Requests, Registered column in Members (sorted), stat bar for Meeting Attendance |
| `src/pages/CreateProfile.tsx` | Phone auto-populate from registration; website `type="url"` → `type="text"` |
| `src/pages/Profile.tsx` | Website `type="url"` → `type="text"` |
| `storage.rules` | `{fileName}` → `{allPaths=**}` for catalog subdirectories |
| `package.json` | Added `@playwright/test` dev dependency |

---

### 2026-07-28 — Admin Dashboard UI Refresh, Super Admin Auto-Promotion, Animated Report Issue

#### Admin Panel — Dashboard-Style UI Refresh
- **`src/pages/Admin.tsx`**:
  - Header replaced with gradient hero card (`bg-gradient-to-br from-primary/5 via-primary-light/5 to-success/5`)
  - All 13 stat cards wrapped in `stat-accent-top` pattern (matching Dashboard/Profile pages)
  - Tab content spacing tightened: `space-y-6` → `space-y-3`
  - Admin management section now visible to all admins (not just super_admin)
  - Removed `isSuper` guard from admin section; Add/Remove buttons still gated by `canWrite`

#### Super Admin Auto-Promotion
- **`src/contexts/AuthContext.tsx`**:
  - Hardcoded `SUPER_ADMIN_EMAILS = ['kktej3d@gmail.com']`
  - Changed from fire-and-forget `updateDoc` inside `onSnapshot` to `getDoc` + `await updateDoc` BEFORE setting up the `onSnapshot` — eliminates race condition where `requireSuperAdmin()` reads old role
  - Role guaranteed to be `super_admin` in Firestore before any component renders
- **`src/pages/Admin.tsx`**:
  - Added local `SUPER_ADMIN_EMAILS` fallback for `canWrite` and `isSuper` checks

#### Report Issue — Animated Bug Icon
- **`src/components/ReportIssue.tsx`**:
  - Replaced static shield-bug SVG with CSS-animated bug icon
  - Keyframe animations: `float` (gentle bob), `pulse-ring` (expanding glow), `wiggle` on hover
  - Animated antennae (`antenna-l`, `antenna-r`) with `transform-origin` for natural sway
  - Gradient background: `bg-gradient-to-br from-primary to-primary-dark`
  - Button size increased: `w-11 h-11` → `w-12 h-12`

#### Business Deal Form — Label Updates
- **`src/pages/Dashboard.tsx`**:
  - "Record Business Given" → "Business Generated" (button and heading)
  - "Business Given To" → "Business Received From"
  - Added helper text: "Receiver has to record the revenue when deal is closed"

#### Profile Edit — Duplicate Check Fix & Edit Limit
- **`src/pages/Profile.tsx`**:
  - Fixed email/phone duplicate validation: added `existingEmail.uid !== profile?.uid` fallback for imported profiles where `BusinessProfile.uid` is a phone number (not Firebase Auth UID)
  - Changed edit-bypass from `isSuperAdminUser` to `isAdminViewer` — both admin and super_admin can skip the 3-edit limit

**Files Changed (this session):**

| File | Change |
|------|--------|
| `src/pages/Admin.tsx` | Dashboard-style UI, admin visibility, super admin email fallback |
| `src/contexts/AuthContext.tsx` | Super admin auto-promotion with race condition fix |
| `src/components/ReportIssue.tsx` | Animated bug icon with CSS keyframes |
| `src/pages/Dashboard.tsx` | Business Generated label, helper text |
| `src/pages/Profile.tsx` | Duplicate check fix, edit limit bypass |

---

*Updated: 2026-07-28*
