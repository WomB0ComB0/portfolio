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

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { getExperiences } from '@/lib/sanity/api';
import { constructMetadata, logger } from '@/utils';

/**
 * Dynamically imports the ExperienceDetail component for SSR.
 *
 * @readonly
 * @type {import('react').ComponentType<{ params: { id: string } }>}
 * @web
 * @author Mike Odnis
 * @see https://nextjs.org/docs/pages/api-reference/functions/dynamic
 * @version 1.0.0
 */
const ExperienceDetail = (await import('next/dynamic')).default(
  () =>
    import('@/app/(routes)/(main)/(professioal)/experience/_interface/experience-detail').then(
      (mod) => mod.ExperienceDetail,
    ),
  {
    ssr: true,
  },
);

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every id renders on request anyway, and a build-time id list only made `next build` try and
// fail to prerender each one. Unknown ids still 404 through notFound() in ExperienceDetail.

/**
 * Generates metadata for the Experience detail page for SEO and meta tags.
 *
 * Attempts to resolve the experience by id and propagate metadata for the experience,
 * or provides fallback metadata if not found or on error.
 *
 * @function
 * @async
 * @public
 * @param {{ params: Promise<{ id: string }> }} context - The params object containing the experience id as a Promise.
 * @returns {Promise<Record<string, any>>} A metadata object suitable for Next.js SEO/meta rendering.
 * @throws {Error} Throws error if fetching experiences fails or unexpected issues occur.
 * @example
 * const meta = await generateMetadata({ params: Promise.resolve({ id: 'abc123' }) });
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 * @version 1.0.0
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const path = `/experience/${encodeURIComponent(id)}`;

  try {
    const experiences = await getExperiences();
    const experienceItem = experiences.find((exp) => exp._id === id);

    // An unknown id renders a 404, so it gets no og:url.
    if (!experienceItem) {
      return constructMetadata({
        title: 'Experience Not Found',
        description: 'The requested experience item could not be found',
      });
    }

    return constructMetadata({
      title: `${experienceItem.position} at ${experienceItem.company}`,
      description: experienceItem.description,
      path,
    });
  } catch (error) {
    logger.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Experience',
      description: 'View professional experience details',
      path,
    });
  }
}

/**
 * Renders the detail page for a specific work experience entry.
 *
 * Resolves the Next.js dynamic route parameter and passes it to the dynamic ExperienceDetail component.
 *
 * @function
 * @async
 * @public
 * @param {{ params: Promise<{ id: string }> }} props - The page props containing dynamic route params as a Promise.
 * @returns {Promise<JSX.Element>} The JSX for the Experience Detail view.
 * @throws {Error} Throws if params cannot be resolved.
 * @example
 * <ExperienceDetailPage params={Promise.resolve({ id: 'abc123' })} />
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/page
 * @version 1.0.0
 */
const ExperienceDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> => {
  const resolvedParams = await params;
  return <ExperienceDetail params={resolvedParams} />;
};
ExperienceDetailPage.displayName = 'ExperienceDetailPage';
export default ExperienceDetailPage;
