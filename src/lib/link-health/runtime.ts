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
import { processGlobal } from '@/lib/cache/process-global';
import { reportApiFailure } from '@/lib/observability/report';
import { sanityClientWithToken } from '@/lib/sanity/client';
import { loadLinkCatalog } from './catalog';
import { HEALTH_DOCUMENT_QUERY } from './documents';
import { createLinkHealthReader } from './reader';
import type { LinkHealthScope } from './types';

const reader = () =>
  processGlobal('link-health.sanity-reader.v1', () =>
    createLinkHealthReader({
      catalog: loadLinkCatalog,
      fetchDocuments: (ids) =>
        sanityClientWithToken.fetch(
          HEALTH_DOCUMENT_QUERY,
          { ids },
          { signal: AbortSignal.timeout(3000) },
        ),
      report: () =>
        reportApiFailure(new Error('Link health snapshot unavailable'), {
          context: 'link-health',
          level: 'warning',
        }),
    }),
  );

export const readLinkHealth = (scope: LinkHealthScope) => reader().read(scope);
export const readLinkHealthCatalog = async (scope: LinkHealthScope) => ({
  scope,
  urls: await loadLinkCatalog(scope),
});
