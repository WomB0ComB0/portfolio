import 'server-only';
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

/**
 * @file The /certifications page, rendered on the server: the header, then the filterable list
 * as a client island fed plain card data. A failed load is not caught here; it reaches the
 * route's error page inside the shell.
 */

import { Award } from 'lucide-react';
import type { JSX } from 'react';
import {
  type CertificationCardData,
  CertificationsExplorer,
  CertificationsExplorerSkeleton,
} from '@/app/(routes)/(main)/(professioal)/certifications/_components';
import { PageHeader } from '@/components/custom/page-header';
import type { Certification } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';

/** The badge size the cards have always requested. */
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 450;
const PAGE_CLASS = 'container mx-auto px-4 py-12 max-w-7xl space-y-16';

/** What the list's client island needs from one certification, with its image URL built here. */
export function toCertificationCard(certification: Certification): CertificationCardData {
  const { image } = certification;
  return {
    id: certification._id,
    title: certification.title,
    issuer: certification.issuer,
    issueDate: certification.issueDate,
    expiryDate: certification.expiryDate ?? null,
    credentialId: certification.credentialId ?? null,
    credentialUrl: certification.credentialUrl ?? null,
    description: certification.description ?? null,
    skills: certification.skills ?? [],
    imageUrl: image ? urlFor(image.asset._ref).width(IMAGE_WIDTH).height(IMAGE_HEIGHT).url() : null,
    imageAlt: image?.alt || `${certification.title} certification badge`,
  };
}

const CertificationsHeader = (): JSX.Element => (
  <PageHeader
    title="My Certifications"
    description="A collection of my professional certifications and credentials."
    icon={<Award />}
  />
);

export interface CertificationsProps {
  readonly certifications: readonly CertificationCardData[];
}

/** Every certification, grouped by issuer, with search and filters kept in the URL. */
export const Certifications = ({ certifications }: CertificationsProps): JSX.Element => (
  <div className={PAGE_CLASS}>
    <CertificationsHeader />
    <CertificationsExplorer certifications={certifications} />
  </div>
);
Certifications.displayName = 'Certifications';

/** The page while it loads (loading.tsx): the real header over the list's skeleton. */
export const CertificationsPageSkeleton = (): JSX.Element => (
  <div className={PAGE_CLASS}>
    <CertificationsHeader />
    <CertificationsExplorerSkeleton />
  </div>
);
CertificationsPageSkeleton.displayName = 'CertificationsPageSkeleton';

export default Certifications;
