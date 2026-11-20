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
 * @file The component axe helper (tests/utils/axe.ts) fails when it should, says why in a way a
 * reader can act on (rule id, impact, help, the failing nodes' HTML), and leaves out only the
 * rules jsdom cannot evaluate. Without these checks every "no violations" test could pass on a
 * helper that checks nothing. label-content-name-mismatch (WCAG 2.5.3) included: jsdom alone
 * filed it as "needs review" every time, so it checked nothing until the helper lent it a canvas
 * and Tailwind's sr-only.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { axeViolations, expectNoAxeViolations, JSDOM_LAYOUT_RULES } from '../../utils/axe';
import { formatViolations } from '../../utils/axe-report';

afterEach(cleanup);

describe('expectNoAxeViolations', () => {
  it('passes markup with nothing to fix', async () => {
    const { container } = render(
      <section aria-labelledby="t">
        <h2 id="t">Title</h2>
        {/* biome-ignore lint/performance/noImgElement: plain markup for axe, not a page image. */}
        <img src="/a.png" alt="A chart of commits" />
        <button type="button">Save</button>
      </section>,
    );

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('fails with the rule id, impact, help and the failing node’s HTML', async () => {
    const { container } = render(
      <div>
        {/* biome-ignore lint/performance/noImgElement: plain markup for axe, not a page image. */}
        {/* biome-ignore lint/a11y/useAltText: the missing alt is what the helper must report. */}
        <img src="/unnamed.png" />
        <button type="button" />
      </div>,
    );

    const failure = expectNoAxeViolations(container, { label: 'the test fixture' });

    await expect(failure).rejects.toThrow(/^2 axe rules failed in the test fixture:/);
    await expect(failure).rejects.toThrow(
      /- button-name \[critical\]: Buttons must have discernible text/,
    );
    await expect(failure).rejects.toThrow(/- image-alt \[critical\]: Images must have alternative/);
    await expect(failure).rejects.toThrow('<img src="/unnamed.png">');
    await expect(failure).rejects.toThrow('<button type="button"></button>');
  });

  // axe 4.10 files a duplicate id ARIA points at as "needs review"; the helper fails on it.
  it('catches a duplicate id that names a landmark, as the "See also" section had', async () => {
    const { container } = render(
      <>
        <section aria-labelledby="dup">
          <h2 id="dup">Photos and videos</h2>
        </section>
        <aside aria-labelledby="dup">
          <h2 id="dup">See also</h2>
        </aside>
      </>,
    );

    const ids = (await axeViolations(container)).map((violation) => violation.id);

    expect(ids).toContain('duplicate-id-aria');
  });

  it('leaves out only the rules that need layout, and runs the rest of the WCAG set', async () => {
    const { container } = render(
      <p style={{ color: '#777', background: '#888' }}>
        Grey on grey, with <a href="/x">the policy</a> told apart by nothing.
      </p>,
    );

    // Pinned: turning off another rule here would silently weaken every component check.
    expect(JSDOM_LAYOUT_RULES).toEqual([
      'color-contrast',
      'link-in-text-block',
      'target-size',
      'scrollable-region-focusable',
    ]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('turns on a best-practice rule when asked, such as heading-order for a whole page', async () => {
    const { container } = render(
      <main>
        <h1>Page</h1>
        <h3>Skips a level</h3>
      </main>,
    );

    expect(await axeViolations(container)).toEqual([]);
    const ids = (await axeViolations(container, { rules: { 'heading-order': true } })).map(
      (violation) => violation.id,
    );
    expect(ids).toEqual(['heading-order']);
  });
});

/** A link that shows a date range, with 'to' for screen readers only, as PlaceDateRange does. */
const RangeLink = ({ name }: { readonly name: string }) => (
  <a href="/places/antler" aria-label={name}>
    May 19<span aria-hidden="true"> – </span>
    <span className="sr-only"> to </span>
    20, 2026
  </a>
);

describe('label-content-name-mismatch under jsdom (WCAG 2.5.3, Label in Name)', () => {
  it('fails a name that rewrites the words its link shows (the dash said as "to")', async () => {
    const { container } = render(<RangeLink name="Antler NYC, May 19 to 20, 2026, photo 1" />);

    const ids = (await axeViolations(container)).map((violation) => violation.id);

    expect(ids).toEqual(['label-content-name-mismatch']);
  });

  it('passes a name that holds the words shown, and never counts sr-only words as shown', async () => {
    const { container } = render(<RangeLink name="May 19 – 20, 2026, photo 1 of 5" />);

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('fails a name that leaves out text inside the link, such as a browser frame’s address', async () => {
    const { container } = render(
      <a href="/cover.png" aria-label="Open screen 1 of 2: The live map">
        <span>grepo.example.com</span>
      </a>,
    );

    const failure = expectNoAxeViolations(container, { label: 'the cover' });

    await expect(failure).rejects.toThrow(/- label-content-name-mismatch \[serious\]/);
  });

  it('leaves jsdom as it found it: no canvas context, no sr-only stylesheet', async () => {
    const { container } = render(<RangeLink name="May 19 – 20, 2026" />);
    const { getContext } = HTMLCanvasElement.prototype;

    await axeViolations(container);

    expect(HTMLCanvasElement.prototype.getContext).toBe(getContext);
    expect(document.querySelector('style[data-axe-helper]')).toBeNull();
  });
});

describe('formatViolations', () => {
  it('is empty when nothing failed', () => {
    expect(formatViolations([])).toBe('');
  });

  it('caps the nodes it prints per rule, and says how many more there are', () => {
    const nodes = Array.from({ length: 10 }, (_, index) => ({
      html: `<img src="/${index}.png">`,
      target: [`img:nth-child(${index + 1})`],
      failureSummary: 'Fix any of the following:\n  Element does not have an alt attribute',
    }));

    const report = formatViolations([
      { id: 'image-alt', impact: 'critical', help: 'Images must have alternative text', nodes },
    ]);

    expect(report).toContain('<img src="/7.png">');
    expect(report).not.toContain('<img src="/8.png">');
    expect(report).toContain('…and 2 more nodes');
    expect(report).toContain('at img:nth-child(1)');
    expect(report).toContain('Element does not have an alt attribute');
  });
});
