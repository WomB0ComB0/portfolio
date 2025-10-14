import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore';
import { config } from '@/config';
import { onRequestError } from '@/instrumentation';

const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
  measurementId: config.firebase.measurementId,
} as const satisfies FirebaseOptions;

const serviceAccount = {
  type: 'service_account',
  project_id: config.gcp.projectId,
  private_key_id: config.gcp.privateKeyId,
  private_key: config.gcp.privateKey.replace(/\\n/g, '\n'),
  client_email: config.gcp.clientEmail,
  client_id: config.gcp.clientId,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: config.gcp.clientX509CertUrl,
  universe_domain: 'googleapis.com',
} as const;

function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  const existingApp = getApps()[0];
  const app = existingApp ?? initializeApp(firebaseConfig);

  if (!existingApp) {
    console.log('Firebase initialized successfully');
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  // Connect to emulators in development (only once)
  if (process.env.NODE_ENV === 'development' && !existingApp) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, 'localhost', 8080);
      console.log('Connected to Firebase emulators');
    } catch (error) {
      // Emulators already connected or not available
      console.warn('Firebase emulators connection warning:', error);
      onRequestError(error);
    }
  }

  return { app, auth, firestore };
}

const { app, auth, firestore } = initializeFirebase();

export { app, auth, firestore, serviceAccount };
