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
 * @file A role's technologies as tokens that link into /projects. Pure and server-safe.
 *
 * /projects owns the truth: techKey folds spellings (React, React.js), buildProjectIndex gives
 * each project its technologies, and the page's filter schema counts them and writes the
 * address (?tech=<key>). This module only asks those, so a token links exactly where /projects'
 * own Technology picker would, with the count the picker shows, and a technology no project
 * has is plain text.
 */

import { projectFilters } from '../../projects/_lib/project-filters';
import { buildProjectIndex, type IndexableProject } from '../../projects/_lib/project-index';
import { techKey } from '../../projects/_lib/project-text';

/** A technology on /projects. */
export interface TechLink {
  /** /projects filtered by this one technology. */
  readonly href: string;
  /** The technology as /projects spells it. */
  readonly label: string;
  /** How many projects have it. */
  readonly projects: number;
}

/** Every technology /projects has, by its key (techKey). */
export type TechLinks = ReadonlyMap<string, TechLink>;

/** One of a role's technologies, as the role spells it. */
export interface TechToken {
  readonly name: string;
  /** Where it leads on /projects; null when no project has it. */
  readonly link: TechLink | null;
}

/** For a page without the projects (they failed to load): every token is plain text. */
export const NO_TECH_LINKS: TechLinks = new Map();

/** Each technology the projects have: its /projects address, spelling and project count. */
export function buildTechLinks(projects: readonly IndexableProject[]): TechLinks {
  const { entries, lookups } = buildProjectIndex(projects, () => []);
  const schema = projectFilters(lookups);
  const everything = schema.empty();
  return new Map(
    schema
      .options(entries, everything)
      .tech.options.filter((option) => option.count > 0)
      .map((option): [string, TechLink] => [
        option.slug,
        {
          href: schema.hrefFor(everything, { tech: [option.slug] }),
          label: option.label,
          projects: option.count,
        },
      ]),
  );
}

/** A role's technologies in its own order and spelling, blank ones dropped, each with its link. */
export function techTokensOf(technologies: readonly string[], links: TechLinks): TechToken[] {
  return technologies
    .map((technology) => technology.trim())
    .filter((name) => name !== '')
    .map((name) => ({ name, link: links.get(techKey(name)) ?? null }));
}
