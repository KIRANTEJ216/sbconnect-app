import * as functions from 'firebase-functions/v2';
import * as callable from 'firebase-functions/v2/https';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import * as admin from 'firebase-admin';
import { v1 } from '@google-cloud/firestore';
import { Resend } from 'resend';
import { randomInt } from 'crypto';
import { checkRateLimit } from './rateLimit';

admin.initializeApp();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'SB Connect <notifications@yourdomain.com>';

function sanitize(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const DRIP_THRESHOLDS = [90, 60, 30, 14, 7, 1, 0];

const DRIP_SUBJECTS: Record<number, string> = {
  90: 'SB Connect — Membership Renewal Reminder (3 Months)',
  60: 'SB Connect — 2 Months Until Membership Expires',
  30: 'SB Connect — 30 Days Until Membership Expires',
  14: 'SB Connect — 2 Weeks Until Membership Expires',
  7: 'SB Connect — 1 Week Until Membership Expires',
  1: 'SB Connect — Last Day! Membership Expires Tomorrow',
  0: 'SB Connect — Membership Expired',
};

function dripBody(companyName: string, daysUntilExpiry: number, paidDate: number): string {
  const safeName = sanitize(companyName);
  if (daysUntilExpiry > 0) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Membership Renewal Reminder</h2>
        <p>Dear ${safeName},</p>
        <p>Your SB Connect membership will expire in <strong>${daysUntilExpiry} days</strong>.</p>
        ${daysUntilExpiry <= 30 ? '<p style="color: #d97706; font-weight: 600;">⚠️ Your membership is expiring soon. Please renew to avoid interruption.</p>' : ''}
        <p>Log in to your dashboard to renew your membership and continue enjoying network benefits.</p>
        <hr style="margin: 24px 0;" />
        <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
      </div>
    `;
  }
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Membership Expired</h2>
      <p>Dear ${safeName},</p>
      <p>Your SB Connect membership has expired.</p>
      <p>Renew now to reactivate your profile and continue connecting with the network.</p>
      <hr style="margin: 24px 0;" />
      <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
    </div>
  `;
}

function dripWelcomeBody(companyName: string, paidDate: number, expiry: number): string {
  const safeName = sanitize(companyName);
  const start = new Date(paidDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const end = new Date(expiry).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>🎉 Welcome to SB Connect!</h2>
      <p>Dear ${safeName},</p>
      <p>Your membership is now <strong style="color: #059669;">active</strong>.</p>
      <p><strong>Member since:</strong> ${start}</p>
      <p><strong>Valid until:</strong> ${end}</p>
      <p>You now have access to:</p>
      <ul>
        <li>Business directory listing</li>
        <li>Networking requests & pitches</li>
        <li>Meeting RSVPs & attendance</li>
        <li>Member leaderboard</li>
      </ul>
      <p>Log in to your dashboard to get started.</p>
      <hr style="margin: 24px 0;" />
      <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
    </div>
  `;
}

interface BusinessProfile {
  uid: string;
  companyName: string;
  contactEmail: string;
  membershipStatus: string;
  membershipExpiry: number;
  paidDate: number;
  dripSentDays: number[];
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

async function sendEmail(resend: Resend, to: string, subject: string, html: string) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
}

export const sendWelcomeEmail = callable.onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new callable.HttpsError('unauthenticated', 'You must be logged in.');
  }

  const rl = checkRateLimit(`sendWelcomeEmail:${uid}`, 2, 3_600_000);
  if (!rl.allowed) {
    throw new callable.HttpsError(
      'resource-exhausted',
      `Too many requests. Try again in ${Math.ceil(rl.resetMs / 60_000)} minutes.`,
    );
  }

  const profileDoc = await admin.firestore().collection('profiles').doc(uid).get();
  if (!profileDoc.exists) {
    throw new callable.HttpsError('not-found', 'Profile not found.');
  }

  const profile = profileDoc.data() as BusinessProfile;
  if (!profile.paidDate || profile.paidDate <= 0) {
    throw new callable.HttpsError('failed-precondition', 'Membership not activated yet.');
  }

  if (!RESEND_API_KEY) {
    throw new callable.HttpsError('internal', 'Email service not configured.');
  }

  const resend = new Resend(RESEND_API_KEY);
  const expiry = profile.paidDate + 364 * 24 * 60 * 60 * 1000;

  try {
    await sendEmail(resend, profile.contactEmail, 'Welcome to SB Connect!', dripWelcomeBody(profile.companyName, profile.paidDate, expiry));
    return { success: true, message: 'Welcome email sent.' };
  } catch (err) {
    functions.logger.error('Failed to send welcome email:', err);
    throw new callable.HttpsError('internal', 'Failed to send welcome email.');
  }
});

export const sendAdminCode = callable.onCall(async (request) => {
  const uid = request.auth?.uid;
  const email = request.auth?.token?.email;

  if (!uid || !email) {
    throw new callable.HttpsError('unauthenticated', 'You must be logged in.');
  }

  const rl = checkRateLimit(`sendAdminCode:${uid}`, 3, 3_600_000);
  if (!rl.allowed) {
    throw new callable.HttpsError(
      'resource-exhausted',
      `Too many requests. Try again in ${Math.ceil(rl.resetMs / 60_000)} minutes.`,
    );
  }

  const code = generateCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  await admin.firestore().collection('adminCodes').doc(uid).set({
    uid,
    email,
    code,
    expiresAt,
    used: false,
    createdAt: Date.now(),
  });

  if (RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'SB Connect — Admin Access Code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Admin Access Request</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 24px; background: #F5F0E8; border-radius: 12px; margin: 16px 0;">
            ${code}
          </div>
          <p>This code expires in <strong>5 minutes</strong>.</p>
          <p>Enter this code in the app to complete admin verification.</p>
          <hr style="margin: 24px 0;" />
          <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
        </div>
      `,
    });
  }

  return { success: true, message: 'Code sent to your email.' };
});

export const verifyAdminCode = callable.onCall(async (request) => {
  const uid = request.auth?.uid;
  const email = request.auth?.token?.email;
  const { code } = request.data as { code: string };

  if (!uid || !email) {
    throw new callable.HttpsError('unauthenticated', 'You must be logged in.');
  }

  const rl = checkRateLimit(`verifyAdminCode:${uid}`, 5, 900_000);
  if (!rl.allowed) {
    throw new callable.HttpsError(
      'resource-exhausted',
      `Too many attempts. Try again in ${Math.ceil(rl.resetMs / 60_000)} minutes.`,
    );
  }

  if (!code || code.length !== 6) {
    throw new callable.HttpsError('invalid-argument', 'Invalid code.');
  }

  const doc = await admin.firestore().collection('adminCodes').doc(uid).get();

  if (!doc.exists) {
    throw new callable.HttpsError('not-found', 'No code found. Request a new one.');
  }

  const data = doc.data()!;

  if (data.used) {
    throw new callable.HttpsError('already-exists', 'Code already used.');
  }

  if (Date.now() > data.expiresAt) {
    throw new callable.HttpsError('deadline-exceeded', 'Code expired. Request a new one.');
  }

  if (data.code !== code) {
    throw new callable.HttpsError('permission-denied', 'Incorrect code.');
  }

  await admin.firestore().collection('adminCodes').doc(uid).update({ used: true });
  await admin.firestore().collection('users').doc(uid).update({ role: 'admin' });
  await admin.auth().setCustomUserClaims(uid, { role: 'admin' });

return { success: true, message: 'You are now an admin!' };
});

export const onUserCreate = beforeUserCreated(async (event) => {
  // New users start with 'user' role; admin roles assigned via verified processes only
  return {
    customClaims: { role: 'user' },
  };
});

export const onUserRegistered = onDocumentCreated('users/{uid}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const userData = snap.data();
  const email = userData?.email as string | undefined;
  const displayName = userData?.displayName as string | undefined;

  if (!email || !RESEND_API_KEY) return;

  const resend = new Resend(RESEND_API_KEY);

  const body = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>👋 Welcome to SB Connect!</h2>
      <p>Dear ${sanitize(displayName || 'Member')},</p>
      <p>Thank you for registering with SB Connect — the premier business networking community.</p>
      <p><strong>Next steps:</strong></p>
      <ul>
        <li>Complete your business profile</li>
        <li>Browse the member directory</li>
        <li>RSVP for upcoming meetings</li>
        <li>Connect with fellow members</li>
      </ul>
      <p>Log in to your dashboard to get started.</p>
      <hr style="margin: 24px 0;" />
      <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
    </div>
  `;

  try {
    await sendEmail(resend, email, 'Welcome to SB Connect!', body);
    functions.logger.info(`Welcome email sent to ${email}`);
  } catch (err) {
    functions.logger.error('Failed to send welcome email:', err);
  }
});

export const syncUserRole = onDocumentWritten('users/{uid}', async (event) => {
  const change = event.data;
  if (!change) return;

  const snapshot = change.after;
  if (!snapshot.exists) return;

  const data = snapshot.data();
  const role = data?.role;
  if (!role || !['user', 'admin', 'super_admin'].includes(role)) return;

  const uid = event.params.uid;
  await admin.auth().setCustomUserClaims(uid, { role });
  functions.logger.info(`Synced role "${role}" for user ${uid}`);
});

export const onMembershipActivated = onDocumentWritten('profiles/{uid}', async (event) => {
  const change = event.data;
  if (!change) return;

  const before = change.before.data() as BusinessProfile | undefined;
  const after = change.after.data() as BusinessProfile | undefined;
  if (!after) return;

  // Check if paidDate was newly set (was 0 or undefined, now has a value)
  const beforePaid = before?.paidDate ?? 0;
  const afterPaid = after.paidDate ?? 0;
  if (beforePaid > 0 && afterPaid > 0) return; // Already had paidDate, not a new activation
  if (afterPaid === 0) return; // Still no paidDate

  const profile = after as BusinessProfile;
  if (!profile.contactEmail || !RESEND_API_KEY) return;

  const resend = new Resend(RESEND_API_KEY);
  const expiry = afterPaid + 364 * 24 * 60 * 60 * 1000;

  try {
    await sendEmail(resend, profile.contactEmail, 'Welcome to SB Connect!', dripWelcomeBody(profile.companyName, afterPaid, expiry));
    functions.logger.info(`Welcome email sent to ${profile.contactEmail}`);
  } catch (err) {
    functions.logger.error('Failed to send welcome email:', err);
  }
});

export const checkMembershipExpiry = functions.scheduler.onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    if (!RESEND_API_KEY) {
      functions.logger.warn('RESEND_API_KEY not set — skipping email notifications');
      return;
    }

    const resend = new Resend(RESEND_API_KEY);
    const now = Date.now();
    const profilesSnap = await admin.firestore().collection('profiles').get();

    const results: string[] = [];

    for (const doc of profilesSnap.docs) {
      const profile = doc.data() as BusinessProfile;

      if (!profile.contactEmail) continue;

      const daysUntilExpiry = Math.floor((profile.membershipExpiry - now) / (1000 * 60 * 60 * 24));
      const dripSent = Array.isArray(profile.dripSentDays) ? profile.dripSentDays : [];

      try {
        // Welcome email should be sent via onMembershipActivated trigger, not here

        // Drip reminders
        for (const threshold of DRIP_THRESHOLDS) {
          if (daysUntilExpiry === threshold && !dripSent.includes(threshold)) {
            const subject = DRIP_SUBJECTS[threshold] || `SB Connect — Membership Update`;
            const html = dripBody(profile.companyName, daysUntilExpiry, profile.paidDate);
            
            await sendEmail(resend, profile.contactEmail, subject, html);
            
            // Update dripSentDays
            await admin.firestore().collection('profiles').doc(doc.id).update({
              dripSentDays: [...dripSent, threshold],
            });
            
            results.push(`Drip ${threshold}d sent to ${profile.contactEmail}`);
            break; // Only send one drip per day
          }
        }

        // Expired
        if (daysUntilExpiry <= 0 && profile.membershipStatus === 'active') {
          await admin.firestore().collection('profiles').doc(doc.id).update({
            membershipStatus: 'expired',
          });

          await sendEmail(resend, profile.contactEmail, 'SB Connect — Membership Expired', dripBody(profile.companyName, daysUntilExpiry, profile.paidDate));
          results.push(`Expired and notified: ${profile.contactEmail}`);
        }
      } catch (err) {
        functions.logger.error(`Failed to process profile ${doc.id}:`, err);
      }
    }

    functions.logger.info('Membership check complete', { results });
  },
);

interface IssueReply {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorRole: 'user' | 'admin' | 'super_admin';
  createdAt: number;
  updatedAt?: number;
}

export const onIssueCreated = onDocumentCreated('issueReports/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const issue = snap.data();
  const id = event.params.id;

  // Send in-app notification to all admins
  const userSnap = await admin.firestore().collection('users')
    .where('role', 'in', ['admin', 'super_admin']).get();
  const notifPromises = userSnap.docs.map((d) =>
    admin.firestore().collection('userNotifications').add({
      uid: d.id,
      type: 'admin_message',
      title: 'New Issue Report',
      message: `${issue.companyName}: ${issue.subject}`,
      relatedId: id,
      read: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  await Promise.all(notifPromises);

  // Send confirmation email to the reporter
  if (issue.userEmail && RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: issue.userEmail,
        subject: `[#${id.slice(0, 8)}] Issue Report Received — SB Connect`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>We received your report</h2>
            <p>Dear ${sanitize(issue.userDisplayName || 'Member')},</p>
            <p>Thank you for reporting an issue. Here's a summary:</p>
            <div style="background: #F5F0E8; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p><strong>Ticket ID:</strong> #${id.slice(0, 8)}</p>
              <p><strong>Subject:</strong> ${sanitize(issue.subject)}</p>
              <p><strong>Description:</strong> ${sanitize(issue.description)}</p>
            </div>
            <p>Our admin team will review it and get back to you shortly.</p>
            <p>You can track this issue in your dashboard under "My Reports".</p>
            <hr style="margin: 24px 0;" />
            <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
          </div>
        `,
      });
    } catch (err) {
      functions.logger.error('Failed to send issue confirmation email:', err);
    }
  }
});

export const onIssueUpdated = onDocumentWritten('issueReports/{id}', async (event) => {
  const change = event.data;
  if (!change) return;
  const before = change.before.data();
  const after = change.after.data();
  if (!before || !after) return;

  if (!RESEND_API_KEY || !after.userEmail) return;

  const beforeReplies: IssueReply[] = (before.replies as IssueReply[] | undefined) || [];
  const afterReplies: IssueReply[] = (after.replies as IssueReply[] | undefined) || [];

  // Check if status changed to resolved
  if (before.status !== 'resolved' && after.status === 'resolved') {
    const resend = new Resend(RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: after.userEmail,
        subject: `[#${event.params.id.slice(0, 8)}] Issue Resolved — SB Connect`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Issue Resolved</h2>
            <p>Dear ${sanitize(after.userDisplayName || 'Member')},</p>
            <p>Your issue report has been marked as resolved:</p>
            <div style="background: #F5F0E8; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p><strong>Subject:</strong> ${sanitize(after.subject)}</p>
              ${after.adminNote ? `<p><strong>Admin note:</strong> ${sanitize(after.adminNote)}</p>` : ''}
            </div>
            <p>If you have further questions, feel free to submit a new report.</p>
            <hr style="margin: 24px 0;" />
            <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
          </div>
        `,
      });
    } catch (err) {
      functions.logger.error('Failed to send issue resolved email:', err);
    }
    return;
  }

  // Check if a new admin reply was added
  if (afterReplies.length > beforeReplies.length) {
    const newReply = afterReplies[afterReplies.length - 1];
    if (newReply.authorRole === 'admin' || newReply.authorRole === 'super_admin') {
      const resend = new Resend(RESEND_API_KEY);
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: after.userEmail,
          subject: `[#${event.params.id.slice(0, 8)}] Admin replied to your report — SB Connect`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Admin Reply</h2>
              <p>Dear ${sanitize(after.userDisplayName || 'Member')},</p>
              <p>Admin replied to your issue report:</p>
              <div style="background: #F5F0E8; border-radius: 12px; padding: 16px; margin: 16px 0;">
                <p><strong>Subject:</strong> ${sanitize(after.subject)}</p>
                <p><strong>Reply:</strong> ${sanitize(newReply.text)}</p>
              </div>
              <p>Log in to your dashboard to continue the conversation.</p>
              <hr style="margin: 24px 0;" />
              <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
            </div>
          `,
        });
      } catch (err) {
        functions.logger.error('Failed to send issue reply email:', err);
      }
    }
  }
});

export const dailyFirestoreBackup = onSchedule('0 0 * * *', async () => {
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'sbconnect-65338';
  const bucketName = `${projectId}-backups`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const client = new v1.FirestoreAdminClient();
  const databaseName = client.databasePath(projectId, '(default)');

  try {
    const [response] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: `gs://${bucketName}/backups/${timestamp}`,
      collectionIds: [],
    });
    functions.logger.info(`Daily backup started: ${response.name} → gs://${bucketName}/backups/${timestamp}`);
  } catch (err) {
    functions.logger.error('Daily backup failed:', err);
  }
});
