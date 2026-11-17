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

import 'server-only';

import { createStaleCache } from '@/lib/cache/stale-cache';
import { healthDocumentId, readHealthDocument } from './documents';
import { canWarnForLink } from './public-warning';
import { publicEntry } from './state';
import type { LinkHealthResponse, LinkHealthScope } from './types';
import { normalizeLinkUrl } from './url';

interface ReaderDependencies {
  catalog(scope: LinkHealthScope): Promise<readonly string[]>;
  fetchDocuments(ids: readonly string[]): Promise<unknown>;
  now?: () => number;
  report?: () => void;
}

/** Website reads have no probe, lease, write token or mutation dependency. */
export function createLinkHealthReader({
  catalog,
  fetchDocuments,
  now = Date.now,
  report = () => undefined,
}: ReaderDependencies) {
  const cache = createStaleCache<unknown>({ ttlMs: 60_000, now });
  return {
    async read(scope: LinkHealthScope): Promise<LinkHealthResponse> {
      try {
        const urls = [
          ...new Set((await catalog(scope)).flatMap((value) => normalizeLinkUrl(value) ?? [])),
        ].slice(0, 500);
        if (urls.length === 0) return { links: {} };
        const allowed = new Set(urls);
        const cached = await cache.get(scope, () => fetchDocuments(urls.map(healthDocumentId)));
        const links: LinkHealthResponse['links'] = {};
        const time = now();
        for (const raw of Array.isArray(cached.data) ? cached.data.slice(0, 500) : []) {
          const document = readHealthDocument(raw, time);
          if (!document || !allowed.has(document.url) || !canWarnForLink(document.url)) continue;
          const entry = publicEntry(document.record, time);
          if (entry) links[document.url] = entry;
        }
        return { links };
      } catch {
        report();
        return { links: {} };
      }
    },
  };
}
