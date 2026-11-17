// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLinkHealthService, type LinkHealthStore } from '@/lib/link-health/service';
import { type LinkRecord, nextRecord } from '@/lib/link-health/state';
import type { LinkHealthScope } from '@/lib/link-health/types';

const NOW = Date.parse('2026-11-17T01:00:00Z');
const URL_A = 'https://example.com/demo';

function fixture() {
  let now = NOW;
  let leasedUntil = 0;
  const records = new Map<LinkHealthScope, unknown>();
  const store: LinkHealthStore = {
    read: vi.fn(async (scope) => records.get(scope) ?? {}),
    acquire: vi.fn(async () => {
      if (leasedUntil > now) return null;
      leasedUntil = now + 30_000;
      return 'lease-token';
    }),
    write: vi.fn(async (scope, data) => {
      records.set(scope, data);
    }),
  };
  const catalog = vi.fn(async () => [URL_A]);
  const probe = vi.fn(async () => ({ kind: 'reachable' as const }));
  const service = createLinkHealthService({ store, catalog, probe, now: () => now });
  return {
    service,
    store,
    records,
    catalog,
    probe,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('cached link health service', () => {
  it('reads cached statuses without probing and filters removed links', async () => {
    const f = fixture();
    f.records.set('projects', {
      [URL_A]: nextRecord(undefined, { kind: 'temporary' }, NOW),
      'https://removed.example/': nextRecord(undefined, { kind: 'temporary' }, NOW),
    });
    expect(await f.service.read('projects')).toEqual({
      links: { [URL_A]: { status: 'temporary', checkedAt: new Date(NOW).toISOString() } },
    });
    expect(f.probe).not.toHaveBeenCalled();
    expect(f.store.acquire).not.toHaveBeenCalled();
  });

  it('does nothing without shared storage or when the lease is held', async () => {
    const f = fixture();
    const offline = createLinkHealthService({ store: null, catalog: f.catalog, probe: f.probe });
    await offline.refresh('projects');
    expect(await offline.read('projects')).toEqual({ links: {} });
    expect(f.catalog).not.toHaveBeenCalled();
    vi.mocked(f.store.acquire).mockResolvedValue(null);
    await f.service.refresh('projects');
    expect(f.probe).not.toHaveBeenCalled();
  });

  it.each(['read', 'acquire'] as const)('fails closed if Redis %s fails', async (method) => {
    const f = fixture();
    vi.mocked(f.store[method]).mockRejectedValue(new Error('Redis unavailable'));
    await f.service.refresh('projects');
    expect(f.probe).not.toHaveBeenCalled();
  });

  it('never probes fresh records and recovers due links', async () => {
    const f = fixture();
    await f.service.refresh('projects');
    f.advance(30_000);
    await f.service.refresh('projects');
    expect(f.probe).toHaveBeenCalledTimes(1);
    f.advance(6 * 60 * 60_000);
    await f.service.refresh('projects');
    expect(f.probe).toHaveBeenCalledTimes(2);
    expect((await f.service.read('projects')).links[URL_A]?.status).toBe('reachable');
  });

  it('shares a lease across scopes and prunes retired URLs when saving', async () => {
    const f = fixture();
    f.records.set('projects', {
      'https://retired.example/': nextRecord(undefined, { kind: 'reachable' }, NOW),
    });
    await Promise.all([f.service.refresh('projects'), f.service.refresh('media')]);
    expect(f.probe).toHaveBeenCalledTimes(1);
    expect(Object.keys(f.records.get('projects') as object)).toEqual([URL_A]);
  });

  it('bounds each refresh to 8 catalog URLs and 2 concurrent probes', async () => {
    const f = fixture();
    f.catalog.mockResolvedValue(Array.from({ length: 30 }, (_, i) => `https://example.com/${i}`));
    let active = 0;
    let maximum = 0;
    f.probe.mockImplementation(async () => {
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return { kind: 'reachable' };
    });
    await f.service.refresh('projects');
    expect(f.probe).toHaveBeenCalledTimes(8);
    expect(maximum).toBe(2);
    expect(f.store.write).toHaveBeenCalledWith('projects', expect.any(Object), 'lease-token');
  });

  it('prioritizes due missing confirmations without starving other links', async () => {
    const f = fixture();
    f.catalog.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) => `https://example.com/${i}`),
      URL_A,
    ]);
    f.records.set('projects', {
      [URL_A]: nextRecord(undefined, { kind: 'missing' }, NOW - 120_000),
    });
    await f.service.refresh('projects');
    expect(f.probe.mock.calls[0]).toEqual([URL_A]);
    expect(f.probe).toHaveBeenCalledTimes(8);
  });

  it('discards corrupt and stale cache entries from the public response', async () => {
    const f = fixture();
    f.records.set('projects', { [URL_A]: { checkedAt: 'bad', status: 'unavailable' } });
    expect(await f.service.read('projects')).toEqual({ links: {} });
    f.records.set('projects', {
      [URL_A]: nextRecord(undefined, { kind: 'temporary' }, NOW - 24 * 60 * 60_000),
    });
    expect(await f.service.read('projects')).toEqual({ links: {} });
  });

  it('stops starting probes before the shared lease can expire', async () => {
    const f = fixture();
    f.catalog.mockResolvedValue(Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`));
    f.probe.mockImplementation(async () => {
      f.advance(13_000);
      return { kind: 'reachable' };
    });
    await f.service.refresh('projects');
    expect(f.probe).toHaveBeenCalledTimes(2);
  });

  it('isolates a failed probe and saves the remaining results', async () => {
    const f = fixture();
    f.catalog.mockResolvedValue([URL_A, 'https://example.com/second']);
    f.probe.mockRejectedValueOnce(new Error('probe failed'));
    await f.service.refresh('projects');
    const data = f.records.get('projects') as Record<string, LinkRecord>;
    expect(data[URL_A]?.status).toBe('unknown');
    expect(data['https://example.com/second']?.status).toBe('reachable');
  });
});
