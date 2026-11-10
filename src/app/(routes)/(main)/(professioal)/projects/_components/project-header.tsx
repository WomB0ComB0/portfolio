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
 * @file The /projects header's words and figures: the h1 (as the other PageShell pages name
 * theirs: "Certifications", "Projects"), the description, and the three-figure stat strip
 * (projects, technologies after folding spellings, and how many have a live demo). Server-safe.
 */

import type { ReactElement } from 'react';

import { StatStrip } from '@/components/console';
import type { ProjectStats } from '../_lib/project-index';

export const PROJECTS_TITLE = 'Projects';
export const PROJECTS_DESCRIPTION =
  'A showcase of my work spanning web development, mobile apps, and machine learning.';
const STATS_LABEL = 'Totals';

/** The header's three figures. */
export function ProjectsStatStrip({ stats }: { readonly stats: ProjectStats }): ReactElement {
  return (
    <StatStrip
      aria-label={STATS_LABEL}
      items={[
        { label: 'projects', value: stats.projects },
        { label: 'technologies', value: stats.technologies },
        { label: 'with a live demo', value: stats.withLive },
      ]}
    />
  );
}
