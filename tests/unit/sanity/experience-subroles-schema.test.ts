/**
 * Copyright 2026 Mike Odnis
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

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { Schema } from 'effect';
import { Elysia } from 'elysia';
import { describe, expect, it } from 'vitest';
import { experienceSchema as responseSchema } from '@/app/api/v1/[[...route]]/sanity/schema';
import { ExperienceSchema } from '@/hooks/sanity/schemas';
import { experienceByIdQuery, experiencesQuery } from '@/lib/sanity/queries';
import { experienceSchema as legacySchema } from '@/lib/sanity/schemas';
import { experienceType } from '@/sanity/schemaTypes/experience';

const role = {
  _key: 'engineer',
  _type: 'experienceSubRole' as const,
  position: 'Software Engineer',
  startDate: '2024-01-01',
  endDate: '2024-06-30',
};
const decode = Schema.decodeUnknownSync(ExperienceSchema);

describe('optional nested experience schema', () => {
  it('preserves old documents and explicit null without inventing a progression', () => {
    const old = makeExperience();
    expect(decode(old)).toEqual(old);
    expect(decode({ ...old, subRoles: null }).subRoles).toBeNull();
  });
  it('decodes children and defaults a missing/null current flag to false', () => {
    const decoded = decode({
      ...makeExperience(),
      subRoles: [role, { ...role, _key: 'lead', current: null }],
    });
    expect(decoded.subRoles?.map((r) => [r._key, r.current])).toEqual([
      ['engineer', false],
      ['lead', false],
    ]);
  });
  it('drops malformed child objects without rejecting their parent or valid siblings', () => {
    const source = {
      ...makeExperience(),
      subRoles: [
        null,
        {},
        'bad',
        { ...role, position: 42 },
        { ...role, technologies: [123] },
        role,
      ],
    };
    const decoded = decode(source);
    expect(decoded._id).toBe(source._id);
    expect(decoded.subRoles).toEqual([{ ...role, current: false }]);
    expect(decode({ ...source, subRoles: 'bad-array' }).subRoles).toEqual([]);
  });
  it.each([experienceType, legacySchema])(
    'defines an optional inline experienceSubRole array in both Studio definitions',
    (schema) => {
      const field = schema.fields.find((f) => f.name === 'subRoles') as
        | {
            type: string;
            of: {
              name: string;
              type: string;
              fields: { name: string; initialValue?: unknown }[];
            }[];
          }
        | undefined;
      expect(field?.type).toBe('array');
      expect(field?.of[0]?.name).toBe('experienceSubRole');
      expect(field?.of[0]?.type).toBe('object');
      expect(field?.of[0]?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([
          'position',
          'startDate',
          'endDate',
          'current',
          'description',
          'responsibilities',
          'technologies',
        ]),
      );
      expect(field?.of[0]?.fields.find((f) => f.name === 'current')?.initialValue).toBe(false);
    },
  );
  it.each([experiencesQuery, experienceByIdQuery])(
    'projects every nested field and stable key in GROQ',
    (query) => {
      const projection = /subRoles\[\]\s*\{([^}]+)\}/u.exec(query)?.[1];
      expect(projection).toBeDefined();
      for (const field of [
        '_key',
        '_type',
        'position',
        'startDate',
        'endDate',
        'description',
        'responsibilities',
        'technologies',
      ])
        expect(projection).toContain(field);
      expect(projection).toMatch(/"current"\s*:\s*coalesce\(current,\s*false\)/u);
    },
  );
  it('keeps valid children in the declared API response rather than stripping them', async () => {
    const payload = {
      ...makeExperience(),
      location: 'Remote',
      responsibilities: [],
      technologies: [],
      subRoles: [{ ...role, current: false }],
    };
    const app = new Elysia().get('/', () => payload, { response: responseSchema });
    const response = await app.handle(new Request('http://localhost/'));
    expect(response.status).toBe(200);
    expect((await response.json()).subRoles).toEqual(payload.subRoles);
  });
});
