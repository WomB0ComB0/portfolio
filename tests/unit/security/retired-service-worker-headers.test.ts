// @vitest-environment node
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
 * @file /sw.js (public/sw.js) retires the service worker older builds registered. Its response
 * must not be cached, must apply to that exact path only, and must still be served as JavaScript
 * with the static security headers. Sources are compiled with Next's own route builder.
 */

import { buildCustomRoute } from 'next/dist/lib/build-custom-route';
import { getContentType } from 'next/dist/server/serve-static';
import { describe, expect, it } from 'vitest';

import {
  RETIRED_SERVICE_WORKER_HEADERS,
  RETIRED_SERVICE_WORKER_SOURCE,
} from '@/config/retired-service-worker';
import { SECURITY_HEADERS, SECURITY_HEADERS_SOURCE } from '@/config/security-headers';

const compile = (source: string, headers: ReadonlyArray<{ key: string; value: string }>) => {
  const route = buildCustomRoute('header', { source, headers: [...headers] });
  return (path: string) => new RegExp(route.regex).test(path);
};

const header = (key: string) =>
  RETIRED_SERVICE_WORKER_HEADERS.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('retired service worker headers', () => {
  const matches = compile(RETIRED_SERVICE_WORKER_SOURCE, RETIRED_SERVICE_WORKER_HEADERS);

  it('applies to /sw.js only', () => {
    expect(matches('/sw.js')).toBe(true);
    for (const path of [
      '/sw.jsx',
      '/sw.js.map',
      '/a/sw.js',
      '/xsw.js',
      '/',
      '/service-worker.js',
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('stops browsers, CDNs and proxies from serving a stale copy', () => {
    const cacheControl = header('Cache-Control');
    expect(cacheControl).toBeDefined();
    for (const directive of ['no-cache', 'no-store', 'must-revalidate']) {
      expect(cacheControl).toContain(directive);
    }
  });

  it('keeps the static security headers on /sw.js without overriding any of them', () => {
    expect(compile(SECURITY_HEADERS_SOURCE, SECURITY_HEADERS)('/sw.js')).toBe(true);

    const securityKeys = new Set(SECURITY_HEADERS.map((h) => h.key.toLowerCase()));
    for (const { key } of RETIRED_SERVICE_WORKER_HEADERS) {
      expect(securityKeys.has(key.toLowerCase()), key).toBe(false);
    }
  });

  it('leaves the Content-Type to the static file server, which already sends JavaScript', () => {
    expect(header('Content-Type')).toBeUndefined();
    // Browsers reject a worker script without a JavaScript MIME type (and nosniff is set).
    expect(getContentType('js')).toMatch(/^(application|text)\/javascript/);
  });
});
