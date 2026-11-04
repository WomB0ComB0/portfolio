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
 * @file The header rules in next.config.ts, resolved the way Next applies them: every matching
 * rule in order, a later rule replacing an earlier one's value for the same key. This catches a
 * rule that is missing from `headers()` or overridden by another, which the tests of the header
 * constants alone can't.
 */

import { buildCustomRoute } from 'next/dist/lib/build-custom-route';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  RETIRED_SERVICE_WORKER_HEADERS,
  RETIRED_SERVICE_WORKER_SOURCE,
} from '@/config/retired-service-worker';
import { SECURITY_HEADERS } from '@/config/security-headers';

// next.config.ts validates the environment on import and wraps the config in build plugins. None
// of that affects headers(), so the env is empty and each plugin hands the config back unchanged.
vi.mock('../../../src/env', () => ({ env: {}, default: {} }));
vi.mock('@million/lint', () => ({ default: { next: () => (config: unknown) => config } }));
vi.mock('@next/bundle-analyzer', () => ({ default: () => (config: unknown) => config }));
vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig: (config: unknown) => config }));

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

let rules: HeaderRule[] = [];

/** The response headers Next would send for `path`, keyed by lower-case name. */
const headersFor = (path: string) => {
  const sent = new Map<string, string>();
  for (const rule of rules) {
    const route = buildCustomRoute('header', rule);
    if (!new RegExp(route.regex).test(path)) continue;
    for (const { key, value } of rule.headers) sent.set(key.toLowerCase(), value);
  }
  return sent;
};

const retiredCacheControl = RETIRED_SERVICE_WORKER_HEADERS.find(
  (h) => h.key.toLowerCase() === 'cache-control',
)?.value;

beforeAll(async () => {
  // The config's optional optimisation lists may be missing here; that warning isn't under test.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const { default: config } = await import('../../../next.config');
    rules = ((await config.headers?.()) ?? []) as HeaderRule[];
  } finally {
    warn.mockRestore();
  }
});

describe('next.config.ts headers()', () => {
  it('serves /sw.js with the retired worker headers, not overridden by any other rule', () => {
    expect(rules.some((rule) => rule.source === RETIRED_SERVICE_WORKER_SOURCE)).toBe(true);
    expect(retiredCacheControl).toBeDefined();

    const sent = headersFor(RETIRED_SERVICE_WORKER_SOURCE);
    for (const { key, value } of RETIRED_SERVICE_WORKER_HEADERS) {
      expect(sent.get(key.toLowerCase()), key).toBe(value);
    }
  });

  it('keeps every static security header on /sw.js', () => {
    const sent = headersFor(RETIRED_SERVICE_WORKER_SOURCE);
    for (const { key, value } of SECURITY_HEADERS) {
      expect(sent.get(key.toLowerCase()), key).toBe(value);
    }
  });

  it('does not put the no-store rule on pages or other scripts', () => {
    for (const path of ['/', '/places', '/sw.js.map', '/a/sw.js', '/_next/static/chunks/x.js']) {
      expect(headersFor(path).get('cache-control'), path).not.toBe(retiredCacheControl);
    }
  });
});
