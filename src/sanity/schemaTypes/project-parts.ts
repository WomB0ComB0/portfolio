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
 * @file A project's parts ("How it fits together"): the Studio fields for a project made of
 * several repositories that work together, and their checks. Everything here is public: the
 * dataset and /api/v1/sanity/projects can be read without a token, so a private repository is
 * described by its name and never given an address. The site reads only published documents, so
 * a warning on the draft is the last moment a leak can still be stopped; the checks that only
 * nudge stay warnings and let Publish through. Studio and the site share the repository rules
 * (../project-part-rules.ts).
 *
 * Relative imports only: the Studio's own build does not resolve the app's '@/' alias.
 */

import { type CustomValidatorResult, defineField, type ValidationContext } from 'sanity';
import {
  isSameRepo,
  looksLikeRepoSlug,
  MIN_PARTS,
  PART_LIMITS,
  repoPathOf,
} from '../project-part-rules';

/** What the checks read of one part, as Studio holds it (any field may still be missing). */
interface PartValue {
  readonly _key?: string;
  readonly name?: string;
  readonly repoUrl?: string;
  readonly project?: { readonly _ref?: string };
  readonly technologies?: readonly string[];
}

/**
 * The API version the repository check reads with. Before 2025-02-19 a query's default
 * perspective is raw, so the check sees every project, published or draft (as bookshelf.ts does).
 */
const PARTS_API_VERSION = '2024-10-14';

/**
 * Every project's title and GitHub URL except the edited project's own (its published
 * `$published` and draft ids). Release versions (`versions.<release>.<id>`) are left out: they are
 * pending copies of projects already counted, and the edited project's own would flag its main
 * repository, listed as a part, as another project's.
 */
const OTHER_PROJECT_REPOS_QUERY =
  '*[_type == "project" && !(_id in path("versions.**")) && !(_id in [$published, $draft])]{title, githubUrl}';

const DRAFT_PREFIX = 'drafts.';
const VERSION_PREFIX = 'versions.';

/** The published id behind a published, draft or release version id (bookshelf.ts's rule). */
function publishedId(id: string): string {
  if (id.startsWith(DRAFT_PREFIX)) return id.slice(DRAFT_PREFIX.length);
  if (id.startsWith(VERSION_PREFIX)) return id.split('.').slice(2).join('.');
  return id;
}

const partsOf = (value: unknown): readonly PartValue[] =>
  Array.isArray(value) ? (value as PartValue[]) : [];

/**
 * What makes two parts the same repository: the GitHub 'owner/repo' in lower case, else the
 * trimmed address in lower case; null for a part with no address (private parts never clash).
 */
const repoIdentity = (url: string | undefined): string | null =>
  url?.trim() ? (repoPathOf(url) ?? url.trim()).toLowerCase() : null;

/** True when a list of identities holds one twice. */
const hasRepeats = (values: readonly (string | null | undefined)[]): boolean => {
  const present = values.filter((value): value is string => Boolean(value));
  return new Set(present).size < present.length;
};

/** What Studio says for each check, exported so the tests read the same words. */
export const PART_MESSAGES = {
  oneOnly: 'List two or more parts, or leave this empty. One part never shows on the site.',
  sameRepo: 'Two parts have the same repository.',
  sameProject: 'Two parts point at the same project page.',
  selfReference: 'A project cannot be a part of itself.',
  tooMany: `More than ${PART_LIMITS.soft} parts reads as a list of repositories, not a system. Keep the ones a visitor needs.`,
  mainMissing:
    'Add the main repository (GitHub URL above) as a part too, so the section shows the whole system and "N repos" matches its rows.',
  repoShapedName:
    'This looks like a repository name. For a private repository, write what it is ("Core platform") instead.',
  ignoredTech:
    'Ignored while "Its own project page" is set: that project\'s own card answers its filter.',
  summaryAlone: 'This sentence shows only with two or more parts.',
} as const;

/**
 * Warns about a name shaped like 'owner/repo' on a part with no address: that is how a private
 * repository's name would slip onto the page.
 */
export function warnRepoShapedName(
  name: string | undefined,
  context: ValidationContext,
): CustomValidatorResult {
  const part = context.parent as PartValue | undefined;
  return name && !part?.repoUrl?.trim() && looksLikeRepoSlug(name)
    ? PART_MESSAGES.repoShapedName
    : true;
}

/** Refuses a page link to the edited project itself, whichever of its ids Studio is editing. */
export function rejectSelfReference(
  ref: { readonly _ref?: string } | undefined,
  context: ValidationContext,
): CustomValidatorResult {
  const id = context.document?._id;
  return ref?._ref && id && ref._ref === publishedId(id) ? PART_MESSAGES.selfReference : true;
}

/** Warns that technologies typed on a part with a page link are ignored by the site. */
export function warnIgnoredTechnologies(
  techs: readonly unknown[] | undefined,
  context: ValidationContext,
): CustomValidatorResult {
  const part = context.parent as PartValue | undefined;
  return part?.project?._ref && techs?.length ? PART_MESSAGES.ignoredTech : true;
}

/**
 * Warns when a plain part's address is another project's GitHub repository: the part should
 * point at that project instead, so its row links the project's page and its filter stays its
 * own (the bookshelf.ts validateShelfTitle pattern). It asks Sanity nothing for a part that
 * already links a page or names no GitHub repository, and stays quiet when the lookup fails,
 * because it is only a nudge.
 */
export async function warnOtherProjectsRepo(
  url: string | undefined,
  context: ValidationContext,
): Promise<CustomValidatorResult> {
  const part = context.parent as PartValue | undefined;
  const id = context.document?._id;
  if (!url || !id || part?.project?._ref || !repoPathOf(url)) return true;
  const published = publishedId(id);
  try {
    const others = await context
      .getClient({ apiVersion: PARTS_API_VERSION })
      .fetch<unknown>(
        OTHER_PROJECT_REPOS_QUERY,
        { published, draft: `${DRAFT_PREFIX}${published}` },
        { signal: context.signal, tag: 'validation.project-part-repo' },
      );
    const owner = Array.isArray(others)
      ? (others as readonly { readonly title?: unknown; readonly githubUrl?: unknown }[]).find(
          (other) => typeof other?.githubUrl === 'string' && isSameRepo(other.githubUrl, url),
        )
      : undefined;
    if (!owner) return true;
    const title = typeof owner.title === 'string' && owner.title.trim() ? owner.title : null;
    return `This is ${title ?? 'another project'}'s repository. Pick that project under "Its own project page" instead.`;
  } catch {
    return true;
  }
}

/** The list's errors: exactly one part, two parts on one repository, two on one project page. */
export function partsListErrors(value: unknown): CustomValidatorResult {
  const parts = partsOf(value);
  if (parts.length > 0 && parts.length < MIN_PARTS) return PART_MESSAGES.oneOnly;
  if (hasRepeats(parts.map((part) => repoIdentity(part?.repoUrl)))) return PART_MESSAGES.sameRepo;
  if (hasRepeats(parts.map((part) => part?.project?._ref))) return PART_MESSAGES.sameProject;
  return true;
}

/**
 * The list's warnings: more parts than a visitor reads as one system, and a main repository no
 * part lists. An organisation-root GitHub URL names no repository (repoPathOf answers null), so
 * it never asks for one.
 */
export function partsListWarnings(
  value: unknown,
  context: ValidationContext,
): CustomValidatorResult {
  const parts = partsOf(value);
  if (parts.length > PART_LIMITS.soft) return PART_MESSAGES.tooMany;
  const main = context.document?.githubUrl;
  const mainUrl = typeof main === 'string' ? main : undefined;
  if (
    parts.length >= MIN_PARTS &&
    repoPathOf(mainUrl) &&
    !parts.some((part) => isSameRepo(part?.repoUrl, mainUrl))
  ) {
    return PART_MESSAGES.mainMissing;
  }
  return true;
}

/** Warns about a lead sentence on a project the site shows no section for. */
export function warnSummaryWithoutParts(
  summary: string | undefined,
  context: ValidationContext,
): CustomValidatorResult {
  return summary?.trim() && partsOf(context.document?.systemParts).length < MIN_PARTS
    ? PART_MESSAGES.summaryAlone
    : true;
}

/** "github.com/example-org/example-repo" for the collapsed row: the address without its scheme. */
const shortAddress = (url: unknown): string => String(url).replace(/^https?:\/\/(www\.)?/u, '');

/** The two fields, placed right after githubUrl in project.ts. */
export const systemPartsFields = () => [
  defineField({
    name: 'systemParts',
    title: 'How it fits together',
    type: 'array',
    description:
      'Only for a project made of several repositories that work together. List every part, the main repository (GitHub URL above) included, in the order a visitor should meet them: what people use first, then what it calls. Two or more, or leave it empty; a one-repository project stays exactly as it is. Everything here is public, even what the page does not link: anyone can read this dataset and /api/v1/sanity/projects, so describe a private repository by what it is and leave its address empty. Parts never change the home page\'s "Latest work" or /media, which read the GitHub URL only.',
    of: [
      {
        type: 'object',
        name: 'projectPart',
        title: 'Part',
        fields: [
          defineField({
            name: 'name',
            title: 'Name',
            type: 'string',
            description:
              'What a visitor would call it: "Web app", "Browser extension", "Scraper API". For a private repository, say what it is ("Core platform"), never its repository name.',
            validation: (Rule) => [
              Rule.required().max(PART_LIMITS.name),
              Rule.custom(warnRepoShapedName).warning(),
            ],
          }),
          defineField({
            name: 'role',
            title: 'What it does in the system',
            type: 'string',
            description:
              'One line, in terms of the other parts: "Fetches pages for the web app and the extension."',
            validation: (Rule) => Rule.required().max(PART_LIMITS.role),
          }),
          defineField({
            name: 'repoUrl',
            title: 'Public repository',
            type: 'url',
            description:
              'A public repository only, e.g. https://github.com/example-org/example-repo. Leave it empty for a private one: the row then says "Private repository". Never paste a private repository\'s address here, not even to keep it unlinked: publishing makes it readable by anyone.',
            validation: (Rule) => [
              Rule.uri({ scheme: ['https'] }),
              Rule.custom(warnOtherProjectsRepo).warning(),
            ],
          }),
          defineField({
            name: 'project',
            title: 'Its own project page',
            type: 'reference',
            to: [{ type: 'project' }],
            // Weak, so deleting or unpublishing that project is never blocked; the row then
            // renders without a link.
            weak: true,
            description:
              "Only when this part also has its own page on /projects: the row's name links there. Leave Technologies empty; that project's own card answers its filter.",
            options: {
              disableNew: true,
              filter: ({ document }) => {
                const published = publishedId(document._id);
                return {
                  filter: '!(_id in [$published, $draft])',
                  params: { published, draft: `${DRAFT_PREFIX}${published}` },
                };
              },
            },
            validation: (Rule) => Rule.custom(rejectSelfReference),
          }),
          defineField({
            name: 'technologies',
            title: 'Technologies',
            type: 'array',
            of: [{ type: 'string' }],
            description:
              "This part's own stack, spelled as in the project's Technologies. It joins the project's Technology filter on /projects and its Built with list.",
            hidden: ({ parent }) => Boolean(parent?.project?._ref) && !parent?.technologies?.length,
            validation: (Rule) => [Rule.unique(), Rule.custom(warnIgnoredTechnologies).warning()],
          }),
          defineField({
            name: 'contribution',
            title: 'My part',
            type: 'text',
            rows: 2,
            description:
              'Optional. What you built here, plainly: "Sole author." or "The scraper and the PWA, in a team of five." Public.',
            validation: (Rule) => Rule.max(PART_LIMITS.contribution),
          }),
        ],
        preview: {
          select: { title: 'name', role: 'role', repoUrl: 'repoUrl', page: 'project.title' },
          prepare: ({ title, role, repoUrl, page }) => ({
            title,
            subtitle: [
              page ? `→ ${page}` : null,
              repoUrl ? shortAddress(repoUrl) : page ? null : 'No link (private)',
              role,
            ]
              .filter(Boolean)
              .join(' · '),
          }),
        },
      },
    ],
    validation: (Rule) => [
      Rule.max(PART_LIMITS.max),
      Rule.custom(partsListErrors),
      Rule.custom(partsListWarnings).warning(),
    ],
  }),
  defineField({
    name: 'systemSummary',
    title: 'How it fits together: lead sentence',
    type: 'text',
    rows: 2,
    description:
      'Optional. One or two sentences a visitor reads before the parts: who uses which part, and what it sends where. "Students study in the web app or the browser extension; both send pages to one scraper API." Public.',
    validation: (Rule) => [
      Rule.max(PART_LIMITS.summary),
      Rule.custom(warnSummaryWithoutParts).warning(),
    ],
  }),
];
