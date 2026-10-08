import { defineSecret, defineString } from 'firebase-functions/params';

/**
 * Central definition of every Cloud Functions parameter.
 *
 * Only files that import from here know how configuration is supplied, so
 * changing the source of a value is a one-line edit rather than a sweep
 * through every trigger.
 *
 * RESEND_API_KEY is a Secret Manager secret, not a plain env var. That
 * distinction matters: a value in process.env, a checked-in .env, or a JSON
 * file inside the deployment artifact is readable by anyone who can read the
 * build output, and it is exactly how this key ended up pasted into a chat
 * transcript. Secret Manager keeps the ciphertext at rest, records access in
 * Cloud Audit Logs, and lets the key be rotated without a code change.
 *
 * Wiring a secret requires the trigger to list it, which is what
 * `secretParams()` returns. A trigger that forgets is the failure mode worth
 * guarding against, so `requireResend` also verifies the resolved value at
 * runtime rather than trusting that the wiring was correct.
 */

/** Resend API key. Stored in Secret Manager; never in the repo or the artifact. */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

/**
 * Verified sender. `onboarding@resend.dev` only delivers to the Resend
 * account owner's own inbox, which is fine while there is a single admin
 * recipient. Replace with a verified domain before adding other recipients.
 */
export const FROM_EMAIL = defineString('FROM_EMAIL', {
  default: 'SB Connect <onboarding@resend.dev>',
});

/** Sole admin alert recipient. */
export const ADMIN_ALERT_EMAIL = defineString('ADMIN_ALERT_EMAIL', {
  default: 'kktej3d@gmail.com',
});

/** Params every function that sends mail must declare. */
export const secretParams = () => ({ secrets: [RESEND_API_KEY] });

/**
 * Resolves the Resend key, or '' when it is unavailable.
 *
 * Returns '' rather than throwing so a missing key degrades to "no email"
 * instead of failing a member's write.
 */
export async function resendKey(): Promise<string> {
  try {
    return (await RESEND_API_KEY.value()) || '';
  } catch {
    // Raised when the trigger is missing `secrets: [RESEND_API_KEY]`, or when
    // the secret has no enabled version. Swallowed deliberately: callers treat
    // '' as "skip sending".
    return '';
  }
}