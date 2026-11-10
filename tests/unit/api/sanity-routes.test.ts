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
 * @file GET /api/v1/sanity/* contract. A Sanity failure must never look like real content:
 * - success: 200 with the CDN cache headers, and real empty lists are cached like any answer;
 * - failure with a last good answer in memory: 200 with that answer, a short CDN cache and a
 *   Sentry warning;
 * - failure with nothing cached: 503, `Cache-Control: no-store`, a JSON error body and a Sentry
 *   error;
 * - no active resume: 404 (not 200 null), also never stored by the CDN;
 * - /videos never answers placeholder videos, whatever Sanity returns.
 * Only the Sanity client and the YouTube integration are mocked; the getters, loaders, stale
 * cache and routes are the real ones.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
/** The routes' in-memory TTL (5 minutes), plus one millisecond. */
const AFTER_TTL = 5 * 60 * 1_000 + 1;
const FRESH_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';
const STALE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30';

/** The placeholders the old handler answered when Sanity had no videos or failed. */
const PLACEHOLDER_VIDEO_IDS = ['dQw4w9WgXcQ', 'jjMbPt_H3RQ', 'jNQXAC9IVRw'];
const PLACEHOLDER_TEXT = /dummy|placeholder/i;

const project = {
  _id: 'proj-grepo',
  _type: 'project',
  title: 'grepo',
  slug: { _type: 'slug', current: 'grepo' },
};

/** Every Sanity route, and the context its failures are reported under. */
const ROUTES = [
  ['/resume', 'fetch resume from Sanity'],
  ['/experiences', 'fetch experiences from Sanity'],
  ['/projects', 'fetch projects from Sanity'],
  ['/projects/featured', 'fetch featured projects from Sanity'],
  ['/certifications', 'fetch certifications from Sanity'],
  ['/places', 'fetch places from Sanity'],
  ['/presentations', 'fetch presentations from Sanity'],
  ['/talks', 'fetch talks from Sanity'],
  ['/articles', 'fetch articles from Sanity'],
  ['/videos', 'fetch YouTube videos from Sanity'],
] as const;

/**
 * Every test loads a fresh app. The routes' answers live in one process-wide cache that survives
 * vi.resetModules() (every copy of the loaders shares it), so it is cleared here as well.
 */
const loadApp = async () => {
  vi.resetModules();
  const [{ Elysia }, { sanityRoutes }, { logger }, { resetSanityLoaderCaches }] = await Promise.all(
    [
      import('elysia'),
      import('@/app/api/v1/[[...route]]/sanity'),
      import('@/utils'),
      import('@/lib/sanity/loaders'),
    ],
  );
  resetSanityLoaderCaches();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  const app = new Elysia({ prefix: '/api/v1' }).use(sanityRoutes);
  return (path: string) => app.handle(new Request(`http://localhost/api/v1/sanity${path}`));
};

const expectReport = (level: 'warning' | 'error', context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level, tags: { 'api.context': context } }),
  );
};

const sanityDown = () => new Error('Sanity answered 502 Bad Gateway');

const channelVideo = (videoId: string, publishedAt: string) => ({
  videoId,
  title: `Channel video ${videoId}`,
  description: 'From the channel',
  duration: '4:20',
  durationIso: 'PT4M20S',
  publishedAt,
  thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockReset();
  sanity.sanityFetchWithToken.mockReset();
  youtube.fetchChannelVideos.mockReset();
  youtube.fetchYouTubeVideoMetadataBatch.mockReset();
  envValues.YOUTUBE_SERVER_API_KEY = undefined;
  // loadTalks reads its YouTube key from here.
  envValues.NEXT_PUBLIC_FIREBASE_API_KEY = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a working Sanity', () => {
  it('answers 200 with the CDN cache headers', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([project]);
    const get = await loadApp();

    const res = await get('/projects');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(FRESH_CACHE_CONTROL);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual([project]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('caches a real empty list like any answer', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([]);
    const get = await loadApp();

    const first = await get('/projects');
    const second = await get('/projects');

    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe(FRESH_CACHE_CONTROL);
    expect(await second.json()).toEqual([]);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });
});

describe('a failing Sanity with a last good answer in memory', () => {
  it('answers 200 with the last good data, a short CDN cache and a warning', async () => {
    sanity.sanityFetchWithToken.mockResolvedValueOnce([project]);
    const get = await loadApp();
    await get('/projects');

    sanity.sanityFetchWithToken.mockRejectedValueOnce(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const res = await get('/projects');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([project]);
    expect(res.headers.get('cache-control')).toBe(STALE_CACHE_CONTROL);
    expectReport('warning', 'fetch projects from Sanity');
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      command: 'sanity:projects',
      cause: expect.objectContaining({ message: 'Sanity answered 502 Bad Gateway' }),
    });
  });
});

describe('a failing Sanity with nothing cached', () => {
  it.each(ROUTES)('%s answers 503, no-store and an error report', async (path, context) => {
    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    const get = await loadApp();

    const res = await get(path);

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: `Failed to ${context}`, status: 503 });
    expectReport('error', context);
  });

  it('loads again on the next request instead of caching the failure', async () => {
    sanity.sanityFetchWithToken.mockRejectedValueOnce(sanityDown());
    const get = await loadApp();
    expect((await get('/projects')).status).toBe(503);

    sanity.sanityFetchWithToken.mockResolvedValueOnce([project]);
    const res = await get('/projects');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([project]);
  });
});

describe('GET /sanity/places', () => {
  // T0 is 07:00 ET on Nov 5, 2026, before noon, so the cutoff is Nov 4: Nov 3 is over, Nov 4 not.
  const rawPlace = (id: string, startDate?: string, endDate?: string) => ({
    _id: id,
    _type: 'place',
    name: `Place ${id}`,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });

  it('answers past places only: never a visit that may still be on, or an undated one', async () => {
    const past = rawPlace('place-past', '2026-11-03');
    const older = rawPlace('place-older', '2026-06-01', '2026-06-03');
    sanity.sanityFetchWithToken.mockResolvedValue([
      rawPlace('place-on-the-cutoff', '2026-11-04'),
      past,
      rawPlace('place-running', '2026-11-01', '2026-11-08'),
      rawPlace('place-to-come', '2026-12-01'),
      rawPlace('place-undated'),
      older,
    ]);
    const get = await loadApp();

    const res = await get('/places');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(FRESH_CACHE_CONTROL);
    expect(await res.json()).toEqual([past, older]);
  });

  it('keeps the past-only rule on a stale answer', async () => {
    const past = rawPlace('place-past', '2026-11-03');
    sanity.sanityFetchWithToken.mockResolvedValueOnce([
      past,
      rawPlace('place-to-come', '2026-12-01'),
    ]);
    const get = await loadApp();
    await get('/places');

    sanity.sanityFetchWithToken.mockRejectedValueOnce(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const res = await get('/places');

    expect(res.headers.get('cache-control')).toBe(STALE_CACHE_CONTROL);
    expect(await res.json()).toEqual([past]);
  });
});

describe('GET /sanity/resume', () => {
  const resume = {
    _id: 'resume-1',
    _type: 'resume',
    title: 'Resume',
    pdfFile: { _type: 'file', asset: { _ref: 'file-abc-pdf', _type: 'reference' } },
    lastUpdated: '2026-10-01',
    isActive: true,
  };

  it('answers the active resume', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(resume);
    const get = await loadApp();

    const res = await get('/resume');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(FRESH_CACHE_CONTROL);
    expect(await res.json()).toEqual(resume);
  });

  it('answers 404, not 200 null, when no resume is active', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);
    const get = await loadApp();

    const res = await get('/resume');

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'No active resume', status: 404 });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers 503, not a stale 404, when Sanity fails after answering no active resume', async () => {
    sanity.sanityFetchWithToken.mockResolvedValueOnce(null);
    const get = await loadApp();
    expect((await get('/resume')).status).toBe(404);

    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const failed = await get('/resume');
    // Within the retry backoff the cache serves its stale null without asking Sanity.
    const backedOff = await get('/resume');

    for (const res of [failed, backedOff]) {
      expect(res.status).toBe(503);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({
        error: 'Failed to fetch resume from Sanity',
        status: 503,
      });
    }
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        level: 'error',
        tags: { 'api.context': 'fetch resume from Sanity' },
      }),
    );
  });

  it('serves the last good resume, not a 503, when Sanity fails after answering one', async () => {
    sanity.sanityFetchWithToken.mockResolvedValueOnce(resume);
    const get = await loadApp();
    await get('/resume');

    sanity.sanityFetchWithToken.mockRejectedValueOnce(sanityDown());
    vi.setSystemTime(T0 + AFTER_TTL);
    const res = await get('/resume');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(STALE_CACHE_CONTROL);
    expect(await res.json()).toEqual(resume);
  });
});

describe('GET /sanity/talks', () => {
  const VIDEO_ID = 'AbCdEfGhI_-';

  const talk = (id: string, videoUrl: string | null, videoFormat = 'youtube') => ({
    _id: id,
    _type: 'talk',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    _rev: `rev-${id}`,
    title: `Talk ${id}`,
    description: 'A talk',
    venue: 'A venue',
    date: '2026-01-01',
    videoFormat,
    videoUrl,
    duration: 'stored',
    order: 1,
  });

  /** Answers YouTube metadata for exactly VIDEO_ID, so only a cleanly parsed ID gets it. */
  const metadataFor = async (ids: string[]) =>
    new Map(
      ids
        .filter((id) => id === VIDEO_ID)
        .map((id) => [id, { ...channelVideo(id, '2026-01-01T00:00:00Z'), duration: '12:34' }]),
    );

  it.each([
    ['youtu.be with ?si=', `https://youtu.be/${VIDEO_ID}?si=share-token`],
    ['youtu.be with ?t=', `https://youtu.be/${VIDEO_ID}?t=30`],
    ['youtu.be with a fragment', `https://youtu.be/${VIDEO_ID}#t=30`],
    ['youtu.be with a trailing slash', `https://youtu.be/${VIDEO_ID}/`],
    ['watch?v=', `https://www.youtube.com/watch?v=${VIDEO_ID}`],
    ['watch with v after other params', `https://youtube.com/watch?list=PL1&v=${VIDEO_ID}&t=5s`],
    ['mobile watch', `https://m.youtube.com/watch?v=${VIDEO_ID}#comments`],
    ['/embed/', `https://www.youtube.com/embed/${VIDEO_ID}?start=10`],
    ['/shorts/', `https://youtube.com/shorts/${VIDEO_ID}?feature=share`],
    ['/live/', `https://www.youtube.com/live/${VIDEO_ID}?si=x`],
    ['no scheme', `youtu.be/${VIDEO_ID}?si=x`],
  ])('reads the video ID from a %s link', async (_form, videoUrl) => {
    envValues.NEXT_PUBLIC_FIREBASE_API_KEY = 'yt-key-example';
    sanity.sanityFetchWithToken.mockResolvedValue([talk('t1', videoUrl)]);
    youtube.fetchYouTubeVideoMetadataBatch.mockImplementation(metadataFor);
    const get = await loadApp();

    const body: Array<{ duration: string }> = await (await get('/talks')).json();

    expect(youtube.fetchYouTubeVideoMetadataBatch).toHaveBeenCalledWith(
      [VIDEO_ID],
      'yt-key-example',
    );
    expect(body.map((item) => item.duration)).toEqual(['12:34']);
  });

  it('asks YouTube about no ID for links that are not YouTube videos', async () => {
    envValues.NEXT_PUBLIC_FIREBASE_API_KEY = 'yt-key-example';
    sanity.sanityFetchWithToken.mockResolvedValue([
      talk('t1', 'https://www.youtube.com/@mikeodnis'),
      talk('t2', `https://notyoutube.com/watch?v=${VIDEO_ID}`),
      talk('t3', 'https://youtu.be/too-short'),
      talk('t4', 'not a url at all'),
      talk('t5', `https://vimeo.com/${VIDEO_ID}`, 'vimeo'),
      talk('t6', null),
    ]);
    const get = await loadApp();

    const body: Array<{ duration: string }> = await (await get('/talks')).json();

    expect(youtube.fetchYouTubeVideoMetadataBatch).not.toHaveBeenCalled();
    expect(body.every((item) => item.duration === 'stored')).toBe(true);
  });
});

describe('GET /sanity/videos', () => {
  const expectNoPlaceholders = (body: unknown) => {
    const text = JSON.stringify(body);
    expect(text).not.toMatch(PLACEHOLDER_TEXT);
    for (const id of PLACEHOLDER_VIDEO_IDS) expect(text).not.toContain(id);
  };

  it('answers an empty list when Sanity has no videos and there is no YouTube key', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue([]);
    const get = await loadApp();

    const res = await get('/videos');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('answers only the channel videos when Sanity has none', async () => {
    envValues.YOUTUBE_SERVER_API_KEY = 'yt-key-example';
    sanity.sanityFetchWithToken.mockResolvedValue([]);
    youtube.fetchChannelVideos.mockResolvedValue([
      channelVideo('chanOld0001', '2025-06-01T00:00:00Z'),
      channelVideo('chanNew0002', '2026-02-01T00:00:00Z'),
    ]);
    youtube.fetchYouTubeVideoMetadataBatch.mockImplementation(async (ids: string[]) => {
      return new Map(ids.map((id) => [id, channelVideo(id, '2020-01-01T00:00:00Z')]));
    });
    const get = await loadApp();

    const res = await get('/videos');
    const body: Array<{ videoId: string; source: string }> = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((video) => video.videoId)).toEqual(['chanNew0002', 'chanOld0001']);
    expect(body.every((video) => video.source === 'youtube-api')).toBe(true);
    expectNoPlaceholders(body);
  });

  it('lists Sanity videos with their YouTube metadata ahead of duplicates from the channel', async () => {
    envValues.YOUTUBE_SERVER_API_KEY = 'yt-key-example';
    const sanityVideo = {
      _id: 'video-1',
      _type: 'youtubeVideo',
      _createdAt: '2026-01-01T00:00:00Z',
      _updatedAt: '2026-01-01T00:00:00Z',
      _rev: 'rev-1',
      title: 'Stored title',
      description: 'Stored description',
      videoId: 'sanityVid01',
      publishedDate: '2026-03-01T00:00:00Z',
      order: 1,
    };
    sanity.sanityFetchWithToken.mockResolvedValue([sanityVideo]);
    youtube.fetchChannelVideos.mockResolvedValue([
      channelVideo('sanityVid01', '2026-03-01T00:00:00Z'),
      channelVideo('chanOnly001', '2026-01-15T00:00:00Z'),
    ]);
    youtube.fetchYouTubeVideoMetadataBatch.mockResolvedValue(
      new Map([['sanityVid01', { ...channelVideo('sanityVid01', ''), title: 'Live title' }]]),
    );
    const get = await loadApp();

    const body: Array<{ _id: string; title: string; source: string }> = await (
      await get('/videos')
    ).json();

    expect(body.map(({ _id, title, source }) => ({ _id, title, source }))).toEqual([
      { _id: 'video-1', title: 'Live title', source: 'sanity' },
      { _id: 'yt-channel-chanOnly001', title: 'Channel video chanOnly001', source: 'youtube-api' },
    ]);
  });

  it('never answers placeholder videos when Sanity fails', async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    const get = await loadApp();

    const res = await get('/videos');

    expect(res.status).toBe(503);
    expectNoPlaceholders(await res.json());
  });

  it('serves the last good list when the YouTube channel fails, rather than an empty one', async () => {
    envValues.YOUTUBE_SERVER_API_KEY = 'yt-key-example';
    sanity.sanityFetchWithToken.mockResolvedValue([]);
    youtube.fetchYouTubeVideoMetadataBatch.mockResolvedValue(new Map());
    youtube.fetchChannelVideos.mockResolvedValueOnce([
      channelVideo('chanVideo01', '2026-02-01T00:00:00Z'),
    ]);
    const get = await loadApp();
    await get('/videos');

    youtube.fetchChannelVideos.mockRejectedValueOnce(new Error('quotaExceeded'));
    vi.setSystemTime(T0 + AFTER_TTL);
    const res = await get('/videos');

    expect(res.status).toBe(200);
    expect((await res.json()).map((video: { videoId: string }) => video.videoId)).toEqual([
      'chanVideo01',
    ]);
    expectReport('warning', 'fetch YouTube videos from Sanity');
  });
});
