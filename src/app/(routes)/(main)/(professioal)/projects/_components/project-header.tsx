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
 * @file The /projects header's words: the h1 (as the other PageShell pages name theirs:
 * "Certifications", "Projects"), the description, and the counts as one small byline ('32 projects
 * · 20 with a live demo'), where the stat tiles were: the work leads, the numbers follow.
 * Server-safe.
 */

import type { ReactElement } from 'react';

import { Byline } from '@/components/console/folio/byline';
import { countOf } from '@/components/console/folio/byline-items';
import type { ProjectStats } from '../_lib/project-index';
import { PROJECT_NOUN } from '../_lib/project-text';

export const PROJECTS_TITLE = 'Projects';
export const PROJECTS_DESCRIPTION =
  'A showcase of my work spanning web development, mobile apps, and machine learning.';

/** The header's counts, in words. */
export function ProjectsByline({ stats }: { readonly stats: ProjectStats }): ReactElement | null {
  return (
    <Byline
      parts={[
        countOf(stats.projects, PROJECT_NOUN),
        stats.withLive > 0 ? `${stats.withLive} with a live demo` : null,
      ]}
      className="md:text-end"
    />
  );
}
