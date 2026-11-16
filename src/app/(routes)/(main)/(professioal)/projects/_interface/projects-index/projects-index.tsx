import 'server-only';

/**
 * Copyright 2026 Mike Odnis
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
 * @file The /projects page, rendered on the server: a PageShell header (the title, the
 * description and the counts as a byline), then the filter island, which lays out the view the
 * URL names (Stories, Index or Screens) from every project's entry. The image URLs are built
 * here, so the client island never loads the Sanity client. A failed load is not caught here; it
 * reaches the route's error page inside the shell.
 */

import type { ReactElement } from 'react';

import { PageShell } from '@/components/console';
import { EMPTY_CLASS } from '@/components/console/filter-bar/filter-bar-classes';
import type { Project } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import {
  PROJECTS_DESCRIPTION,
  PROJECTS_TITLE,
  ProjectsByline,
} from '../../_components/project-header';
import { ProjectsIndex } from '../../_components/projects-index';
import { projectImagesOf } from '../../_lib/project-images';
import { buildProjectIndex } from '../../_lib/project-index';
import { DEFAULT_PROJECT_VIEW, type ProjectView } from '../../_lib/project-views';

/** The whole image (fit max: never cropped, never enlarged), in the best format. */
const sanityUrl = (assetRef: string, maxWidth: number): string =>
  urlFor({ _type: 'reference', _ref: assetRef }).width(maxWidth).fit('max').auto('format').url();

export interface ProjectsProps {
  readonly projects: readonly Project[];
  /** The view the URL names; Stories by default. */
  readonly view?: ProjectView;
}

/** Every project; the island applies the URL's filters (also on the server) and lays out the view. */
export function Projects({ projects, view = DEFAULT_PROJECT_VIEW }: ProjectsProps): ReactElement {
  const { entries, lookups, stats } = buildProjectIndex(projects, (project) =>
    projectImagesOf(project, sanityUrl),
  );

  return (
    <PageShell
      title={PROJECTS_TITLE}
      description={PROJECTS_DESCRIPTION}
      stats={<ProjectsByline stats={stats} />}
    >
      {entries.length === 0 ? (
        <div data-state="empty" className={EMPTY_CLASS}>
          <p className="tile-sub text-muted-foreground">No projects yet.</p>
        </div>
      ) : (
        // The island follows the URL itself (Back, links, router.push), so it needs no key.
        <ProjectsIndex entries={entries} lookups={lookups} view={view} />
      )}
    </PageShell>
  );
}
Projects.displayName = 'Projects';

export default Projects;
