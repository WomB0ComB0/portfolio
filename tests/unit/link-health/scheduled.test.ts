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
import { healthDocumentId, makeHealthDocument } from '@/lib/link-health/documents';
import { runScheduledChecks, type ScheduledDependencies } from '@/lib/link-health/scheduled';
import { nextRecord } from '@/lib/link-health/state';
import { LINK_HEALTH_SCOPES } from '@/lib/link-health/types';

const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const A = 'https://a.example.com/';
const B = 'https://b.example.com/';
const doc = (
  url: string,
  record = nextRecord(undefined, { kind: 'reachable', httpStatus: 200 }, NOW - 86_400_000),
) => ({ ...makeHealthDocument(url, record), _rev: 'original-revision' });
function harness() {
  const catalog = vi.fn<ScheduledDependencies['catalog']>().mockResolvedValue([A, B]);
  const readDocuments = vi.fn<ScheduledDependencies['readDocuments']>().mockResolvedValue([]);
  const probe = vi
    .fn<ScheduledDependencies['probe']>()
    .mockResolvedValue({ kind: 'reachable', httpStatus: 200 });
  const write = vi.fn<ScheduledDependencies['write']>().mockResolvedValue(undefined);
  return { catalog, readDocuments, probe, write, now: () => NOW, monotonic: () => 0 };
}

describe('scheduled checks', () => {
  it('deduplicates fixed scopes, skips fresh records, and commits one guarded transaction', async () => {
    const h = harness();
    h.readDocuments.mockResolvedValue([
      doc(A, nextRecord(undefined, { kind: 'reachable', httpStatus: 200 }, NOW)),
      doc(B),
    ]);
    const result = await runScheduledChecks(h);
    expect(h.catalog.mock.calls.map(([scope]) => scope)).toEqual([...LINK_HEALTH_SCOPES]);
    expect(h.probe).toHaveBeenCalledExactlyOnceWith(B);
    expect(h.write).toHaveBeenCalledOnce();
    const mutations = h.write.mock.calls[0]?.[0];
    expect(mutations).toHaveLength(1);
    expect(mutations?.[0]).toMatchObject({
      patch: {
        id: healthDocumentId(B),
        ifRevisionID: 'original-revision',
        set: { status: 'reachable', url: B },
      },
    });
    expect(result).toMatchObject({ catalog: 2, due: 1, checked: 1, written: 1 });
  });
  it('uses create rather than replace for new IDs, so a racing writer cannot be overwritten', async () => {
    const h = harness();
    await runScheduledChecks(h);
    expect(h.write.mock.calls[0]?.[0]).toEqual([
      {
        create: makeHealthDocument(
          A,
          nextRecord(undefined, { kind: 'reachable', httpStatus: 200 }, NOW),
        ),
      },
      {
        create: makeHealthDocument(
          B,
          nextRecord(undefined, { kind: 'reachable', httpStatus: 200 }, NOW),
        ),
      },
    ]);
  });
  it('dry-runs without any mutation', async () => {
    const h = harness();
    expect(await runScheduledChecks(h, { dryRun: true })).toMatchObject({
      checked: 2,
      written: 0,
      dryRun: true,
    });
    expect(h.write).not.toHaveBeenCalled();
  });
  it.each(['catalog', 'read', 'probe'] as const)(
    'preserves all old records on a %s failure',
    async (stage) => {
      const h = harness();
      if (stage === 'catalog') h.catalog.mockRejectedValueOnce(new Error('secret SDK config'));
      if (stage === 'read') h.readDocuments.mockRejectedValue(new Error('secret SDK config'));
      if (stage === 'probe') h.probe.mockRejectedValueOnce(new Error('secret SDK config'));
      await expect(runScheduledChecks(h)).rejects.toMatchObject({ stage });
      expect(h.write).not.toHaveBeenCalled();
    },
  );
  it('reports a sanitized write error, without SDK secrets or retrying a partial update', async () => {
    const h = harness();
    h.write.mockRejectedValue(new Error('Authorization: Bearer secret-token'));
    await expect(runScheduledChecks(h)).rejects.toMatchObject({
      stage: 'write',
      message: 'Scheduled link check failed: write',
    });
    expect(h.write).toHaveBeenCalledOnce();
  });
  it('rejects malformed catalogs or persisted records before probing', async () => {
    const h = harness();
    h.catalog.mockResolvedValueOnce(['http://user:password@example.com/']);
    await expect(runScheduledChecks(h)).rejects.toMatchObject({ stage: 'catalog' });
    expect(h.probe).not.toHaveBeenCalled();
    const bad = harness();
    bad.readDocuments.mockResolvedValue([{ ...doc(A), url: B }]);
    await expect(runScheduledChecks(bad)).rejects.toMatchObject({ stage: 'read' });
    expect(bad.probe).not.toHaveBeenCalled();
  });
  it('retains the 100-URL bound and never has more than two active probes', async () => {
    const h = harness();
    h.catalog.mockResolvedValue(Array.from({ length: 110 }, (_, i) => `https://example.com/${i}`));
    let active = 0;
    let maximum = 0;
    h.probe.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return { kind: 'reachable', httpStatus: 200 };
    });
    expect(await runScheduledChecks(h)).toMatchObject({ due: 110, checked: 100, deferred: 10 });
    expect(maximum).toBeLessThanOrEqual(2);
  });
  it('does not save a batch that crosses the total deadline after a process pause', async () => {
    const h = harness();
    let time = 0;
    h.monotonic = () => time;
    h.probe.mockImplementation(async () => {
      time = 300_001;
      return { kind: 'reachable' };
    });
    await expect(runScheduledChecks(h)).rejects.toMatchObject({ stage: 'deadline' });
    expect(h.write).not.toHaveBeenCalled();
  });
  it('confirms only separated missing checks and keeps Notion missing inconclusive', async () => {
    const h = harness();
    const notion = 'https://shared.notion.site/page';
    h.catalog.mockResolvedValue([A, notion]);
    h.readDocuments.mockResolvedValue([
      doc(A, nextRecord(undefined, { kind: 'missing', httpStatus: 404 }, NOW - 120_000)),
    ]);
    h.probe.mockResolvedValue({ kind: 'missing', httpStatus: 404 });
    expect(await runScheduledChecks(h)).toMatchObject({ unavailable: 1, unknown: 1 });
    expect(h.write.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          create: expect.objectContaining({ url: notion, status: 'unknown' }),
        }),
      ]),
    );
  });
});
