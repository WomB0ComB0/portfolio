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

import type { JSX } from 'react';
import {
  Certifications,
  toCertificationCard,
} from '@/app/(routes)/(main)/(professioal)/certifications/_interface/certifications/certifications';
import { loadCertifications } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Certifications',
  description: 'View my professional certifications and credentials',
  path: '/certifications',
});

/**
 * Every certification, rendered on the server. When Sanity fails with nothing cached the load
 * rejects, and src/app/(routes)/error.tsx shows the error inside the shell.
 */
export default async function CertificationsPage(): Promise<JSX.Element> {
  const certs = await loadCertifications();
  return <Certifications certifications={certs.map(toCertificationCard)} />;
}
