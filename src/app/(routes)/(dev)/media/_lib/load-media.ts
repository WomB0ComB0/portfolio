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
 * @file The data behind each /media tab, loaded on the server. The Sanity collections come from
 * the shared loaders (one stale-on-error cache per collection, shared with /api/v1/sanity/*); the
 * blog gets its own stale-on-error cache here, since Hashnode's feed, its post pages and dev.to
 * are slow to ask and change rarely.
 */

import { cache } from 'react';
import { type Blog, fetchBlogs } from '@/app/api/v1/[[...route]]/blog/handlers';
import { ensureBaseError } from '@/classes/error';
import { createStaleCache } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';

export type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';
export {
  type Article,
  type ListedVideo,
  loadArticles,
  loadPresentations,
  loadTalks,
  loadVideos,
  type Presentation,
  type Talk,
} from '@/lib/sanity/loaders';

/** How long the blog list is served from memory before the sources are asked again. */
export const BLOG_CACHE_TTL_MS = 30 * 60_000;

const BLOG_CACHE_KEY = 'blog:posts';

/** The clock is read on every call, so a test's faked Date moves it too. */
const blogCache = createStaleCache<readonly Blog[]>({
  ttlMs: BLOG_CACHE_TTL_MS,
  now: () => Date.now(),
});

/**
 * Every blog post, newest first. When both sources fail after a good load, the last good list is
 * served and a warning is sent; with nothing cached, this rejects with fetchBlogs' error, which
 * the panel's section boundary shows.
 */
export const loadBlogPosts = cache(async (): Promise<readonly Blog[]> => {
  const result = await blogCache.get(BLOG_CACHE_KEY, fetchBlogs);
  if (result.stale) {
    reportApiFailure(ensureBaseError(result.error, 'blog:posts'), {
      context: 'load blog for pages',
      level: 'warning',
    });
  }
  return result.data;
});
