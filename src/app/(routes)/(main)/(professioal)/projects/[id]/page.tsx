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
 * @file /projects/[id], rendered on the server. The project is looked up before anything streams
 * (no loading.tsx or Suspense sits above this page), so an unknown id answers a real 404 through
 * notFound() and the (routes) not-found view, and a Sanity outage with nothing cached answers a
 * real 500 through the (routes) error view. The metadata and the page share one load: the loaders
 * are React-cache()d per request.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { ProjectDetail } from '@/app/(routes)/(main)/(professioal)/projects/_interface/project-detail/project-detail';
import { reportApiFailure } from '@/lib/observability/report';
import { urlFor } from '@/lib/sanity/client';
import { loadProjectById } from '@/lib/sanity/loaders';
import { constructMetadata, logger } from '@/utils';

/** Groups this page's metadata fallbacks in Sentry (one event per cooldown window). */
const METADATA_REPORT_CONTEXT = 'build project page metadata';

/** The Open Graph image: Sanity's image at the size link previews use. */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const DEFAULT_OG_IMAGE = '/opengraph-image.png';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every id renders on request anyway, and a build-time id list only made `next build` try and
// fail to prerender each one.

/**
 * The project's title, description, image and og:url. An unknown id gets "Not Found" and no
 * og:url; when Sanity fails, whether the id exists is unknown, so the page's defaults (with their
 * og:url) are kept and the failure is reported as a warning.
 */
export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const path = `/projects/${encodeURIComponent(id)}`;

  try {
    const project = await loadProjectById(id);

    if (!project) {
      return constructMetadata({
        title: 'Project Not Found',
        description: 'The requested project could not be found',
      });
    }

    const imageUrl = project.image
      ? urlFor(project.image).width(OG_IMAGE_WIDTH).height(OG_IMAGE_HEIGHT).url()
      : DEFAULT_OG_IMAGE;

    return constructMetadata({
      title: project.title,
      description: project.description,
      image: imageUrl,
      path,
    });
  } catch (error) {
    logger.warn('Project metadata fell back to the defaults', { error });
    reportApiFailure(error, { context: METADATA_REPORT_CONTEXT, level: 'warning' });
    return constructMetadata({
      title: 'Project',
      description: 'View project details',
      path,
    });
  }
}

/** The project with this id; an unknown or malformed id is a 404. */
export default async function ProjectDetailPage({
  params,
}: ProjectPageProps): Promise<JSX.Element> {
  const { id } = await params;
  const project = await loadProjectById(id);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
