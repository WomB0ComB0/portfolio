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
 * @file buildProjectIndex: the projects as /projects reads them, pure and server-safe. Each
 * project becomes one entry in page order (project-order.ts) with its group, title, summary and
 * description, kinds and technologies (labelled as the filter lookups label them), start month,
 * period and status, links (kept only when they are real web addresses, project-links.ts), search
 * text and images. The entries are plain JSON, so the server
 * hands them to the filter island, which lays out every view (Stories, Index, Screens) from them.
 * The image URLs come from an injected function, so this module never imports the Sanity client
 * and stays testable.
 */

import {
  buildProjectLookups,
  type ProjectFilterItem,
  type ProjectLookups,
} from './project-filters';
import { safeHref } from './project-links';
import { groupLabel, type OrderableProject, orderProjects } from './project-order';
import {
  kindSlug,
  kindsOf,
  type ProjectMonth,
  splitTitle,
  startedOf,
  techKey,
} from './project-text';
import { isInProgress, periodOf } from './project-words';

/** What the index reads of a project (a decoded Sanity project has all of it). */
export interface IndexableProject extends OrderableProject {
  readonly description: string;
  readonly category: string;
  readonly technologies: readonly string[];
  readonly status?: string | null;
  readonly endDate?: string | null;
  readonly githubUrl?: string | null;
  readonly liveUrl?: string | null;
}

/** Where an image's subject sits, as fractions of its width and height (Studio's hotspot). */
export interface ImageFocus {
  readonly x: number;
  readonly y: number;
}

/** One image of a project: its cover first, then its gallery, in Studio's order. */
export interface ProjectImage {
  /** The whole image from Sanity (never cropped); next/image sizes it for each place. */
  readonly src: string;
  /** Width over height, from the asset id. */
  readonly ratio: number;
  /** Studio's alt text, tidied; null when there is none. */
  readonly alt: string | null;
  readonly focus: ImageFocus | null;
}

/** One project as every view reads it. */
export interface ProjectEntry extends ProjectFilterItem {
  readonly id: string;
  /** 'featured', a year or 'undated'. */
  readonly group: string;
  readonly groupLabel: string;
  /** The title before a spaced dash: 'Fraud Guard'. */
  readonly title: string;
  /** The rest of the title, else the description's first sentence. */
  readonly summary: string;
  /** The description on one line. */
  readonly description: string;
  readonly kindLabels: readonly string[];
  readonly techLabels: readonly string[];
  readonly started: ProjectMonth | null;
  /** 'Mar – Jun 2026', 'Apr 2026 – now' (PRESENT_LABEL); null without a start date. */
  readonly period: string | null;
  /** Studio's status says it is still in progress. */
  readonly ongoing: boolean;
  /** Studio display order (lower first): the lead rule reads it. */
  readonly order: number;
  /** The code's address, only when it is a real web address. */
  readonly githubUrl: string | null;
  /** The live site's address, only when it is a real web address. */
  readonly liveUrl: string | null;
  /** The cover first, then the gallery; empty when it has none. */
  readonly images: readonly ProjectImage[];
}

export interface ProjectStats {
  readonly projects: number;
  readonly withLive: number;
}

export interface ProjectIndex {
  readonly entries: readonly ProjectEntry[];
  readonly lookups: ProjectLookups;
  readonly stats: ProjectStats;
}

/** Each value once, in order. */
const unique = (values: readonly string[]): string[] => [...new Set(values)];

const collapse = (text: string): string => text.replaceAll(/\s+/gu, ' ').trim();

/** One project's entry, labelled by the lookups. */
function entryOf<P extends IndexableProject>(
  project: P,
  group: string,
  lookups: ProjectLookups,
  images: readonly ProjectImage[],
): ProjectEntry {
  const { title, summary } = splitTitle(project.title, project.description);
  const kindSlugs = unique(kindsOf(project.category).map(kindSlug));
  const kindLabels = kindSlugs.map((slug) => lookups.kinds[slug] ?? slug);
  const techKeys = unique(project.technologies.map(techKey).filter((key) => key !== ''));
  const techLabels = techKeys.map((key) => lookups.techs[key] ?? key);
  const ongoing = isInProgress(project.status);
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
    description: collapse(project.description),
    kindSlugs,
    kindLabels,
    techKeys,
    techLabels,
    started: startedOf(project.startDate),
    period: periodOf(project.startDate, project.endDate, ongoing),
    ongoing,
    order: project.order,
    githubUrl: safeHref(project.githubUrl),
    liveUrl: safeHref(project.liveUrl),
    haystack,
    images,
  };
}

/** Every project as an entry in page order, with the filter lookups and the header's figures. */
export function buildProjectIndex<P extends IndexableProject>(
  projects: readonly P[],
  imagesOf: (project: P) => readonly ProjectImage[],
): ProjectIndex {
  const lookups = buildProjectLookups(projects);
  const entries = orderProjects(projects).map(({ item, group }) =>
    entryOf(item, group, lookups, imagesOf(item)),
  );
  return {
    entries,
    lookups,
    stats: {
      projects: projects.length,
      // The links shown, so the header never counts a demo no story links to.
      withLive: entries.filter((entry) => entry.liveUrl !== null).length,
    },
  };
}
