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
 * @file hasContent calls a slot empty when React would render nothing for it (null, undefined,
 * a boolean) or it is '', so a 0, which React prints, still gets its wrapper.
 */

import { describe, expect, it } from 'vitest';

import { hasContent } from '@/components/console/has-content';

describe('hasContent', () => {
  it.each([0, Number.NaN, 'Work', ' ', ['Work']])('%j has content', (slot) => {
    expect(hasContent(slot)).toBe(true);
  });

  it.each([null, undefined, false, true, ''])('%j is empty', (slot) => {
    expect(hasContent(slot)).toBe(false);
  });
});
