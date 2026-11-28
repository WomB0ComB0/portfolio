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
 * @file /sitemap.xml: every public page, then every project, experience, place, book and
 * bookshelf shelf page.
 *
 * It is built from the loaders the pages use, and with the rules the pages use (past places
 * only, roles from their first month, books on a published shelf, shelves with books), so it
 * lists the detail pages that answer 200. It renders on request (`dynamic`), and Vercel's CDN
 * keeps each answer for up to an hour (src/config/sitemap-cache.ts), so a crawler's fetch is
 * served from the cache and each region renders it about once an hour. A new project, role, past
 * place, book or shelf therefore appears within about an hour (plus the loaders' few minutes of
 * caching), and a role or place that turns listable on a new day as well. It is not prerendered:
 * with Next's build adapter on Vercel, a prerendered sitemap with `revalidate` ships as a static
 * file that only a new deploy replaces (vercel/next.js#99055).
 *
 * When Sanity fails with nothing cached for projects, experiences, places or the bookshelf, that
 * loader rejects and so does the render: the request fails rather than answer a sitemap without
 * the detail URLs (which would read as those pages being gone). An error is never cached, and the
 * CDN serves the last good copy for up to a day instead (stale-if-error), so the next fetch tries
 * again. The certifications and resume loads only date /certifications and
 * /resume, so their failure is reported and those two entries go out without a lastModified:
 * every URL is still listed.
 */

import type { MetadataRoute } from 'next';
import { nyToday } from '@/app/_components/home/data/format';
import {
  type BookshelfCatalog,
  loadBookshelfCatalog,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
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
 * Render on request, never at build time. `revalidate` would prerender it, and on Vercel a
 * prerendered sitemap is a static file that never refreshes (see the file comment); the CDN
 * header in src/config/sitemap-cache.ts keeps crawlers from running its Sanity loaders on
 * every fetch. A literal, as Next reads it statically.
 */
export const dynamic = 'force-dynamic';

type SitemapEntry = MetadataRoute.Sitemap[number];

/** When something last changed: a Sanity document's `_updatedAt` (ISO 8601). */
interface ChangeStamp {
  readonly _updatedAt: string;
}

/** The system fields of a Sanity document that the sitemap reads. */
interface DocumentStamp extends ChangeStamp {
  readonly _id: string;
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
function dayOf(doc: ChangeStamp): string | undefined {
  const day = doc._updatedAt.slice(0, CALENDAR_DAY_LENGTH);
  return CALENDAR_DAY.test(day) ? day : undefined;
}

/** The day the newest of `docs` changed, or undefined when none has a day. */
function newestDay(docs: readonly ChangeStamp[]): string | undefined {
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

/** A book's or shelf's last change (the catalog's `updatedAt`) as a stamp. */
const stampOf = ({ updatedAt }: { readonly updatedAt: string }): ChangeStamp => ({
  _updatedAt: updatedAt,
});

/** The bookshelf's change stamps: every book and every shelf in the catalog. */
const bookshelfStamps = (catalog: BookshelfCatalog): ChangeStamp[] =>
  [...catalog.books, ...catalog.shelves].map(stampOf);

/**
 * Each book's page, dated by its document, and each shelf's page (the catalog holds only shelves
 * with books), dated by the newest of the shelf and its books: a book added to a shelf changes
 * what the shelf's page shows.
 */
function bookshelfEntries(catalog: BookshelfCatalog): SitemapEntry[] {
  const bookBySlug = new Map(catalog.books.map((book) => [book.slug, book]));
  return [
    ...catalog.books.map((book) =>
      entryFor(`/bookshelf/${encodeURIComponent(book.slug)}`, dayOf(stampOf(book))),
    ),
    ...catalog.shelves.map((shelf) => {
      const books = shelf.bookSlugs.flatMap((slug) => bookBySlug.get(slug) ?? []);
      const lastModified = newestDay([shelf, ...books].map(stampOf));
      return entryFor(`/bookshelf/shelf/${encodeURIComponent(shelf.slug)}`, lastModified);
    }),
  ];
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
 * - A detail page's lastModified is the day its document last changed; a bookshelf shelf's page
 *   takes the newest of its shelf and books. /projects, /experience, /places, /bookshelf and
 *   /certifications take their newest document's day, and /resume its resume's.
 * - The other static pages have no lastModified, rather than one claiming they changed on the
 *   day of the request.
 * - Rejects when the projects, experiences, places or bookshelf loader does (Sanity down with
 *   nothing cached), never answering a partial list. A failed certifications or resume load only
 *   leaves /certifications or /resume undated.
 */
export default async function Sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, allExperiences, places, bookshelf, certifications, resume] = await Promise.all([
    loadProjects(),
    loadExperiences(),
    // Past visits only (the owner's rule): a visit still on has no page, URL or date here.
    loadPastPlaces(),
    // Books on a published shelf and shelves with books: the pages that answer 200.
    loadBookshelfCatalog(),
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
    '/bookshelf': newestDay(bookshelfStamps(bookshelf)),
    '/certifications': certifications ? newestDay(certifications) : undefined,
    '/resume': resume ? dayOf(resume) : undefined,
  };

  return [
    ...STATIC_ROUTES.map((route) => entryFor(route, lastModifiedOf[route])),
    ...sortedUnique([
      ...bookshelfEntries(bookshelf),
      ...detailEntries('/projects', projects),
      ...detailEntries('/experience', experiences),
      ...detailEntries('/places', places),
    ]),
  ];
}
