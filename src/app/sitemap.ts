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
 * It renders on request from the loaders the pages use, so it lists the detail pages that answer
 * 200 right now, and `next build` never asks Sanity. The loaders keep each collection in memory
 * for a few minutes, so a crawler's fetch costs no Sanity request in the steady state.
 *
 * When Sanity fails with nothing cached for projects, experiences or places, that loader rejects
 * and so does this route (HTTP 500). Crawlers retry a failed sitemap, whereas a sitemap without
 * the detail URLs would read as those pages being gone. The certifications and resume loads only
 * date /certifications and /resume, so their failure is reported and those two entries go out
 * without a lastModified: every URL is still listed.
 */

import type { MetadataRoute } from 'next';
import { loadPastPlaces } from '@/app/(routes)/(main)/(personal)/places/_lib/past-place-loaders';
import { app } from '@/constants/app';
import { reportApiFailure } from '@/lib/observability/report';
import {
  isSanityDocumentId,
  loadCertifications,
  loadExperiences,
  loadProjects,
  loadResume,
} from '@/lib/sanity/loaders';

/** Render per request: a build-time sitemap would freeze the detail URLs and need Sanity. */
export const dynamic = 'force-dynamic';

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
  '/places',
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
  const [projects, experiences, places, certifications, resume] = await Promise.all([
    loadProjects(),
    loadExperiences(),
    // Past visits only (the owner's rule): a visit still on has no page, URL or date here.
    loadPastPlaces(),
    loadDateSource(loadCertifications, 'certifications'),
    loadDateSource(loadResume, 'resume'),
  ]);

  const lastModifiedOf: Partial<Record<StaticRoute, string>> = {
    '/projects': newestDay(projects),
    '/experience': newestDay(experiences),
    '/places': newestDay(places),
    '/certifications': certifications ? newestDay(certifications) : undefined,
    '/resume': resume ? dayOf(resume) : undefined,
  };

  return [
    ...STATIC_ROUTES.map((route) => entryFor(route, lastModifiedOf[route])),
    ...sortedUnique([
      ...detailEntries('/projects', projects),
      ...detailEntries('/experience', experiences),
      ...detailEntries('/places', places),
    ]),
  ];
}
