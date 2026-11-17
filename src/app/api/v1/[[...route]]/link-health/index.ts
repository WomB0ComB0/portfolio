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

import { Elysia, t } from 'elysia';
import { readLinkHealth, readLinkHealthCatalog } from '@/lib/link-health/runtime';

const scope = t.Union([
  t.Literal('projects'),
  t.Literal('media'),
  t.Literal('certifications'),
  t.Literal('experience'),
]);

/** Fixed content collections only: this endpoint cannot check a supplied URL. */
export const linkHealthRoute = new Elysia({ prefix: '/link-health' })
  .get(
    '/catalog',
    async ({ query, set }) => {
      try {
        const result = await readLinkHealthCatalog(query.scope);
        set.headers['Cache-Control'] = 'public, max-age=0, s-maxage=60';
        return result;
      } catch {
        set.status = 503;
        set.headers['Cache-Control'] = 'no-store';
        return { error: 'Link catalog unavailable' };
      }
    },
    { query: t.Object({ scope }) },
  )
  .get(
    '/',
    async ({ query, set }) => {
      const result = await readLinkHealth(query.scope);
      set.headers['Cache-Control'] = 'public, max-age=0, s-maxage=30, stale-while-revalidate=30';
      return result;
    },
    { query: t.Object({ scope }) },
  );
