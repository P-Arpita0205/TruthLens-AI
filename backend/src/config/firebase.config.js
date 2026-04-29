const admin = require('firebase-admin');

// On Render (production): credentials are stored in FIREBASE_SERVICE_ACCOUNT_JSON env var
// Locally: read from serviceAccountKey.json file
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

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
