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
import { makeHealthDocument } from '@/lib/link-health/documents';
import { createLinkHealthReader } from '@/lib/link-health/reader';
import { nextRecord } from '@/lib/link-health/state';

const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const URL = 'https://content.example.com/page';
const first = nextRecord(undefined, { kind: 'missing', httpStatus: 404 }, NOW - 120_000);
const missing = nextRecord(first, { kind: 'missing', httpStatus: 404 }, NOW);
const document = (url = URL) => ({ ...makeHealthDocument(url, missing), _rev: 'rev-1' });

describe('read-only Sanity link health', () => {
  it('returns only current catalog warnings and shares a cached read without any probe dependency', async () => {
    const catalog = vi.fn().mockResolvedValue([URL]);
    const fetchDocuments = vi
      .fn()
      .mockResolvedValue([document(), document('https://removed.example.com/')]);
    const reader = createLinkHealthReader({ catalog, fetchDocuments, now: () => NOW });
    const expected = {
      links: { [URL]: { status: 'unavailable', checkedAt: new Date(NOW).toISOString() } },
    };
    expect(await reader.read('projects')).toEqual(expected);
    expect(await reader.read('projects')).toEqual(expected);
    expect(fetchDocuments).toHaveBeenCalledOnce();
    expect(fetchDocuments.mock.calls[0]?.[0]).toEqual([document()._id]);
  });
  it('expires cached public warnings after24h and excludes inconclusive/Notion records', async () => {
    let now = NOW;
    const notion = 'https://shared.notion.site/page';
    const temporary = {
      ...makeHealthDocument(
        'https://slow.example.com/',
        nextRecord(undefined, { kind: 'temporary' }, NOW),
      ),
      _rev: 'rev-2',
    };
    const reader = createLinkHealthReader({
      catalog: async () => [URL, notion, temporary.url],
      fetchDocuments: async () => [document(), document(notion), temporary],
      now: () => now,
    });
    expect(Object.keys((await reader.read('media')).links)).toEqual([URL]);
    now += 86_400_000;
    expect(await reader.read('media')).toEqual({ links: {} });
  });
  it('fails closed when the current catalog cannot be authorized', async () => {
    const fetchDocuments = vi.fn();
    const reader = createLinkHealthReader({
      catalog: async () => {
        throw new Error('catalog failed');
      },
      fetchDocuments,
    });
    expect(await reader.read('projects')).toEqual({ links: {} });
    expect(fetchDocuments).not.toHaveBeenCalled();
  });
  it('contains cache failures and rejects malformed records', async () => {
    const fetchDocuments = vi
      .fn()
      .mockResolvedValueOnce([{ ...document(), status: 'temporary' }])
      .mockRejectedValue(new Error('Sanity unavailable'));
    let now = NOW;
    const reader = createLinkHealthReader({
      catalog: async () => [URL],
      fetchDocuments,
      now: () => now,
    });
    expect(await reader.read('projects')).toEqual({ links: {} });
    now += 60_001;
    expect(await reader.read('projects')).toEqual({ links: {} });
  });
});
