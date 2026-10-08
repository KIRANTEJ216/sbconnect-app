import * as functions from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { secretParams } from './secrets';
import { notifyAdmin, composeRequestDigest, sendViaResend } from './adminEmail';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Triggers that email the super admin when something new needs an admin.
 *
 * Deliberately `onDocumentCreated`, never `onDocumentWritten`. An edit is not
 * news: without that distinction every profile save, request edit and meeting
 * change would generate an email, because those are `setDoc` upserts on existing
 * documents.
 *
 * Every handler swallows its own errors. A Firestore trigger should not fail —
 * and should not be retried by the platform — because an email provider is
 * unreachable. `notifyAdmin` never throws either; this catch is belt-and-braces
 * for the document read itself.
 */
async function guard(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    functions.logger.error(`admin alert trigger "${name}" failed:`, err);
  }
}

/**
 * New requests are reported on a 12-hourly DIGEST, not immediately.
 *
 * Requirement: email the super admin every 12 hours, and only if there are new
 * requests. When the window is empty no email is sent at all — a twice-daily
 * "nothing to report" mail is precisely the noise this replaces.
 *
 * A cursor document records how far we have reported, so each request is
 * mentioned exactly once rather than repeating every 12 hours forever. The cursor
 * advances only after a successful send, so a Resend failure means the next run
 * retries the same window instead of silently dropping those requests.
 */
export const onRequestDigest = onSchedule(
  {
    schedule: 'every 12 hours',
    timeZone: 'Asia/Kolkata',
    retryCount: 3,
    ...secretParams(),
  },
  async () => {
    const db = admin.firestore();
    const cursorRef = db.doc('config/requestDigest');

    try {
      const cursorSnap = await cursorRef.get();
      const lastRunAt =
        typeof cursorSnap.data()?.lastRunAt === 'number'
          ? (cursorSnap.data()!.lastRunAt as number)
          : // First run: cover the previous 12 hours rather than all history.
            Date.now() - 12 * 60 * 60 * 1000;

      const cutoff = Date.now();
      const windowMs = cutoff - lastRunAt;

      // Single-field range on createdAt; no composite index required.
      const snap = await db
        .collection('requests')
        .where('createdAt', '>', lastRunAt)
        .orderBy('createdAt', 'asc')
        .get();

      const requests = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

      const windowLabel = `${Math.max(1, Math.round(windowMs / (60 * 60 * 1000)))}h window`;
      const digest = composeRequestDigest(requests, windowLabel);

      if (!digest.shouldSend) {
        // Nothing new — send nothing. Still advance the cursor so the next window
        // starts from now instead of re-scanning the same stretch of history.
        await cursorRef.set({ lastRunAt: cutoff, lastRunAtIso: new Date(cutoff).toISOString(), sent: 0 });
        functions.logger.info('Request digest: no new requests, no email sent.');
        return;
      }

      await sendViaResend({ subject: digest.subject, html: digest.html });

      await cursorRef.set({ lastRunAt: cutoff, lastRunAtIso: new Date(cutoff).toISOString(), sent: digest.count });
      functions.logger.info(`Request digest sent: ${digest.count} request(s).`);
    } catch (err) {
      // Never advance the cursor on failure, and never throw: the next scheduled
      // run must retry this same window.
      functions.logger.error('Request digest failed:', err);
    }
  },
);

/** 2. A new business profile is waiting for verification. */
export const onProfileCreated = onDocumentCreated({ document: 'profiles/{uid}', ...secretParams() },
  async (event) => {
  await guard('new_profile', async () => {
    const doc = event.data?.data();
    if (!doc) return;
    notifyAdmin('new_profile', {
      id: event.params.uid,
      companyName: doc.companyName,
      ownerName: doc.ownerName,
      ownerSurname: doc.ownerSurname,
      categories: doc.categories,
      location: doc.location,
      contactEmail: doc.contactEmail,
      countryCode: doc.countryCode,
      phone: doc.phone,
    });
  });
});

/** 3. A member pitched on someone's request. */
export const onInterestCreated = onDocumentCreated({ document: 'requests/{requestId}/interests/{interestId}', ...secretParams() },
  async (event) => {
    await guard('new_pitch', async () => {
      const interest = event.data?.data();
      if (!interest) return;
      // The parent's title makes the alert readable, so include it. A missing
      // parent is not worth an error, so fall back rather than throwing.
      let requestTitle = '(request unavailable)';
      try {
        const path = event.data?.ref.path ?? '';
        const parentPath = path.replace(/\/interests\/[^/]+$/, '');
        if (parentPath) {
          const parent = await admin.firestore().doc(parentPath).get();
          requestTitle = parent.data()?.title || requestTitle;
        }
      } catch {
        /* keep the fallback */
      }
      notifyAdmin('new_pitch', {
        id: event.params.interestId,
        requestId: event.params.requestId,
        requestTitle,
        companyName: interest.companyName,
        uid: interest.uid,
        phone: interest.phone,
        message: interest.message,
      });

      // Keep the parent request's pitch counters accurate.
      //
      // `expressInterest` writes only this subcollection and never updated the
      // parent's `interestedUids` / `interestCount`, so both stayed at their
      // initial values forever. That made the Admin award modal
      // (Admin.tsx) permanently report "No one has pitched for this request yet"
      // — so a pitch email would correctly announce a pitch that the admin UI
      // could then not show them.
      //
      // This cannot be fixed in the client: `firestore.rules` only lets the
      // requester or a super admin update a request, and the pitching member is
      // neither. Doing it here via the Admin SDK needs no rules change.
      await admin.firestore().doc(`requests/${event.params.requestId}`).update({
        interestedUids: FieldValue.arrayUnion(interest.uid),
        interestCount: FieldValue.increment(1),
        updatedAt: Date.now(),
      });
    });
  },
);

/**
 * 4. A member submitted revenue (a deal or a referral claim) that needs
 * verifying. Deals are also created by admins when awarding a request, so this
 * is gated on `status === 'pending'` — which only member submissions ever have.
 */
export const onPendingRevenueCreated = onDocumentCreated({ document: 'deals/{dealId}', ...secretParams() },
  async (event) => {
  await guard('pending_revenue', async () => {
    const doc = event.data?.data();
    if (!doc) return;
    if (doc.status !== 'pending') return;
    notifyAdmin('pending_revenue', {
      id: event.params.dealId,
      amount: doc.amount,
      amountValue: doc.amountValue,
      receiverCompanyName: doc.receiverCompanyName,
      giverCompanyName: doc.giverCompanyName,
      submittedByRole: doc.submittedByRole,
    });
  });
});

/** 5. A member filed an issue report. */
export const onAdminIssueCreated = onDocumentCreated({ document: 'issueReports/{id}', ...secretParams() },
  async (event) => {
  await guard('new_issue', async () => {
    const doc = event.data?.data();
    if (!doc) return;
    notifyAdmin('new_issue', {
      id: event.params.id,
      subject: doc.subject,
      description: doc.description,
      companyName: doc.companyName,
      userDisplayName: doc.userDisplayName,
      userEmail: doc.userEmail,
    });
  });
});

/**
 * 6. A meeting was scheduled.
 *
 * Note: meetings are created by an admin from the Admin panel, so this emails
 * the super admin about their own action. It is included because the brief was
 * "anything new"; delete this export to switch it off.
 */
export const onMeetingCreated = onDocumentCreated({ document: 'meetings/{id}', ...secretParams() },
  async (event) => {
  await guard('new_meeting', async () => {
    const doc = event.data?.data();
    if (!doc) return;
    notifyAdmin('new_meeting', {
      id: event.params.id,
      label: doc.label,
      date: doc.date,
      location: doc.location,
    });
  });
});