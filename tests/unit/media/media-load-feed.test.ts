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
 * @file /media's load (load-feed.ts) and Next's after(): a source still loading at
 * FEED_SOURCE_DEADLINE_MS is dropped from this answer but kept alive past the response, so its
 * load still fills its cache for the next visitor; a source that answers in time hands nothing
 * over. What the page renders from the load is in media-feed-page.test.tsx.
 */

import { makeVideo } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loaders: {
    loadVideos: vi.fn(),
    loadVideoList: vi.fn(),
    loadTalks: vi.fn(),
    loadPresentations: vi.fn(),
    loadArticles: vi.fn(),
    loadProjects: vi.fn(),
  },
  fetchBlogs: vi.fn(),
  after: vi.fn(),
}));

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/server', () => ({ after: h.after }));
vi.mock('@/lib/sanity/loaders', () => h.loaders);
vi.mock('@/lib/sanity/client', () => ({ urlFor: vi.fn() }));
vi.mock('@/app/api/v1/[[...route]]/blog/handlers', () => ({ fetchBlogs: h.fetchBlogs }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: vi.fn(() => true) }));

import { FEED_SOURCE_DEADLINE_MS, loadMediaFeed } from '@/app/(routes)/(dev)/media/_lib/load-feed';

const VIDEO = makeVideo({ _id: 'v1', videoId: 'abcdefghijk', title: 'A video' });

beforeEach(() => {
  h.loaders.loadVideos.mockResolvedValue([{ ...VIDEO, source: 'youtube-api' }]);
  h.loaders.loadVideoList.mockImplementation(async () => ({
    videos: await h.loaders.loadVideos(),
    complete: true,
  }));
  h.loaders.loadTalks.mockResolvedValue([]);
  h.loaders.loadPresentations.mockResolvedValue([]);
  h.loaders.loadArticles.mockResolvedValue([]);
  h.loaders.loadProjects.mockResolvedValue([]);
  h.fetchBlogs.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('loadMediaFeed and after()', () => {
  it('keeps a source still loading at the deadline alive past the response', async () => {
    vi.useFakeTimers();
    h.loaders.loadTalks.mockReturnValue(new Promise(() => {}));

    const pending = loadMediaFeed();
    await vi.advanceTimersByTimeAsync(FEED_SOURCE_DEADLINE_MS);
    const feed = await pending;

    expect(feed.missing).toEqual(['talk']);
    expect(feed.entries.map(({ title }) => title)).toEqual(['A video']);
    expect(h.after).toHaveBeenCalledTimes(1);
    expect(h.after.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });

  it('hands nothing over when every source answers in time', async () => {
    const feed = await loadMediaFeed();

    expect(feed.missing).toEqual([]);
    expect(h.after).not.toHaveBeenCalled();
  });
});

describe('loadMediaFeed: is the video list every upload?', () => {
  it('says so when the channel list is complete', async () => {
    const feed = await loadMediaFeed();

    expect(feed.videosComplete).toBe(true);
  });

  it('says not when the channel has more uploads than were read, and still lists them', async () => {
    h.loaders.loadVideoList.mockResolvedValue({
      videos: [{ ...VIDEO, source: 'youtube-api' }],
      complete: false,
    });

    const feed = await loadMediaFeed();

    expect(feed.videosComplete).toBe(false);
    expect(feed.entries.map(({ title }) => title)).toEqual(['A video']);
  });

  it('claims nothing about a video list that could not load', async () => {
    h.loaders.loadVideos.mockRejectedValue(new Error('YouTube down'));

    const feed = await loadMediaFeed();

    expect(feed.missing).toEqual(['video']);
    expect(feed.videosComplete).toBe(true);
  });
});
