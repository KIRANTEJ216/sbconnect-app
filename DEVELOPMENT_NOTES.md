# SB Connect — Development Notes

## Build Status
- **Frontend:** ✅ Build passes (Vite + TypeScript)
- **Functions (Cloud):** ✅ TypeScript compiles cleanly
- **PWA:** ✅ Service worker generated (11 precache entries, ~1.7 MB)
- **Security:** ✅ `npm audit` — 0 vulnerabilities
- **Deploy target:** Vercel (SPA with `vercel.json` rewrite)

---

## Progressive Change Log

### 2026-07-16 — Batch 1: Revenue Fix + Performance Optimizations

#### 1.1 Dashboard Revenue Card — Reactive + Remaining-First Display
- **Root cause:** Dashboard fetched `revenueConfig` once on mount; admin setting a target in another tab was never picked up
- `src/pages/Dashboard.tsx`:
  - Replaced one-time `getRevenueConfig()` + `useState` with `useRevenueConfig()` hook (React Query, 2-min stale time) for reactive updates
  - Primary number now shows **remaining = target − business generated** (matching TopBar behavior)
  - Subtitle reads `"FY X-Y · Remaining"`; target shown in right-side column
  - Progress bar and "₹ X raised" always rendered — no longer hidden when target is unset
  - Countdown urgency panel always visible
- `src/pages/Admin.tsx`:
  - Removed manual Financial Year input field; auto-calculated from `getFinancialYear().fyLabel`
  - `handleSaveRevenue` invalidates `['revenueConfig']` query so Dashboard picks up changes immediately
- `src/components/layout/TopBar.tsx` — already showed remaining as primary; unchanged

#### 1.2 Aggregated Deal Counter
- `src/lib/firestore.ts`:
  - New `stats/deals` doc stores precomputed `totalValue`
  - `recordDeal()` atomically increments via `runTransaction` + `increment()`
  - `getTotalBusinessValue()` reads 1 doc instead of scanning `deals/` collection
  - `ensureDealStats()` migrates existing deals on first call (scans once, creates doc)
- `src/pages/Dashboard.tsx` — invalidates `['totalBusinessValue']` on deal creation

#### 1.3 Aggregated Online Counter
- `src/lib/firestore.ts`:
  - New `stats/online` doc stores `count`
  - `getOnlineUsersCount()` reads 1 doc instead of `where('onlineStatus','==','online')`
  - `ensureOnlineStats()` initialises with current count on first call
- `src/lib/auth.ts`:
  - `setUserOnline()` atomically increments via `runTransaction`
  - `setUserOffline()` atomically decrements via `runTransaction`
  - Both check previous onlineStatus to avoid double-counting

#### 1.4 Polling Interval Adjustments
- `src/hooks/useFirebaseQuery.ts`:
  - `useOnlineUsersCount`: 10s → 30s
  - `useTotalBusinessValue`: 30s → 60s
  - `useAllRsvpsByMeeting`: 15s → 30s

#### 1.5 Camera UX Improvements
- `src/components/CameraCapture.tsx` — rewritten:
  - Loading spinner while camera initialises
  - Camera-not-supported message if `navigator.mediaDevices` unavailable
  - "Use Gallery Instead" button (closes camera, opens native file picker)
  - "Retry" button on failure
  - Camera icon shown in error state
- `src/pages/Profile.tsx` / `src/pages/CreateProfile.tsx`:
  - `handleGalleryInstead()` passes `onGallery` prop to `CameraCapture`

---

### 2026-07-16 — Batch 0: Feature Complete

#### 0.1 Meeting Attendance Warning — Renewal Note
- `src/components/StrikeWarning.tsx` — Compact mode shows renewal note: "If you do not meet this requirement, you will need to renew your membership for ₹1,000 to rejoin the community."

#### 0.2 Thin Accent Line on Dashboard Blocks
- `src/pages/Dashboard.tsx` — Added `stat-accent-top` to Notifications, Awarded Requests, My Reports, Leaderboard blocks
- `src/components/StrikeWarning.tsx` — Added `className="stat-accent-top"` to Card
- CSS class `.stat-accent-top` adds 3px gradient line at top via `::after` pseudo-element

#### 0.3 Bulk Import Business Profiles (Admin)
- `src/lib/firestore.ts` — `bulkImportProfiles(entries)`, `ImportProfileEntry` type:
  - Validates required fields (phone, ownerName, companyName)
  - Skips existing phones (checks by uid)
  - Returns `{ success, errors }`
- `src/pages/Admin.tsx` — "Import 📥" tab:
  - File upload (`.csv` only)
  - Native CSV parser (`parseCSVLine()` + `FileReader.text()`)
  - Auto-detected column mapping (heuristic header matching)
  - Manual column mapping via dropdown
  - Preview table (first 5 rows)
  - One-click import with progress and per-row error reporting
- `xlsx` dependency removed; `npm audit` now 0 vulnerabilities

#### 0.4 Photo Compression
- `src/lib/storage.ts` — `compressImage(file, maxWidth=400, quality=0.75)`:
  - Canvas API — draws to reduced size, exports as JPEG
  - Reduces uploads from ~5 MB to ~50–150 KB
- `uploadProfilePhoto()` compresses before upload
- `src/pages/Profile.tsx` / `src/pages/CreateProfile.tsx` — `handlePhoto` calls `compressImage()`
- 5 MB hard limit removed

#### 0.5 Camera Option for Profile Photo
- `src/components/CameraCapture.tsx` — Live viewfinder via `getUserMedia()`, capture button, flip toggle
- `src/pages/Profile.tsx` / `src/pages/CreateProfile.tsx` — Gallery + Camera buttons

#### 0.6 Welcome Email on Registration
- `functions/src/index.ts` — `onUserRegistered` Cloud Function:
  - Trigger: `onDocumentCreated('users/{uid}')`
  - Sends welcome email via Resend
  - Includes next steps: complete profile, browse directory, RSVP meetings

#### 0.7 Revenue Target Tracking (Initial)
- `src/types.ts` — `RevenueConfig` interface
- `src/lib/firestore.ts` — `getRevenueConfig()`, `setRevenueConfig()`
- `src/pages/Dashboard.tsx` — Revenue card with target, progress bar, remaining
- `src/pages/Admin.tsx` — Revenue target editor in Deals tab (super admin)
- `src/lib/format.ts` — `getFinancialYear()`: Indian FY (Apr 1–Mar 31), returns fyLabel, total/elapsed/remaining days, months, timeProgress

#### 0.8 UI Fixes
- "Going" → "Attend" text (`DashboardUpdates.tsx`)
- Location dropdown: `e.preventDefault()` on `onMouseDown` (`CreateProfile.tsx`, `Profile.tsx`)
- Keywords: trailing commas stripped before adding (`replace(/,+$/, '').trim()`)
- "Upload Files" → "Upload Catalog" button text
- Catalog image compression (max 1200px, quality 0.8), PDFs pass through
- Attendance warning text centered in compact mode (`StrikeWarning.tsx`)

---

## PWA Notes
- Service worker generated by `vite-plugin-pwa`
- 11 precache entries (index, CSS, JS chunks, manifest)
- Offline support via Workbox
- Manifest: `dist/manifest.webmanifest`

## Vercel Deployment
- `vercel.json` — SPA rewrite: all routes → `/index.html`
- No server-side rendering
- Firebase Functions deploy separately (not via Vercel)
- Environment variables needed on Vercel: all `VITE_FIREBASE_*`

## Known Issues
- Firebase chunk (591 KB) not code-splittable due to mixed static + dynamic import pattern in `firebase.ts`
