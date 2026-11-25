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
 * @file /sitemap.xml: every public page, then every project, experience and place page.
 *
 * It is built from the loaders the pages use, and with the rules the pages use (past places
 * only, roles from their first month), so it lists the detail pages that answer 200. It is
 * regenerated at most once an hour (ISR, `revalidate`), not on every crawler's fetch: `next
 * build` renders it once from Sanity, and after an hour the next fetch is served the cached copy
 * while one fresh render runs in the background. A new project, role or past place therefore
 * appears within about an hour, and a role or place that turns listable on a new day as well.
 *
 * When Sanity fails with nothing cached for projects, experiences or places, that loader rejects
 * and so does the render: the build fails rather than ship a sitemap without the detail URLs
 * (which would read as those pages being gone), and a failed hourly render keeps serving the last
 * good copy. The certifications and resume loads only date /certifications and /resume, so their
 * failure is reported and those two entries go out without a lastModified: every URL is still
 * listed.
 */

import type { MetadataRoute } from 'next';
import { nyToday } from '@/app/_components/home/data/format';
import { BOOK_SLUGS } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { loadPastPlaces } from '@/app/(routes)/(main)/(personal)/places/_lib/past-place-loaders';
import { listedExperiences } from '@/app/(routes)/(main)/(professioal)/experience/_lib/listed-role';
import { app } from '@/constants/app';
import { reportApiFailure } from '@/lib/observability/report';
import {
  isSanityDocumentId,
  loadCertifications,
  loadExperiences,
  loadProjects,
  loadResume,
} from '@/lib/sanity/loaders';

/**
 * Regenerate at most once an hour (seconds). It used to render on every fetch (force-dynamic),
 * running five Sanity loaders per crawler request. A literal, as Next reads it statically.
 */
export const revalidate = 3600;

type SitemapEntry = MetadataRoute.Sitemap[number];

/** The system fields of a Sanity document that the sitemap reads. */
interface DocumentStamp {
  readonly _id: string;
  readonly _updatedAt: string;
}

/** Every page with a fixed URL, in the order the sitemap lists them ('' is the home page). */
const STATIC_ROUTES = [
  '',
  '/cookies',
  '/licenses',
  '/privacy',
  '/sponsor',
  '/media',
  '/projects',
  '/certifications',
  '/resume',
  '/spotify',
  '/stats',
  '/experience',
  '/guestbook',
  '/bookshelf',
  '/places',
  '/places/photos',
] as const;

type StaticRoute = (typeof STATIC_ROUTES)[number];

/** The list pages whose documents each have a page at `<list>/<_id>`. */
type DetailSection = '/projects' | '/experience' | '/places';

/** A calendar day, the W3C date form the sitemap protocol accepts. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_DAY_LENGTH = 'YYYY-MM-DD'.length;

/** The day a document last changed, or undefined when its timestamp does not start with one. */
function dayOf(doc: DocumentStamp): string | undefined {
  const day = doc._updatedAt.slice(0, CALENDAR_DAY_LENGTH);
  return CALENDAR_DAY.test(day) ? day : undefined;
}

/** The day the newest of `docs` changed, or undefined when none has a day. */
function newestDay(docs: readonly DocumentStamp[]): string | undefined {
  return docs.reduce<string | undefined>((newest, doc) => {
    const day = dayOf(doc);
    return day !== undefined && (newest === undefined || day > newest) ? day : newest;
  }, undefined);
}

/** One sitemap entry; a page with no known change date gets no lastModified at all. */
function entryFor(path: string, lastModified: string | undefined): SitemapEntry {
  const url = `${app.url}${path}`;
  return lastModified === undefined ? { url } : { url, lastModified };
}

/**
 * The page of each document in `docs`. An id the loaders never look up (see isSanityDocumentId)
 * has no page that answers 200, so it is left out.
 */
function detailEntries(section: DetailSection, docs: readonly DocumentStamp[]): SitemapEntry[] {
  return docs
    .filter((doc) => isSanityDocumentId(doc._id))
    .map((doc) => entryFor(`${section}/${encodeURIComponent(doc._id)}`, dayOf(doc)));
}

const byUrl = (a: SitemapEntry, b: SitemapEntry): number => {
  if (a.url === b.url) return 0;
  return a.url < b.url ? -1 : 1;
};

/** `entries` sorted by URL, each URL once. */
function sortedUnique(entries: readonly SitemapEntry[]): SitemapEntry[] {
  const unique = new Map(entries.map((entry) => [entry.url, entry]));
  return [...unique.values()].sort(byUrl);
}

/**
 * What `load` answers, or undefined when it rejects, after reporting the failure as a warning.
 * Only for a load that dates a page the sitemap lists anyway: losing it costs that page its
 * lastModified, not its URL, so failing the whole sitemap over it would drop every detail URL.
 */
async function loadDateSource<T>(
  load: () => Promise<T>,
  collection: string,
): Promise<T | undefined> {
  try {
    return await load();
  } catch (error) {
    reportApiFailure(error, { context: `date ${collection} in the sitemap`, level: 'warning' });
    return undefined;
  }
}

/**
 * Generates sitemap.xml.
 *
 * @returns The static pages in their fixed order, then every detail page sorted by URL.
 *
 * @remarks
 * - A detail page's lastModified is the day its document last changed. /projects, /experience,
 *   /places and /certifications take their newest document's day, and /resume its resume's.
 * - The other static pages have no lastModified, rather than one claiming they changed on the
 *   day of the request.
 * - Rejects when the projects, experiences or places loader does (Sanity down with nothing
 *   cached), never answering a partial list. A failed certifications or resume load only leaves
 *   /certifications or /resume undated.
 */
export default async function Sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, allExperiences, places, certifications, resume] = await Promise.all([
    loadProjects(),
    loadExperiences(),
    // Past visits only (the owner's rule): a visit still on has no page, URL or date here.
    loadPastPlaces(),
    loadDateSource(loadCertifications, 'certifications'),
    loadDateSource(loadResume, 'resume'),
  ]);
  // The roles /experience lists on New York's day: a role yet to begin has a page that answers
  // 404 (experience/[id]/page.tsx), so it has no URL or date here until its first month.
  const experiences = listedExperiences(allExperiences, nyToday());

  const lastModifiedOf: Partial<Record<StaticRoute, string>> = {
    '/projects': newestDay(projects),
    '/experience': newestDay(experiences),
    '/places': newestDay(places),
    // The photos of the same past places: dated as their list is.
    '/places/photos': newestDay(places),
    '/certifications': certifications ? newestDay(certifications) : undefined,
    '/resume': resume ? dayOf(resume) : undefined,
  };

  return [
    ...STATIC_ROUTES.map((route) => entryFor(route, lastModifiedOf[route])),
    ...sortedUnique([
      ...BOOK_SLUGS.map((slug) => entryFor(`/bookshelf/${encodeURIComponent(slug)}`, undefined)),
      ...detailEntries('/projects', projects),
      ...detailEntries('/experience', experiences),
      ...detailEntries('/places', places),
    ]),
  ];
}
