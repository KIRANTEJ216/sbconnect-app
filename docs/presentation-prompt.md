# SB Connect — Presentation Prompt

## Product Overview

Create a presentation for **SB Connect**, a B2B networking and membership management platform built for business communities. It connects members, facilitates business referrals, tracks attendance at meetings, and provides admin tools for managing the entire ecosystem.

---

## App Name & Tagline
- **SB Connect**
- *Networking. Referrals. Growth.*

---

## Page-by-Page Feature Walkthrough

### 1. Authentication (Login / Register / Reset Password)
- Email/password auth with phone number login support
- Login activity tracking (audit trail)
- Password reset via email
- Role-based access: `user`, `admin`, `super_admin`

### 2. Dashboard — The Member Home
- **4 stat cards**: Membership Status, Members Directory count, Requests summary, Notifications
- **Quick Actions panel**: Create Request, View Profile, Record Business Given
- **Business Profile card**: Company info, verification badge, membership status with countdown or "Expired X days ago"
- **Leaderboard**: Top 7 businesses by deal revenue (gold/silver/bronze medals)
- **Upcoming Meetings widget**: Next meeting info with RSVP buttons
- **Notifications block**: Real-time alerts for issue resolutions (green pill) and new pitches (blue pill)
- **Attendance Strike Warning**: Alerts members who attended fewer than 3 meetings in 6 months
- **Record Business Given**: Inline form to log deals with confetti animation on success

### 3. Business Directory
- Searchable grid of all member businesses
- Filter by company name, category, keywords, location
- Each card shows: logo, member since, verification status, categories
- Click through to detailed profile

### 4. Business Profile (View & Edit)
- Public profile page: photo, company name, owner, categories, location, about, contact info
- **Catalog uploads**: Images and PDFs (up to 5 files, 10MB each)
- **Dynamic QR code** linking to the profile URL
- **Membership card**: Status, member since date, expiry countdown
- **Edit limits**: Max 3 edits before lock (admin can bypass)
- **Membership editing** (admin): Change status, set expiry
- **Send Message**: Opens 1-on-1 chat with the member

### 5. Create Business Profile
- Multi-field form with completion percentage tracker
- Photo upload, catalog files, categories (19 industry options)
- "Tips for Strong Profile" side panel

### 6. Requests — Business Opportunities
- **My Requests** and **Open Requests** sections
- Category filters: Technology, Construction, Marketing, Finance, Logistics, Consulting, Electrical, Other
- Each request: title, description, budget, deadline, interest count, status
- **Pitch/Express Interest**: Auto-generated or custom message with company info; notifies the request owner
- **Award Contract**: Request owner selects a pitcher, creates a deal, closes the request
- **Call** button for direct contact after pitching

### 7. Meetings & Attendance
- **Meeting Today** card with Mark Attendance button
- **Attendance history** with dates and Present badges
- **3-Strike compliance rule**: Must attend 3 meetings in rolling 6 months
- **QR Code scanning**: Mark attendance by scanning QR code
- **RSVP system**: Yes/No/Maybe for upcoming meetings

### 8. Chat / Messaging
- 1-on-1 conversations auto-created from profile "Send Message"
- Real-time messaging with read receipts
- Unread count badges
- 30-day auto-delete for old messages

### 9. Admin Panel (6 Tabs)

**Tab 1 — Members**
- Approve/reject business profile verification requests
- Full business directory table with CSV export
- Membership expiry management with color-coded warnings and CSV export

**Tab 2 — Meetings**
- Create meetings with date, label, location
- Auto-publishes notification on meeting creation
- View meeting detail: attendance stats, RSVPs, QR code
- Attendance table across all meetings with CSV export

**Tab 3 — Updates**
- Send app-wide broadcast notifications (shown in marquee bar)
- Manage issue reports: view, resolve with admin note (user gets notified), delete

**Tab 4 — Requests**
- Full requests table with status, interested parties, award management
- Award deals, close requests, delete

**Tab 5 — Reports**
- **Audit & Compliance Report**: Downloadable JSON with full member roster, attendance compliance, deals, leaderboard, login activity
- **System Health Check**: Firestore diagnostics, collection counts, integrity checks, error log viewer
- **Webhook/Google Sheets Sync**: Configure URL + one-click export of all collections as JSON POST

**Tab 6 — Security**
- Login activity audit log with timestamps
- Admin management: Add/remove admins (super admin only)
- **Admin Access**: Self-service 3-step upgrade (request code → verify → activate)

### 10. PWA (Progressive Web App)
- Installable on mobile/desktop home screen
- Automatic service worker updates
- Full offline-capable shell

---

## Key Differentiators

1. **Attendance Compliance Engine** — Automated 3/6 rule enforcement keeps members engaged
2. **Business Referral Tracking** — End-to-end from request → pitch → deal award with leaderboard
3. **Real-time Notifications** — Push-style user notifications for issue resolution, new pitches, and announcements
4. **Admin Dashboard** — Complete control over members, meetings, compliance, reporting, and data export
5. **Webhook Integration** — Export all data to Google Sheets, n8n, Zapier, or any external system
6. **QR-based Attendance** — Touchless meeting check-in via QR scan
7. **Audit Readiness** — Login logs, error tracking, health checks, and downloadable compliance reports

---

## Target Audience for Presentation
- Network/chamber of commerce leadership evaluating the platform
- Potential member businesses deciding to join
- Investors or partners evaluating the product

---

## Suggested Slide Structure

| Slide | Topic |
|---|---|
| 1 | **Title Slide**: SB Connect — Networking. Referrals. Growth. |
| 2 | **Problem**: Business networks struggle with engagement tracking, referral management, and administrative overhead |
| 3 | **Solution**: All-in-one platform for membership, networking, referrals, and compliance tracking |
| 4 | **Dashboard Overview**: Member home screen walkthrough |
| 5 | **Business Directory & Profiles**: Member discovery and self-representation |
| 6 | **Requests & Referrals**: How members post needs, pitch solutions, and award contracts |
| 7 | **Meetings & Attendance**: QR check-in, RSVPs, compliance enforcement |
| 8 | **Chat & Communication**: Direct messaging between members |
| 9 | **Admin Control Panel**: Verification, meetings, updates, security |
| 10 | **Reports & Compliance**: Audit reports, health checks, webhook data export |
| 11 | **Technical Architecture**: Firebase, React, PWA, security rules |
| 12 | **Roadmap / Next Steps**: Payments integration, enhanced analytics, mobile apps |

---

## Design Direction
- **Colors**: Deep purple `#2A11A6` primary, warm off-white `#FAF8F5` background
- **Style**: Clean, modern, card-based UI with subtle shadows and hover animations
- **Tone**: Professional, trustworthy, community-focused
- Use real screenshots from the app where possible
