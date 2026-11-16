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

/** Site-wide navigation, no-JavaScript page links, JSON-LD and 404 robots, extracted from the approved route lab. Media CollectionPage and route-specific content checks remain in their owning route changes. */
import { describe, expect, it } from 'vitest';
import { markupOf } from '../../../e2e/fixtures/server-markup';

describe('server markup extraction', () => {
  it('keeps full-document metadata and nav links while dropping payload and fallback links', () => {
    const markup = markupOf(
      '<!doctype html><html><head><meta name="robots" content="noindex"><script type="application/ld+json">{"html":"<a href="/payload">payload</a>"}</script></head><body><noscript><a href="/fallback">fallback</a></noscript><nav><a href="/real">real</a></nav></body></html>',
    );
    expect(markup).toContain('<meta name="robots" content="noindex">');
    expect(markup).toContain('<nav><a href="/real">real</a></nav>');
    expect(markup).not.toContain('/payload');
    expect(markup).not.toContain('/fallback');
  });

  it.each(['script', 'SCRIPT', 'ScRiPt'])(
    'excludes %s payload links from the navigation assertion',
    (tag) => {
      const html = `<meta name="robots" content="noindex"><${tag}>const text = '<a href="/script-only">ghost</a>';</${tag}><nav><a href="/real">real</a></nav>`;
      const markup = markupOf(html);
      expect(markup).not.toContain('/script-only');
      expect(markup).toContain('<a href="/real">real</a>');
      expect(markup).toContain('<meta name="robots" content="noindex">');
    },
  );

  it.each(['noscript', 'NOSCRIPT', 'NoScript'])(
    'excludes %s fallback links from the JavaScript navigation assertion',
    (tag) => {
      const markup = markupOf(
        `<${tag}><a href="/fallback-only">fallback</a></${tag}><nav><a href="/real">real</a></nav>`,
      );
      expect(markup).not.toContain('/fallback-only');
      expect(markup).toContain('<a href="/real">real</a>');
    },
  );
});
