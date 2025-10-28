/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
