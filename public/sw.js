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
 * Retired service worker.
 *
 * Builds before 2025-10-24 registered a Workbox worker at this URL (@ducanh2912/next-pwa, scope
 * "/"). The site no longer uses a service worker, but a browser keeps an installed worker until it
 * is replaced, and a 404 at this URL does not remove it. Browsers re-check this file when a page
 * in scope loads, so serving this version replaces the old worker: it activates straight away,
 * deletes the caches the old worker filled and unregisters itself.
 *
 * There is no fetch handler, so requests go to the network as soon as it activates. Open tabs are
 * not reloaded; the next page load is not controlled by any worker.
 *
 * Keep this file published at /sw.js. Removing it brings the 404 back, and visitors who still have
 * the old worker keep it.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((key) => caches.delete(key)));
      } catch {
        // Cache Storage is unavailable, so there is nothing to clear. Unregister regardless.
      }
      await self.registration.unregister();
    })(),
  );
});
