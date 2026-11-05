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
 * @file /experience/[id]. The page loads its experience at the top level, with no Suspense or
 * loading.tsx above it, so an unknown id answers HTTP 404 (src/app/(routes)/not-found.tsx, in the
 * shell) and a Sanity failure with nothing cached answers 500 (src/app/(routes)/error.tsx).
 * Metadata and page share one load per request through the loader's React cache().
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { ExperienceDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/experience-detail';
import { reportApiFailure } from '@/lib/observability/report';
import { loadExperienceById } from '@/lib/sanity/loaders';
import { constructMetadata, logger } from '@/utils';

/** Groups this page's metadata fallbacks in Sentry (one event per cooldown window). */
const METADATA_REPORT_CONTEXT = 'build experience page metadata';

interface ExperienceDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every id renders on request anyway, and a build-time id list only made `next build` try and
// fail to prerender each one.

/**
 * The experience's title and description, with its og:url. An unknown id gets "Not Found" and no
 * og:url (the page answers 404). When Sanity fails, whether the id exists is unknown, so the
 * page's defaults are kept, og:url included, and the failure is reported as a warning.
 */
export async function generateMetadata({ params }: ExperienceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const path = `/experience/${encodeURIComponent(id)}`;

  try {
    const experience = await loadExperienceById(id);

    if (!experience) {
      return constructMetadata({
        title: 'Experience Not Found',
        description: 'The requested experience item could not be found',
      });
    }

    return constructMetadata({
      title: `${experience.position} at ${experience.company}`,
      description: experience.description,
      path,
    });
  } catch (error) {
    logger.warn('Experience metadata fell back to the defaults', { error });
    reportApiFailure(error, { context: METADATA_REPORT_CONTEXT, level: 'warning' });
    return constructMetadata({
      title: 'Experience',
      description: 'View professional experience details',
      path,
    });
  }
}

/** One experience, or a real 404 for an id Sanity does not have. */
const ExperienceDetailPage = async ({
  params,
}: ExperienceDetailPageProps): Promise<JSX.Element> => {
  const { id } = await params;
  const experience = await loadExperienceById(id);
  if (!experience) notFound();
  return <ExperienceDetail experience={experience} />;
};
ExperienceDetailPage.displayName = 'ExperienceDetailPage';
export default ExperienceDetailPage;
