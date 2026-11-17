import { describe, expect, it } from 'vitest';
import { nextRecord, publicEntry, readRecord } from '@/lib/link-health/state';

const NOW = Date.parse('2026-11-17T01:00:00Z');
const MINUTE = 60_000;

describe('link health observations', () => {
  it('requires two missing observations at least two minutes apart', () => {
    const first = nextRecord(undefined, { kind: 'missing', httpStatus: 404 }, NOW);
    expect(first.status).toBe('unknown');
    expect(first.nextCheckAt).toBe(NOW + 2 * MINUTE);
    expect(nextRecord(first, { kind: 'missing', httpStatus: 410 }, NOW + MINUTE).status).toBe(
      'unknown',
    );
    const confirmed = nextRecord(first, { kind: 'missing', httpStatus: 404 }, NOW + 2 * MINUTE);
    expect(confirmed.status).toBe('unavailable');
    expect(confirmed.nextCheckAt).toBe(NOW + 62 * MINUTE);
  });

  it.each(['reachable', 'temporary', 'unknown'] as const)(
    'clears a missing streak on %s',
    (kind) => {
      const first = nextRecord(undefined, { kind: 'missing' }, NOW);
      const interrupted = nextRecord(first, { kind }, NOW + 2 * MINUTE);
      expect(interrupted.status).toBe(kind);
      expect(nextRecord(interrupted, { kind: 'missing' }, NOW + 4 * MINUTE).status).toBe('unknown');
    },
  );

  it('does not join two missing observations separated by a day or a backwards clock', () => {
    const first = nextRecord(undefined, { kind: 'missing' }, NOW);
    expect(nextRecord(first, { kind: 'missing' }, NOW + 25 * 60 * MINUTE).status).toBe('unknown');
    expect(nextRecord(first, { kind: 'missing' }, NOW - MINUTE).status).toBe('unknown');
  });

  it('clears a confirmed unavailable label immediately on recovery', () => {
    const first = nextRecord(undefined, { kind: 'missing' }, NOW);
    const failed = nextRecord(first, { kind: 'missing' }, NOW + 2 * MINUTE);
    const recovered = nextRecord(failed, { kind: 'reachable' }, NOW + 3 * MINUTE);
    expect(recovered.status).toBe('reachable');
    expect(recovered.nextCheckAt).toBe(NOW + 363 * MINUTE);
  });

  it('retries temporary failures sooner than healthy or uncheckable links', () => {
    expect(nextRecord(undefined, { kind: 'temporary' }, NOW).nextCheckAt).toBe(NOW + 15 * MINUTE);
    expect(nextRecord(undefined, { kind: 'unknown' }, NOW).nextCheckAt).toBe(NOW + 360 * MINUTE);
  });

  it('omits stale and future-dated warnings and exposes no internal HTTP details', () => {
    const record = nextRecord(undefined, { kind: 'temporary', httpStatus: 503 }, NOW);
    expect(publicEntry(record, NOW)).toEqual({
      status: 'temporary',
      checkedAt: new Date(NOW).toISOString(),
    });
    expect(publicEntry(record, NOW + 24 * 60 * MINUTE)).toBeUndefined();
    expect(publicEntry(record, NOW - MINUTE)).toBeUndefined();
  });

  it('validates persisted records before reading', () => {
    const record = nextRecord(undefined, { kind: 'reachable' }, NOW);
    expect(readRecord(record)).toEqual(record);
    for (const value of [
      null,
      {},
      { ...record, checkedAt: 'bad' },
      { ...record, nextCheckAt: Infinity },
      { ...record, status: 'made-up' },
      { ...record, kind: 'missing', status: 'reachable' },
    ]) {
      expect(readRecord(value)).toBeUndefined();
    }
  });
});
