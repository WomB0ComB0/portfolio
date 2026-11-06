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
 * @file The project's GitHub URL in Studio tells the owner when the home page shows the project
 * as his latest work, and which repositories never count (a fork, a private repository, another
 * host, this site), with the same window the tile's selector applies.
 */

import { describe, expect, it } from 'vitest';
import { ACTIVE_PROJECT_WINDOW_DAYS } from '@/app/_components/home/data/selectors';
import { projectType } from '@/sanity/schemaTypes/project';

/** Only some field types declare `description`, so it is read off the field as found. */
const githubUrlField = projectType.fields.find(({ name }) => name === 'githubUrl') as
  | { readonly description?: unknown }
  | undefined;
const description = String(githubUrlField?.description ?? '');

describe("the project's GitHub URL in Studio", () => {
  it('says when the project is the home page’s latest work, with the selector’s window', () => {
    expect(description).toContain('"Latest work"');
    expect(description).toContain(`in the last ${ACTIVE_PROJECT_WINDOW_DAYS} days`);
    expect(description).toMatch(/your own commits/);
  });

  it('names the repositories that never count', () => {
    for (const never of [
      'not a fork',
      'A fork',
      'a private repository',
      'GitLab',
      'this website',
    ]) {
      expect(description, never).toContain(never);
    }
  });
});
