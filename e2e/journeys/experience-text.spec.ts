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
 * @file /experience (the story) and a role's page with enlarged text, on narrow windows: a word
 * that fits a line stays whole. A stop's title gives way by its own width over its widest word
 * and stays inside its role, the lead's never below the body text; the page's h1 steps down by
 * the page's width, never below the body text. A word wider than its line even at that smallest
 * size may still break: that is the last resort, and it is not counted. In the prose, from
 * 1440px down to a 320px phone, a web name ('SAM.gov', '(app.curvance.com ↗)') moves whole to
 * the next line whenever it fits there, and no line starts on a closing bracket or punctuation.
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectNoOverflow, openConsolePage, readOnly } from '../fixtures/console-routes';
import { indexRows, listedRoles, openRole, skipUnless } from './experience-helpers';

test.beforeEach(async ({ page }) => readOnly(page));

/** A stop's title (its role page's link) and its organization's name. */
const NAMES = 'li[data-role-row] [data-role-page], li[data-role-row] [data-role-org-name]';
/** The byline over them: the smallest size the names are held to when a word must break. */
const PERIOD = 'li[data-role-row] [data-role-meta]';

/** Sets the root font size, or text-size-adjust (which only a phone's mobile mode applies). */
async function enlarge(page: Page, how: { root?: number; adjust?: number }): Promise<void> {
  await page.evaluate(({ root, adjust }) => {
    const style = document.getElementById('enlarged') ?? document.createElement('style');
    style.id = 'enlarged';
    style.textContent = [
      root ? `html { font-size: ${root}% !important; }` : '',
      adjust ? `html { -webkit-text-size-adjust: ${adjust}%; text-size-adjust: ${adjust}%; }` : '',
    ].join('');
    document.head.append(style);
  }, how);
}

/**
 * The words broken across two lines that would fit their element's line whole at `floor`'s font
 * size (the smallest the words may take). A break after '-' or '/' is not a split.
 */
const wholeWordsBroken = (scope: Locator, parts: string, floor: string): Promise<string[]> =>
  scope.locator(parts).evaluateAll((elements, floorSelector) => {
    const floorPx = Number.parseFloat(
      getComputedStyle(document.querySelector(floorSelector) ?? document.documentElement).fontSize,
    );
    // The computed size already carries text-size-adjust: the probe must not grow it again.
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;-webkit-text-size-adjust:100%;text-size-adjust:100%';
    document.body.append(probe);
    const broken: string[] = [];
    for (const element of elements) {
      if (!element.checkVisibility()) continue;
      const style = getComputedStyle(element);
      const line =
        element.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('.sr-only')) continue;
        const own = getComputedStyle(node.parentElement ?? element);
        for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
          const text = word[0];
          const tops = Array.from({ length: text.length }, (_, at) => {
            const range = document.createRange();
            range.setStart(node, word.index + at);
            range.setEnd(node, word.index + at + 1);
            return Math.round(range.getBoundingClientRect().top);
          });
          const breaks = tops.flatMap((top, at) =>
            at > 0 && Math.abs(top - (tops[at - 1] ?? top)) > 2 ? [at] : [],
          );
          if (!breaks.some((at) => !/[-/]/.test(text.charAt(at - 1)))) continue;
          probe.style.font = own.font;
          probe.style.letterSpacing = own.letterSpacing;
          probe.style.fontSize = `${floorPx}px`;
          probe.textContent = text;
          if (probe.getBoundingClientRect().width <= line + 0.5) {
            broken.push(`${text} split at ${breaks.join(',')}, fits ${Math.round(line)}px`);
          }
        }
      }
    }
    probe.remove();
    return broken;
  }, floor);

/**
 * The prose's web names and slashed words ('SAM.gov', '(blog.curvance.com ↗)', 'UI/UX'), each
 * read with the brackets and punctuation glued to it and its new-tab arrow, that break across
 * lines although the whole name fits its column; and each line that starts on a closing bracket
 * or punctuation. A name wider than its column may break at its dots and slashes.
 */
const namesBroken = (main: Locator): Promise<string[]> =>
  main.locator('[data-prose]').evaluateAll((proses) => {
    type Glyph = { text: string; top: number; width: number; height: number } | null;
    /** The visible glyphs in order, the new-tab arrow as one; null for a space. */
    const glyphsOf = (prose: Element): Glyph[] => {
      const glyphs: Glyph[] = [];
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_ALL);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node instanceof Element && node.matches('[data-new-tab-arrow]')) {
          const box = node.getBoundingClientRect();
          glyphs.push({ text: '↗', top: box.top, width: box.width, height: box.height });
        }
        if (node.nodeType !== Node.TEXT_NODE) continue;
        if (node.parentElement?.closest('.sr-only, [data-new-tab-arrow]')) continue;
        const value = node.textContent ?? '';
        for (let at = 0; at < value.length; at += 1) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          const box = Array.from(range.getClientRects()).find((rect) => rect.width > 0);
          if (/\s/.test(value.charAt(at))) glyphs.push(null);
          else if (box) glyphs.push({ text: value.charAt(at), ...box.toJSON() });
        }
      }
      return glyphs;
    };
    /** The content width of the block the prose's lines run in. */
    const columnOf = (prose: Element): number => {
      let block = prose;
      while (block.parentElement && getComputedStyle(block).display.startsWith('inline')) {
        block = block.parentElement;
      }
      const style = getComputedStyle(block);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      return block.clientWidth - padding;
    };
    const below = (a: NonNullable<Glyph>, b: NonNullable<Glyph>) =>
      b.top > a.top + Math.max(4, b.height / 2);
    const faults: string[] = [];
    for (const prose of proses) {
      if (!prose.checkVisibility()) continue;
      const column = columnOf(prose);
      const glyphs = glyphsOf(prose);
      let word: NonNullable<Glyph>[] = [];
      let last: NonNullable<Glyph> | null = null;
      for (const glyph of [...glyphs, null]) {
        if (glyph && last && below(last, glyph) && /[)\]}.,;:!?]/.test(glyph.text)) {
          faults.push(`a line starts on "${glyph.text}" in "${prose.textContent?.slice(0, 40)}"`);
        }
        if (glyph) {
          word = [...word, glyph];
          last = glyph;
          continue;
        }
        const text = word.map((part) => part.text).join('');
        const width = word.reduce((sum, part) => sum + part.width, 0);
        const split = word.some((part, at) => at > 0 && below(word[at - 1] ?? part, part));
        if (split && /\w[./]\w/.test(text) && width <= column - 1) {
          faults.push(`${text} breaks though it fits (${Math.round(width)} of ${column}px)`);
        }
        word = [];
      }
    }
    return faults;
  });

/** The windows the prose is read at: a mouse at 1440 and 1024, touch from a tablet down. */
const PROSE_VIEWS = [
  { name: '1440px', use: { viewport: { width: 1440, height: 900 } } },
  { name: '1024px', use: { viewport: { width: 1024, height: 768 } } },
  {
    name: 'a 768px touch tablet',
    use: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
  },
  {
    name: 'a 390px phone',
    use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  },
  {
    name: 'a 320px phone',
    use: { viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true },
  },
];

for (const view of PROSE_VIEWS) {
  test.describe(`Experience prose at ${view.name}`, () => {
    test.use(view.use);

    test('keeps each web name whole when it fits its line, and starts no line on a closing mark', async ({
      page,
    }) => {
      await indexRows(page);
      const main = page.locator('main#main-content');
      const names = await main
        .locator('[data-prose]')
        .evaluateAll((proses) => proses.filter((p) => /\w[./]\w/.test(p.textContent ?? '')).length);
      skipUnless(names > 0, 'No web name in the prose.');
      // "What I did" open, so its duties are read too.
      await main.locator('details[data-role-more]').evaluateAll((all) => {
        for (const details of all) details.setAttribute('open', '');
      });
      expect(await namesBroken(main), 'at the page’s own size').toEqual([]);
      await enlarge(page, { root: 200 });
      await expectNoOverflow(page);
      expect(await namesBroken(main), 'with the root font at 200%').toEqual([]);
    });
  });
}

/**
 * Stops whose title or organization leaves its role's box: a title gives way by its own width
 * over its widest word, so it never needs the room of the words beside it.
 */
const rowFaults = (main: Locator) =>
  main.locator('li[data-role-row] article').evaluateAll((articles) =>
    articles.flatMap((article) => {
      const frame = article.getBoundingClientRect();
      return Array.from(article.querySelectorAll('[data-role-page], [data-role-organization]'))
        .filter((part) => part.getBoundingClientRect().right > frame.right + 0.5)
        .map((part) => `"${(part.textContent ?? '').trim().slice(0, 40)}" leaves its role`);
    }),
  );

for (const width of [320, 390]) {
  test.describe(`Experience rows at ${width}px with the root font enlarged`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('split no title or organization that fits its line, and keep both inside the role', async ({
      page,
    }) => {
      await indexRows(page);
      const main = page.locator('main#main-content');
      for (const root of [150, 175, 200]) {
        await enlarge(page, { root });
        await expectNoOverflow(page);
        expect(await wholeWordsBroken(main, NAMES, PERIOD), `at ${root}%`).toEqual([]);
        expect(await rowFaults(main), `at ${root}%`).toEqual([]);
      }
    });
  });
}

test.describe('Experience rows on a phone with enlarged text', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });

  test('split no title or organization that fits its line, with the root font at 200%', async ({
    page,
  }) => {
    await indexRows(page);
    const main = page.locator('main#main-content');
    await enlarge(page, { root: 200 });
    await expectNoOverflow(page);
    expect(await wholeWordsBroken(main, NAMES, PERIOD)).toEqual([]);
    expect(await rowFaults(main)).toEqual([]);
  });

  test('split no title that fits its line under text-size-adjust at 200%', async ({ page }) => {
    // Known limit: Chrome multiplies the final font size after every CSS unit is resolved, so
    // a title fitted to its box in em or cqi comes out twice as large there and a long word
    // splits. Nothing in CSS can read the multiplier. The folio display numerals and type covers
    // no longer share it (they hold text-size-adjust at 100%, globals.css Folio block); the
    // inline chapter heading does.
    test.fail();
    await indexRows(page);
    const main = page.locator('main#main-content');
    await enlarge(page, { adjust: 200 });
    await expectNoOverflow(page);
    expect(await wholeWordsBroken(main, NAMES, PERIOD)).toEqual([]);
  });
});

/** The h1's size against the root's, so the title is never set below the body text. */
const titleSizes = (main: Locator) =>
  main.locator('h1').evaluate((title) => ({
    title: Number.parseFloat(getComputedStyle(title).fontSize),
    body: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));

/** The role whose title holds the longest word: the hardest for the h1. */
async function longestTitledRole(page: Page) {
  const roles = await listedRoles(page);
  const longest = (title: string) => Math.max(0, ...title.split(/\s+/).map((word) => word.length));
  const role = [...roles].sort((a, b) => longest(b.title) - longest(a.title))[0];
  return skipUnless(role, 'The list has no role: no page to open.');
}

for (const width of [320, 390]) {
  test.describe(`The page title at ${width}px with the root font enlarged`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('keeps "Experience" whole, never below the body text', async ({ page }) => {
      const main = await openConsolePage(page, '/experience', 'Experience');
      for (const root of [150, 175, 200]) {
        await enlarge(page, { root });
        await expectNoOverflow(page);
        expect(await wholeWordsBroken(main, 'h1', 'html'), `at ${root}%`).toEqual([]);
        const sizes = await titleSizes(main);
        expect(sizes.title, `at ${root}%`).toBeGreaterThanOrEqual(sizes.body);
      }
    });

    test('keeps a long role title whole on its page', async ({ page }) => {
      const main = await openRole(page, await longestTitledRole(page));
      for (const root of [150, 175, 200]) {
        await enlarge(page, { root });
        await expectNoOverflow(page);
        expect(await wholeWordsBroken(main, 'h1', 'html'), `at ${root}%`).toEqual([]);
        const sizes = await titleSizes(main);
        expect(sizes.title, `at ${root}%`).toBeGreaterThanOrEqual(sizes.body);
      }
    });
  });
}

/** A role page's eyebrow: the organization, with its mark, over the h1. */
const EYEBROW = 'header p:has([data-role-organization])';

/** The roles whose organizations hold the longest words, longest first: hardest for an eyebrow. */
async function longestNamedRoles(page: Page, count: number) {
  const roles = await listedRoles(page);
  const names: Record<string, string> = await page
    .locator('main#main-content')
    .evaluate((root) =>
      Object.fromEntries(
        Array.from(root.querySelectorAll<HTMLElement>('li[data-role-row]')).map((row) => [
          row.dataset.id ?? '',
          (row.querySelector('[data-role-org-name]')?.textContent ?? '').trim(),
        ]),
      ),
    );
  const longest = (name = '') => Math.max(0, ...name.split(/\s+/).map((word) => word.length));
  return roles
    .filter((role) => names[role.id])
    .sort((a, b) => longest(names[b.id]) - longest(names[a.id]))
    .slice(0, count);
}

for (const width of [320, 390]) {
  test.describe(`The lead role and the eyebrow at ${width}px with the root font enlarged`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("keeps the lead role's title whole, never below the body text", async ({ page }) => {
      await indexRows(page);
      const main = page.locator('main#main-content');
      const lead = 'li[data-role-row][data-weight="lead"] [data-role-page]';
      const title = main.locator(lead);
      skipUnless((await title.count()) > 0, 'No role is current: no lead.');
      for (const root of [150, 175, 200]) {
        await enlarge(page, { root });
        await expectNoOverflow(page);
        expect(await wholeWordsBroken(main, lead, 'html'), `at ${root}%`).toEqual([]);
        const sizes = await title.evaluate((heading) => ({
          title: Number.parseFloat(getComputedStyle(heading).fontSize),
          body: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        }));
        expect(sizes.title, `at ${root}%`).toBeGreaterThanOrEqual(sizes.body);
      }
    });

    test("keeps the organization whole in a role page's eyebrow", async ({ page }) => {
      const roles = await longestNamedRoles(page, 3);
      skipUnless(roles.length > 0, 'No role has a row: no organization to check.');
      for (const role of roles) {
        const main = await openRole(page, role);
        for (const root of [150, 175, 200]) {
          await enlarge(page, { root });
          await expectNoOverflow(page);
          expect(await wholeWordsBroken(main, EYEBROW, EYEBROW), `${role.id} at ${root}%`).toEqual(
            [],
          );
        }
      }
    });
  });
}

test.describe('The page title at the browser’s own text size', () => {
  test('keeps its size: 2rem on a phone, 2.75rem from a 48rem page', async ({ page }) => {
    for (const { width, size } of [
      { width: 320, size: 32 },
      { width: 390, size: 32 },
      { width: 1024, size: 44 },
      { width: 1440, size: 44 },
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/experience', 'Experience');
      expect((await titleSizes(main)).title, `at ${width}px`).toBe(size);
    }
  });
});
