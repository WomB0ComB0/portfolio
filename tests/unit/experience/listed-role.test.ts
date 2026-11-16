// @vitest-environment node
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

/**
 * @file The one rule for which roles the site lists on a day (listed-role.ts): /experience, a
 * role's page (404 otherwise), the sitemap and the home page's roles all read it. A role is
 * listed from its first month; a current one with no readable start is not; an ended one is,
 * start or not. The module stays light enough for the sitemap and the home selectors to import:
 * its only value import is period.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  isListedRole,
  listedExperiences,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/listed-role';

const TODAY = '2026-11-13';
const MODULE_FILE = 'src/app/(routes)/(main)/(professioal)/experience/_lib/listed-role.ts';

describe('isListedRole', () => {
  it('lists a role from its first month, the day within it not counting', () => {
    expect(isListedRole(makeExperience({ current: true, startDate: '2026-11-30' }), TODAY)).toBe(
      true,
    );
    expect(isListedRole(makeExperience({ current: true, startDate: '2026-12-01' }), TODAY)).toBe(
      false,
    );
  });

  it('leaves out a current role without a readable start, and keeps an ended one', () => {
    const blank = { startDate: '', endDate: null };
    expect(isListedRole(makeExperience({ ...blank, current: true }), TODAY)).toBe(false);
    expect(isListedRole(makeExperience({ startDate: '', endDate: '2024-05-01' }), TODAY)).toBe(
      true,
    );
  });
});

describe('listedExperiences', () => {
  it('keeps the listed roles in the order given and leaves the input as it was', () => {
    const toCome = makeExperience({ current: true, startDate: '2027-01-04' });
    const ended = makeExperience({ startDate: '2023-01-01', endDate: '2024-01-01' });
    const now = makeExperience({ current: true, startDate: '2026-03-01' });
    const input = [toCome, ended, now];

    expect(listedExperiences(input, TODAY)).toEqual([ended, now]);
    expect(input).toEqual([toCome, ended, now]);
  });
});

describe('where the rule lives', () => {
  it('imports nothing but period.ts at run time, so the sitemap and home can use it', () => {
    const source = readFileSync(join(process.cwd(), MODULE_FILE), 'utf8');
    const valueImports = [...source.matchAll(/^import (?!type )[^;]*from '([^']+)'/gm)].map(
      (match) => match[1],
    );

    expect(valueImports).toEqual(['./period']);
    expect(source).not.toMatch(/['"]use client['"]/);
  });
});
