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
 * @file The server Sanity loaders pages read: one stale-on-error cache per collection per server
 * process, shared with /api/v1/sanity/*, then per-document decoding.
 * - Within the TTL, pages and the API route share one Sanity request per collection per process,
 *   even when Next loads this module once for route handlers and once for pages.
 * - When Sanity fails after a good load, pages get the last good list plus one warning.
 * - When Sanity fails with nothing cached, the loader rejects with the getter's BaseError and
 *   reports nothing itself (Next reports page errors). So does loadResume when the only resume
 *   answer cached is a stale "none".
 * - Invalid CMS documents are dropped and listed in one warning instead of failing the page.
 * - By-id lookups never send a malformed id to Sanity.
 * Only the Sanity client, the YouTube integration, the env and Sentry are mocked.
 */

import { makeExperience, makePlace, makeProject, makeResume } from '@tests/fixtures/sanity-docs';
import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanityRoutes } from '@/app/api/v1/[[...route]]/sanity';
import { isBaseError } from '@/classes/error';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import {
  isSanityDocumentId,
  loadExperienceById,
  loadFeaturedProjects,
  loadPlaceById,
  loadPlaces,
  loadProjectById,
  loadProjects,
  loadResume,
  loadVideos,
  resetSanityLoaderCaches,
  SANITY_CACHE_TTL_MS,
} from '@/lib/sanity/loaders';
import { logger } from '@/utils';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));
const youtube = vi.hoisted(() => ({
  fetchChannelVideos: vi.fn(),
  fetchYouTubeVideoMetadataBatch: vi.fn(),
}));
const envValues = vi.hoisted((): Record<string, string | undefined> => ({ NODE_ENV: 'test' }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/sanity/client', () => sanity);
vi.mock('@/lib/api-integrations/youtube', () => youtube);
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? envValues[key] : undefined),
  });
  return { env, default: env };
});

const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const AFTER_TTL = SANITY_CACHE_TTL_MS + 1;
const FRESH_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

const sanityDown = () => new Error('Sanity answered 502 Bad Gateway');

/** A Sanity request that answers only when the test says so. */
const deferredAnswer = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/**
 * Another copy of loaders.ts and everything it imports, as Next loads one for route handlers and
 * another for pages in the same Node process.
 */
const loadModuleCopy = async () => {
  vi.resetModules();
  return import('@/lib/sanity/loaders');
};

const apiGet = (path: string) =>
  new Elysia({ prefix: '/api/v1' })
    .use(sanityRoutes)
    .handle(new Request(`http://localhost/api/v1/sanity${path}`));

const expectOneReport = (level: 'warning' | 'error', context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level, tags: { 'api.context': context } }),
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockReset();
  sanity.sanityFetchWithToken.mockReset();
  youtube.fetchChannelVideos.mockReset();
  youtube.fetchYouTubeVideoMetadataBatch.mockReset();
  envValues.YOUTUBE_SERVER_API_KEY = undefined;
  envValues.NEXT_PUBLIC_FIREBASE_API_KEY = undefined;
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loadProjects', () => {
  it('answers the decoded documents in GROQ order and reuses them within the TTL', async () => {
    const projects = [makeProject({ order: 3 }), makeProject({ order: 1 }), makeProject()];
    sanity.sanityFetchWithToken.mockResolvedValue(projects);

    const first = await loadProjects();
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS - 1);
    const second = await loadProjects();

    expect(first).toEqual(projects);
    expect(second).toEqual(projects);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers the last good list and sends one warning when Sanity fails past the TTL', async () => {
    const projects = [makeProject(), makeProject()];
    sanity.sanityFetchWithToken.mockResolvedValueOnce(projects);
    await loadProjects();

    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const stale = await loadProjects();
    const again = await loadProjects();

    expect(stale).toEqual(projects);
    expect(again).toEqual(projects);
    expectOneReport('warning', 'load projects for pages');
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      command: 'sanity:projects',
      cause: expect.objectContaining({ message: 'Sanity answered 502 Bad Gateway' }),
    });
  });

  it("rejects with the getter's BaseError and reports nothing when nothing is cached", async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());

    const error = await loadProjects().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(isBaseError(error)).toBe(true);
    expect(error).toMatchObject({ command: 'sanity:projects' });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers a real empty list without reporting', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([]);

    expect(await loadProjects()).toEqual([]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('the API route and the pages', () => {
  it('share one Sanity request per collection within the TTL in one process', async () => {
    const projects = [makeProject(), makeProject()];
    sanity.sanityFetchWithToken.mockResolvedValue(projects);

    const fromPages = await loadProjects();
    const res = await apiGet('/projects');

    expect(fromPages).toEqual(projects);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(FRESH_CACHE_CONTROL);
    expect(await res.json()).toEqual(projects);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('serve the raw answer from the API even when a page drops an invalid document', async () => {
    const valid = makePlace();
    const workshop = { ...makePlace(), category: 'Workshop' };
    sanity.sanityFetchWithToken.mockResolvedValue([valid, workshop]);

    const res = await apiGet('/places');
    const fromPages = await loadPlaces();

    expect(await res.json()).toEqual([valid, workshop]);
    expect(fromPages).toEqual([valid]);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('share one Sanity request when the route and the pages load separate module copies', async () => {
    const projects = [makeProject(), makeProject()];
    sanity.sanityFetchWithToken.mockResolvedValue(projects);
    const routeCopy = await loadModuleCopy();
    const pageCopy = await loadModuleCopy();

    const fromRoute = await routeCopy.readProjects();
    const fromPages = await pageCopy.loadProjects();

    expect(pageCopy.readProjects).not.toBe(routeCopy.readProjects);
    expect(fromRoute).toEqual({ stale: false, data: projects });
    expect(fromPages).toEqual(projects);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('forget the shared answers for every module copy on resetSanityLoaderCaches', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([makeProject()]);
    const routeCopy = await loadModuleCopy();
    await routeCopy.readProjects();

    resetSanityLoaderCaches();
    await routeCopy.readProjects();

    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(2);
  });

  it('keep featured projects in their own cache', async () => {
    const featured = [makeProject({ featured: true })];
    sanity.sanityFetchWithToken.mockResolvedValueOnce([makeProject()]);
    sanity.sanityFetchWithToken.mockResolvedValueOnce(featured);

    await loadProjects();
    const res = await apiGet('/projects/featured');

    expect(await res.json()).toEqual(featured);
    expect(await loadFeaturedProjects()).toEqual(featured);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(2);
  });
});

describe('loadPlaces', () => {
  it('drops a place with an unknown category and lists its _id in one warning', async () => {
    const [first, last] = [makePlace(), makePlace({ category: 'Hackathon' })];
    const workshop = { ...makePlace(), category: 'Workshop' };
    sanity.sanityFetchWithToken.mockResolvedValue([first, workshop, last]);

    const places = await loadPlaces();
    await loadPlaces();

    expect(places).toEqual([first, last]);
    expectOneReport('warning', 'decode places');
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      command: 'sanity:decode:places',
      metadata: { invalid: [{ id: workshop._id, problem: expect.stringContaining('Workshop') }] },
    });
  });

  it('shares one Sanity request between concurrent calls', async () => {
    const places = [makePlace(), makePlace()];
    const answer = deferredAnswer<unknown>();
    sanity.sanityFetchWithToken.mockReturnValue(answer.promise);

    const calls = Array.from({ length: 5 }, () => loadPlaces());
    answer.resolve(places);
    const results = await Promise.all(calls);

    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
    for (const result of results) expect(result).toEqual(places);
  });
});

describe('loadResume', () => {
  it('answers the active resume', async () => {
    const resume = makeResume();
    sanity.sanityFetchWithToken.mockResolvedValue(resume);

    expect(await loadResume()).toEqual(resume);
  });

  it('answers null without a report when no resume is active', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);

    expect(await loadResume()).toBeNull();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers the last good resume and sends one warning when Sanity fails past the TTL', async () => {
    const resume = makeResume();
    sanity.sanityFetchWithToken.mockResolvedValueOnce(resume);
    await loadResume();

    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);

    expect(await loadResume()).toEqual(resume);
    expectOneReport('warning', 'load resume for pages');
  });

  it('rejects with the failure, as the API answers 503, when the cached "no resume" is stale', async () => {
    sanity.sanityFetchWithToken.mockResolvedValueOnce(null);
    expect(await loadResume()).toBeNull();

    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const error = await loadResume().then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const res = await apiGet('/resume');

    expect(isBaseError(error)).toBe(true);
    expect(error).toMatchObject({
      command: 'sanity:resume',
      cause: expect.objectContaining({ message: 'Sanity answered 502 Bad Gateway' }),
    });
    expect(res.status).toBe(503);
  });
});

describe('by-id loaders', () => {
  it('answer the document with that id, or null for an unknown id', async () => {
    const projects = [makeProject(), makeProject()];
    sanity.sanityFetchWithToken.mockResolvedValue(projects);

    expect(await loadProjectById(projects[1]?._id ?? '')).toEqual(projects[1]);
    expect(await loadProjectById('project-unknown')).toBeNull();
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('find experiences and places in their own lists', async () => {
    const experience = makeExperience();
    const place = makePlace();
    sanity.sanityFetchWithToken.mockImplementation(async (query: string) =>
      query.includes('"experience"') ? [experience] : [place],
    );

    expect(await loadExperienceById(experience._id)).toEqual(experience);
    expect(await loadPlaceById(place._id)).toEqual(place);
    expect(await loadPlaceById(experience._id)).toBeNull();
  });

  it.each([
    ['a path', '../etc'],
    ['an empty id', ''],
    ['a 200-character id', 'a'.repeat(200)],
    ['a GROQ fragment', '"] | *[_type == "resume'],
  ])('answer null for %s without calling Sanity', async (_label, id) => {
    expect(await loadProjectById(id)).toBeNull();
    expect(await loadExperienceById(id)).toBeNull();
    expect(await loadPlaceById(id)).toBeNull();
    expect(sanity.sanityFetchWithToken).not.toHaveBeenCalled();
  });

  it('accept the ids Sanity issues', () => {
    expect(isSanityDocumentId('c9b1d2e3-4f56-7890-abcd-ef1234567890')).toBe(true);
    expect(isSanityDocumentId('drafts.project-grepo')).toBe(true);
    expect(isSanityDocumentId('a'.repeat(128))).toBe(true);
    expect(isSanityDocumentId('a'.repeat(129))).toBe(false);
  });
});

describe('loadVideos', () => {
  const storedVideo = {
    _id: 'video-stored',
    _type: 'youtubeVideo',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    _rev: 'rev-1',
    title: 'Stored title',
    description: 'Stored description',
    videoId: 'storedVid01',
    publishedDate: '2026-03-01T00:00:00Z',
    order: 1,
  };

  it('tags Sanity videos with their source when there is no YouTube key', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([storedVideo]);

    expect(await loadVideos()).toEqual([{ ...storedVideo, source: 'sanity' }]);
  });

  it('keeps where each video came from once the channel is merged in', async () => {
    envValues.YOUTUBE_SERVER_API_KEY = 'yt-key-example';
    sanity.sanityFetchWithToken.mockResolvedValue([storedVideo]);
    youtube.fetchYouTubeVideoMetadataBatch.mockResolvedValue(new Map());
    youtube.fetchChannelVideos.mockResolvedValue([
      {
        videoId: 'channelVid1',
        title: 'Channel video',
        description: 'From the channel',
        duration: '4:20',
        publishedAt: '2026-04-01T00:00:00Z',
      },
    ]);

    const videos = await loadVideos();

    expect(videos.map(({ _id, source }) => ({ _id, source }))).toEqual([
      { _id: 'yt-channel-channelVid1', source: 'youtube-api' },
      { _id: 'video-stored', source: 'sanity' },
    ]);
  });
});
