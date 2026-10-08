import * as functions from 'firebase-functions/v2';
import { Resend } from 'resend';
import { sanitize, truncate, emailRow, emailNote, emailShell } from './html';

/**
 * Admin email alerts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nothing notified admins. `createRequest` wrote a document and stopped; there
 * was no trigger on `requests` and none observing `profiles.verified`, so a new
 * request or a new profile was invisible unless an admin happened to refresh the
 * tab. This module is the single entry point for "something new needs an admin".
 *
 * DESIGN NOTES
 * ------------
 * - One recipient. The super admin is configured via ADMIN_ALERT_EMAIL rather
 *   than queried from the `users` collection: there is no server-side admin
 *   list, and querying it would fail silently for an admin with no email on file.
 *   It is an env var rather than a literal so the address is not duplicated a
 *   third time in the repo (the client already hardcodes it twice).
 *
 * - Never throws. A Resend outage must not fail a member's post, and Firestore
 *   triggers should not retry because an email provider is degraded.
 *
 * - Burst guard. `bulkImportProfiles` writes profiles in 500-document batches, so
 *   a 200-row CSV import fires 200 separate triggers. Posting one email per
 *   trigger would exceed Resend's ~2 req/sec limit and risk the sending domain
 *   being flagged. Same-kind events are therefore coalesced over a short window
 *   and sent as one email listing every item. Nothing is dropped: if the
 *   function cold-starts between events, each flushes independently and you get
 *   more emails, never fewer.
 */

/** Read at call time so a redeploy-free env change is picked up. */
function adminAlertEmail(): string {
  return process.env.ADMIN_ALERT_EMAIL || 'kktej3d@gmail.com';
}

export type AlertKind =
  | 'new_request'
  | 'new_profile'
  | 'new_pitch'
  | 'pending_revenue'
  | 'new_issue'
  | 'new_meeting';

export interface AlertItem {
  kind: AlertKind;
  /** Free-form, already-safe-to-display fields for this event. */
  data: Record<string, unknown>;
}

export interface ComposedEmail {
  subject: string;
  html: string;
}

export interface DigestEmail extends ComposedEmail {
  /** 0 means there is nothing to report and no email should be sent at all. */
  shouldSend: boolean;
  count: number;
}

const SUBJECTS: Record<AlertKind, string> = {
  new_request: 'New request posted',
  new_profile: 'New profile awaiting verification',
  new_pitch: 'New pitch on a request',
  pending_revenue: 'Revenue awaiting verification',
  new_issue: 'New issue report',
  new_meeting: 'New meeting scheduled',
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Compact ₹ for amounts. Deliberately simple — deals already store a numeric field. */
function rupees(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return str(v);
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * How many items get a full detail block before the rest are summarised.
 *
 * A 200-row CSV import coalesces into one email whose HTML would run to ~90 KB.
 * Gmail clips a message body at roughly 102 KB and shows "[Message clipped]",
 * which hides the very content the admin opened it for. So the body renders the
 * first N in full, then states exactly how many more arrived — nothing is
 * dropped, the email just stops trying to print a whole import inline.
 */
const MAX_DETAIL_PER_EMAIL = 25;

/**
 * Turn one event into a subject + HTML body.
 *
 * Pure and exported so the test suite can assert on the output without a
 * Resend key, and so every interpolated value is provably escaped.
 */
export function composeEmail(items: AlertItem[]): ComposedEmail {
  const first = items[0];
  const kind = first.kind;
  const single = items.length === 1;
  const heading = single ? SUBJECTS[kind] : `${SUBJECTS[kind]} (${items.length})`;
  const subject = `[SB Connect] ${heading}`;

  const detailed = items.slice(0, MAX_DETAIL_PER_EMAIL);
  const omitted = items.length - detailed.length;

  const blocks = detailed.map((item, index) => {
    const d = item.data;
    const prefix = single ? '' : `<p style="margin:18px 0 6px;font-weight:700;">${index + 1}.</p>`;

    switch (item.kind) {
      case 'new_request': {
        const category = str(d.category) === 'Other' && d.customCategory
          ? str(d.customCategory)
          : str(d.category);
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${sanitize(str(d.title))}</h3>` +
          emailNote([
            `Category: ${category || '—'}`,
            // Rendered verbatim: the member typed this, so it is the honest value.
            // Re-parsing "1.5L" server-side would risk disagreeing with the app.
            `Budget: ${str(d.budget) || '—'}`,
            `Deadline: ${str(d.deadline) || '—'}`,
            `Posted by: ${str(d.companyName) || 'Unknown'} (uid ${str(d.uid)})`,
          ]) +
          (str(d.description)
            ? `<p style="margin:0 0 12px;color:#55505F;">${sanitize(truncate(d.description))}</p>`
            : '') +
          emailRow('Request ID', str(d.id))
        );
      }

      case 'new_profile': {
        const categories = Array.isArray(d.categories) ? (d.categories as string[]).join(', ') : '';
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${sanitize(str(d.companyName))}</h3>` +
          emailNote([
            `Owner: ${[str(d.ownerName), str(d.ownerSurname)].filter(Boolean).join(' ') || '—'}`,
            `Categories: ${categories || '—'}`,
            `Location: ${str(d.location) || '—'}`,
            `Email: ${str(d.contactEmail) || '—'}`,
            `Phone: ${[str(d.countryCode), str(d.phone)].filter(Boolean).join(' ') || '—'}`,
          ]) +
          emailRow('Profile ID', str(d.id))
        );
      }

      case 'new_pitch': {
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${sanitize(str(d.requestTitle))}</h3>` +
          emailNote([
            `Pitched by: ${str(d.companyName) || 'Unknown'} (uid ${str(d.uid)})`,
            `Contact: ${str(d.phone) || '—'}`,
          ]) +
          (str(d.message)
            ? `<p style="margin:0 0 12px;color:#55505F;">${sanitize(truncate(d.message))}</p>`
            : '') +
          emailRow('Request ID', str(d.requestId)) +
          emailRow('Interest ID', str(d.id))
        );
      }

      case 'pending_revenue': {
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${rupees(
            d.amountValue ?? d.amount,
          )}</h3>` +
          emailNote([
            `Received by: ${str(d.receiverCompanyName) || '—'}`,
            `Generated by: ${str(d.giverCompanyName) || '—'}`,
            `Submitted by: ${str(d.submittedByRole) || 'member'}`,
          ]) +
          emailRow('Deal ID', str(d.id))
        );
      }

      case 'new_issue': {
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${sanitize(str(d.subject))}</h3>` +
          emailNote([
            `Company: ${str(d.companyName) || '—'}`,
            `Reported by: ${str(d.userDisplayName) || 'Unknown'} <${str(d.userEmail) || 'no email'}>`,
          ]) +
          (str(d.description)
            ? `<p style="margin:0 0 12px;color:#55505F;">${sanitize(truncate(d.description))}</p>`
            : '') +
          emailRow('Issue ID', str(d.id))
        );
      }

      case 'new_meeting': {
        return (
          prefix +
          `<h3 style="margin:0 0 8px;font-size:15px;">${sanitize(str(d.label))}</h3>` +
          emailNote([
            `When: ${str(d.date) || '—'}`,
            `Where: ${str(d.location) || '—'}`,
          ]) +
          emailRow('Meeting ID', str(d.id))
        );
      }

      default:
        return prefix + emailNote(['(unsupported alert kind)']);
    }
  });

  if (omitted > 0) {
    blocks.push(
      `<p style="margin:18px 0 0;padding:12px;background:#F5F0E8;border-radius:12px;color:#55505F;">` +
        `${sanitize(String(omitted))} further ${sanitize(omitted === 1 ? 'item' : 'items')} of the same type ` +
        `arrived and ${sanitize(omitted === 1 ? 'is' : 'are')} not listed above. Open the Admin panel to see them all.` +
        `</p>`,
    );
  }

  return { subject, html: emailShell(heading, blocks.join('')) };
}

// ── Burst guard ──────────────────────────────────────────────────────────────

/**
 * Same-kind events arriving within this window are merged into one email.
 * Eight seconds is short enough to feel instant for a single event and long
 * enough to absorb a bulk import, which writes all of its documents in a tight
 * loop.
 */
const BURST_WINDOW_MS = 8_000;

/**
 * Ceiling on emails per hour per kind. If this trips, one final summary email is
 * still sent so a runaway loop is visible rather than silent.
 */
const MAX_PER_HOUR = 60;

interface BurstState {
  items: AlertItem[];
  timer: NodeJS.Timeout | null;
  sent: number[];
}

const bursts = new Map<AlertKind, BurstState>();

export async function sendViaResend(email: ComposedEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    functions.logger.warn(
      'RESEND_API_KEY is not set — admin alert not sent. Configure it, or emails will silently no-op.',
    );
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'SB Connect <notifications@yourdomain.com>',
    to: adminAlertEmail(),
    subject: email.subject,
    html: email.html,
  });
}

async function flush(kind: AlertKind): Promise<void> {
  const state = bursts.get(kind);
  if (!state) return;
  bursts.delete(kind);
  state.timer = null;
  if (state.items.length === 0) return;

  // Record the attempt BEFORE awaiting, so a burst that arrives during the send
  // still counts against the hourly cap.
  state.sent.push(Date.now(), ...Array(state.items.length - 1).fill(Date.now()));
  // Keep only the timestamps still inside the window.
  state.sent = state.sent.filter((t) => Date.now() - t < 60 * 60 * 1000);

  try {
    await sendViaResend(composeEmail(state.items));
    functions.logger.info(`Admin alert sent: ${state.items.length} x ${kind}`);
  } catch (err) {
    // Deliberately swallowed: a mail provider failure must never surface as a
    // failed trigger, and must never block a member's write.
    functions.logger.error('Failed to send admin alert email:', err);
  }
}

/** Test seam: drop any pending burst without sending it. */
export function _resetBursts(): void {
  for (const state of bursts.values()) {
    if (state.timer) clearTimeout(state.timer);
  }
  bursts.clear();
}

/** Test seam: send everything queued so far, synchronously. */
export async function _flushAll(): Promise<void> {
  const kinds = [...bursts.keys()];
  for (const kind of kinds) {
    await flush(kind);
  }
}

/**
 * Queue an alert for the super admin. Never throws.
 */
export function notifyAdmin(kind: AlertKind, data: Record<string, unknown>): void {
  try {
    const now = Date.now();
    let state = bursts.get(kind);

    if (!state) {
      state = { items: [], timer: null, sent: [] };
      bursts.set(kind, state);
    }

    // Trim the hourly window before deciding.
    state.sent = state.sent.filter((t) => now - t < 60 * 60 * 1000);
    if (state.sent.length >= MAX_PER_HOUR) {
      functions.logger.warn(
        `Admin alert hourly cap (${MAX_PER_HOUR}) reached for ${kind}; not sending "${SUBJECTS[kind]}".`,
      );
      return;
    }

    state.items.push({ kind, data });

    if (state.timer === null) {
      state.timer = setTimeout(() => {
        void flush(kind);
      }, BURST_WINDOW_MS);
      // Never hold the instance open just for a pending email.
      if (typeof state.timer.unref === 'function') state.timer.unref();
    }
  } catch (err) {
    functions.logger.error('notifyAdmin failed:', err);
  }
}

/** Marks a flush as having happened; separated for testability. */
export function _markSent(kind: AlertKind): void {
  const state = bursts.get(kind);
  if (state) state.sent.push(Date.now());
}

// ── 12-hourly request digest ─────────────────────────────────────────────────

/** The five event kinds that still alert immediately. */
export const IMMEDIATE_ALERT_KINDS: AlertKind[] = [
  'new_profile',
  'new_pitch',
  'pending_revenue',
  'new_issue',
  'new_meeting',
];

/**
 * Build the twice-daily request digest.
 *
 * Returns `shouldSend: false` when nothing arrived, and the caller must then send
 * nothing at all — an empty "no news" email every 12 hours is exactly the noise
 * this replaces. The decision is returned rather than taken here so it can be
 * asserted directly in tests without a scheduler or a Resend key.
 */
export function composeRequestDigest(
  requests: Array<Record<string, unknown>>,
  windowLabel: string,
): DigestEmail {
  const count = requests.length;

  if (count === 0) {
    return { shouldSend: false, count: 0, subject: '', html: '' };
  }

  const noun = count === 1 ? 'request' : 'requests';
  const heading = `${count} new ${noun} awaiting review`;

  const blocks = requests.slice(0, MAX_DETAIL_PER_EMAIL).map((r, index) => {
    const category =
      String(r.category) === 'Other' && r.customCategory
        ? String(r.customCategory)
        : String(r.category);
    return (
      `<p style="margin:18px 0 6px;font-weight:700;">${index + 1}. ${sanitize(
        String(r.title ?? '(no title)'),
      )}</p>` +
      emailNote([
        `Category: ${category || '—'}`,
        // Rendered verbatim: this is the free text the member typed.
        `Budget: ${String(r.budget ?? '') || '—'}`,
        `Deadline: ${String(r.deadline ?? '') || '—'}`,
        `Posted by: ${String(r.companyName ?? 'Unknown')} (uid ${String(r.uid ?? '?')})`,
      ]) +
      (r.description
        ? `<p style="margin:0 0 4px;color:#55505F;">${sanitize(truncate(r.description))}</p>`
        : '') +
      emailRow('Request ID', String(r.id ?? ''))
    );
  });

  const omitted = count - Math.min(count, MAX_DETAIL_PER_EMAIL);
  if (omitted > 0) {
    blocks.push(
      `<p style="margin:18px 0 0;padding:12px;background:#F5F0E8;border-radius:12px;color:#55505F;">` +
        `${sanitize(String(omitted))} further ${sanitize(omitted === 1 ? 'request' : 'requests')} ` +
        `${sanitize(omitted === 1 ? 'is' : 'are')} not listed above. Open the Admin panel to see them all.` +
        `</p>`,
    );
  }

  return {
    shouldSend: true,
    count,
    subject: `[SB Connect] ${heading} (${windowLabel})`,
    html: emailShell(heading, `<p style="color:#55505F;">Since ${sanitize(windowLabel)}.</p>${blocks.join('')}`),
  };
}
