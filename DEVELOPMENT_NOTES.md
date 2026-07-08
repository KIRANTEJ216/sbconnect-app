# SB Connect — Development Notes

## Stack
- **Framework:** React 19 + TypeScript + Vite
- **Auth/DB:** Firebase Auth + Firestore (project `sbconnect-65338`)
- **Styling:** Tailwind CSS v3 + custom design system (warm Anthropic-inspired palette)
- **Deployment:** Vercel (SPA with `vercel.json` rewrites)

## Features & Development Log

### Authentication & Access Control
- Firebase Auth with email/password login
- User profiles stored in `users/{uid}` collection with `role` field (`user | admin | super_admin`)
- Admin access based on: hardcoded email bootstrap (`admin.ts`) OR Firestore `role` field
- `isAdmin(email, role)` / `isSuperAdmin(email, role)` — hybrid check
- AuthContext auto-upgrades hardcoded emails from `user` → `admin`/`super_admin` on login
- `AdminGuard` component protects `/admin` route; redirects to `/dashboard` if unauthorized
- Admin nav link appears in sidebar, bottom nav, and mobile sidebar based on access check
- Admin verification code flow (`AdminAccess.tsx`) — generates code sent via Resend (Firebase Function)

### Business Profiles
- `BusinessProfile` type in `profiles/{uid}` doc with: ownerName, ownerSurname, companyName, phone, categories, keywords, location, photoURL, catalogURLs, verified, membershipStatus, membershipDate, membershipExpiry, editCount, locked, createdAt, updatedAt, lastRequestsViewedAt
- Profile creation (`CreateProfile.tsx`) with side-by-side Name + Surname fields
- Profile editing with photo upload (Firebase Storage), catalog file uploads, keyword tags
- Max 3 edits before profile locks (admin can override via Admin)
- QR code generated at profile creation (`qrCodeURL = window.location.origin/profile/{uid}`)
- Profile page (`Profile.tsx`) with MembershipCountdown, edit controls, deal recording

### Dashboard (`Dashboard.tsx`)
- **Stat cards row:** Membership Status, Members Directory (clickable → `/profiles`), Requests (clickable → `/requests`) with premium pills showing My/Open counts
- **Quick Actions:** Create Request, View My Profile, Record Business Given
- **Your Business:** Photo, owner name/categories/location/badges, MembershipCountdown block
- **Leaderboard:** Top 7 by revenue with 🥇🥈🥉 emojis, deal counts, clickable to profile
- **DashboardUpdates:** Upcoming Meetings (current month only) with join links
- **New Requests dot indicator:** Red pulsing dot on Requests stat card when new requests exist (tracked via `lastRequestsViewedAt`), cleared on visiting `/requests`
- **StrikeWarning:** 3-strike attendance rule warning
- **Deal form:** Record Business Given with business selector, amount, description

### Requests System
- Create requests with title, description, category (from REQUEST_CATEGORIES: Technology, Construction, Marketing, Finance, Logistics, Consulting, Electrical, Other), budget, deadline
- Filter by category tabs (client-side filtering after fetching all)
- **My Requests / Open Requests** sections with count stat cards at top
- Pitch flow: express interest with auto-generated message from company phone
- Call button after pitching (phone redirect, no chat)
- Owner can close their own requests
- Category tabs filter both sections
- `lastRequestsViewedAt` tracking for new-request dot on Dashboard

### Business Directory (`Profiles.tsx`)
- Search by name, category, keyword, location
- TiltCard hover effects with profile cards
- Badges for membership status, verification status
- Clickable to individual profile page

### Admin Panel (`Admin.tsx`)
- **Verification Requests:** Approve/reject unverified business profiles
- **Meetings:** Create with date, label, location; delete with confirm dialog
- **Notifications:** Add/delete (hard delete) marquee notifications
- **Business Directory:** Table with photo, owner name/surname, business name, keywords, phone, email, membership status/expiry; CSV export
- **Membership Expiry:** Table sorted by days left with color-coded countdown; CSV export
- **Login Logs:** Recent login activity table with email, name, timestamp
- **Admins:** List all admins with role badges; add by email; remove (non-super only)
- Super admin gate for sensitive operations

### MarqueeBar (`MarqueeBar.tsx`)
- Auto-fetches current-month meetings and displays as marquee items alongside notifications
- Single-value bounce animation (`marquee-bounce` — 40s `ease-in-out infinite alternate`)
- Moves `translateX(0)` → `translateX(calc(100vw - 100%))` — slow, eye-readable
- Animated gradient accent border

### Attendance & QR Scanning
- Meeting list with active meeting highlighted
- QR code per meeting scanned via AttendanceScan page
- Attendance tracked in `attendance` collection
- Meeting Calendar removed from Attendance page (kept active meeting mark + history)
- 3-strike rule: 3 meetings required in any 6-month window

### Membership System
- `membershipDate` set at profile creation (`Date.now()`)
- `membershipExpiry` always = `membershipDate + 364 days` (auto-fixed on profile load)
- **MembershipCountdown** component with 8 color thresholds:
  - 60–46d: Green (Healthy)
  - 45–31d: Teal (Good)
  - 30–16d: Amber (Expiring Soon)
  - 15–8d: Orange (Critical)
  - 7–4d: Deep Orange (Urgent)
  - 3–2d: Red-Orange (Very Urgent)
  - 1d: Red (Last Day)
  - 0d: Dark Red (Expiring Today)
  - Expired: Dark red with "EXPIRED"
- `membershipStatus` set to `'expired'` automatically when `Date.now() > membershipExpiry`
- Admin panel expiry section with CSV export

### Messaging
- Conversations between users (Firestore `conversations/{id}`)
- Messages auto-deleted after 30 days (Firestore transaction + header notice)
- Sender/receiver display with inline message bubbles

### Design System
- Warm Anthropic-inspired palette (primary, secondary, accent, steel, charcoal, canvas, surface, etc.)
- Gradient text, glassmorphism elements, subtle shadows
- TiltCard hover effects on profile cards and stat cards
- Animated page transitions (`AnimatedPage` / `fade-in`)
- Skeleton loading states
- Responsive: sidebar on desktop, bottom nav on mobile
- Premium pill styling on stats with gradient backgrounds

### Pages Overview
| Route | Component | Description |
|---|---|---|
| `/login` | Login | Email/phone + password auth |
| `/register` | Register | Create account |
| `/forgot-password` | ResetPassword | Password reset email |
| `/dashboard` | Dashboard | Main hub with stats, leaderboard, meetings |
| `/profiles` | Profiles | Business directory with search |
| `/profile/:id` | Profile | Individual business profile |
| `/requests` | Requests | My/Open requests with filters |
| `/requests/create` | CreateRequest | New request form |
| `/requests/:id` | RequestDetail | Single request with pitch/call |
| `/chat` | Chat | Conversation list |
| `/chat/:id` | ChatDetail | Message thread |
| `/attendance` | Attendance | Meeting attendance |
| `/attendance/scan/:meetingId` | AttendanceScan | QR scanner |
| `/my-profile` | Profile (own) | Auto-redirects to own profile |
| `/create-profile` | CreateProfile | Business profile creation |
| `/payments` | Payments | Membership renewal |
| `/admin` | Admin | Admin panel |
| `/admin-access` | AdminAccess | Verification code request |

### Data Model (Firestore Collections)
- `users/{uid}` — UserProfile (role, displayName, email, onlineStatus)
- `profiles/{uid}` — BusinessProfile (ownerName, ownerSurname, companyName, phone, categories, keywords, location, photoURL, catalogURLs, verified, membershipStatus, membershipDate, membershipExpiry, editCount, locked, lastRequestsViewedAt)
- `requests/{id}` — Request (uid, companyName, title, description, category, customCategory, budget, deadline, status, interestCount, interestedUids, requesterPhone, awardedTo)
- `meetings/{id}` — Meeting (date, label, location, qrCodeURL, active)
- `attendance/{id}` — Attendance (meetingId, uid, companyName, scannedAt)
- `notifications/{id}` — Notification (text, active, createdAt)
- `conversations/{id}` / `messages/{id}` — Chat
- `deals/{id}` — Deal records for revenue tracking
- `login_logs/{id}` — Login timestamp records

## Git History
```
0bdacc6 redeploy: trigger fresh Vercel build
c76130c feat: separate super_admin and admin email lists in admin.ts
551063d fix: remove auto-redirect to /admin, admins must navigate manually via URL
6857920 feat: show company owner name on TopBar, replace Sign out text with logout icon
16fe12f feat: Record Business Given auto-scrolls to deal form
52d66bb feat: gradient light logo colors on login left panel, improve text visibility
3c7b62f increase date/time font in TopBar
8a2d5da rename: Status → Membership Status
fa59465 rename: Total Businesses → Members Directory
13ca6d1 feat: keep Your Business always expanded, replace icon blue circles with symbols
eebbef0 fix: add vercel.json for SPA client-side routing
852d961 feat: admin whitelist, auto-redirect for admins, login logs, warm Anthropic design system
50930ce multi-file catalog, keywords, pitch guard, footer, dollar removal, TopBar restructuring
65177aa fix: leaderboard shows top 7
49e7f32 feat: leaderboard shows owner name, company name smaller, emoji rankings
1eb53b9 refactor: move FY label inline with number, words below as Rs. prefix
680ce81 feat: auto-calculate financial year, rename to Total Revenue · FY xx-xx
bfe1a48 refactor: center network total in header, show full number + words, larger font
3f2f05b refactor: replace FlipCounter with premium pill-style network total in TopBar
3ea5083 fix: sendMessage transaction error handling, add 30-day auto-delete header
d1e3042 feat: call-first flow after pitch with phone redirect
95af2ab chore: add .env.example for Firebase config
dd8acdc feat: compact request cards, pitch/chat/close buttons, phone field, dashboard restructure
```
