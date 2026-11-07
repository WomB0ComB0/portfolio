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
 * @file The Studio switch for the featured row: a boolean "Featured" field on certifications,
 * off by default, whose description says what it does; the list query fetches it; and the
 * decoder reads a missing or null value (every document written before the field) as false.
 */

import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { MAX_FEATURED } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { CertificationSchema } from '@/hooks/sanity/schemas';
import { certificationByIdQuery, certificationsQuery } from '@/lib/sanity/queries';
import { certificationType } from '@/sanity/schemaTypes/certification';

/** Only some field types declare these, so they are read off the field as found. */
const featuredField = certificationType.fields.find(({ name }) => name === 'featured') as
  | {
      readonly type?: unknown;
      readonly title?: unknown;
      readonly description?: unknown;
      readonly initialValue?: unknown;
    }
  | undefined;

const BASE = {
  _id: 'certification-test',
  _type: 'certification',
  _createdAt: '2025-10-30T05:25:29Z',
  _updatedAt: '2025-10-30T06:17:25Z',
  _rev: 'rev',
  title: 'Azure AI Fundamentals',
  issuer: 'Microsoft',
  issueDate: '2024-06-01',
  order: 6,
};

const decode = Schema.decodeUnknownSync(CertificationSchema);

describe('the Featured field in Studio', () => {
  it('is a boolean titled Featured, off by default', () => {
    expect(featuredField).toBeDefined();
    expect(featuredField?.type).toBe('boolean');
    expect(featuredField?.title).toBe('Featured');
    expect(featuredField?.initialValue).toBe(false);
  });

  it('says it puts the certificate in the Featured row, up to four, in display order', () => {
    const description = String(featuredField?.description ?? '');

    expect(MAX_FEATURED).toBe(4);
    expect(description).toContain('Featured row');
    expect(description).toContain('/certifications');
    expect(description).toMatch(/up to four/i);
    expect(description).toMatch(/display order/i);
  });

  it('sits just before Display Order, the field it is ordered by', () => {
    const names = certificationType.fields.map(({ name }) => name);

    expect(names.indexOf('featured')).toBe(names.indexOf('order') - 1);
  });
});

describe('fetching and decoding featured', () => {
  it.each([
    ['certificationsQuery', certificationsQuery],
    ['certificationByIdQuery', certificationByIdQuery],
  ])('%s fetches it', (_name, query) => {
    expect(query).toMatch(/^\s*featured,?$/m);
  });

  it('keeps true and false', () => {
    expect(decode({ ...BASE, featured: true }).featured).toBe(true);
    expect(decode({ ...BASE, featured: false }).featured).toBe(false);
  });

  it('reads a missing or null value as false', () => {
    expect(decode(BASE).featured).toBe(false);
    expect(decode({ ...BASE, featured: null }).featured).toBe(false);
  });

  it('still rejects a value that is not a boolean', () => {
    expect(() => decode({ ...BASE, featured: 'yes' })).toThrow();
  });
});
