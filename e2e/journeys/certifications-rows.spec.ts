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
 * @file /certifications' rows against the live data, as a mouse and a finger meet them:
 * - Each count is said once around a year's opening: no opener's byline repeats how many
 *   certificates its year holds (its jump link says that).
 * - On a wide page each skill and each part of a margin note ('Verify on VirtualBadge') stays
 *   whole on its line, the line wrapping only between them, and a one-line note never pushes the
 *   next title down: those titles keep the stack's own step.
 * - Under a mouse a grouped title's line stays 24px tall with no hit overlay, as before.
 * - On a touch phone and a touch tablet every link and button in the record and the year jumps is
 *   a 44px target (its ::after overlay counted, as the site's tap checks read it), none over
 *   another, and on the tablet the Copy ID buttons follow their titles instead of lining up as one
 *   column.
 */

import { expect, type Locator, test } from '@playwright/test';

import { DESKTOP, openAt, PHONE, WIDE } from '../fixtures/ledger';

/** The least a tap target may measure on a touch screen, in CSS pixels. */
const TOUCH_TARGET = 44;
/** The touch tablet: an iPad in portrait, where the issuer is pinned left of its list. */
const TABLET = { width: 768, height: 1024 } as const;
/** A tile-meta line, the margin's line height. */
const MARGIN_LINE_PX = 18;

/**
 * The record's and the year jumps' links and buttons whose tap area is under 44px tall or 24px
 * wide, and the pairs whose areas overlap. An area is the box, grown by an absolute ::after
 * overlay that takes the pointer (how a 24px line reaches 44px without growing that tall).
 */
function tapFaults(main: Locator): Promise<{ small: string[]; overlapping: string[] }> {
  return main.evaluate((root, least) => {
    const scopes = root.querySelectorAll('[data-record], nav[aria-label="By year"]');
    const areas = [...scopes]
      .flatMap((scope) => [...scope.querySelectorAll<HTMLElement>('a[href], button')])
      .filter((element) => element.getClientRects().length > 0 && element.checkVisibility())
      .map((element) => {
        const box = element.getBoundingClientRect();
        const overlay = getComputedStyle(element, '::after');
        const grown =
          overlay.content !== 'none' &&
          overlay.position === 'absolute' &&
          overlay.pointerEvents !== 'none';
        const reach = (inset: string): number => (grown ? Number.parseFloat(inset) || 0 : 0);
        return {
          name: (element.textContent ?? '').trim().slice(0, 32),
          element,
          top: box.top + reach(overlay.top),
          bottom: box.bottom - reach(overlay.bottom),
          left: box.left + reach(overlay.left),
          right: box.right - reach(overlay.right),
        };
      });
    const small = areas
      .filter((a) => a.bottom - a.top < least || a.right - a.left < 24)
      .map((a) => `${a.name}: ${Math.round(a.right - a.left)}x${Math.round(a.bottom - a.top)}`);
    const overlapping = areas.flatMap((a, index) =>
      areas
        .slice(index + 1)
        .filter(
          (b) =>
            !a.element.contains(b.element) &&
            !b.element.contains(a.element) &&
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5,
        )
        .map((b) => `${a.name} / ${b.name}`),
    );
    return { small, overlapping };
  }, TOUCH_TARGET);
}

/**
 * Margin items (a skill, a note's part) split across two lines, and one-line titles whose
 * one-line note pushed the next title off the stack's own step (that of a title with no note).
 */
function marginReport(
  main: Locator,
): Promise<{ checked: number; split: string[]; pushed: string[] }> {
  return main.evaluate((root, marginLine) => {
    const items = root.querySelectorAll(
      '[data-cert-margin] [data-cert-skills] > span:not(.sr-only), [data-cert-margin] [data-byline] > span',
    );
    const split = [...items]
      .filter((item) => new Set([...item.getClientRects()].map((r) => Math.round(r.top))).size > 1)
      .map((item) => (item.textContent ?? '').trim());
    const pushed: string[] = [];
    for (const stack of root.querySelectorAll('[data-month-stack] > ul')) {
      const rows = [...stack.children].map((item) => {
        const title = item.querySelector('[data-cert-title]') as HTMLElement;
        const margin = item.querySelector('[data-cert-margin]');
        const box = title.getBoundingClientRect();
        return {
          name: (title.textContent ?? '').slice(0, 32),
          top: box.top,
          oneLine:
            Math.round(box.height / Number.parseFloat(getComputedStyle(title).lineHeight)) === 1,
          marginLines: margin ? Math.round(margin.getBoundingClientRect().height / marginLine) : 0,
        };
      });
      const bare = rows.findIndex((row, i) => row.oneLine && row.marginLines === 0 && rows[i + 1]);
      const step = bare >= 0 ? (rows[bare + 1]?.top ?? 0) - (rows[bare]?.top ?? 0) : null;
      rows.forEach((row, i) => {
        const next = rows[i + 1];
        if (step === null || !next || !row.oneLine || row.marginLines !== 1) return;
        if (Math.abs(next.top - row.top - step) > 1) pushed.push(row.name);
      });
    }
    return { checked: items.length, split, pushed };
  }, MARGIN_LINE_PX);
}

test.describe('/certifications rows: counts, margins and targets', () => {
  test('no year’s opener repeats the count its jump link gives', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    const bylines = await main
      .locator('[data-record] > section[data-chapter] > header [data-byline]')
      .allTextContents();

    for (const byline of bylines) expect(byline).not.toMatch(/certificates?/);
  });

  test('a wide page: skills and note parts stay whole, and a one-line note keeps the step', async ({
    page,
  }) => {
    const report = await marginReport(await openAt(page, '', WIDE));

    expect(report.checked, 'the margins hold skills and notes').toBeGreaterThan(0);
    expect(report.split).toEqual([]);
    expect(report.pushed, 'titles pushed down by a one-line note').toEqual([]);
  });

  test('under a mouse a grouped title keeps its 24px lines and no hit overlay', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    const titles = await main.locator('a[data-cert-title]').evaluateAll((links) =>
      links.map((link) => ({
        height: Math.round(link.getBoundingClientRect().height),
        overlay: getComputedStyle(link, '::after').content,
      })),
    );

    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) {
      // Its lines alone: 24px each, nothing added under them.
      expect(title.height % 24).toBe(0);
      expect(title.overlay).toBe('none');
    }
  });

  test.describe('on a touch phone', () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

    test('every title, Verify link, button and year jump is a 44px target, none over another', async ({
      page,
    }) => {
      const main = await openAt(page, '', PHONE);

      expect(await tapFaults(main)).toEqual({ small: [], overlapping: [] });
    });
  });

  test.describe('on a touch tablet', () => {
    test.use({ viewport: TABLET, hasTouch: true, isMobile: true });

    test('every target is 44px, none over another, and Copy ID never lines up as a column', async ({
      page,
    }) => {
      const main = await openAt(page, '', TABLET);

      expect(await tapFaults(main)).toEqual({ small: [], overlapping: [] });
      const lefts = await main
        .locator('[data-record] [data-cert-size="brief"] button')
        .evaluateAll((buttons) =>
          buttons
            .filter((button) => button.checkVisibility({ checkOpacity: true }))
            .map((button) => Math.round(button.getBoundingClientRect().left)),
        );
      test.skip(lefts.length < 4, 'too few credential IDs in a busy year to compare');
      const counts = new Map<number, number>();
      for (const left of lefts) counts.set(left, (counts.get(left) ?? 0) + 1);

      expect(
        Math.max(...counts.values()),
        'Copy ID buttons sharing one left edge',
      ).toBeLessThanOrEqual(lefts.length / 3);
    });
  });
});
