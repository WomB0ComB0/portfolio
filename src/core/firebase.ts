import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { env } from '@/env';

const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
};

const serviceAccount = {
  type: 'service_account',
  project_id: env.GCP_PROJECT_ID,
  private_key_id: env.GCP_PRIVATE_KEY_ID,
  private_key: env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: env.GCP_CLIENT_EMAIL,
  client_id: env.GCP_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: env.GCP_CLIENT_X509_CERT_URL,
  universe_domain: 'googleapis.com',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
export { auth, app, firestore, serviceAccount };
