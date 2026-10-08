# SB Connect — Password Reset Email Runbook

## Context

End users report that when they request a password reset, the app shows the success
state ("Check your email for the reset link") **but no email arrives**.

### Verified: not an app-code issue

The full reset flow was audited and is correct:

- `src/pages/ResetPassword.tsx:21` → `resetPassword(email)`
- `src/lib/auth.ts:46` → `sendPasswordResetEmail(auth, email)`
- Errors (`auth/user-not-found`, etc.) are caught and surfaced in the UI.
- `.env` provides a valid `VITE_FIREBASE_AUTH_DOMAIN`, so the reset link is built
  from that domain.

Reset emails are sent by **Firebase Auth servers** (the Firebase Console), not by
your app. Because the UI reports success, Firebase accepted the request — meaning the
account exists in Firebase Auth and the provider is enabled. The missing email is a
**delivery** problem (spam filtering, sender auth, or missing configuration).

> Note: reset email resolution happens against **Firebase Auth**, which is separate
> from the Firestore `users` collection this app maintains. A profile can exist in
> Firestore without a matching Auth record — `sendPasswordResetEmail` only resolves
> against Auth.

---

## Console Fix Checklist (no code changes)

### 1. Check Spam first (0 min — rules it out)

- Search the user's **All Mail / Spam / Promotions** for sender `noreply@<auth-domain>`
  and subject "password reset".
- If found in spam, the account is correct; continue to Step 3 to improve deliverability.

### 2. Enable the Email/Password provider

- Firebase Console → **Authentication → Sign-in method**
- Confirm **Email/Password** is **Enabled** (sign-in and password reset both rely on it).

### 3. Configure a custom SMTP sender (key fix)

Without a custom mail provider, Firebase Auth uses its default `noreply@` sender,
which is frequently dropped or flagged for spam (no DKIM/SPF).

- Firebase Console → **Authentication → Templates → Password reset**
- Click **"Set up custom SMTP"**.
- Add a sending account on a domain you control (recommended: **SendGrid**, **Gmail SMTP**,
  or **Brevo/SendGrid**), and set the sender name + address.

### 4. Add SPF + DKIM DNS records

After configuring SMTP, add the sender domain's **SPF** (e.g. `v=spf1 include:sendgrid.net ~all`)
and **DKIM** records to DNS. Without these, senders keep getting filtered into spam.

### 5. Add the app domain to Authorized domains

- Firebase Console → **Authentication → Settings → Authorized domains**
- Confirm the deployed site's domain **and** the `VITE_FIREBASE_AUTH_DOMAIN` value are listed.
- If missing, add them — otherwise the reset link's action URL is blocked even when the email arrives.

### 6. Re-test from a real account

- Trigger a reset through the app.
- Confirm the email lands and the link opens the change-password page.
- Set a new password and confirm sign-in works.

---

## Optional code change (deferred — do not apply now)

Only if you later want branded, deep-link reset URLs, add `actionCodeSettings` to
`sendPasswordResetEmail` in `src/lib/auth.ts:46`:

```ts
import { sendPasswordResetEmail } from 'firebase/auth';

export async function resetPassword(email: string) {
  const actionCodeSettings = {
    url: 'https://<your-domain>/reset-password',
    handleCodeInApp: false,
  };
  return sendPasswordResetEmail(auth, email, actionCodeSettings);
}
```

**Not required to fix delivery.** Skip unless branded deep links are explicitly wanted.