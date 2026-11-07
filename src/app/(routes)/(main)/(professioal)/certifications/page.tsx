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
import { Certifications } from '@/app/(routes)/(main)/(professioal)/certifications/_interface/certifications/certifications';
import { loadCertifications } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Certifications',
  description: 'View my professional certifications and credentials',
  path: '/certifications',
});

export interface CertificationsPageProps {
  /** ?issuer, ?skill and ?q: the Ledger's filters, so a shared link renders filtered. */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Every certification as the Ledger, rendered on the server with the URL's filters applied. When
 * Sanity fails with nothing cached the load rejects, and src/app/(routes)/error.tsx shows the
 * error inside the shell.
 */
export default async function CertificationsPage({
  searchParams,
}: CertificationsPageProps): Promise<JSX.Element> {
  const [certifications, { issuer, skill, q }] = await Promise.all([
    loadCertifications(),
    searchParams,
  ]);
  return <Certifications certifications={certifications} searchParams={{ issuer, skill, q }} />;
}
