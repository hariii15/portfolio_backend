import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let initialized = false;
let explicitCredentials = false;
let firestore = null;

/**
 * Initialise Firebase Admin once.
 *
 * The same service-account credentials already used for Auth are reused for
 * Firestore. Local development can keep using the JSON files when no
 * credentials are present.
 */
export function initFirebase() {
  if (initialized || admin.apps.length) {
    initialized = true;
    return admin;
  }

  // 1. Auto-detect service-account.json in the backend root.
  const defaultServiceAccountPath = path.resolve('service-account.json');
  if (fs.existsSync(defaultServiceAccountPath)) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(defaultServiceAccountPath) });
      explicitCredentials = true;
      initialized = true;
      console.log('Firebase Admin initialised from local service-account.json');
      return admin;
    } catch (error) {
      console.error('Error auto-initialising from service-account.json:', error);
    }
  }

  // 2. Service account supplied as JSON in an environment variable.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      explicitCredentials = true;
      initialized = true;
      console.log('Firebase Admin initialised from FIREBASE_SERVICE_ACCOUNT_JSON');
      return admin;
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    }
  }

  // 3. Service account file path.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
      });
      explicitCredentials = true;
      initialized = true;
      console.log('Firebase Admin initialised from FIREBASE_SERVICE_ACCOUNT_PATH');
      return admin;
    } catch (error) {
      console.error('Error initialising from FIREBASE_SERVICE_ACCOUNT_PATH:', error.message);
    }
  }

  // 4. Individual environment variables.
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      explicitCredentials = true;
      initialized = true;
      console.log('Firebase Admin initialised from individual environment variables');
      return admin;
    } catch (error) {
      console.error('Error initialising from individual environment variables:', error);
    }
  }

  // 5. Application Default Credentials (GCP / local gcloud auth).
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    explicitCredentials = true;
  }
  try {
    admin.initializeApp();
    initialized = true;
    console.log('Firebase Admin initialised with default credentials');
  } catch (error) {
    console.warn(
      'Firebase Admin failed default initialisation. Auth validation will fail until config is corrected.',
      error.message
    );
  }

  return admin;
}

export function getFirebaseAdmin() {
  return initFirebase();
}

export function isFirestoreEnabled() {
  initFirebase();
  return initialized && explicitCredentials;
}

export function getFirestore() {
  if (!isFirestoreEnabled()) return null;
  if (firestore) return firestore;

  try {
    firestore = admin.firestore();
    return firestore;
  } catch (error) {
    console.warn('Firestore is not available:', error.message);
    return null;
  }
}

export default admin;
