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
 * @file /experience (the story) and a role's page on a phone-sized touch screen. Every title,
 * "What I did", "Jump to" link and row of "The path so far" gives a 44px tap target (a link
 * inside a sentence is exempt, as WCAG has it). With the phone's text at 200% every chapter
 * title stays whole and inside the page, the display word never eats the screen, and no word
 * splits mid-word: not in a title or an organization (on the list, and among a role's "Ran
 * alongside"), and, on the narrowest phone, not in the duties or "What I did" either (the rail
 * narrows and the duties' indent gives way); nothing leaves its figure or its tile.
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, type Locator, test } from '@playwright/test';
import { expectNoOverflow, readOnly } from '../fixtures/console-routes';
import {
  cutIn,
  indexRows,
  listedRoles,
  openRole,
  ROW_TEXT,
  skipUnless,
  splitWordsIn,
  tapFaultsIn,
} from './experience-helpers';

test.beforeEach(async ({ page }) => readOnly(page));

test.describe('Experience story, on a phone with its text at 200%', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps every chapter title whole and inside the page, and nothing cut', async ({ page }) => {
    await indexRows(page);
    const main = page.locator('main#main-content');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoOverflow(page);

    const titles = main.locator('section[data-chapter] h2');
    expect(await splitWordsIn(main, 'section[data-chapter] h2')).toEqual([]);
    const outside = await titles.evaluateAll((headings) =>
      headings.filter((heading) => heading.getBoundingClientRect().right > window.innerWidth + 0.5),
    );
    expect(outside).toHaveLength(0);
    // The display word never eats the screen: well under the window's height.
    const first = await titles.first().boundingBox();
    expect(first?.height ?? 0).toBeLessThan(844 * 0.4);
    expect(await cutIn(main, ROW_TEXT)).toEqual([]);
  });

  test('splits no title or organization mid-word, and the lead stays largest', async ({ page }) => {
    await indexRows(page);
    const main = page.locator('main#main-content');
    const names = '[data-role-page], [data-role-org-name]';
    // At the phone's own text size nothing splits either.
    expect(await splitWordsIn(main, names)).toEqual([]);

    for (const size of [150, 175, 200]) {
      await page.addStyleTag({ content: `html { font-size: ${size}% !important; }` });
      await expectNoOverflow(page);
      expect(await splitWordsIn(main, names), `at ${size}%`).toEqual([]);
    }
    // The lead's title is still the largest text of its role.
    const lead = main.locator('li[data-role-row][data-weight="lead"]');
    skipUnless((await lead.count()) > 0, 'No role runs now: no lead to measure.');
    const title = await lead.locator('h3').evaluate((heading) => {
      const article = heading.closest('article');
      const sizes = Array.from(article?.querySelectorAll('p, li') ?? [])
        .filter((part) => !heading.contains(part))
        .map((part) => Number.parseFloat(getComputedStyle(part).fontSize));
      return {
        size: Number.parseFloat(getComputedStyle(heading).fontSize),
        others: Math.max(...sizes),
      };
    });
    expect(title.size).toBeGreaterThan(title.others);
  });

  test('splits no name among the roles that ran alongside: the months go under the title', async ({
    page,
  }) => {
    const roles = await listedRoles(page);
    // The role with the most months on the clock ran beside the most others.
    const role = skipUnless(
      [...roles].sort((a, b) => b.months - a.months)[0],
      'The list has no role: no page to open.',
    );
    const main = await openRole(page, role);
    const names = '[data-role-companion] > [data-part]';
    skipUnless((await main.locator(names).count()) > 0, 'No role ran alongside this one.');

    for (const size of [100, 150, 175, 200]) {
      await page.addStyleTag({ content: `html { font-size: ${size}% !important; }` });
      await expectNoOverflow(page);
      expect(await splitWordsIn(main, names), `at ${size}%`).toEqual([]);
    }
  });
});

test.describe('Experience, on the narrowest phone with its text at 200%', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });

  /** The parts under `scope` whose box leaves the box of the closest `tile` around them. */
  const outsideTile = (scope: Locator, parts: string, tile: string): Promise<string[]> =>
    scope.locator(parts).evaluateAll(
      (elements, around) =>
        elements
          .filter((part) => {
            const frame = part.closest(around)?.getBoundingClientRect();
            const box = part.getBoundingClientRect();
            return !frame || box.left < frame.left - 0.5 || box.right > frame.right + 0.5;
          })
          .map((part) => (part.textContent ?? '').trim()),
      tile,
    );

  test('splits no word in the duties or "What I did": the rail narrows, the indent gives way', async ({
    page,
  }) => {
    await indexRows(page);
    const main = page.locator('main#main-content');
    const summaries = main.locator('details[data-role-more] > summary');
    for (const summary of await summaries.all()) await summary.tap();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoOverflow(page);

    const words = '[data-role-duties], details[data-role-more], [data-prose], [data-role-tech]';
    expect(await splitWordsIn(main, words)).toEqual([]);
    // The duties take the words' full width: no dash, no indent.
    const indent = await main
      .locator('[data-role-duties] > li')
      .first()
      .evaluate((item) => Number.parseFloat(getComputedStyle(item).paddingLeft));
    expect(indent).toBe(0);
    expect(await cutIn(main, ROW_TEXT)).toEqual([]);
  });

  test('keeps "The path so far" inside the page: each row its name over its line', async ({
    page,
  }) => {
    await indexRows(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const main = page.locator('main#main-content');
    skipUnless((await main.locator('figure[data-role-path]').count()) > 0, 'No path.');
    await expectNoOverflow(page);

    const parts = '[data-path-label], [data-path-line]';
    expect(await outsideTile(main, parts, 'figure[data-role-path]')).toEqual([]);
    expect(await splitWordsIn(main, '[data-path-label]')).toEqual([]);
  });

  test("keeps a step's dates inside its tile on a role's page", async ({ page }) => {
    const roles = await listedRoles(page);
    // A role in the middle of the list: it has a step before it and one after.
    const role = skipUnless(roles[Math.floor(roles.length / 2)], 'The list has no role.');
    const main = await openRole(page, role);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoOverflow(page);

    await expect(main.locator('[data-role-step]').first()).toBeVisible();
    expect(await outsideTile(main, '[data-role-step] time', '[data-role-step]')).toEqual([]);
    expect(
      await outsideTile(
        main,
        '[data-stack-legend] > span:nth-of-type(2) > span',
        '[data-role-on-clock]',
      ),
    ).toEqual([]);
  });

  test("splits no organization in a role page's steps: the name gives way to its tile", async ({
    page,
  }) => {
    const roles = await listedRoles(page);
    const names = '[data-role-step] > span:nth-child(2)';
    let checked = 0;
    // Every page: which names its steps carry is the data's, and a long one-word name
    // ("TalentSprint", "Farmingdale") split at 1.25rem.
    for (const role of roles) {
      const main = await openRole(page, role);
      if ((await main.locator(names).count()) === 0) continue;
      checked += 1;
      for (const size of [175, 200]) {
        await page.addStyleTag({ content: `html { font-size: ${size}% !important; }` });
        expect(await splitWordsIn(main, names), `${role.href} at ${size}%`).toEqual([]);
        expect(await outsideTile(main, names, '[data-role-step]'), role.href).toEqual([]);
      }
    }
    skipUnless(checked > 0, 'No role page has a step.');
  });
});

test.describe('Experience story, on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** Links inside a sentence (WCAG 2.5.8 inline). */
  const EXEMPT = '[data-prose] a';

  test('gives every title, "What I did", jump and path row a 44px tap target, none over another', async ({
    page,
  }) => {
    await indexRows(page);
    const main = page.locator('main#main-content');

    expect(await tapFaultsIn(main, EXEMPT)).toEqual({ small: [], overlapping: [] });
    const summaries = main.locator('details[data-role-more] > summary');
    const count = await summaries.count();
    for (let index = 0; index < count; index += 1) await summaries.nth(index).tap();
    expect(await tapFaultsIn(main, EXEMPT)).toEqual({ small: [], overlapping: [] });
  });
});

test.describe("A role's page, on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('gives every link a 44px tap target, none over another', async ({ page }) => {
    const roles = await listedRoles(page);
    skipUnless(roles.length > 0, 'The list has no role: no page to open.');
    // The first four in the list's order: with and without a site, links and a logo.
    for (const role of roles.slice(0, 4)) {
      const main = await openRole(page, role);
      expect(await tapFaultsIn(main), role.href).toEqual({ small: [], overlapping: [] });
    }
  });
});
