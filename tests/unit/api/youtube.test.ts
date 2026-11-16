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
 * @file The YouTube Data API integration against a fake API (a stubbed fetch), through the real
 * HTTP client:
 * - the server key rides in the X-Goog-Api-Key header, never in a URL, so a failed request's
 *   error (its message, stack and the wrapped error the routes report) never carries it;
 * - the IDs sent are percent-encoded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The HTTP client reads env only for the Vercel bypass header; skip t3-env validation.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { ensureBaseError } from '@/classes/error';
import {
  fetchChannelVideos,
  fetchYouTubeVideoMetadata,
  fetchYouTubeVideoMetadataBatch,
  resolveChannelHandle,
} from '@/lib/api-integrations/youtube';

/** A made-up key: the tests look for it in every URL and every error. */
const KEY = 'fake-youtube-key-for-tests';
const HANDLE = '@example';
const UPLOADS = 'UUexample';

interface Seen {
  readonly url: URL;
  readonly apiKey: string | null;
}

const thumb = { url: 'https://i.ytimg.com/vi/x/hqdefault.jpg', width: 480, height: 360 };
const thumbnails = { default: thumb, medium: thumb, high: thumb };

/** The ID of upload `index` (0 is the newest): 11 characters, like YouTube's. */
const idOf = (index: number): string => `vid${String(index).padStart(8, '0')}`;
/** Upload `index`'s publish time: one day apart, newest first. */
const publishedOf = (index: number): string =>
  new Date(Date.UTC(2026, 0, 1) - index * 86_400_000).toISOString();

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers both channel calls: part=id (a handle's ID) and part=contentDetails (its uploads). */
const channelsAnswer = () =>
  json({
    kind: 'youtube#channelListResponse',
    etag: 'e',
    pageInfo: { totalResults: 1, resultsPerPage: 1 },
    items: [
      {
        kind: 'youtube#channel',
        etag: 'e',
        id: 'UCexample',
        contentDetails: { relatedPlaylists: { likes: '', uploads: UPLOADS } },
      },
    ],
  });

/** The uploads playlist of a channel with `total` uploads, as one page. */
function playlistAnswer(url: URL, total: number): Response {
  const size = Math.min(total, Number(url.searchParams.get('maxResults') ?? '5'));
  const items = Array.from({ length: size }, (_, index) => ({
    kind: 'youtube#playlistItem',
    etag: 'e',
    id: `item-${index}`,
    snippet: {
      publishedAt: publishedOf(index),
      channelId: 'UCexample',
      title: `Upload ${index}`,
      description: '',
      thumbnails,
      channelTitle: 'Example',
      playlistId: UPLOADS,
      position: index,
      resourceId: { kind: 'youtube#video', videoId: idOf(index) },
    },
  }));
  return json({
    kind: 'youtube#playlistItemListResponse',
    etag: 'e',
    pageInfo: { totalResults: total, resultsPerPage: size },
    items,
  });
}

function videosAnswer(url: URL): Response {
  const ids = (url.searchParams.get('id') ?? '').split(',').filter(Boolean);
  return json({
    kind: 'youtube#videoListResponse',
    etag: 'e',
    pageInfo: { totalResults: ids.length, resultsPerPage: ids.length },
    items: ids.map((id) => {
      // A made-up ID that is not one of idOf()'s dates as the newest upload.
      const index = Number(id.slice(3)) || 0;
      return {
        kind: 'youtube#video',
        etag: 'e',
        id,
        snippet: {
          title: `Upload ${index}`,
          description: '',
          publishedAt: publishedOf(index),
          thumbnails,
        },
        contentDetails: {
          duration: 'PT4M20S',
          dimension: '2d',
          definition: 'hd',
          caption: 'false',
        },
      };
    }),
  });
}

/**
 * A fake YouTube Data API for a channel with `total` uploads. Every request is recorded with the
 * key it carried in the X-Goog-Api-Key header.
 */
function fakeYoutube(total: number) {
  const seen: Seen[] = [];
  const answer = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    seen.push({ url, apiKey: new Headers(init?.headers).get('x-goog-api-key') });
    if (url.pathname.endsWith('/channels')) return channelsAnswer();
    if (url.pathname.endsWith('/playlistItems')) return playlistAnswer(url, total);
    if (url.pathname.endsWith('/videos')) return videosAnswer(url);
    return json({ error: 'not found' }, 404);
  };
  const fetchMock = vi.fn(answer);
  vi.stubGlobal('fetch', fetchMock);
  return { seen, fetchMock, answer };
}

const callsTo = (seen: readonly Seen[], endpoint: string): Seen[] =>
  seen.filter(({ url }) => url.pathname.endsWith(`/${endpoint}`));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the YouTube server key', () => {
  it('rides in the X-Goog-Api-Key header of every request and in no URL', async () => {
    const { seen } = fakeYoutube(3);

    const uploads = await fetchChannelVideos(HANDLE, KEY);
    await fetchYouTubeVideoMetadataBatch([idOf(1), idOf(2)], KEY);
    await fetchYouTubeVideoMetadata(idOf(0), KEY);
    await resolveChannelHandle(HANDLE, KEY);

    // The listing is the handle's ID, its uploads playlist, one playlist page and one metadata
    // batch; then the batch, the single video and the handle on their own.
    expect(seen).toHaveLength(7);
    for (const { url, apiKey } of seen) {
      expect(url.href).not.toContain(KEY);
      expect(url.searchParams.has('key')).toBe(false);
      expect(apiKey).toBe(KEY);
    }
    // The answers are unchanged: the uploads, newest first, with their lengths.
    expect(uploads.map(({ videoId, duration }) => [videoId, duration])).toEqual([
      [idOf(0), '4:20'],
      [idOf(1), '4:20'],
      [idOf(2), '4:20'],
    ]);
  });

  it('asks for the same resources as before, with the same parameters', async () => {
    const { seen } = fakeYoutube(3);

    await fetchChannelVideos(HANDLE, KEY);

    const [handle, channel] = callsTo(seen, 'channels');
    expect(handle?.url.searchParams.get('part')).toBe('id');
    expect(handle?.url.searchParams.get('forHandle')).toBe(HANDLE);
    expect(channel?.url.searchParams.get('part')).toBe('contentDetails');
    expect(channel?.url.searchParams.get('id')).toBe('UCexample');
    const [page] = callsTo(seen, 'playlistItems');
    expect(page?.url.searchParams.get('part')).toBe('snippet');
    expect(page?.url.searchParams.get('playlistId')).toBe(UPLOADS);
    expect(page?.url.searchParams.get('maxResults')).toBe('50');
    const [batch] = callsTo(seen, 'videos');
    expect(batch?.url.searchParams.get('part')).toBe('snippet,contentDetails');
    expect(batch?.url.searchParams.get('id')).toBe([0, 1, 2].map(idOf).join(','));
  });

  it('percent-encodes the IDs it sends, so an ID cannot add a parameter', async () => {
    const { seen } = fakeYoutube(0);

    await fetchYouTubeVideoMetadataBatch(['abc&key=x', 'def'], KEY);
    await fetchYouTubeVideoMetadataBatch(['ghi&part=x'], KEY);

    const [batch, single] = callsTo(seen, 'videos');
    expect(batch?.url.search).toContain('id=abc%26key%3Dx%2Cdef');
    expect(batch?.url.searchParams.getAll('key')).toEqual([]);
    expect(single?.url.searchParams.get('id')).toBe('ghi&part=x');
    expect(single?.url.searchParams.getAll('part')).toEqual(['snippet,contentDetails']);
  });
});

describe('an error from a failed YouTube request', () => {
  beforeEach(() => {
    // The client retries twice with a 1 s then 2 s backoff; the fake clock skips the wait.
    vi.useFakeTimers();
  });

  /** Every text a failure can reach a log, the error tracker or a page with, its cause's too. */
  const textsOf = (error: unknown): string[] => {
    const wrapped = ensureBaseError(error, 'youtube:test');
    const own = error instanceof Error ? [error.message, String(error.stack)] : [];
    return [
      String(error),
      JSON.stringify(error) ?? '',
      ...own,
      wrapped.message,
      String(wrapped),
      JSON.stringify(wrapped) ?? '',
      String(wrapped.stack),
      JSON.stringify(wrapped.cause) ?? '',
    ];
  };

  const failureOf = async (run: () => Promise<unknown>): Promise<unknown> => {
    const settled = run().then(
      () => {
        throw new Error('expected the request to fail');
      },
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    return settled;
  };

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
  ])('never carries the key after %s', async (_case, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));

    const batchError = await failureOf(() => fetchYouTubeVideoMetadataBatch([idOf(0)], KEY));
    const listingError = await failureOf(() => fetchChannelVideos(HANDLE, KEY));

    for (const text of [...textsOf(batchError), ...textsOf(listingError)]) {
      expect(text).not.toContain(KEY);
    }
    // The failure still says what failed, so it stays useful in the error tracker.
    expect(textsOf(batchError).join(' ')).toContain('googleapis.com/youtube/v3/videos');
  });
});
