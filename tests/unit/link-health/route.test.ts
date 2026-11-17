// @vitest-environment node
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ readLinkHealth: vi.fn(), refreshLinkHealth: vi.fn() }));
const background = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock('@/lib/link-health/runtime', () => runtime);
vi.mock('next/server', () => background);

import { linkHealthRoute } from '@/app/api/v1/[[...route]]/link-health';

const app = new Elysia().use(linkHealthRoute);
const request = (query: string) => app.handle(new Request(`http://localhost/link-health?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  runtime.readLinkHealth.mockResolvedValue({ links: {} });
  runtime.refreshLinkHealth.mockResolvedValue(undefined);
});

describe('GET /link-health', () => {
  it('returns cached data immediately and schedules the probe batch after the response', async () => {
    const cached = {
      links: {
        'https://example.com/demo': { status: 'temporary', checkedAt: '2026-11-17T01:00:00Z' },
      },
    };
    runtime.readLinkHealth.mockResolvedValue(cached);
    const response = await request('scope=projects');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cached);
    expect(response.headers.get('cache-control')).toContain('s-maxage=30');
    expect(runtime.readLinkHealth).toHaveBeenCalledWith('projects');
    expect(runtime.refreshLinkHealth).not.toHaveBeenCalled();
    expect(background.after).toHaveBeenCalledTimes(1);
    await background.after.mock.calls[0]?.[0]();
    expect(runtime.refreshLinkHealth).toHaveBeenCalledWith('projects');
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
    for (const [task] of background.after.mock.calls) await task();
    for (const args of runtime.refreshLinkHealth.mock.calls) expect(args).toEqual(['media']);
  });
});
