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
 * @file buildProjectIndex: the projects as the /projects Index reads them, pure and
 * server-safe. Each project becomes one entry in page order (project-order.ts) with its group,
 * title and summary, kinds and technologies (labelled as the filter lookups label them), start
 * month, links, search text and hover-preview card. The cover URL comes from an injected
 * function, so this module never imports the Sanity client and stays testable.
 */

import {
  buildProjectLookups,
  type ProjectFilterItem,
  type ProjectLookups,
} from './project-filters';
import { groupLabel, type OrderableProject, orderProjects } from './project-order';
import {
  kindSlug,
  kindsOf,
  type ProjectMonth,
  splitTitle,
  startedOf,
  techKey,
} from './project-text';

/** What the index reads of a project (a decoded Sanity project has all of it). */
export interface IndexableProject extends OrderableProject {
  readonly description: string;
  readonly category: string;
  readonly technologies: readonly string[];
  readonly githubUrl?: string | null;
  readonly liveUrl?: string | null;
}

/** The hover preview's card for a row. */
export interface PreviewItem {
  readonly title: string;
  /** The first kind, as a word. */
  readonly kind: string;
  /** A 16:9 crop at twice the card's size, or null for the typographic card. */
  readonly cover: string | null;
}

/** One row of the Index. */
export interface ProjectEntry extends ProjectFilterItem {
  readonly id: string;
  /** 'featured', a year or 'undated'. */
  readonly group: string;
  readonly groupLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly kindLabels: readonly string[];
  readonly techLabels: readonly string[];
  readonly started: ProjectMonth | null;
  readonly githubUrl: string | null;
  readonly liveUrl: string | null;
  readonly preview: PreviewItem;
}

export interface ProjectStats {
  readonly projects: number;
  readonly technologies: number;
  readonly withLive: number;
}

export interface ProjectIndex {
  readonly entries: readonly ProjectEntry[];
  readonly lookups: ProjectLookups;
  readonly stats: ProjectStats;
}

/** Each value once, in order. */
const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** One project's entry, labelled by the lookups. */
function entryOf<P extends IndexableProject>(
  project: P,
  group: string,
  lookups: ProjectLookups,
  cover: string | null,
): ProjectEntry {
  const { title, summary } = splitTitle(project.title, project.description);
  const kindSlugs = unique(kindsOf(project.category).map(kindSlug));
  const kindLabels = kindSlugs.map((slug) => lookups.kinds[slug] ?? slug);
  const techKeys = unique(project.technologies.map(techKey).filter((key) => key !== ''));
  const techLabels = techKeys.map((key) => lookups.techs[key] ?? key);
  const haystack = [
    project.title,
    summary,
    project.description,
    project.category,
    ...kindLabels,
    ...project.technologies,
    ...techLabels,
  ].join('\n');
  return {
    id: project._id,
    group,
    groupLabel: groupLabel(group),
    title,
    summary,
    kindSlugs,
    kindLabels,
    techKeys,
    techLabels,
    started: startedOf(project.startDate),
    githubUrl: project.githubUrl || null,
    liveUrl: project.liveUrl || null,
    haystack,
    preview: { title, kind: kindLabels[0] ?? '', cover },
  };
}

/** Every project as an Index entry in page order, with the filter lookups and the figures. */
export function buildProjectIndex<P extends IndexableProject>(
  projects: readonly P[],
  coverOf: (project: P) => string | null,
): ProjectIndex {
  const lookups = buildProjectLookups(projects);
  const entries = orderProjects(projects).map(({ item, group }) =>
    entryOf(item, group, lookups, coverOf(item)),
  );
  return {
    entries,
    lookups,
    stats: {
      projects: projects.length,
      technologies: Object.keys(lookups.techs).length,
      withLive: projects.filter((project) => Boolean(project.liveUrl)).length,
    },
  };
}
