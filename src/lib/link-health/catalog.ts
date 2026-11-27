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

import 'server-only';

import { nyToday } from '@/app/_components/home/data/format';
import { loadMediaFeed } from '@/app/(routes)/(dev)/media/_lib/load-feed';
import type { FeedKind } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { loadBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { linkedHrefs } from '@/app/(routes)/(main)/(professioal)/experience/_lib/linked-text';
import { buildRoleStory } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-story';
import { safeHref } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-links';
import { orderProjects } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-order';
import { partRepoHrefs } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-parts';
import { ensureBaseError } from '@/classes/error';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import { createStaleCache, type StaleCache } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import { loadCertifications, loadExperiences, loadProjects } from '@/lib/sanity/loaders';
import type { LinkHealthScope } from './types';
import { normalizeLinkUrl } from './url';

/**
 * A fixed, bounded allowlist of links the published pages actually offer. It bounds the public
 * allowlist and the probe load, so it is not raised when a scope outgrows it: the links past it
 * (in page order) go unchecked and unbadged, and buildCatalog reports that as a warning.
 */
const MAX_CATALOG_LINKS = 500;
const CATALOG_CACHE_KEY = 'link-health.catalog.v1';
const CATALOG_TTL_MS = 60_000;
const catalogCache = (): StaleCache<readonly string[]> =>
  processGlobal(CATALOG_CACHE_KEY, () =>
    createStaleCache<readonly string[]>({ ttlMs: CATALOG_TTL_MS, now: () => Date.now() }),
  );

/** Forgets cached catalogs and in-flight work between tests. */
export function resetLinkCatalogCache(): void {
  resetProcessGlobal(CATALOG_CACHE_KEY);
}

/** Platform-managed upload rows are outside the requested content-link health scope. */
const CONTENT_KINDS: ReadonlySet<FeedKind> = new Set(['post', 'article', 'talk', 'presentation']);
const IMAGE_HOSTS = new Set([
  'avatars.githubusercontent.com',
  'cdn.discordapp.com',
  'i.scdn.co',
  'i.ytimg.com',
  'img.youtube.com',
  'media.licdn.com',
]);
const PROFILE_HOSTS = new Set([
  'dev.to',
  'facebook.com',
  'instagram.com',
  'twitch.tv',
  'twitter.com',
  'x.com',
]);

/**
 * Obvious service/profile pages and image infrastructure are not content health targets.
 * Keep content URLs on the same hosts: GitHub repositories, LinkedIn articles, selected talk
 * videos, and Google/Sanity-hosted slides or credential files remain eligible.
 */
function isStableDestination(href: string): boolean {
  const url = new URL(href);
  const host = url.hostname.replace(/^www\./u, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (IMAGE_HOSTS.has(host) || (host === 'cdn.sanity.io' && parts[0] === 'images')) return true;
  if (host === 'spotify.com' || host.endsWith('.spotify.com')) return true;
  if (host === 'maps.google.com' || host === 'maps.app.goo.gl') return true;
  if (host === 'github.com')
    return parts.length < 2 || parts[0] === 'orgs' || parts[0] === 'sponsors';
  if (host === 'linkedin.com')
    return parts.length === 0 || ['in', 'company', 'school'].includes(parts[0] ?? '');
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    return (
      parts.length === 0 ||
      ['channel', 'user', 'c'].includes(parts[0] ?? '') ||
      (parts[0]?.startsWith('@') ?? false)
    );
  }
  if (host === 'youtu.be') return parts.length === 0;
  return PROFILE_HOSTS.has(host) && parts.length < 2;
}

async function renderedTargets(scope: LinkHealthScope): Promise<readonly (string | null)[]> {
  switch (scope) {
    case 'projects':
      // These are the same two helpers/fields used by the list and CaseLinks, without loading images,
      // then the repository links a project page's "How it fits together" section draws (the same
      // threshold and safeHref rule), so each of their badges has an entry; a private part has no
      // link and is never probed.
      return orderProjects(await loadProjects()).flatMap(({ item }) => [
        safeHref(item.liveUrl),
        safeHref(item.githubUrl),
        ...partRepoHrefs(item),
      ]);
    case 'certifications':
      // Featured entries are also in entries. Stored files are links even when verifies is false.
      return buildLedger(await loadCertifications()).entries.map(
        (entry) => entry.link?.href ?? null,
      );
    case 'media': {
      // The published feed already merges/deduplicates blog sources and chooses each row's primary
      // destination. Do not add unused video/slides/event fields or description pairing signals.
      const { entries } = await loadMediaFeed();
      return entries.flatMap((entry) => [
        CONTENT_KINDS.has(entry.kind) ? entry.href : null,
        entry.pair && CONTENT_KINDS.has(entry.pair.kind) ? entry.pair.href : null,
      ]);
    }
    case 'experience': {
      // Uses the same New York day/listed-role rule as the pages; future/unlisted roles have no URLs.
      const story = buildRoleStory(await loadExperiences(), { today: nyToday() });
      return story.chapters.flatMap((chapter) =>
        chapter.stops.flatMap(({ row, prose }) => [
          // Detail Organization checks the original value without trimming before deciding to link it.
          row.companyUrl && /^https?:\/\//iu.test(row.companyUrl) ? row.companyUrl : null,
          ...row.links.map((link) => link.href),
          ...(row.subRoles ?? []).flatMap((subRole) => subRole.links.map((link) => link.href)),
          // The Story's inline links and detail chips deduplicate differently; collect both rendered sets.
          ...linkedHrefs(prose.sentence),
          ...linkedHrefs(prose.more),
          ...prose.duties.flatMap(linkedHrefs),
        ]),
      );
    }
    case 'bookshelf':
      // The catalog the pages render: books on a published shelf, each with the url its detail
      // view links (and badges) only when Studio has one. Empty Sanity data is an empty catalog.
      return (await loadBookshelfCatalog()).books.map((book) => book.url ?? null);
    default:
      throw new Error('Unknown link-health scope');
  }
}

/**
 * One warning that `scope` offers more distinct links than the catalog holds, naming how many
 * were left out. The catalog is rebuilt once a minute; the per-context cooldown keeps this to one
 * event per scope per window, and a context per scope keeps one scope from silencing another.
 */
function reportCappedCatalog(scope: LinkHealthScope, dropped: number): void {
  const more = `${dropped} more ${dropped === 1 ? 'link goes' : 'links go'} unchecked`;
  const summary = `The ${scope} link catalog is capped at ${MAX_CATALOG_LINKS} links: ${more}`;
  reportApiFailure(
    ensureBaseError(new Error(summary), 'link-health:catalog', {
      scope,
      kept: MAX_CATALOG_LINKS,
      dropped,
    }),
    { context: `link-health catalog cap (${scope})`, level: 'warning' },
  );
}

/**
 * Normalized, deduplicated destinations from published/validated page loaders, in page order,
 * at most MAX_CATALOG_LINKS of them; the distinct links past the cap are counted and reported.
 * No Places, Spotify, raw CMS scans, image generation or network probing. Loader failures remain
 * failures so the caller can fail closed rather than confuse an outage with an empty catalog.
 */
async function buildCatalog(scope: LinkHealthScope): Promise<readonly string[]> {
  const unique = new Set<string>();
  const dropped = new Set<string>();
  for (const target of await renderedTargets(scope)) {
    const href = normalizeLinkUrl(target);
    if (!href || isStableDestination(href) || unique.has(href)) continue;
    if (unique.size < MAX_CATALOG_LINKS) unique.add(href);
    else dropped.add(href);
  }
  if (dropped.size > 0) reportCappedCatalog(scope, dropped.size);
  return [...unique];
}

/** One process-wide load per scope/minute; a failed reload never authorizes an old catalog. */
export async function loadLinkCatalog(scope: LinkHealthScope): Promise<string[]> {
  const result = await catalogCache().get(scope, () => buildCatalog(scope));
  if (result.stale) throw result.error;
  return [...result.data];
}
