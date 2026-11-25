// @vitest-environment node
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
 * @file The sitemap lists every public page, then every project, experience and place page, from
 * the loaders the pages use:
 * - each detail page once, dated by the day its document last changed;
 * - only the roles /experience lists: one that has not begun by New York's month, or a current
 *   one with no readable start, has a page that answers 404, so it is left out;
 * - the list pages and /resume dated by their newest document, the other pages not dated at all;
 * - never a partial list: when the projects, experiences or places loader rejects (Sanity down,
 *   nothing cached), so does the sitemap;
 * - but the certifications and resume loads only date a page, so when one rejects the sitemap
 *   still lists every URL, that page undated, and the failure is reported as a warning.
 * The loaders are mocked with fixtures; isSanityDocumentId is the real one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeCertification,
  makeExperience,
  makePlace,
  makeProject,
  makeResume,
} from '@tests/fixtures/sanity-docs';
import type { MetadataRoute } from 'next';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const loaders = vi.hoisted(() => ({
  loadProjects: vi.fn(),
  loadExperiences: vi.fn(),
  loadPlaces: vi.fn(),
  loadCertifications: vi.fn(),
  loadResume: vi.fn(),
}));

const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));

// The real loaders module is loaded for isSanityDocumentId only: t3-env validates every variable
// on import, and the Sanity client is never asked for anything.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/client', () => ({ sanityFetchWithToken: vi.fn(), urlFor: vi.fn() }));
vi.mock('@/lib/sanity/loaders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sanity/loaders')>()),
  ...loaders,
}));
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  ...report,
}));

import { BOOK_SLUGS } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import * as sitemapModule from '@/app/sitemap';
import Sitemap, { revalidate } from '@/app/sitemap';

type Entry = MetadataRoute.Sitemap[number];

const ORIGIN = 'https://mikeodnis.dev';

/** The pages with a fixed URL, in the sitemap's order. */
const STATIC_PATHS = [
  '/',
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
];

/** A Sanity timestamp on `day`, at an hour that is still the previous day in US time zones. */
const at = (day: string): string => `${day}T03:15:00Z`;

// Out of date order, so the newest document is neither the first nor the last.
const PROJECTS = [
  makeProject({ _updatedAt: at('2026-02-10') }),
  makeProject({ _updatedAt: at('2026-07-04') }),
  makeProject({ _updatedAt: at('2026-01-20') }),
];
const EXPERIENCES = [
  makeExperience({ _updatedAt: at('2025-11-01') }),
  makeExperience({ _updatedAt: at('2026-03-15') }),
];
const PLACES = [
  makePlace({ _updatedAt: at('2026-05-19') }),
  makePlace({ _updatedAt: at('2026-09-30') }),
  makePlace({ _updatedAt: at('2026-06-01') }),
];
const CERTIFICATIONS = [
  makeCertification({ _updatedAt: at('2026-08-08') }),
  makeCertification({ _updatedAt: at('2024-12-31') }),
];
const RESUME = makeResume({ _updatedAt: at('2026-10-02') });

const DETAIL_DOCS = [
  ...PROJECTS.map((doc) => ({ section: 'projects', doc })),
  ...EXPERIENCES.map((doc) => ({ section: 'experience', doc })),
  ...PLACES.map((doc) => ({ section: 'places', doc })),
];

/** The page with `path` as the sitemap writes it ('/' is the bare origin). */
const urlOf = (path: string): string => (path === '/' ? ORIGIN : `${ORIGIN}${path}`);
const pathOf = (entry: Entry): string => new URL(entry.url).pathname;
const entryAt = (entries: readonly Entry[], path: string): Entry | undefined =>
  entries.find((entry) => pathOf(entry) === path);

beforeEach(() => {
  report.reportApiFailure.mockReset();
  loaders.loadProjects.mockReset().mockResolvedValue(PROJECTS);
  loaders.loadExperiences.mockReset().mockResolvedValue(EXPERIENCES);
  loaders.loadPlaces.mockReset().mockResolvedValue(PLACES);
  loaders.loadCertifications.mockReset().mockResolvedValue(CERTIFICATIONS);
  loaders.loadResume.mockReset().mockResolvedValue(RESUME);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('sitemap entries', () => {
  it('is regenerated at most once an hour, not rendered on every fetch', () => {
    expect(revalidate).toBe(3600);
    expect(sitemapModule).not.toHaveProperty('dynamic');
  });

  it('keeps `revalidate` a plain number literal in the source, which Next reads statically', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/sitemap.ts'), 'utf8');

    expect(source).toMatch(/^export const revalidate = 3600;$/m);
    expect(source).not.toMatch(/^export const dynamic\b/m);
  });

  it('lists every project, experience and place page once, dated by its own change', async () => {
    const entries = await Sitemap();

    for (const { section, doc } of DETAIL_DOCS) {
      const url = `${ORIGIN}/${section}/${doc._id}`;
      const matches = entries.filter((entry) => entry.url === url);
      expect(matches).toEqual([{ url, lastModified: doc._updatedAt.slice(0, 10) }]);
    }
  });

  it('dates each list page by its newest document and /resume by the resume', async () => {
    const entries = await Sitemap();

    expect(entryAt(entries, '/projects')?.lastModified).toBe('2026-07-04');
    expect(entryAt(entries, '/experience')?.lastModified).toBe('2026-03-15');
    expect(entryAt(entries, '/places')?.lastModified).toBe('2026-09-30');
    expect(entryAt(entries, '/places/photos')?.lastModified).toBe('2026-09-30');
    expect(entryAt(entries, '/certifications')?.lastModified).toBe('2026-08-08');
    expect(entryAt(entries, '/resume')?.lastModified).toBe('2026-10-02');
  });

  it('gives the other static pages no lastModified rather than the day of the request', async () => {
    const entries = await Sitemap();
    const undated = ['/', '/cookies', '/licenses', '/privacy', '/sponsor', '/media', '/stats'];

    for (const path of [...undated, '/spotify', '/guestbook', '/bookshelf']) {
      expect(entryAt(entries, path)).toEqual({ url: urlOf(path) });
    }
  });

  it('puts every URL on the site origin', async () => {
    for (const entry of await Sitemap()) {
      expect(new URL(entry.url).origin).toBe(ORIGIN);
    }
  });
});

describe('sitemap order', () => {
  it('lists the static pages in their fixed order, then the detail pages by URL', async () => {
    const paths = (await Sitemap()).map(pathOf);
    const details = paths.slice(STATIC_PATHS.length);

    expect(paths.slice(0, STATIC_PATHS.length)).toEqual(STATIC_PATHS);
    expect(details).toHaveLength(DETAIL_DOCS.length + BOOK_SLUGS.length);
    expect(details).toEqual([...details].sort());
  });

  it('lists a document the loader answers twice only once', async () => {
    loaders.loadProjects.mockResolvedValue([...PROJECTS, ...PROJECTS.slice(0, 1)]);

    const urls = (await Sitemap()).map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('sitemap and the places opsec rule (past visits only)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists no place that may still be on, and dates /places by past places only', async () => {
    // 13:00 ET on Nov 10, 2026: Nov 9 is over, Nov 10 is not.
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 10, 18, 0), toFake: ['Date'] });
    const today = makePlace({ startDate: '2026-11-10', _updatedAt: at('2026-11-10') });
    const toCome = makePlace({ startDate: '2026-12-01', _updatedAt: at('2026-11-10') });
    const undated = makePlace({ startDate: null, _updatedAt: at('2026-11-09') });
    loaders.loadPlaces.mockResolvedValue([...PLACES, today, toCome, undated]);

    const entries = await Sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const place of [today, toCome, undated]) {
      expect(urls).not.toContain(`${ORIGIN}/places/${place._id}`);
    }
    for (const place of PLACES) expect(urls).toContain(`${ORIGIN}/places/${place._id}`);
    expect(entryAt(entries, '/places')?.lastModified).toBe('2026-09-30');
    expect(entryAt(entries, '/places/photos')?.lastModified).toBe('2026-09-30');
  });
});

describe('sitemap and the experience rule (listed roles only)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists no role that has not begun in New York, and dates /experience by listed roles only', async () => {
    // 00:30 ET on Dec 1, 2026 (05:30 UTC): December has begun in New York, January has not.
    vi.useFakeTimers({ now: Date.UTC(2026, 11, 1, 5, 30), toFake: ['Date'] });
    const thisMonth = makeExperience({
      current: true,
      startDate: '2026-12-01',
      endDate: null,
      _updatedAt: at('2026-11-20'),
    });
    const toCome = makeExperience({
      current: true,
      startDate: '2027-01-04',
      endDate: null,
      _updatedAt: at('2026-11-30'),
    });
    const noStart = makeExperience({
      current: true,
      startDate: '',
      endDate: null,
      _updatedAt: at('2026-11-29'),
    });
    loaders.loadExperiences.mockResolvedValue([...EXPERIENCES, thisMonth, toCome, noStart]);

    const entries = await Sitemap();
    const urls = entries.map((entry) => entry.url);

    // The role pages that answer 404 (experience/[id]/page.tsx) are not asked to be crawled.
    expect(urls).not.toContain(`${ORIGIN}/experience/${toCome._id}`);
    expect(urls).not.toContain(`${ORIGIN}/experience/${noStart._id}`);
    for (const role of [...EXPERIENCES, thisMonth]) {
      expect(urls).toContain(`${ORIGIN}/experience/${role._id}`);
    }
    expect(entryAt(entries, '/experience')?.lastModified).toBe('2026-11-20');
  });
});

describe('sitemap edge cases', () => {
  it('leaves out a document whose id no detail page looks up (it would answer 404)', async () => {
    const odd = makeProject({ _id: 'not a sanity id' });
    loaders.loadProjects.mockResolvedValue([...PROJECTS, odd]);

    const urls = (await Sitemap()).map((entry) => entry.url);

    expect(urls.filter((url) => url.includes('sanity'))).toEqual([]);
    expect(urls.filter((url) => url.startsWith(`${ORIGIN}/projects/`))).toHaveLength(
      PROJECTS.length,
    );
  });

  it('dates no page by a timestamp that does not start with a day', async () => {
    const undated = makePlace({ _updatedAt: 'yesterday' });
    loaders.loadPlaces.mockResolvedValue([undated]);

    const entries = await Sitemap();

    expect(entryAt(entries, `/places/${undated._id}`)).toEqual({
      url: `${ORIGIN}/places/${undated._id}`,
    });
    expect(entryAt(entries, '/places')).toEqual({ url: urlOf('/places') });
  });

  it('dates nothing for an empty collection or when no resume is active', async () => {
    loaders.loadProjects.mockResolvedValue([]);
    loaders.loadResume.mockResolvedValue(null);

    const entries = await Sitemap();

    expect(entryAt(entries, '/projects')).toEqual({ url: urlOf('/projects') });
    expect(entryAt(entries, '/resume')).toEqual({ url: urlOf('/resume') });
    expect(entries.map(pathOf).filter((path) => path.startsWith('/projects/'))).toEqual([]);
  });

  it.each(['loadProjects', 'loadExperiences', 'loadPlaces'] as const)(
    'rejects instead of answering a partial sitemap when %s rejects',
    async (loader) => {
      const outage = new Error('Sanity answered 503');
      loaders[loader].mockRejectedValue(outage);

      await expect(Sitemap()).rejects.toBe(outage);
    },
  );

  it.each([
    ['loadCertifications', '/certifications'],
    ['loadResume', '/resume'],
  ] as const)(
    'still lists every page when %s rejects, leaving %s undated',
    async (loader, path) => {
      const full = await Sitemap();
      expect(entryAt(full, path)?.lastModified).toBeDefined();
      // An outage with nothing cached, a broken query, or (loadResume) an outage whose last good
      // answer was "no active resume": each rejects.
      const outage = new Error('Sanity answered 503');
      loaders[loader].mockRejectedValue(outage);

      const entries = await Sitemap();

      expect(entries).toEqual(
        full.map((entry) => (pathOf(entry) === path ? { url: entry.url } : entry)),
      );
      expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
      expect(report.reportApiFailure).toHaveBeenCalledWith(
        outage,
        expect.objectContaining({ level: 'warning' }),
      );
    },
  );

  it('reports nothing when every loader answers', async () => {
    await Sitemap();

    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });
});
