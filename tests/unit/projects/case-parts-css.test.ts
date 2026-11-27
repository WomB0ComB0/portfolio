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
 * @file How it fits together's rows in case-body.module.css, read as text (Vitest runs no
 * PostCSS; e2e/journeys/project-page.spec.ts measures the built page):
 * - every link in a row, the repository link and a linked part's name alike, is 44px tall to a
 *   finger, as Built with's links are, and reaches into the space around it by as much as it
 *   grows, so the rows keep their height;
 * - "Private repository" stands in the same box as a repository link, so a private row sits as
 *   far below its role as a public one.
 */

import { describe, expect, it } from 'vitest';
import { readCss } from '../places/module-css';
import { declaredValue, findRule, resolveLength, styleRules } from '../styles/css-rules';

const CASE_BODY_CSS =
  'src/app/(routes)/(main)/(professioal)/projects/_components/detail/case-body.module.css';
const RULES = styleRules(readCss(CASE_BODY_CSS));
const COARSE = ['@media (pointer: coarse)'];
/** The least height of a touch target: 2.75rem at the default 16px text. */
const TOUCH_PX = 44;

const AT_DEFAULT_TEXT = { viewport: { width: 375, height: 812 }, percentOf: 0, vars: {} };

/** A declared length in px at the default text size; a missing one throws, naming it. */
function px(selector: string, property: string, conditions: readonly string[] = []): number {
  const value = declaredValue(findRule(RULES, selector, conditions), property);
  if (value === undefined) {
    throw new Error(`"${selector}" under [${conditions.join(', ')}] declares no ${property}`);
  }
  return resolveLength(value, AT_DEFAULT_TEXT);
}

describe('a part’s links under a finger', () => {
  it.each([
    ['the repository link', '.part-repo', () => px('.part-repo', 'min-height')],
    ['a linked part’s name', '.part-page', () => px('.part-name', 'line-height')],
  ])(
    '%s is 44px tall and gives the growth back to the space around it',
    (_label, link, resting) => {
      const padding = px(link, 'padding-block', COARSE);

      expect(px(link, 'min-height', COARSE)).toBe(TOUCH_PX);
      expect(px(link, 'margin-block', COARSE)).toBe(-padding);
      // What is left once the margins take the padding back fits the line the link sits on: the
      // repository link's own resting height, or the heading's line for a part's name.
      expect(TOUCH_PX - 2 * padding).toBeLessThanOrEqual(resting());
    },
  );

  it('draws a linked part’s name as a box, which an inline link could not be', () => {
    const display = declaredValue(findRule(RULES, '.part-page', COARSE), 'display');

    expect(['inline-block', 'inline-flex']).toContain(display);
  });
});

describe('"Private repository"', () => {
  it('stands in the same box as a repository link, its words centred in it', () => {
    const rule = findRule(RULES, '.part-private');
    const repoAtRest = px('.part-repo', 'min-height');
    const repoUnderFinger =
      px('.part-repo', 'min-height', COARSE) + 2 * px('.part-repo', 'margin-block', COARSE);

    expect(declaredValue(rule, 'display')).toBe('inline-flex');
    expect(declaredValue(rule, 'align-items')).toBe('center');
    expect(px('.part-private', 'min-height')).toBe(repoAtRest);
    expect(repoUnderFinger).toBe(repoAtRest);
  });
});
