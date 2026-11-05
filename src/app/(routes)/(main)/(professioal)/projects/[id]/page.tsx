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
import { getProjects } from '@/lib/sanity/api';
import { urlFor } from '@/lib/sanity/client';
import { constructMetadata, logger } from '@/utils';

/**
 * ProjectDetail React component (dynamically imported).
 *
 * Renders the detail page content for a specific project given its id.
 *
 * @constant
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 */
const ProjectDetail = (await import('next/dynamic')).default(
  () =>
    import('@/app/(routes)/(main)/(professioal)/projects/_interface/project-detail').then(
      (mod) => mod.ProjectDetail,
    ),
  {
    ssr: true,
  },
);

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every id renders on request anyway, and a build-time id list only made `next build` try and
// fail to prerender each one. Unknown ids still 404 through notFound() in ProjectDetail.

/**
 * Generates Open Graph and SEO metadata for a specific project detail page.
 *
 * Utilizes the project id param to find details and construct page metadata.
 *
 * @async
 * @function generateMetadata
 * @param {{ params: Promise<{ id: string }> }} ctx - Context containing route parameters promise.
 * @returns {Promise<Record<string, any>>} The constructed metadata object for Next.js.
 * @throws {Error} Throws if metadata or project fails to load.
 * @example
 * const meta = await generateMetadata({ params: Promise.resolve({ id: 'xyz' }) });
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

  try {
    const projects = await getProjects();
    const project = projects.find((p) => p._id === id);

    if (!project) {
      return constructMetadata({
        title: 'Project Not Found',
        description: 'The requested project could not be found',
      });
    }

    const imageUrl = project.image
      ? urlFor(project.image).width(1200).height(630).url()
      : '/opengraph-image.png';

    return constructMetadata({
      title: project.title,
      description: project.description,
      image: imageUrl,
    });
  } catch (error) {
    logger.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Project',
      description: 'View project details',
    });
  }
}

/**
 * ProjectDetailPage - Server component to render a project's detail page.
 *
 * Fetches and resolves route parameters, and renders the {@link ProjectDetail} component.
 *
 * @async
 * @function ProjectDetailPage
 * @param {{ params: Promise<{ id: string }> }} props - Next.js route props with params promise.
 * @returns {Promise<JSX.Element>} Rendered ProjectDetail React component.
 * @throws {Error} Throws if params cannot be resolved or component fails to render.
 * @example
 * export default async function Page(props) {
 *   return <ProjectDetailPage {...props} />;
 * }
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @readonly
 * @version 1.0.0
 */
const ProjectDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> => {
  const resolvedParams = await params;
  return <ProjectDetail params={resolvedParams} />;
};
ProjectDetailPage.displayName = 'ProjectDetailPage';
export default ProjectDetailPage;
