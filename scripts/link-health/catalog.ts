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

import { ScheduledCheckError } from '../../src/lib/link-health/scheduled';
import { LINK_HEALTH_SCOPES, type LinkHealthScope } from '../../src/lib/link-health/types';
import { normalizeLinkUrl } from '../../src/lib/link-health/url';

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
const MAX_BYTES = 2_000_000;

/** Only the deployed, fixed-scope published catalog; never a caller-provided target endpoint. */
export async function fetchPublishedCatalog(
  scope: LinkHealthScope,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<string[]> {
  try {
    if (!LINK_HEALTH_SCOPES.includes(scope)) throw new Error('Invalid scope');
    const response = await fetcher(
      `https://mikeodnis.dev/api/v1/link-health/catalog?scope=${scope}`,
      {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Catalog unavailable');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error('Catalog too large');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const payload: unknown = JSON.parse(text);
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('scope' in payload) ||
      payload.scope !== scope ||
      !('urls' in payload) ||
      !Array.isArray(payload.urls) ||
      payload.urls.length > 500 ||
      payload.urls.some((url) => typeof url !== 'string' || normalizeLinkUrl(url) !== url)
    )
      throw new Error('Invalid catalog');
    return payload.urls as string[];
  } catch {
    throw new ScheduledCheckError('catalog');
  }
}
