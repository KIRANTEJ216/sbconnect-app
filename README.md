# CommunityHub — Business Network

A community web application for businesses to connect, post opportunities, and chat.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript |
| Styling | Tailwind CSS v4 (STARTD-inspired design) |
| Auth | Firebase Auth (email/password + phone lookup) |
| Database | Firestore (real-time) |
| QR Codes | `qrcode.react` (client-side) |
| Hosting | Firebase Hosting (deploy-ready) |

## Setup

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (Spark free plan is sufficient)
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Create a **Cloud Firestore** database (start in test mode, then apply `firestore.rules`)
5. Enable **Firestore Indexes** — deploy the indexes in `firestore.indexes.json`

### 2. Environment Variables

Copy `.env` and fill in your Firebase project values:

```bash
cp .env .env.local
```

Edit `.env.local`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

### 4. (Optional) Firebase Emulators

```bash
VITE_USE_FIREBASE_EMULATORS=true npm run dev
```

Requires Firebase CLI & Java: `npx firebase init emulators`

## Build

```bash
npm run build
```

Output in `dist/` — ready for Firebase Hosting deployment:

```bash
npx firebase deploy
```

## Project Structure

```
src/
├── lib/
│   ├── firebase.ts        — Firebase init (prod + emulator support)
│   ├── auth.ts            — Sign in, sign up, reset, phone→email lookup
│   └── firestore.ts       — All CRUD + real-time subscriptions
├── contexts/
│   └── AuthContext.tsx     — Auth state provider
├── components/
│   ├── ui/                — Button, Input, Card, Badge (STARTD-styled)
│   └── layout/            — AppLayout, Sidebar, TopBar
├── pages/
│   ├── Login.tsx           — Email or phone sign-in
│   ├── Register.tsx        — Account creation
│   ├── ResetPassword.tsx   — Email-based password reset (free)
│   ├── Dashboard.tsx       — Home with stats + quick actions
│   ├── CreateProfile.tsx   — Business profile creation form
│   ├── Profile.tsx         — Business profile view/edit + QR code
│   ├── Profiles.tsx        — Browse/search businesses
│   ├── Requests.tsx        — Categorized business requests feed
│   ├── CreateRequest.tsx   — New request form
│   ├── RequestDetail.tsx   — Request detail + respond/close
│   ├── Chat.tsx            — Conversation list
│   └── ChatDetail.tsx      — Real-time 1-to-1 chat
├── types.ts                — All TypeScript types
├── App.tsx                 — Router
└── main.tsx                — Entry point
```

## Features

- **Auth**: Login with email **or** phone number (phone → email resolution via Firestore)
- **Password Reset**: Firebase built-in email reset — **zero cost**
- **Business Profiles**: 2-step creation form, view with QR code, membership badges
- **Online Status**: Real-time online/offline indicators
- **Posts**: Categorized business requests with open/close status
- **Chat**: Real-time 1-to-1 messaging via Firestore subscriptions
- **STARTD Design**: Indigo primary, Inter font, clean card-based layout

## Cost

- **Firebase Spark (Free) Plan** handles auth (10K MAU), Firestore (50K reads/day), hosting
- **Password reset** via email only — no SMS costs
- **QR codes** generated client-side — no API costs
- **Total**: $0/month for MVP
