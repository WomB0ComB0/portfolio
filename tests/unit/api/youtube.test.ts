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
 * - the IDs sent are percent-encoded;
 * - the channel's uploads are read page by page (50 a page, metadata in batches of 50) up to
 *   CHANNEL_UPLOADS_CAP, and the answer says whether that was every upload.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The HTTP client reads env only for the Vercel bypass header; skip t3-env validation.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { ensureBaseError } from '@/classes/error';
import {
  CHANNEL_UPLOADS_CAP,
  fetchChannelVideos,
  fetchYouTubeVideoMetadataBatch,
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

/** One page of a playlist with `total` uploads; the page token is the index it starts at. */
function playlistAnswer(url: URL, total: number): Response {
  const start = Number(url.searchParams.get('pageToken') ?? '0');
  const size = Number(url.searchParams.get('maxResults') ?? '5');
  const end = Math.min(total, start + size);
  const items = Array.from({ length: end - start }, (_, offset) => {
    const index = start + offset;
    return {
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
      contentDetails: { videoId: idOf(index), videoPublishedAt: publishedOf(index) },
    };
  });
  return json({
    kind: 'youtube#playlistItemListResponse',
    etag: 'e',
    ...(end < total ? { nextPageToken: String(end) } : {}),
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

    await fetchChannelVideos(HANDLE, KEY);
    await fetchYouTubeVideoMetadataBatch([idOf(1), idOf(2)], KEY);

    // The channel, one playlist page and one metadata batch, then the batch call's own.
    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (const { url, apiKey } of seen) {
      expect(url.href).not.toContain(KEY);
      expect(url.searchParams.has('key')).toBe(false);
      expect(apiKey).toBe(KEY);
    }
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

describe("the channel's uploads", () => {
  it('reads one page and one batch for 50 uploads: three calls in all', async () => {
    const { seen } = fakeYoutube(50);

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(videos).toHaveLength(50);
    expect(complete).toBe(true);
    expect(callsTo(seen, 'channels')).toHaveLength(1);
    expect(callsTo(seen, 'playlistItems')).toHaveLength(1);
    expect(callsTo(seen, 'videos')).toHaveLength(1);
  });

  it('reads the next page for upload 51, and its metadata in a second batch', async () => {
    const { seen } = fakeYoutube(51);

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(videos).toHaveLength(51);
    expect(complete).toBe(true);
    expect(videos.map(({ videoId }) => videoId)).toEqual(
      Array.from({ length: 51 }, (_, index) => idOf(index)),
    );
    const pages = callsTo(seen, 'playlistItems');
    expect(pages.map(({ url }) => url.searchParams.get('pageToken'))).toEqual([null, '50']);
    expect(pages.every(({ url }) => url.searchParams.get('maxResults') === '50')).toBe(true);
    expect(
      callsTo(seen, 'videos').map(({ url }) => url.searchParams.get('id')?.split(',').length),
    ).toEqual([50, 1]);
    expect(seen).toHaveLength(5);
  });

  it(`stops at ${CHANNEL_UPLOADS_CAP} of 250 uploads and says the list is not complete`, async () => {
    const { seen } = fakeYoutube(250);

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(CHANNEL_UPLOADS_CAP).toBe(200);
    expect(videos).toHaveLength(CHANNEL_UPLOADS_CAP);
    expect(videos.at(0)?.videoId).toBe(idOf(0));
    expect(videos.at(-1)?.videoId).toBe(idOf(CHANNEL_UPLOADS_CAP - 1));
    expect(complete).toBe(false);
    expect(callsTo(seen, 'playlistItems')).toHaveLength(4);
    expect(callsTo(seen, 'videos')).toHaveLength(4);
    expect(seen).toHaveLength(9);
  });

  it('calls a list that ends exactly at the cap complete', async () => {
    fakeYoutube(CHANNEL_UPLOADS_CAP);

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(videos).toHaveLength(CHANNEL_UPLOADS_CAP);
    expect(complete).toBe(true);
  });

  it('answers an empty, complete list for a channel with no uploads', async () => {
    fakeYoutube(0);

    await expect(fetchChannelVideos(HANDLE, KEY)).resolves.toEqual({ videos: [], complete: true });
  });

  it('fails as a whole when one page fails, rather than answer part of the list', async () => {
    const { fetchMock, answer } = fakeYoutube(120);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.searchParams.get('pageToken') === '100') return json({ error: 'bad page' }, 400);
      return answer(input, init);
    });

    await expect(fetchChannelVideos(HANDLE, KEY)).rejects.toThrow();
  });

  // Page tokens are positions: an upload that goes public between two page reads shifts the list
  // down by one, so page 2 starts with the last upload of page 1.
  it('lists an upload once when page 2 starts with the last upload of page 1', async () => {
    const { seen, fetchMock, answer } = fakeYoutube(60);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.searchParams.get('pageToken') === '50') {
        url.searchParams.set('pageToken', '49');
        return answer(url.href, init);
      }
      return answer(input, init);
    });

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(videos.map(({ videoId }) => videoId)).toEqual(
      Array.from({ length: 60 }, (_, index) => idOf(index)),
    );
    expect(complete).toBe(true);
    // The repeated upload's metadata is not asked for twice.
    expect(
      callsTo(seen, 'videos').map(({ url }) => url.searchParams.get('id')?.split(',').length),
    ).toEqual([50, 10]);
  });

  it('stops at a page token it has already read, and says the list is not complete', async () => {
    const { seen, fetchMock, answer } = fakeYoutube(50);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/playlistItems')) return answer(input, init);
      // Every page is the same 50 uploads with the same next token.
      url.searchParams.delete('pageToken');
      const page = (await (await answer(url.href, init)).json()) as Record<string, unknown>;
      return json({ ...page, nextPageToken: 'same-token' });
    });

    const { videos, complete } = await fetchChannelVideos(HANDLE, KEY);

    expect(videos).toHaveLength(50);
    expect(new Set(videos.map(({ videoId }) => videoId)).size).toBe(50);
    expect(complete).toBe(false);
    // The tokens as sent (the fake reads every page without one).
    const sentTokens = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.endsWith('/playlistItems'))
      .map((url) => url.searchParams.get('pageToken'));
    expect(sentTokens).toEqual([null, 'same-token']);
    expect(callsTo(seen, 'videos')).toHaveLength(1);
  });
});

describe('the metadata batch', () => {
  it('asks for any number of IDs in batches of 50', async () => {
    const { seen } = fakeYoutube(0);
    const ids = Array.from({ length: 120 }, (_, index) => idOf(index));

    const metadata = await fetchYouTubeVideoMetadataBatch(ids, KEY);

    expect(metadata.size).toBe(120);
    expect(
      callsTo(seen, 'videos').map(({ url }) => url.searchParams.get('id')?.split(',').length),
    ).toEqual([50, 50, 20]);
  });

  it('asks nothing for no IDs', async () => {
    const { seen } = fakeYoutube(0);

    await expect(fetchYouTubeVideoMetadataBatch([], KEY)).resolves.toEqual(new Map());
    expect(seen).toHaveLength(0);
  });
});
