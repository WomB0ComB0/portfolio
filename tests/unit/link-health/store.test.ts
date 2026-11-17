// @vitest-environment node

import { Redis } from '@upstash/redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRedisLinkHealthStore, linkHealthRedisConfig } from '@/lib/link-health/store';

const calls: unknown[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});
function redis() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init: RequestInit) => {
      const commands = JSON.parse(String(init.body)) as unknown[][];
      calls.push(...commands);
      return new Response(
        JSON.stringify(commands.map((command) => ({ result: command[0] === 'get' ? '{}' : 'OK' }))),
      );
    }),
  );
  return new Redis(linkHealthRedisConfig('https://redis.example', 'test-token'));
}

describe('link health storage', () => {
  it('keeps storage time bounded and gives every request a fresh timeout', () => {
    const config = linkHealthRedisConfig('https://redis.example', 'test-token');
    expect(config.retry).toEqual({ retries: 0 });
    expect(config.readYourWrites).toBe(true);
    const getSignal = config.signal as () => AbortSignal;
    expect(getSignal()).not.toBe(getSignal());
  });

  it('acquires a shared NX lease which expires after the bounded batch', async () => {
    const store = createRedisLinkHealthStore(redis());
    const lease = await store.acquire();
    expect(lease).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls).toEqual([['set', 'portfolio:link-health:v1:lease', lease, 'nx', 'ex', 30]]);
  });

  it('expires saved health without touching other site data', async () => {
    const store = createRedisLinkHealthStore(redis());
    await store.write('projects', {}, 'owned-lease');
    expect(await store.read('projects')).toEqual({});
    expect(calls).toEqual([
      [
        'eval',
        expect.any(String),
        2,
        'portfolio:link-health:v1:lease',
        'portfolio:link-health:v1:projects',
        'owned-lease',
        '{}',
        30 * 24 * 60 * 60,
      ],
      ['get', 'portfolio:link-health:v1:projects'],
    ]);
  });

  it('does not mistake a rejected or timed-out SET for a lease', async () => {
    const store = createRedisLinkHealthStore(redis());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([{ result: null }]))),
    );
    expect(await store.acquire()).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    );
    await expect(store.acquire()).rejects.toThrow('timeout');
  });
});
