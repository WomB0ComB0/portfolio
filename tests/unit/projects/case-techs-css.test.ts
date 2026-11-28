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
 * @file Built with's technology links in case-body.module.css, read as text (Vitest runs no
 * PostCSS; e2e/accessibility/a11y.spec.ts runs axe on the built page): a two-letter name such as
 * "Go" or "C#" draws narrower than 24px, so each link holds at least 24px of width, the WCAG 2.2
 * target size (2.5.8, AA), however short its name.
 */

import { describe, expect, it } from 'vitest';
import { readCss } from '../places/module-css';
import { declaredValue, findRule, resolveLength, styleRules } from '../styles/css-rules';

const CASE_BODY_CSS =
  'src/app/(routes)/(main)/(professioal)/projects/_components/detail/case-body.module.css';
const RULES = styleRules(readCss(CASE_BODY_CSS));
/** WCAG 2.2's least target size (2.5.8, AA), in CSS px. */
const TARGET_PX = 24;
const AT_DEFAULT_TEXT = { viewport: { width: 375, height: 812 }, percentOf: 0, vars: {} };

describe('a technology link in Built with', () => {
  it('is at least 24px wide, so a two-letter name is a large enough target', () => {
    const value = declaredValue(findRule(RULES, '.tech'), 'min-width');

    expect(value, '.tech declares no min-width').toBeDefined();
    expect(resolveLength(value ?? '0', AT_DEFAULT_TEXT)).toBeGreaterThanOrEqual(TARGET_PX);
  });
});
