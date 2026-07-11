"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMembershipExpiry = exports.syncUserRole = exports.onUserCreate = exports.verifyAdminCode = exports.sendAdminCode = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const callable = __importStar(require("firebase-functions/v2/https"));
const firestore_1 = require("firebase-functions/v2/firestore");
const identity_1 = require("firebase-functions/v2/identity");
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
admin.initializeApp();
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'SB Connect <notifications@yourdomain.com>';
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
exports.sendAdminCode = callable.onCall(async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email;
    if (!uid || !email) {
        throw new callable.HttpsError('unauthenticated', 'You must be logged in.');
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
        const resend = new resend_1.Resend(RESEND_API_KEY);
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
exports.verifyAdminCode = callable.onCall(async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email;
    const { code } = request.data;
    if (!uid || !email) {
        throw new callable.HttpsError('unauthenticated', 'You must be logged in.');
    }
    if (!code || code.length !== 6) {
        throw new callable.HttpsError('invalid-argument', 'Invalid code.');
    }
    const doc = await admin.firestore().collection('adminCodes').doc(uid).get();
    if (!doc.exists) {
        throw new callable.HttpsError('not-found', 'No code found. Request a new one.');
    }
    const data = doc.data();
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
const SUPER_ADMIN_EMAILS = ['kktej3d@gmail.com'];
exports.onUserCreate = (0, identity_1.beforeUserCreated)(async (event) => {
    const userData = event.data;
    const email = (userData?.email || '').toLowerCase().trim();
    const role = SUPER_ADMIN_EMAILS.includes(email) ? 'super_admin' : 'user';
    return {
        customClaims: { role },
    };
});
exports.syncUserRole = (0, firestore_1.onDocumentWritten)('users/{uid}', async (event) => {
    const change = event.data;
    if (!change)
        return;
    const snapshot = change.after;
    if (!snapshot.exists)
        return;
    const data = snapshot.data();
    const role = data?.role;
    if (!role || !['user', 'admin', 'super_admin'].includes(role))
        return;
    const uid = event.params.uid;
    await admin.auth().setCustomUserClaims(uid, { role });
    functions.logger.info(`Synced role "${role}" for user ${uid}`);
});
exports.checkMembershipExpiry = functions.scheduler.onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Kolkata' }, async () => {
    if (!RESEND_API_KEY) {
        functions.logger.warn('RESEND_API_KEY not set — skipping email notifications');
        return;
    }
    const resend = new resend_1.Resend(RESEND_API_KEY);
    const now = Date.now();
    const profilesSnap = await admin.firestore().collection('profiles').get();
    const results = [];
    for (const doc of profilesSnap.docs) {
        const profile = doc.data();
        if (!profile.contactEmail)
            continue;
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
        }
        catch (err) {
            functions.logger.error(`Failed to process profile ${doc.id}:`, err);
        }
    }
    functions.logger.info('Membership check complete', { results });
});
//# sourceMappingURL=index.js.map