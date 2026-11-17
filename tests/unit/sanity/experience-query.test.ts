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
import { evaluate, parse } from 'groq-js';
import { describe, expect, it } from 'vitest';
import { ExperienceSchema } from '@/hooks/sanity/schemas';
import { experienceByIdQuery, experiencesQuery } from '@/lib/sanity/queries';

const decode = Schema.decodeUnknownSync(ExperienceSchema);

for (const [name, query] of [
  ['collection', experiencesQuery],
  ['detail', experienceByIdQuery],
] as const) {
  describe(`experience ${name} projection`, () => {
    it.each([
      ['omitted', undefined],
      ['explicit null', null],
      ['empty', []],
      ['populated', ['Built tools', 'TypeScript']],
    ] as const)('keeps a valid parent whose optional lists are %s', async (_label, lists) => {
      const original = makeExperience({
        company: 'Headstarter',
        position: 'Software Engineer Resident',
      });
      const {
        responsibilities: _responsibilities,
        technologies: _technologies,
        ...withoutLists
      } = original;
      const source =
        lists === undefined
          ? withoutLists
          : { ...withoutLists, responsibilities: lists, technologies: lists };
      // Execute the real GROQ against a raw Studio document: absent projected fields become null.
      const value = await evaluate(parse(query), { dataset: [source], params: { id: source._id } });
      const result = await value.get();
      const projected = Array.isArray(result) ? result[0] : result;
      const decoded = decode(projected);
      expect(decoded._id).toBe(source._id);
      expect(decoded.responsibilities).toEqual(lists ?? []);
      expect(decoded.technologies).toEqual(lists ?? []);
    });
  });
}
