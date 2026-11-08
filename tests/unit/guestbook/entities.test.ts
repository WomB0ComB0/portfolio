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
 * @file decodeBasicEntities: legacy guestbook records may hold text that was HTML-escaped before
 * it was stored. The page renders text (React escapes it), so those five entities are decoded
 * once at display time; nothing else is touched.
 */

import { describe, expect, it } from 'vitest';
import { decodeBasicEntities } from '@/lib/guestbook/entities';

describe('decodeBasicEntities', () => {
  it.each([
    ['Tom &amp; Jerry', 'Tom & Jerry'],
    ['1 &lt; 2', '1 < 2'],
    ['2 &gt; 1', '2 > 1'],
    ['say &quot;hi&quot;', 'say "hi"'],
    ['D&#039;Angelo', "D'Angelo"],
    ['D&#39;Angelo', "D'Angelo"],
  ])('decodes %j to %j', (stored, shown) => {
    expect(decodeBasicEntities(stored)).toBe(shown);
  });

  it('decodes once, so text that was escaped twice keeps one level', () => {
    expect(decodeBasicEntities('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
  });

  it('turns escaped markup back into text, never into elements', () => {
    expect(decodeBasicEntities('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(
      '<script>alert(1)</script>',
    );
  });

  it('leaves every other entity as it is', () => {
    const other = 'a&nbsp;b &#x27; &copy; &#8217; &apos; &AMP;';

    expect(decodeBasicEntities(other)).toBe(other);
  });

  it('leaves plain text, a bare ampersand and an empty string alone', () => {
    expect(decodeBasicEntities("It's fine & dandy")).toBe("It's fine & dandy");
    expect(decodeBasicEntities('AT&T; R&D')).toBe('AT&T; R&D');
    expect(decodeBasicEntities('')).toBe('');
  });
});
