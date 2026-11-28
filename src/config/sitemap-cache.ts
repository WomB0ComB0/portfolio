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
 * How long Vercel's CDN keeps /sitemap.xml, applied through next.config.ts `headers()`.
 *
 * The sitemap renders on request (`dynamic = 'force-dynamic'` in src/app/sitemap.ts): with Next's
 * build adapter on Vercel, a prerendered sitemap with `revalidate` ships as a static file that
 * never refreshes until the next deploy (vercel/next.js#99055). This header caches the function's
 * answer instead: fresh for 50 minutes, then served stale for up to 10 more while one render in
 * the background replaces it, so while renders succeed a copy is at most an hour old and each
 * region renders it about once an hour, not once per crawler request. A render that fails (Sanity
 * down with nothing cached in the instance) is never cached: the CDN keeps serving the last good
 * copy for up to a day instead of the error (stale-if-error).
 *
 * Vercel-CDN-Cache-Control, because the sitemap handler sends its own `Cache-Control: public,
 * max-age=0, must-revalidate`, and a function's Cache-Control wins over one from next.config.ts;
 * Vercel-CDN-Cache-Control has top priority wherever it is set, and Vercel strips it, so browsers
 * and other caches still see max-age=0. A deploy clears the CDN cache, so a new build answers
 * fresh at once.
 *
 * Kept free of imports so next.config.ts and the tests can load it directly.
 */

/** Exact path of the sitemap. */
export const SITEMAP_SOURCE = '/sitemap.xml';

export const SITEMAP_CDN_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: 'Vercel-CDN-Cache-Control',
    value: 'max-age=3000, stale-while-revalidate=600, stale-if-error=86400',
  },
];
