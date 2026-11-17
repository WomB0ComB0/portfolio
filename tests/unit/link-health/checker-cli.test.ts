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

import { describe, expect, it, vi } from 'vitest';
import { fetchPublishedCatalog } from '../../../scripts/link-health/catalog';
import { runCli } from '../../../scripts/link-health/check';

describe('fixed catalog HTTP reader', () => {
  it('uses only the production fixed-scope GET, with no credentials or redirects', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ scope: 'projects', urls: ['https://example.com/'] })),
      );
    expect(await fetchPublishedCatalog('projects', fetcher)).toEqual(['https://example.com/']);
    expect(fetcher).toHaveBeenCalledWith(
      'https://mikeodnis.dev/api/v1/link-health/catalog?scope=projects',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fetcher.mock.calls[0]?.[1].headers).toEqual({ accept: 'application/json' });
  });
  it.each([
    { scope: 'media', urls: ['https://example.com/'] },
    { scope: 'projects', urls: ['http://secret:password@example.com/'] },
    { scope: 'projects', urls: ['/local'] },
    { scope: 'projects', urls: Array(501).fill('https://example.com/') },
  ])('rejects malformed or mismatched catalog payloads', async (payload) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
    await expect(fetchPublishedCatalog('projects', fetcher)).rejects.toThrow();
  });
  it('bounds catalog response bytes before JSON parsing', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('x'.repeat(2_000_001)));
    await expect(fetchPublishedCatalog('projects', fetcher)).rejects.toThrow();
  });
});

describe('checker CLI output boundary', () => {
  it('prints help without requiring app configuration or opening clients', async () => {
    const factory = vi.fn();
    const log = vi.fn();
    const error = vi.fn();
    expect(
      await runCli({ args: ['--help'], env: {}, createDependencies: factory, log, error }),
    ).toBe(0);
    expect(factory).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('--dry-run'));
  });
  it('never logs an SDK error object, config, URL or authorization header', async () => {
    const log = vi.fn();
    const error = vi.fn();
    const factory = vi.fn(() => {
      throw Object.assign(new Error('Bearer secret-value'), { config: { token: 'secret-value' } });
    });
    expect(await runCli({ args: [], env: {}, createDependencies: factory, log, error })).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret-value');
    expect(error).toHaveBeenCalledWith(
      'Scheduled link check failed: configuration. No records were deleted.',
    );
  });
  it('accepts no arbitrary target URL argument', async () => {
    const factory = vi.fn();
    const error = vi.fn();
    expect(
      await runCli({
        args: ['--url=https://example.com/'],
        env: {},
        createDependencies: factory,
        log: vi.fn(),
        error,
      }),
    ).toBe(1);
    expect(factory).not.toHaveBeenCalled();
  });
});
