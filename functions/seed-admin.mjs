import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'sbconnect-65338' });

const email = 'kktej3d@gmail.com';

async function run() {
  const snap = await admin.firestore().collection('users').where('email', '==', email).get();
  if (snap.empty) {
    console.log(`No user found with email "${email}". Have they signed up yet?`);
    process.exit(1);
  }
  const doc = snap.docs[0];
  await doc.ref.update({ role: 'super_admin' });
  console.log(`✅ ${email} is now super_admin (uid: ${doc.id})`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
