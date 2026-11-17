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

import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ readLinkHealth: vi.fn(), readLinkHealthCatalog: vi.fn() }));
const background = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock('@/lib/link-health/runtime', () => runtime);
vi.mock('next/server', () => background);

import { linkHealthRoute } from '@/app/api/v1/[[...route]]/link-health';

const app = new Elysia().use(linkHealthRoute);
const request = (query: string) => app.handle(new Request(`http://localhost/link-health?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  runtime.readLinkHealth.mockResolvedValue({ links: {} });
  runtime.readLinkHealthCatalog.mockResolvedValue({
    scope: 'projects',
    urls: ['https://example.com/demo'],
  });
});

describe('GET /link-health', () => {
  it('returns cached Sanity data without scheduling any background probe', async () => {
    const cached = {
      links: {
        'https://example.com/demo': { status: 'unavailable', checkedAt: '2026-11-17T01:00:00Z' },
      },
    };
    runtime.readLinkHealth.mockResolvedValue(cached);
    const response = await request('scope=projects');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cached);
    expect(response.headers.get('cache-control')).toContain('s-maxage=30');
    expect(runtime.readLinkHealth).toHaveBeenCalledWith('projects');
    expect(background.after).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'scope=places',
    'scope=spotify',
    'scope=https%3A%2F%2Fexample.com',
    'url=https%3A%2F%2Fexample.com',
  ])('rejects unsupported or missing scopes: %s', async (query) => {
    const response = await request(query);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(runtime.readLinkHealth).not.toHaveBeenCalled();
    expect(background.after).not.toHaveBeenCalled();
  });

  it('cannot pass an arbitrary URL to the checker', async () => {
    await request('scope=media&url=https%3A%2F%2F127.0.0.1%2Fsecret');
    for (const args of runtime.readLinkHealth.mock.calls) expect(args).toEqual(['media']);
    expect(background.after).not.toHaveBeenCalled();
  });

  it('serves only the fixed published catalog for the scheduler', async () => {
    const response = await app.handle(
      new Request('http://localhost/link-health/catalog?scope=projects&url=http://127.0.0.1'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scope: 'projects',
      urls: ['https://example.com/demo'],
    });
    expect(runtime.readLinkHealthCatalog).toHaveBeenCalledExactlyOnceWith('projects');
    expect(background.after).not.toHaveBeenCalled();
  });

  it('returns503 on a catalog failure instead of treating it as an empty allowlist', async () => {
    runtime.readLinkHealthCatalog.mockRejectedValue(new Error('source failed'));
    const response = await app.handle(
      new Request('http://localhost/link-health/catalog?scope=projects'),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('source failed');
  });
});
