import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

admin.initializeApp();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'SB Connect <notifications@yourdomain.com>';

interface BusinessProfile {
  uid: string;
  companyName: string;
  contactEmail: string;
  membershipStatus: string;
  membershipExpiry: number;
}

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

      try {
        if (profile.membershipStatus === 'active' && daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: profile.contactEmail,
            subject: `SB Connect — Membership Expiring in ${daysUntilExpiry} Days`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Membership Renewal Reminder</h2>
                <p>Dear ${profile.companyName},</p>
                <p>Your SB Connect membership will expire in <strong>${daysUntilExpiry} days</strong>.</p>
                <p>Please renew your membership to continue enjoying network benefits.</p>
                <p>Log in to your dashboard to renew.</p>
                <hr style="margin: 24px 0;" />
                <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
              </div>
            `,
          });
          results.push(`Reminder sent to ${profile.contactEmail} (${daysUntilExpiry} days remaining)`);
        }

        if (daysUntilExpiry <= 0 && profile.membershipStatus === 'active') {
          await admin.firestore().collection('profiles').doc(doc.id).update({
            membershipStatus: 'expired',
          });

          await resend.emails.send({
            from: FROM_EMAIL,
            to: profile.contactEmail,
            subject: 'SB Connect — Membership Expired',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Membership Expired</h2>
                <p>Dear ${profile.companyName},</p>
                <p>Your SB Connect membership has expired.</p>
                <p>Renew now to reactivate your profile and continue connecting with the network.</p>
                <hr style="margin: 24px 0;" />
                <p style="color: #666; font-size: 12px;">SB Connect — Business Network</p>
              </div>
            `,
          });
          results.push(`Expired and notified: ${profile.contactEmail}`);
        }
      } catch (err) {
        functions.logger.error(`Failed to process profile ${doc.id}:`, err);
      }
    }

    functions.logger.info('Membership check complete', { results });
  },
);
