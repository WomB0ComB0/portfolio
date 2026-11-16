// @vitest-environment node
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
 * @file The YouTube keys on the server's whole path, against a fake YouTube (a stubbed fetch).
 * The Sanity routes, loaders and enrichment, the YouTube integration and the HTTP client are the
 * real ones; only the Sanity client, the env and Sentry are mocked.
 * - Talk lengths are read with the server key (YOUTUBE_SERVER_API_KEY), never with the public
 *   Firebase browser key.
 * - The key reaches YouTube only in the X-Goog-Api-Key header, and no log call or Sentry report
 *   carries it, whether YouTube answers or fails.
 * - Without the server key nothing asks YouTube: talks keep their stored lengths and /videos is
 *   Sanity's list alone.
 */

import { makeTalk } from '@tests/fixtures/sanity-docs';
import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { sanityRoutes } from '@/app/api/v1/[[...route]]/sanity';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';
import { logger } from '@/utils';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));
const envValues = vi.hoisted((): Record<string, string | undefined> => ({ NODE_ENV: 'test' }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/sanity/client', () => sanity);
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? envValues[key] : undefined),
  });
  return { env, default: env };
});

/** Made-up keys: the tests look for them in every URL, header, log call and report. */
const SERVER_KEY = 'made-up-youtube-server-key';
const BROWSER_KEY = 'made-up-firebase-browser-key';
const VIDEO_ID = 'talkVideo01';

const talk = makeTalk({
  videoFormat: 'youtube',
  videoUrl: `https://youtu.be/${VIDEO_ID}`,
  duration: '1:00',
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const thumb = { url: 'https://i.ytimg.com/vi/x/hqdefault.jpg', width: 480, height: 360 };
const thumbnails = { default: thumb, medium: thumb, high: thumb };
const page = { kind: 'k', etag: 'e', pageInfo: { totalResults: 1, resultsPerPage: 1 } };

/** A channel with one upload, VIDEO_ID, 12:34 long. */
function youtubeAnswer(url: URL): Response {
  if (url.pathname.endsWith('/channels')) {
    const uploads = { likes: '', uploads: 'UUexample' };
    return json({
      ...page,
      items: [{ ...page, id: 'UCexample', contentDetails: { relatedPlaylists: uploads } }],
    });
  }
  const snippet = {
    title: 'Upload',
    description: '',
    publishedAt: '2026-01-01T00:00:00.000Z',
    thumbnails,
  };
  if (url.pathname.endsWith('/playlistItems')) {
    const resourceId = { kind: 'youtube#video', videoId: VIDEO_ID };
    const item = {
      ...snippet,
      channelId: 'UCexample',
      channelTitle: 'Example',
      playlistId: 'UUexample',
      position: 0,
      resourceId,
    };
    return json({
      ...page,
      items: [{ ...page, id: 'item-0', snippet: item, contentDetails: { videoId: VIDEO_ID } }],
    });
  }
  const contentDetails = {
    duration: 'PT12M34S',
    dimension: '2d',
    definition: 'hd',
    caption: 'false',
  };
  return json({ ...page, items: [{ ...page, id: VIDEO_ID, snippet, contentDetails }] });
}

interface Sent {
  readonly url: string;
  readonly headers: Headers;
}

/** Stubs fetch with `answer`, recording every request's URL and headers. */
function stubFetch(answer: (url: URL) => Promise<Response> | Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      sent.push({ url, headers: new Headers(init?.headers) });
      return answer(new URL(url));
    }),
  );
  return sent;
}

/** Sanity answers the talk for the talks query and no stored videos for the videos query. */
const sanityAnswers = async (query: string) => (query.includes('"talk"') ? [talk] : []);

const app = new Elysia({ prefix: '/api/v1' }).use(sanityRoutes);

/** GETs a Sanity route, letting the client's retry backoff (1 s, then 2 s) pass. */
async function apiGet(path: string): Promise<Response> {
  const answer = app.handle(new Request(`http://localhost/api/v1/sanity${path}`));
  await vi.advanceTimersByTimeAsync(30_000);
  return answer;
}

/** Whether `secret` is in any string reachable from `value` by property access, cause included. */
function reaches(value: unknown, secret: string, seen = new Set<unknown>(), depth = 0): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (value === null || typeof value !== 'object' || seen.has(value) || depth > 12) return false;
  seen.add(value);
  if (String(value).includes(secret)) return true;
  return Reflect.ownKeys(value).some((key) => {
    try {
      return reaches((value as Record<PropertyKey, unknown>)[key], secret, seen, depth + 1);
    } catch {
      return false;
    }
  });
}

let logSpies: MockInstance[] = [];

/** Every argument of every log call (the logger's and the console's) and Sentry report. */
const loggedAndReported = (): unknown[] => [
  ...logSpies.flatMap((spy) => spy.mock.calls.flat()),
  ...sentry.captureException.mock.calls.flat(),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  sentry.captureException.mockReset();
  sanity.sanityFetchWithToken.mockReset();
  sanity.sanityFetchWithToken.mockImplementation(sanityAnswers);
  envValues.YOUTUBE_SERVER_API_KEY = SERVER_KEY;
  envValues.NEXT_PUBLIC_FIREBASE_API_KEY = BROWSER_KEY;
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  const quiet = () => undefined;
  logSpies = [
    ...(['error', 'warn', 'info', 'debug'] as const).map((level) =>
      vi.spyOn(logger, level).mockImplementation(quiet),
    ),
    ...(['error', 'warn', 'info', 'log', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(quiet),
    ),
  ];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('talk lengths', () => {
  it('are read with the server key, sent in the X-Goog-Api-Key header only', async () => {
    const sent = stubFetch(youtubeAnswer);

    const talks: Array<{ duration?: string }> = await (await apiGet('/talks')).json();

    expect(talks.map(({ duration }) => duration)).toEqual(['12:34']);
    expect(sent).toHaveLength(1);
    for (const { url, headers } of sent) {
      expect(headers.get('x-goog-api-key')).toBe(SERVER_KEY);
      expect(url).not.toContain(SERVER_KEY);
      expect(url).not.toContain(BROWSER_KEY);
      expect([...headers.values()].join(' ')).not.toContain(BROWSER_KEY);
    }
  });

  it('keep their stored values, and nothing asks YouTube, without the server key', async () => {
    envValues.YOUTUBE_SERVER_API_KEY = undefined;
    const sent = stubFetch(youtubeAnswer);

    const talks: Array<{ duration?: string }> = await (await apiGet('/talks')).json();
    const videos: unknown[] = await (await apiGet('/videos')).json();

    expect(talks.map(({ duration }) => duration)).toEqual(['1:00']);
    expect(videos).toEqual([]);
    expect(sent).toHaveLength(0);
  });
});

describe('the YouTube server key in logs and reports', () => {
  it('is in none when YouTube answers', async () => {
    const sent = stubFetch(youtubeAnswer);

    const videos: Array<{ videoId: string; duration: string }> = await (
      await apiGet('/videos')
    ).json();
    await apiGet('/talks');

    expect(videos.map(({ videoId, duration }) => [videoId, duration])).toEqual([
      [VIDEO_ID, '12:34'],
    ]);
    expect(sent.every(({ url }) => !url.includes(SERVER_KEY))).toBe(true);
    for (const value of loggedAndReported()) expect(reaches(value, SERVER_KEY)).toBe(false);
  });

  it.each([
    ['a connection failure', () => Promise.reject(new TypeError('fetch failed'))],
    ['a rate limit (429)', async () => json({ error: { code: 429 } }, 429)],
    ['a refusal (403)', async () => json({ error: { code: 403, message: 'quota' } }, 403)],
    [
      'an HTML page answered with 200',
      async () =>
        new Response('<!DOCTYPE html><html><body>Sorry</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ],
    [
      'JSON cut short with 200',
      async () =>
        new Response('{"kind":"youtube#videoListResponse","items":[{"id":"x', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ],
  ])('is in none after %s', async (_case, answer) => {
    stubFetch(answer);

    const talks = await apiGet('/talks');
    const videos = await apiGet('/videos');

    // The talks keep their stored length (with a warning); the videos have nothing to fall back on.
    expect(talks.status).toBe(200);
    expect((await talks.json()).map(({ duration }: { duration: string }) => duration)).toEqual([
      '1:00',
    ]);
    expect(videos.status).toBe(503);
    expect(logger.warn).toHaveBeenCalled();
    expect(sentry.captureException).toHaveBeenCalled();
    for (const value of loggedAndReported()) expect(reaches(value, SERVER_KEY)).toBe(false);
  });
});
