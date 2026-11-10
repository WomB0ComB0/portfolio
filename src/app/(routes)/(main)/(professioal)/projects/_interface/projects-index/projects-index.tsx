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
 * @file The /projects page as the open Index, rendered on the server: a PageShell header with
 * three figures, then the filter island holding the server-rendered rows (the Featured group,
 * then the years). Cover URLs for the hover preview are built here, so the client island never
 * loads the Sanity client. A failed load is not caught here; it reaches the route's error page
 * inside the shell.
 */

import type { ReactElement } from 'react';

import { PageShell } from '@/components/console';
import { EMPTY_CLASS } from '@/components/console/filter-bar/filter-bar-classes';
import type { Project } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import {
  PROJECTS_DESCRIPTION,
  PROJECTS_TITLE,
  ProjectsStatStrip,
} from '../../_components/project-header';
import { ProjectRow } from '../../_components/project-row';
import { type ProjectRowItem, ProjectsIndex } from '../../_components/projects-index';
import { buildProjectIndex } from '../../_lib/project-index';

/** A cover's crop: 16:9 at twice the preview card's 288 x 162, for sharp high-DPI screens. */
const COVER_WIDTH = 576;
const COVER_HEIGHT = 324;

/** A project's cover for the preview card, or null for the typographic card. */
function coverOf(project: Project): string | null {
  if (!project.image?.asset) return null;
  return (
    urlFor(project.image)
      .width(COVER_WIDTH)
      .height(COVER_HEIGHT)
      .fit('crop')
      .auto('format')
      .url() || null
  );
}

export interface ProjectsProps {
  readonly projects: readonly Project[];
}

/** Every project in the Index; the island applies the URL's filters (also on the server). */
export function Projects({ projects }: ProjectsProps): ReactElement {
  const { entries, lookups, stats } = buildProjectIndex(projects, coverOf);
  const rows: ProjectRowItem[] = entries.map((entry) => ({
    id: entry.id,
    group: entry.group,
    groupLabel: entry.groupLabel,
    kindSlugs: entry.kindSlugs,
    techKeys: entry.techKeys,
    haystack: entry.haystack,
    preview: entry.preview,
    row: <ProjectRow entry={entry} />,
  }));

  return (
    <PageShell
      title={PROJECTS_TITLE}
      description={PROJECTS_DESCRIPTION}
      stats={<ProjectsStatStrip stats={stats} />}
    >
      {rows.length === 0 ? (
        <div data-state="empty" className={EMPTY_CLASS}>
          <p className="tile-sub text-muted-foreground">No projects yet.</p>
        </div>
      ) : (
        // The island follows the URL itself (Back, links, router.push), so it needs no key.
        <ProjectsIndex rows={rows} lookups={lookups} />
      )}
    </PageShell>
  );
}
Projects.displayName = 'Projects';

export default Projects;
