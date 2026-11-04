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
 * Response headers for /sw.js (public/sw.js), the script that retires the service worker older
 * builds registered at that URL. Applied through next.config.ts `headers()`.
 *
 * Browsers skip their HTTP cache when they check a worker script for updates, but a CDN or proxy
 * could still hand out a stale copy. These headers keep every check on the current file.
 *
 * No Content-Type override: Next and Vercel already serve `.js` files with a JavaScript MIME type,
 * which is what browsers require for a worker script. The static SECURITY_HEADERS still apply to
 * this path; the keys here don't overlap with them.
 *
 * Kept free of imports so next.config.ts and the tests can load it directly.
 */

/** Exact path of the worker script. Matches `/sw.js` only, not nested paths or longer names. */
export const RETIRED_SERVICE_WORKER_SOURCE = '/sw.js';

export const RETIRED_SERVICE_WORKER_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
];
