const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Import the key

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin successfully connected!");
  } catch (e) {
    console.error("Firebase Admin initialization failed.", e.message);
  }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };
