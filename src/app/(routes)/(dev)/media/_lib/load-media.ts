import 'server-only';
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
 * @file The blog posts behind /media and the project pages' "See also", loaded on the server.
 * The blog gets its own stale-on-error cache here, since Hashnode's feed, its post pages and
 * dev.to are slow to ask and change rarely. The Sanity collections come from the shared loaders
 * in '@/lib/sanity/loaders' (one stale-on-error cache per collection, shared with
 * /api/v1/sanity/*).
 */

import { cache } from 'react';
import { type Blog, fetchBlogs } from '@/app/api/v1/[[...route]]/blog/handlers';
import { ensureBaseError } from '@/classes/error';
import { withDeadline } from '@/lib/async/deadline';
import { backgroundRefresh } from '@/lib/cache/keep-alive';
import { type CachedValue, createStaleCache, type StaleCacheResult } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';

/** How long the blog list is served from memory before the sources are asked again. */
export const BLOG_CACHE_TTL_MS = 30 * 60_000;

const BLOG_CACHE_KEY = 'blog:posts';

/** The clock is read on every call, so a test's faked Date moves it too. */
const blogCache = createStaleCache<readonly Blog[]>({
  ttlMs: BLOG_CACHE_TTL_MS,
  now: () => Date.now(),
});

/**
 * The longest the One feed waits on the blog sources (Hashnode's feed, its post pages for covers,
 * dev.to) before it serves the last good list instead, or none. The other feed sources answer
 * within 8 s (YouTube) or from Sanity's cache, so this keeps the blog from being the slowest.
 */
export const BLOG_LOAD_DEADLINE_MS = 6_000;

/** The sources failed but the last good list is served: the page still works, so a warning. */
function reportStalePosts(error: unknown): void {
  reportApiFailure(ensureBaseError(error, 'blog:posts'), {
    context: 'load blog for pages',
    level: 'warning',
  });
}

/** The list from a cache answer, after a warning when it is the last good one. */
function postsOf(result: StaleCacheResult<readonly Blog[]>): readonly Blog[] {
  if (result.stale) reportStalePosts(result.error);
  return result.data;
}

/** The blog sources, failing once {@link BLOG_LOAD_DEADLINE_MS} passes (the late answer is not cached). */
const fetchBlogsWithinDeadline = (): Promise<readonly Blog[]> =>
  withDeadline(fetchBlogs(), BLOG_LOAD_DEADLINE_MS, 'blog posts');

/**
 * Every blog post, newest first, for /media and the project pages. No page waits on a reload:
 * once the TTL is up the cached list answers at once while one reload runs in the background
 * (kept alive past the response, a failure reported once as a warning). Only a server that never
 * loaded the posts waits, and a load past {@link BLOG_LOAD_DEADLINE_MS} counts as failed: with
 * nothing cached this then rejects with a DeadlineError, and the late answer is not cached.
 */
export const loadFeedPosts = cache(
  async (): Promise<readonly Blog[]> =>
    postsOf(
      await blogCache.getOrRefresh(
        BLOG_CACHE_KEY,
        fetchBlogsWithinDeadline,
        backgroundRefresh(reportStalePosts),
      ),
    ),
);

/**
 * The posts last cached and when they were loaded (epoch ms), however old; undefined when the
 * blog sources never answered in this process. Never asks them, never waits and reports no
 * staleness: for a page that cannot wait on a slow reload (a project page's "See also").
 */
export const peekFeedPosts = (): CachedValue<readonly Blog[]> | undefined =>
  blogCache.peek(BLOG_CACHE_KEY);
