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
 * @file The posts /media and the project pages read (loadFeedPosts in load-media.ts): once the
 * blog cache's 30 minutes are up, the cached posts answer at once while one refresh runs in the
 * background, kept alive past the response with Next's after(); its failure is reported once.
 * Only a server that never loaded the posts waits, for BLOG_LOAD_DEADLINE_MS at most.
 * peekFeedPosts answers the last cached list without asking the sources.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const h = vi.hoisted(() => ({
  fetchBlogs: vi.fn(),
  reportApiFailure: vi.fn(() => true),
  after: vi.fn(),
}));

vi.mock('@/app/api/v1/[[...route]]/blog/handlers', () => ({ fetchBlogs: h.fetchBlogs }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
vi.mock('next/server', () => ({ after: h.after }));

const START = new Date('2026-11-13T12:00:00Z').getTime();
const MINUTE_MS = 60_000;

const post = (slug: string): Blog => ({
  title: `Post ${slug}`,
  slug,
  publishedAt: '2024-09-26T15:27:57.000Z',
  excerpt: 'A post.',
  source: 'hashnode',
});

/** A load the test settles by hand. */
function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** A fresh copy of load-media, so each test starts with an empty blog cache. */
async function loadModule() {
  vi.resetModules();
  return import('@/app/(routes)/(dev)/media/_lib/load-media');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(START);
  h.fetchBlogs.mockReset();
  h.reportApiFailure.mockClear();
  h.after.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadFeedPosts', () => {
  it('answers expired posts at once and starts one refresh, kept alive past the response', async () => {
    const { loadFeedPosts, BLOG_CACHE_TTL_MS } = await loadModule();
    h.fetchBlogs.mockResolvedValueOnce([post('old')]);
    await loadFeedPosts();
    vi.setSystemTime(START + BLOG_CACHE_TTL_MS + MINUTE_MS);
    const refresh = held<Blog[]>();
    h.fetchBlogs.mockReturnValueOnce(refresh.promise);

    const answers = await Promise.all([loadFeedPosts(), loadFeedPosts()]);

    expect(answers).toEqual([[post('old')], [post('old')]]);
    expect(h.fetchBlogs).toHaveBeenCalledTimes(2);
    expect(h.after).toHaveBeenCalled();

    refresh.resolve([post('new')]);
    await Promise.all(h.after.mock.calls.map(([kept]) => kept));
    await expect(loadFeedPosts()).resolves.toEqual([post('new')]);
    expect(h.fetchBlogs).toHaveBeenCalledTimes(2);
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });

  it('reports a failed refresh once, as a warning, and keeps answering the old posts', async () => {
    const { loadFeedPosts, BLOG_CACHE_TTL_MS } = await loadModule();
    h.fetchBlogs.mockResolvedValueOnce([post('old')]);
    await loadFeedPosts();
    vi.setSystemTime(START + BLOG_CACHE_TTL_MS + MINUTE_MS);
    h.fetchBlogs.mockRejectedValueOnce(new Error('Failed to fetch blogs from any source'));

    await expect(loadFeedPosts()).resolves.toEqual([post('old')]);
    await Promise.all(h.after.mock.calls.map(([kept]) => kept));

    expect(h.reportApiFailure).toHaveBeenCalledTimes(1);
    expect(h.reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'blog:posts' }),
      { context: 'load blog for pages', level: 'warning' },
    );
  });

  it('waits for the posts when nothing was ever cached, up to the deadline and no longer', async () => {
    const { loadFeedPosts, BLOG_LOAD_DEADLINE_MS } = await loadModule();
    h.fetchBlogs.mockReturnValue(new Promise(() => {}));
    let settled = false;
    const pending = loadFeedPosts();
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await vi.advanceTimersByTimeAsync(BLOG_LOAD_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).rejects.toThrow();
  });

  it('asks the blog sources once while the 30 minutes last', async () => {
    const { loadFeedPosts, BLOG_CACHE_TTL_MS } = await loadModule();
    h.fetchBlogs.mockResolvedValue([post('old')]);

    await loadFeedPosts();
    vi.setSystemTime(START + BLOG_CACHE_TTL_MS - MINUTE_MS);
    await expect(loadFeedPosts()).resolves.toEqual([post('old')]);

    expect(h.fetchBlogs).toHaveBeenCalledTimes(1);
  });
});

describe('peekFeedPosts', () => {
  it('answers nothing, and asks nothing, before the posts were loaded', async () => {
    const { peekFeedPosts } = await loadModule();

    expect(peekFeedPosts()).toBeUndefined();
    expect(h.fetchBlogs).not.toHaveBeenCalled();
  });

  // A project page's "See also" reads this when the reload past the TTL outlasts its deadline.
  it('answers the last list at once, however old, while a reload hangs', async () => {
    const { loadFeedPosts, peekFeedPosts, BLOG_CACHE_TTL_MS } = await loadModule();
    h.fetchBlogs.mockResolvedValueOnce([post('old')]);
    await loadFeedPosts();
    vi.setSystemTime(START + BLOG_CACHE_TTL_MS + MINUTE_MS);
    h.fetchBlogs.mockReturnValue(new Promise(() => {}));

    void loadFeedPosts();
    await vi.waitFor(() => expect(h.fetchBlogs).toHaveBeenCalledTimes(2));

    expect(peekFeedPosts()).toEqual({ data: [post('old')], loadedAt: START });
    expect(h.fetchBlogs).toHaveBeenCalledTimes(2);
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });
});
