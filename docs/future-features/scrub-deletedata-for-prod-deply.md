# Scrub / Delete Data for Production Deployment

## Objective
Clear all test/development data from production Firestore (`sbconnect-65338`) while preserving user accounts, roles, and configuration. No code changes required — all app queries handle empty collections gracefully.

## Collections to DELETE (all documents)

| Collection | Why safe |
|---|---|
| `profiles` | Empty directory shown; `createBusinessProfile()` works normally |
| `deals` | TopBar shows ₹0, leaderboard empty |
| `requests` | Empty listing; `createRequest()` works |
| `meetings` (+ subcollection `rsvps`) | "No meetings" shown; `createMeeting()` works |
| `attendance` | History empty; marking new attendance works |
| `loginLogs` | Table shows empty |
| `conversations` (+ subcollection `messages`) | Chat shows no conversations |
| `issueReports` | Issue tab shows empty |
| `notifications` | App notifications clear |
| `userNotifications` | User notification lists clear |
| `_health` | Ephemeral test docs |

## Collections to KEEP

| Collection | Reason |
|---|---|
| `users` | Auth records with role assignments (admin/super_admin). Without this, `requireSuperAdmin()` fails for non-hardcoded emails |
| `config/webhook` | Runtime Google Sheets sync URL — keep if configured |

## Method: Firebase Console

1. Go to [Firebase Console → Firestore](https://console.firebase.google.com/project/sbconnect-65338/firestore)
2. Delete collections in this order (largest/coupled first):
   - `profiles`
   - `deals`
   - `requests`
   - `meetings` (deletes `rsvps` subcollection automatically)
   - `attendance`
   - `loginLogs`
   - `conversations` (deletes `messages` subcollection)
   - `issueReports`
   - `notifications`
   - `userNotifications`
   - `_health`
3. Alternatively, use Firestore Export/Import: export entire DB, strip everything except `users` and `config`, then import.

## Separate: Clear Firebase Storage (optional)

Profile photos and catalog PDFs live in Firebase Storage, not Firestore. To clear those too:
1. Go to [Firebase Console → Storage](https://console.firebase.google.com/project/sbconnect-65338/storage)
2. Delete the `profiles/` folder

## Post-Scrub App Behavior (all safe, tested)

- **TopBar**: Shows `₹ 0` / `Zero Rupees` — no error
- **Dashboard**: Shows "Create Your Business Profile" prompt for each user
- **Admin Members tab**: Business Directory shows 0 profiles
- **Admin Meetings tab**: Empty; create meeting works
- **Admin Requests tab**: Empty
- **Leaderboard**: "No deals recorded yet"
- **Attendance**: No history; marking new attendance works
- **CSV exports**: Produce empty files (graceful)
- **Health check**: All green (0 docs is healthy)
- **Every query uses defensive fallbacks**: `[]`, `0`, `{}`, null checks — no runtime errors

## Script-Based Alternative (future)

If a one-click reset is needed repeatedly, write a Node.js script using Firebase Admin SDK:

```typescript
import * as admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const firestore = admin.firestore();

const DELETE_COLLECTIONS = [
  'profiles', 'deals', 'requests', 'meetings',
  'attendance', 'loginLogs', 'conversations',
  'issueReports', 'notifications', 'userNotifications', '_health',
];

async function deleteCollection(path: string) {
  const snap = await firestore.collection(path).get();
  const batch = firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

(async () => {
  for (const coll of DELETE_COLLECTIONS) {
    console.log(`Deleting ${coll}...`);
    await deleteCollection(coll);
  }
  console.log('Done.');
})();
```

Run with: `node scrub.mjs` (requires a service-account key with `firebase-adminsdk` credentials).
