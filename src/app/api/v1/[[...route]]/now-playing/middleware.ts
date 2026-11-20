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

import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

/**
 * A successful answer is kept by the CDN for 15 s, then served stale for up to 15 s more while one
 * request asks Spotify again. However many tabs poll (every 30 s on home and /spotify, and as the
 * /stats fallback), the function then runs about once per 15 s per CDN region instead of once per
 * poll. max-age=0 keeps browsers from holding it, so each 30 s poll still reaches the CDN and a
 * tile shows what was playing at most about 30 s earlier.
 */
export const NOW_PLAYING_CACHE_CONTROL =
  'public, max-age=0, s-maxage=15, stale-while-revalidate=15';

export const cacheHeaders = createCacheHeaders({
  contentType: 'application/json',
  cacheControl: NOW_PLAYING_CACHE_CONTROL,
});

/** A failure must never be cached as an answer, by the browser or a CDN. */
export const errorCacheHeaders = createCacheHeaders({
  contentType: 'application/json',
  cacheControl: 'no-store',
});

export const errorHandler = createErrorHandler({
  context: 'now-playing API route',
  customMessage: () => 'Internal Server Error',
});
