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

import { describe, expect, it } from 'vitest';
import {
  healthDocumentId,
  makeHealthDocument,
  readHealthDocument,
} from '@/lib/link-health/documents';
import { nextRecord } from '@/lib/link-health/state';

const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const URL = 'https://content.example.com/page';
const first = nextRecord(undefined, { kind: 'missing', httpStatus: 404 }, NOW - 120_000);
const missing = nextRecord(first, { kind: 'missing', httpStatus: 410 }, NOW);
const stored = () => ({ ...makeHealthDocument(URL, missing), _rev: 'revision-1' });

describe('Sanity health documents', () => {
  it('uses a stable separate ID for a canonical URL, with no content document ID or raw URL in it', () => {
    expect(healthDocumentId(`${URL}#part`)).toBe(healthDocumentId(URL));
    expect(healthDocumentId(URL)).toMatch(/^linkHealth\.[a-f0-9]{64}$/u);
    expect(healthDocumentId(`${URL}?a=1`)).not.toBe(healthDocumentId(URL));
  });
  it('round-trips a validated observation through ISO storage fields', () => {
    const doc = stored();
    expect(doc._type).toBe('linkHealth');
    expect(doc.checkedAt).toBe(new Date(NOW).toISOString());
    expect(readHealthDocument(doc, NOW)).toEqual({
      url: URL,
      revision: 'revision-1',
      record: missing,
    });
  });
  it('ignores forged IDs, malformed state, future dates and inconsistent HTTP evidence', () => {
    const doc = stored();
    for (const value of [
      { ...doc, _id: 'project-real' },
      { ...doc, _type: 'project' },
      { ...doc, url: `${URL}/other` },
      { ...doc, schemaVersion: 999 },
      { ...doc, checkedAt: 'tomorrow' },
      { ...doc, checkedAt: new Date(NOW + 1).toISOString() },
      { ...doc, missingSince: null },
      { ...doc, httpStatus: 403 },
      { ...doc, _rev: null },
    ])
      expect(readHealthDocument(value, NOW)).toBeUndefined();
  });
  it('does not carry a prior missing-since field into a recovered document', () => {
    const recovered = makeHealthDocument(
      URL,
      nextRecord(missing, { kind: 'reachable', httpStatus: 200 }, NOW + 1),
    );
    expect(recovered).not.toHaveProperty('missingSince');
  });
});
