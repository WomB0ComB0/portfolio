import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
  private_key_id: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY_ID,
  private_key: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
  client_id: process.env.NEXT_PUBLIC_GCP_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL,
  universe_domain: 'googleapis.com',
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } else {
    app = getApps()[0]!;
  }

  auth = getAuth(app);
  firestore = getFirestore(app!);

  if (process.env.NODE_ENV === 'development') {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(firestore, 'localhost', 8080);
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

export { auth, app, firestore, serviceAccount };
