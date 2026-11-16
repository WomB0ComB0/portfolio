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
 * @file What the /experience specs share (experience*.spec.ts): opening the list and a role's
 * page, the readers that measure them, and skipUnless, which reports a check as skipped (never
 * as passed) when the data it needs is not there. Not a spec itself: a spec may not import
 * another.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { expectRowsOrState, expectSettled, openConsolePage } from '../fixtures/console-routes';

export const EMPTY = 'No roles listed yet';
export const WIDTHS = [320, 390, 768, 1024, 1366, 1440, 1920];
/** What a stop on the rail must show whole: never cut, never an ellipsis. */
export const ROW_TEXT = '[data-role-organization], [data-role-page], [data-role-meta]';
/**
 * What a role's page must show whole: the header's lines, the description, each duty, and the
 * words of each role alongside and of each step.
 */
export const PAGE_TEXT =
  'header p, [data-role-description], [data-role-duties] li > span, [data-role-companion] > [data-part], [data-role-step] > span';
/** How far two edges that should coincide may differ: subpixel layout, never a column. */
export const EDGE_SLACK = 0.75;
/** The least a tap target may measure on a touch screen, in CSS pixels. */
export const TOUCH_TARGET = 44;

/**
 * `value`, or the test ends as skipped with `reason` when it is missing: a precondition the data
 * does not meet is reported, never counted as a pass.
 */
export function skipUnless<T>(value: T | false | null | undefined, reason: string): T {
  test.skip(!value, reason);
  // test.skip has already ended the test when there is no value; this narrows the type.
  if (!value) throw new Error(reason);
  return value;
}

/** The roles on the story's rail: one stop each (role-stop.tsx). */
const rowsOf = (main: Locator): Locator => main.locator('li[data-role-row]');
const emptyOf = (main: Locator): Locator => main.getByRole('heading', { name: EMPTY, exact: true });

/** The stops, or false after checking the explicit empty state (an empty or failed upstream). */
export async function openIndex(page: Page): Promise<Locator | false> {
  const main = await openConsolePage(page, '/experience', 'Experience');
  await expectSettled(main);
  const rows = rowsOf(main);
  return (await expectRowsOrState(rows, emptyOf(main))) ? rows : false;
}

/** The stops of the list; the test is skipped when the list shows its empty state. */
export async function indexRows(page: Page): Promise<Locator> {
  return skipUnless(await openIndex(page), 'The list shows its empty state: no row to check.');
}

/** Resolves once React has hydrated the page (a link inside main carries its props). */
export const hydrated = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const link = document.querySelector('main a[href]');
    return link !== null && Object.keys(link).some((key) => key.startsWith('__reactProps'));
  });

/** Whether any of the parts is hidden, cut with an ellipsis or clipped by its box. */
export const cutIn = (scope: Locator, parts: string): Promise<string[]> =>
  scope.locator(parts).evaluateAll((elements) =>
    elements
      .filter((part) => {
        const style = getComputedStyle(part);
        return (
          style.display === 'none' ||
          style.textOverflow === 'ellipsis' ||
          part.scrollWidth > part.clientWidth + 1 ||
          part.scrollHeight > part.clientHeight + 1
        );
      })
      .map((part) => (part.textContent ?? '').slice(0, 40)),
  );

/**
 * The links, rows and buttons under `scope` whose tap area is under 44px tall or 24px wide on
 * this screen, and the pairs whose areas overlap; targets matching `exempt` are left out (a
 * link inside a sentence, which WCAG 2.5.8 exempts as inline). A target's area is its box, grown by its
 * ::after overlay where it has one (how a pill reaches 44px without growing that tall). The
 * overlay is set from the padding box, so a border counts against its reach.
 */
export const tapFaultsIn = (
  scope: Locator,
  exempt = '',
): Promise<{ small: string[]; overlapping: string[] }> =>
  scope.evaluate(
    (root, { least, exempt: skip }) => {
      const nameOf = (element: Element): string => (element.textContent ?? '').trim().slice(0, 32);
      const areas = Array.from(root.querySelectorAll<HTMLElement>('a[href], summary, button'))
        .filter((element) => element.getClientRects().length > 0 && element.checkVisibility())
        .filter((element) => skip === '' || !element.matches(skip))
        .map((element) => {
          const box = element.getBoundingClientRect();
          const own = getComputedStyle(element);
          const overlay = getComputedStyle(element, '::after');
          const grown =
            overlay.content !== 'none' &&
            overlay.position === 'absolute' &&
            overlay.pointerEvents !== 'none';
          /** How far the overlay reaches past the box on one side: its inset, less the border. */
          const edge = (inset: string, border: string): number =>
            grown ? (Number.parseFloat(inset) || 0) + (Number.parseFloat(border) || 0) : 0;
          return {
            element,
            top: box.top + edge(overlay.top, own.borderTopWidth),
            bottom: box.bottom - edge(overlay.bottom, own.borderBottomWidth),
            left: box.left + edge(overlay.left, own.borderLeftWidth),
            right: box.right - edge(overlay.right, own.borderRightWidth),
          };
        });
      const small = areas
        .filter((area) => area.bottom - area.top < least || area.right - area.left < 24)
        .map(
          (area) =>
            `${nameOf(area.element)}: ${Math.round(area.right - area.left)}x${Math.round(area.bottom - area.top)}`,
        );
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
          .map((b) => `${nameOf(a.element)} / ${nameOf(b.element)}`),
      );
      return { small, overlapping };
    },
    { least: TOUCH_TARGET, exempt },
  );

/**
 * The words under `parts` that break inside themselves: at a letter, not at a space, a hyphen,
 * a slash or an address's dot. A word is what has no space in it; each comes back with its break marked `|`.
 */
export const splitWordsIn = (scope: Locator, parts: string): Promise<string[]> =>
  scope.locator(parts).evaluateAll((elements) => {
    const split: string[] = [];
    for (const element of elements) {
      if (!element.checkVisibility()) continue;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('.sr-only')) continue;
        for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
          const lines: { top: number; text: string }[] = [];
          for (const [at, letter] of Array.from(word[0]).entries()) {
            const range = document.createRange();
            range.setStart(node, word.index + at);
            range.setEnd(node, word.index + at + 1);
            const top = Math.round(range.getBoundingClientRect().top);
            const line = lines.at(-1);
            if (line && line.top === top) line.text += letter;
            else lines.push({ top, text: letter });
          }
          // A hyphen or a slash may end a line; a dot only inside an address ('blog.' / 'com').
          const address = /\w\.\w/.test(word[0]);
          const broken = lines
            .slice(0, -1)
            .some((line) => !/[-/]$/.test(line.text) && !(address && line.text.endsWith('.')));
          if (broken) split.push(lines.map((line) => line.text).join('|'));
        }
      }
    }
    return split;
  });

/**
 * The stop the address names: whether it is the page's target, whether its light wears the
 * brand rim in full, and where it stopped. Read from the page, so it holds with JavaScript off
 * too. The story has no stuck bar, so the top of the window is the edge it must stop below.
 */
export const landedRow = (page: Page) =>
  page.evaluate(() => {
    const row = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    const box = row?.getBoundingClientRect();
    // The rim's token as the browser writes a colour, to find it in the light's shadow.
    const probe = document.createElement('i');
    probe.style.color = 'var(--brand-rim)';
    document.body.append(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    const article = row?.querySelector('article');
    const light = article ? getComputedStyle(article, '::before') : null;
    return {
      row: row?.hasAttribute('data-role-row') ?? false,
      target: row?.matches(':target') ?? false,
      rimmed: light
        ? light.boxShadow.includes(`${token} 0px 0px 0px 1px inset`) && light.opacity === '1'
        : false,
      top: box?.top ?? Number.NaN,
      axisBottom: 0,
      viewport: window.innerHeight,
    };
  });

/** A stop a jump landed on: the target, its light in the brand rim, in view near the top. */
export async function expectLanded(page: Page): Promise<void> {
  // The light eases in: wait for it to be drawn in full, in the brand rim's own tone.
  await expect.poll(async () => (await landedRow(page)).rimmed).toBe(true);
  const landed = await landedRow(page);
  expect(landed.row).toBe(true);
  expect(landed.target).toBe(true);
  expect(landed.top).toBeGreaterThanOrEqual(landed.axisBottom - 1);
  expect(landed.top).toBeLessThan(landed.viewport / 2);
}

/**
 * Clicks `link` and resolves to where the page was scrolled at that moment: the position a
 * later Back must come back to (a click scrolls the link into view first).
 */
export async function clickKeepingScroll(page: Page, link: Locator): Promise<number> {
  await page.evaluate(() => {
    window.addEventListener(
      'click',
      () => {
        (window as Window & { __scrollAtClick?: number }).__scrollAtClick = window.scrollY;
      },
      { capture: true, once: true },
    );
  });
  await link.click();
  return page.evaluate(
    () => (window as Window & { __scrollAtClick?: number }).__scrollAtClick ?? -1,
  );
}

/**
 * What the list says of each role, in the rail's own order: Now, then each year. The role pages
 * are checked against these, so their figures come from the data on both sides.
 */
export interface ListedRole {
  readonly id: string;
  readonly href: string;
  /** The role's months on the clock: the columns its capsule spans on "The path so far". */
  readonly months: number;
  readonly title: string;
}

export async function listedRoles(page: Page): Promise<ListedRole[]> {
  const main = await openConsolePage(page, '/experience', 'Experience');
  await expectSettled(main);
  return main.evaluate((root) => {
    const monthsOf = (id: string): number =>
      Number(
        root
          .querySelector<HTMLElement>(`[data-role-path] a[data-r="${CSS.escape(id)}"]`)
          ?.closest<HTMLElement>('li')?.dataset.span ?? 0,
      );
    return Array.from(root.querySelectorAll<HTMLElement>('li[data-role-row]')).map((stop) => {
      const link = stop.querySelector<HTMLAnchorElement>('[data-role-page]');
      return {
        id: stop.dataset.id ?? '',
        href: link?.getAttribute('href') ?? '',
        months: monthsOf(stop.dataset.id ?? ''),
        title: (link?.firstChild?.textContent ?? '').trim(),
      };
    });
  });
}

/** Opens a role's page and checks its one heading inside the shell. */
export async function openRole(page: Page, role: ListedRole): Promise<Locator> {
  const response = await page.goto(`${getTargetUrl()}${role.href}`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  const main = page.locator('main#main-content');
  await expect(main.locator('h1')).toHaveCount(1);
  await expect(main.locator('h1')).toHaveText(role.title);
  await expectSettled(main);
  return main;
}
