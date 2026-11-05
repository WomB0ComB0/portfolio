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
 * @file The /projects page body, rendered on the server. It turns each Sanity project into the
 * card DTO here, image URL included, so the client filter island never loads the Sanity client.
 */

import type { JSX } from 'react';
import type { Project } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import type { ProjectCardData } from '../../_components/project-card';
import { ProjectsExplorer } from '../../_components/projects-explorer';
import { ProjectsPageFrame } from '../../_components/projects-skeleton';

/** A card image's size: 16:9, twice the widest card for sharp high-DPI screens. */
const CARD_IMAGE_WIDTH = 800;
const CARD_IMAGE_HEIGHT = 450;

/** Shown when Sanity has an image entry but no URL can be built for it. */
const CARD_IMAGE_FALLBACK = '/assets/svgs/logo.svg';

export interface ProjectsListProps {
  projects: readonly ProjectCardData[];
}

/** What a project's card shows, with its image URL built on the server. */
export function toProjectCard(project: Project): ProjectCardData {
  return {
    id: project._id,
    title: project.title,
    description: project.description,
    category: project.category,
    technologies: project.technologies,
    githubUrl: project.githubUrl || null,
    imageUrl: project.image
      ? urlFor(project.image).width(CARD_IMAGE_WIDTH).height(CARD_IMAGE_HEIGHT).url() ||
        CARD_IMAGE_FALLBACK
      : null,
    imageAlt: project.image?.alt || project.title,
  };
}

/** The page header, the filters and every project. */
export function ProjectsList({ projects }: ProjectsListProps): JSX.Element {
  return (
    <ProjectsPageFrame>
      <ProjectsExplorer projects={projects} />
    </ProjectsPageFrame>
  );
}

export default ProjectsList;
