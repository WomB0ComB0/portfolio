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

import { describe, expect, it } from 'vitest';
import { obfuscateLink } from './html-entities';

describe('obfuscateLink', () => {
  it('should obfuscate a mailto link', () => {
    const { encodedHref, encodedText } = obfuscateLink({
      scheme: 'mailto',
      address: 'test@example.com',
    });
    expect(encodedHref).toBe(
      '&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#116;&#101;&#115;&#116;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;',
    );
    expect(encodedText).toBe(
      '&#116;&#101;&#115;&#116;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;',
    );
  });

  it('should obfuscate a tel link with custom text', () => {
    const { encodedHref, encodedText } = obfuscateLink({
      scheme: 'tel',
      address: '+12015550123',
      text: '+1 (201) 555-0123',
    });
    expect(encodedHref).toBe(
      '&#116;&#101;&#108;&#58;&#43;&#49;&#50;&#48;&#49;&#53;&#53;&#53;&#48;&#49;&#50;&#51;',
    );
    expect(encodedText).toBe(
      '&#43;&#49;&#32;&#40;&#50;&#48;&#49;&#41;&#32;&#53;&#53;&#53;&#45;&#48;&#49;&#50;&#51;',
    );
  });

  it('should handle mailto links with params', () => {
    const { encodedHref } = obfuscateLink({
      scheme: 'mailto',
      address: 'test@example.com',
      params: {
        subject: 'hello',
        body: 'world',
      },
    });
    console.log('encodedHref', encodedHref);
    const expectedHref = 'mailto:test@example.com?subject=hello&body=world';
    expect(encodedHref).toBe(
      expectedHref
        .split('')
        .map((c) => `&#${c.charCodeAt(0)};`)
        .join(''),
    );
  });
});
