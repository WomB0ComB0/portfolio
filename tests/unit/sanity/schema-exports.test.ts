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
 * @file The Sanity schema modules export no list schemas that nothing decodes with. Pages load on
 * the server, and the loaders decode one document at a time (decodeEach), so one bad document is
 * dropped instead of failing its list. The whole-list schemas were used only by the client hooks
 * D2 deleted; left in the client '@/hooks' barrel, they suggested the browser still decodes
 * Sanity collections. PlacesSchema stays for the place schema tests.
 */

import { describe, expect, it } from 'vitest';
import * as barrel from '@/hooks/sanity';
import * as schemas from '@/hooks/sanity/schemas';

/** The export names of `module` that name a list schema: a plural document name, e.g. ProjectsSchema. */
const listSchemaNames = (module: object): string[] =>
  Object.keys(module).filter((name) => name.endsWith('sSchema'));

describe('Sanity list schemas', () => {
  it('keeps only the places list schema, which the place schema tests decode with', () => {
    expect(listSchemaNames(schemas)).toEqual(['PlacesSchema']);
  });

  it('exports none from the barrel the client "@/hooks" barrel re-exports', () => {
    expect(listSchemaNames(barrel)).toEqual([]);
  });

  it('still exports the per-document schemas the barrel promises', () => {
    expect(Object.keys(barrel).sort()).toEqual([
      'CertificationSchema',
      'ExperienceSchema',
      'ProjectSchema',
      'ResumeSchema',
    ]);
  });
});
