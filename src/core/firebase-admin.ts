import { cert, getApp, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount as baseServiceAccount } from './firebase';

const raw = baseServiceAccount;

const { project_id: projectId, client_email: clientEmail, private_key: privateKeyEscaped } = raw;

const serviceAccount: ServiceAccount = {
  projectId,
  clientEmail,
  privateKey: privateKeyEscaped.replace(/\\n/g, '\n'),
};

const app = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount) });
export const adminDb = getFirestore(app);
