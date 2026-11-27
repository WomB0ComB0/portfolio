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
 * @file A project's parts as /projects reads them, pure and server-safe: the repositories a
 * multi-repository project is made of ("How it fits together"). One threshold, MIN_PARTS from
 * the rules Studio shares (src/sanity/project-part-rules.ts), applied once in partSourcesOf,
 * drives everything here: the card's "N repos", the page's section, the technologies the filter
 * and Built with read, the words search reads and the repository links link health probes. A
 * project with no tidy part, or only one, therefore reads exactly as a one-repository project.
 *
 * The decoder already checks each part's shape; the checks are repeated here so a direct call on
 * partial or old data stays safe. A repository is linked only through safeHref, so a mistyped or
 * unsafe address gives no link, and such a row is not called private, because that would be
 * untrue: only a row with no address and no page link is.
 */

import type { ProjectPart } from '@/hooks/sanity/schemas';
import { MIN_PARTS, repoLabelOf } from '@/sanity/project-part-rules';
import { safeHref } from './project-links';
import { projectHref, techKey } from './project-text';

/** What this module reads of a project (a decoded Sanity project has all of it). */
export interface PartOwner {
  readonly _id: string;
  readonly technologies: readonly string[];
  readonly systemParts?: readonly ProjectPart[] | null;
  readonly systemSummary?: string | null;
}

/** A row's repository link: the address as Studio wrote it (trimmed), and its link text. */
export interface PartRepo {
  readonly href: string;
  /** 'owner/repo' on a code host, else the host and path (repoLabelOf). */
  readonly label: string;
}

/** One row of the page's "How it fits together" section. */
export interface PartRow {
  /** Studio's _key, trimmed: the first valid part with a key wins. */
  readonly key: string;
  /** The name on one line. */
  readonly name: string;
  readonly role: string | null;
  /** /projects/<id> when the part links another listed project's page, else null. */
  readonly page: string | null;
  readonly repo: PartRepo | null;
  /** No address typed and no page link: the row says "Private repository". */
  readonly isPrivate: boolean;
  /** The part's own technologies, deduped by techKey; none for a part with a page link. */
  readonly technologies: readonly string[];
  readonly contribution: string | null;
}

/** The page's section: the optional lead sentence, then one row per part. */
export interface CaseSystem {
  readonly summary: string | null;
  readonly parts: readonly PartRow[];
}

const PART_TYPE = 'projectPart';

/** The text on one line, trimmed; empty for none. */
const tidy = (text: string | null | undefined): string =>
  (text ?? '').replaceAll(/\s+/gu, ' ').trim();

const textOrNull = (text: string | null | undefined): string | null => tidy(text) || null;

const optionalText = (value: unknown): boolean => value == null || typeof value === 'string';
const optionalTexts = (value: unknown): boolean =>
  value == null || (Array.isArray(value) && value.every((item) => typeof item === 'string'));

/** A part the page can show: a key and a name, and every other field of its declared type. */
function isPartSource(value: unknown): value is ProjectPart {
  if (!value || typeof value !== 'object') return false;
  const part = value as Record<string, unknown>;
  return (
    typeof part._key === 'string' &&
    part._key.trim() !== '' &&
    typeof part.name === 'string' &&
    tidy(part.name) !== '' &&
    (part._type == null || part._type === PART_TYPE) &&
    optionalText(part.role) &&
    optionalText(part.repoUrl) &&
    optionalText(part.projectId) &&
    optionalTexts(part.technologies) &&
    optionalText(part.contribution)
  );
}

/** The id of the project page a part links, else null. */
const linkedIdOf = (part: ProjectPart): string | null => part.projectId?.trim() || null;

/**
 * A part's own technologies, tidied and deduped by techKey (the first spelling wins), blanks
 * dropped. A part with a page link has none: that project's own card answers its filter.
 */
function ownTechnologiesOf(part: ProjectPart): readonly string[] {
  if (linkedIdOf(part)) return [];
  const keys = new Set<string>();
  return (part.technologies ?? []).map(tidy).filter((tech) => {
    const key = techKey(tech);
    if (key === '' || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/** A part's repository link, only when its address passes safeHref. */
function repoOf(part: ProjectPart): PartRepo | null {
  const href = safeHref(part.repoUrl);
  return href ? { href, label: repoLabelOf(href) } : null;
}

/**
 * The tidy parts in Studio order: each with a key and a name, of type 'projectPart' or untyped,
 * the first valid part of each key kept. Below MIN_PARTS there are none, so every reader below
 * treats the project as one repository.
 */
export function partSourcesOf(project: Pick<PartOwner, 'systemParts'>): readonly ProjectPart[] {
  const value: unknown = project.systemParts;
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>();
  const sources = value.filter((part): part is ProjectPart => {
    if (!isPartSource(part)) return false;
    const key = part._key.trim();
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  return sources.length >= MIN_PARTS ? sources : [];
}

/** The card's "N repos": 0, or 2 and more. Private and linked parts count: each is a repository. */
export const repoCountOf = (project: Pick<PartOwner, 'systemParts'>): number =>
  partSourcesOf(project).length;

/**
 * The technologies the filter, search and Built with read: project.technologies unchanged (same
 * order and spelling, repeats kept), then each tidy part's own technologies whose techKey is new.
 * A part with a page link adds none. Below MIN_PARTS: project.technologies as it is.
 */
export function allTechnologiesOf(
  project: Pick<PartOwner, 'technologies' | 'systemParts'>,
): readonly string[] {
  const keys = new Set(project.technologies.map(techKey));
  const added = partSourcesOf(project)
    .flatMap(ownTechnologiesOf)
    .filter((tech) => {
      const key = techKey(tech);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
  return added.length > 0 ? [...project.technologies, ...added] : project.technologies;
}

/**
 * The words search reads from the parts: names, roles, own technologies and the public
 * repositories' link text ('owner/repo'). Not "My part" and not the lead sentence, as search
 * already leaves out a project's long description.
 */
export function partWords(project: Pick<PartOwner, 'systemParts'>): readonly string[] {
  return partSourcesOf(project)
    .flatMap((part) => [
      tidy(part.name),
      tidy(part.role),
      ...ownTechnologiesOf(part),
      repoOf(part)?.label ?? '',
    ])
    .filter((word) => word !== '');
}

/**
 * The page's "How it fits together" section, or null below MIN_PARTS. A page link to this
 * project itself, or to a project the page does not list (unpublished or deleted), gives
 * page: null, and the row still shows its repository when it has one.
 */
export function caseSystemOf(
  project: PartOwner,
  projects: readonly { readonly _id: string }[],
): CaseSystem | null {
  const sources = partSourcesOf(project);
  if (sources.length === 0) return null;
  const listed = new Set(projects.map(({ _id }) => _id));
  const pageOf = (part: ProjectPart): string | null => {
    const id = linkedIdOf(part);
    return id && id !== project._id && listed.has(id) ? projectHref(id) : null;
  };
  return {
    summary: textOrNull(project.systemSummary),
    parts: sources.map((part) => ({
      key: part._key.trim(),
      name: tidy(part.name),
      role: textOrNull(part.role),
      page: pageOf(part),
      repo: repoOf(part),
      isPrivate: !part.repoUrl?.trim() && !linkedIdOf(part),
      technologies: ownTechnologiesOf(part),
      contribution: textOrNull(part.contribution),
    })),
  };
}

/**
 * The repository links the section renders, in page order, for the link-health catalog: the
 * same threshold and safeHref rule as the page, so every badge it draws has an entry and a
 * private row is never probed.
 */
export function partRepoHrefs(project: Pick<PartOwner, 'systemParts'>): readonly string[] {
  return partSourcesOf(project).flatMap((part) => {
    const href = safeHref(part.repoUrl);
    return href ? [href] : [];
  });
}
