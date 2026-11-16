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
 * Metadata and page share one load per request through the loader's React cache(), and one day
 * in New York through request-day.ts, so the title and the body never disagree on whether a
 * role has begun, even across midnight. The role's place among the others is read from the same
 * list, so it costs no second request. The projects load only to link the technologies: if they
 * fail the role still renders, its technologies as plain text.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { companyName } from '@/app/_components/home/data/format';
import { RoleDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/role-detail/role-detail';
import { isListedRole } from '@/app/(routes)/(main)/(professioal)/experience/_lib/listed-role';
import { requestNyToday } from '@/app/(routes)/(main)/(professioal)/experience/_lib/request-day';
import { plainText } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-text';
import { loadTechProjects } from '@/app/(routes)/(main)/(professioal)/experience/_lib/tech-projects';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { reportApiFailure } from '@/lib/observability/report';
import { loadExperienceById, loadExperiences } from '@/lib/sanity/loaders';
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
 * The experience's title and description, with its og:url: the position at the organization as
 * the list names it, and the description without its raw addresses (a share card is no place
 * for a 100-character link). An unknown id, or a role not listed yet, gets the site's own 404
 * metadata and no og:url (the page answers 404): the title the server already sent with the
 * 404, so it stays "404" once the page hydrates. When Sanity fails, whether the id exists is
 * unknown, so the page's defaults are kept, og:url included, and the failure is reported as a
 * warning.
 */
export async function generateMetadata({ params }: ExperienceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const path = `/experience/${encodeURIComponent(id)}`;
  // The request's day, the one the page reads too, taken before Sanity is waited on.
  const today = requestNyToday();

  try {
    const experience = await loadExperienceById(id);

    if (!experience || !isListedRole(experience, today)) return NOT_FOUND_METADATA;

    return constructMetadata({
      title: `${experience.position} at ${companyName(experience.company)}`,
      description: plainText(experience.description),
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

/**
 * One experience among the others, or a real 404 for an id Sanity does not have, or for a role
 * the list does not show yet (one that begins in a later month). The id is settled first, so
 * such an id answers 404 without waiting for anything else; the list is then already in the
 * request's cache. The clock ends in today's month in New York.
 */
const ExperienceDetailPage = async ({
  params,
}: ExperienceDetailPageProps): Promise<JSX.Element> => {
  const { id } = await params;
  const today = requestNyToday();
  const experience = await loadExperienceById(id);
  if (!experience || !isListedRole(experience, today)) notFound();
  const [experiences, projects] = await Promise.all([loadExperiences(), loadTechProjects()]);
  return (
    <RoleDetail
      experience={experience}
      experiences={experiences}
      projects={projects}
      today={today}
    />
  );
};
ExperienceDetailPage.displayName = 'ExperienceDetailPage';
export default ExperienceDetailPage;
