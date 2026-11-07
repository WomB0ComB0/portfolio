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
 * @file /certifications as the Ledger, against the live data. Nothing here hard-codes a count or
 * an issuer: each check compares the page with its own figures (the header's certificates, the
 * first family chip's label and count).
 * - With no filter, every certificate is a row, as many as the header counts, under year h2s
 *   (newest first) whose counts add up; the page has one h1, and the column header row shows once.
 * - Today's shared links still work: ?issuer=Google Cloud Skills Boost lands on the Google chip
 *   with its rows (and is filtered in the server HTML); ?skill=React.js filters on the split
 *   skills and shows a Clear link that brings every row back and hands focus to the current chip.
 * - The URL stays the truth: a chip, then leaving and coming Back, shows what the URL says; so
 *   does a navigation to the page's own URL.
 * - The page never scrolls sideways at 390 or 1280 px, and is at most 6.5 phone screens
 *   (390x844) and 4.5 desktop screens (1280x800). At 1280 every chip sits on one line. A phone's
 *   first screen shows several whole titles above the bottom bar, its toolbar scrolls inside
 *   itself, and a shared link to a chip past its edge scrolls the toolbar to that chip. No visible
 *   text is under 12px and none is set in capitals. In forced colours the current chip still
 *   stands out. Hydration moves nothing: the header and toolbar sit where the server HTML put them.
 *
 * Each check waits until no streamed segment is hidden and nothing in main is aria-busy (as
 * shell-grid.spec.ts does), and for the fonts, before it measures.
 */

import { type Browser, expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const PATH = '/certifications';
const MAIN = 'main#main-content';
const ROW = 'tr[data-cert-row]';
const YEAR_HEADING = 'h2[id^="certificates-"]';
const CURRENT_CHIP = 'a[aria-current="true"]';
/** A streamed segment not revealed yet, or a skeleton marked busy (shell-grid.spec.ts). */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

const PHONE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;
const MAX_PHONE_SCREENS = 6.5;
const MAX_DESKTOP_SCREENS = 4.5;
const MIN_TEXT_PX = 12;
/** Whole titles a phone's first screen should show above the bottom bar. */
const MIN_TITLES_ON_FIRST_PHONE_SCREEN = 3;
/** Sub-pixel rounding between two renders of the same layout. */
const SAME_PX = 1;

type Viewport = { readonly width: number; readonly height: number };

async function settle(page: Page): Promise<Locator> {
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  return main;
}

async function openAt(page: Page, query: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PATH}${query}`);
  return settle(page);
}

/** Hydrated: the island's search field carries React's props. */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const input = document.querySelector('main input[type="search"]');
    return input !== null && Object.keys(input).some((key) => key.startsWith('__reactProps'));
  });
}

interface NextWindow {
  next?: { router?: { push: (href: string) => void } };
}

/** What the nav's links and the command palette do: a client navigation through Next's router. */
async function routerPush(page: Page, href: string): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as NextWindow).next?.router));
  await page.evaluate((target) => {
    (window as unknown as NextWindow).next?.router?.push(target);
  }, href);
}

/** A header figure by its label ('certificates'), as a number. */
async function figure(main: Locator, label: string): Promise<number> {
  const item = main
    .locator('dl[aria-label="Totals"] > div')
    .filter({ has: main.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) });
  return Number(((await item.locator('dd').textContent()) ?? '').replaceAll(',', ''));
}

const chipList = (main: Locator): Locator => main.getByRole('list', { name: 'Filter by issuer' });

interface Chip {
  readonly label: string;
  readonly count: number;
}

/** A chip's label and count, from its text ("Google 20 certificates"). */
function readChip(text: string | null): Chip {
  const match = /^(.*?) (\d+) certificates?$/.exec((text ?? '').trim());
  if (!match) throw new Error(`unreadable chip: ${text}`);
  return { label: match[1] ?? '', count: Number(match[2]) };
}

const currentChip = async (root: Locator): Promise<Chip> =>
  readChip(await root.locator(CURRENT_CHIP).textContent());

/** The first chip after All: the biggest issuer family, whatever the data holds. */
async function firstFamilyChip(main: Locator): Promise<Chip & { link: Locator; slug: string }> {
  const link = chipList(main).getByRole('link').nth(1);
  const chip = readChip(await link.textContent());
  const href = (await link.getAttribute('href')) ?? '';
  const slug = new URL(href, getTargetUrl()).searchParams.get('issuer') ?? '';
  expect(slug, 'the chip links to ?issuer=<slug>').not.toBe('');
  return { ...chip, link, slug };
}

/**
 * Visible text in main under 12px, or set in capitals, as 'text: reason'. Text only a screen
 * reader reads (sr-only: a box of 1px or less) is skipped.
 */
function textOffenders(main: Locator): Promise<string[]> {
  return main.evaluate((root, minimum) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      const element = node.parentElement;
      const shown = element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      if (text === '' || !element || !shown) continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const style = getComputedStyle(element);
      if (Number.parseFloat(style.fontSize) < minimum - 0.01) {
        found.push(`${text.slice(0, 40)}: ${style.fontSize}`);
      }
      if (style.textTransform === 'uppercase') found.push(`${text.slice(0, 40)}: uppercase`);
    }
    return found;
  }, MIN_TEXT_PX);
}

test.describe('/certifications: the Ledger', () => {
  test('every certificate is a row, as many as the header counts, under year headings', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    const total = await figure(main, 'certificates');

    expect(total).toBeGreaterThan(0);
    await expect(main.locator(ROW)).toHaveCount(total);
    expect((await currentChip(chipList(main))).count).toBe(total);

    expect(await page.evaluate(() => document.querySelectorAll('h1').length)).toBe(1);
    await expect(main.locator('h1')).toHaveText('Certifications');

    // "2024, 26 certificates": the comma is for screen readers, so the two numbers do not run on.
    const years = (await main.locator(YEAR_HEADING).allTextContents()).map((text) =>
      /^(\d{4}), (\d+) certificates?$/.exec(text.trim()),
    );
    expect(years.length).toBeGreaterThan(0);
    expect(years.every(Boolean), 'each year h2 reads "YYYY, N certificates"').toBe(true);
    const yearNumbers = years.map((match) => Number(match?.[1]));
    expect(yearNumbers).toEqual([...yearNumbers].sort((a, b) => b - a));
    expect(years.reduce((sum, match) => sum + Number(match?.[2]), 0)).toBe(total);
  });

  test('desktop: the column header row shows once, and every year table keeps its headers', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    const tables = main.getByRole('table');
    const shownHeaderRows = await main
      .locator('thead tr')
      .evaluateAll((rows) => rows.filter((row) => row.getBoundingClientRect().height > 2).length);

    expect(shownHeaderRows).toBe(1);
    for (const table of await tables.all()) {
      await expect(table.getByRole('columnheader')).toHaveText([
        'Certificate',
        'Issuer',
        'Issued',
        'Verify',
      ]);
    }
  });

  test('?issuer=Google Cloud Skills Boost lands on Google, as shared links always did', async ({
    page,
  }) => {
    const main = await openAt(page, '?issuer=Google%20Cloud%20Skills%20Boost', DESKTOP);
    const chip = await currentChip(chipList(main));

    expect(chip.label).toBe('Google');
    expect(chip.count).toBeGreaterThan(0);
    await expect(main.locator(ROW)).toHaveCount(chip.count);
    for (const issuer of await main.locator(`${ROW} > td:nth-child(2)`).allInnerTexts()) {
      expect(issuer).toMatch(/^Google/);
    }
  });

  test('?skill=React.js filters on the split skills; Clear brings every row back and keeps focus', async ({
    page,
  }) => {
    const main = await openAt(page, '?skill=React.js', DESKTOP);
    const total = await figure(main, 'certificates');
    const rows = main.locator(ROW);
    const line = main.locator('p', { hasText: /^Skill: React\.js · Clear$/ });

    await expect(line).toBeVisible();
    const filtered = await rows.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    for (const text of await rows.allInnerTexts()) expect(text).toContain('React.js');

    await hydrated(page);
    await line.getByRole('link', { name: 'Clear' }).focus();
    await page.keyboard.press('Enter');

    await expect(rows).toHaveCount(total);
    await expect(page).not.toHaveURL(/skill=/);
    // The link Enter pressed is gone: focus goes to the now-current chip, not the page.
    await expect(chipList(main).locator(CURRENT_CHIP)).toBeFocused();
    await expect(main.locator('p[role="status"]')).toHaveText(`Showing all ${total} certificates`);
  });

  test('a chip and the search filter in place, with no navigation, and rewrite the URL', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      // Analytics are no part of the page: blocked hosts in a test run, and the Vercel insights
      // scripts, which only exist on Vercel (elsewhere /_vercel/* answers a text 404).
      const text = message.text();
      const analytics = text.startsWith('Failed to load resource') || text.includes('/_vercel/');
      if (message.type() === 'error' && !analytics) errors.push(text);
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    await page.evaluate(() => {
      (window as unknown as { ledgerMarker: boolean }).ledgerMarker = true;
    });
    const rows = main.locator(ROW);

    const family = await firstFamilyChip(main);
    await family.link.click();
    await expect(rows).toHaveCount(family.count);
    await expect(page).toHaveURL(new RegExp(`/certifications\\?issuer=${family.slug}$`));
    expect((await currentChip(chipList(main))).label).toBe(family.label);

    await chipList(main)
      .getByRole('link', { name: /^All \d+/ })
      .click();
    await main.getByRole('searchbox', { name: 'Search certificates' }).fill('react');
    await expect(page).toHaveURL(/\/certifications\?q=react$/);
    const found = await rows.count();
    expect(found).toBeGreaterThan(0);
    for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain('react');

    expect(await page.evaluate(() => 'ledgerMarker' in window), 'the page navigated').toBe(true);
    expect(errors).toEqual([]);
  });

  test.describe('the URL stays the truth', () => {
    test('a chip, a navigation away, then Back: the rows are the ones the URL names', async ({
      page,
    }) => {
      const main = await openAt(page, '', DESKTOP);
      await hydrated(page);
      const family = await firstFamilyChip(main);
      await family.link.click();
      await expect(page).toHaveURL(new RegExp(`\\?issuer=${family.slug}$`));

      await routerPush(page, '/projects');
      await expect(page).toHaveURL(/\/projects$/);
      await expect(main.locator(ROW)).toHaveCount(0);
      await page.goBack();

      await expect(page).toHaveURL(new RegExp(`/certifications\\?issuer=${family.slug}$`));
      await settle(page);
      await expect(main.locator(ROW)).toHaveCount(family.count);
      await expect(chipList(main).locator(CURRENT_CHIP)).toHaveText(
        new RegExp(`^${family.label} ${family.count}`),
      );
    });

    test('a chip, then a navigation to the page’s own URL: every row again', async ({ page }) => {
      const main = await openAt(page, '', DESKTOP);
      const total = await figure(main, 'certificates');
      await hydrated(page);
      const family = await firstFamilyChip(main);
      await family.link.click();
      await expect(main.locator(ROW)).toHaveCount(family.count);

      // What the nav's Certifications link and the command palette do.
      await routerPush(page, PATH);

      await expect(page).toHaveURL(/\/certifications$/);
      await expect(main.locator(ROW)).toHaveCount(total);
      await expect(chipList(main).locator(CURRENT_CHIP)).toHaveText(/^All \d+/);
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    // The route has no loading.tsx (owner decision, 2026-11-07), so the Ledger arrives inside the
    // shell's main, not in a hidden streamed segment: a visitor without JavaScript sees the rows.
    test('a shared ?issuer link shows its filtered rows', async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(`${getTargetUrl()}${PATH}?issuer=Google%20Cloud%20Skills%20Boost`);

      const main = page.locator(MAIN);
      const chip = await currentChip(main);
      expect(chip.label).toBe('Google');
      await expect(main.locator('h1')).toHaveText('Certifications');
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
      const rows = main.locator(ROW);
      expect(await rows.count()).toBe(chip.count);
      const shown = await rows.evaluateAll(
        (elements) => elements.filter((element) => element.checkVisibility()).length,
      );
      expect(shown).toBe(chip.count);
    });
  });

  for (const [name, viewport, maxScreens] of [
    ['phone', PHONE, MAX_PHONE_SCREENS],
    ['desktop', DESKTOP, MAX_DESKTOP_SCREENS],
  ] as const) {
    test(`${name} ${viewport.width}x${viewport.height}: no sideways scroll, at most ${maxScreens} screens, no small or capital text`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      const measure = await page.evaluate(() => ({
        clientWidth: document.body.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        screen: window.innerHeight,
      }));

      expect(measure.scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(
        measure.clientWidth,
      );
      expect(measure.height / measure.screen, 'screens of scrolling').toBeLessThanOrEqual(
        maxScreens,
      );
      expect(await textOffenders(main)).toEqual([]);
    });
  }

  test('desktop 1280: every chip sits on one line', async ({ page }) => {
    const main = await openAt(page, '', DESKTOP);
    const tops = await chipList(main)
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));

    expect(tops.length).toBeGreaterThan(1);
    expect(new Set(tops).size, 'chips wrap onto a second line').toBe(1);
  });

  test('forced colours: the current chip still looks different from the others', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const main = await openAt(page, '', DESKTOP);
    const looks = await chipList(main)
      .getByRole('link')
      .evaluateAll((links) =>
        links.map((link) => {
          const style = getComputedStyle(link);
          const current = link.getAttribute('aria-current') === 'true';
          return { current, look: `${style.backgroundColor}|${style.color}|${style.borderColor}` };
        }),
      );
    const current = looks.find((chip) => chip.current);

    expect(current).toBeDefined();
    for (const other of looks.filter((chip) => !chip.current)) {
      expect(other.look).not.toBe(current?.look);
    }
  });

  test('phone: the toolbar scrolls inside itself and screen 1 shows several whole titles', async ({
    page,
  }) => {
    const main = await openAt(page, '', PHONE);
    const visibleTitles = await main.locator(`${ROW} [data-cert-title]`).evaluateAll((titles) => {
      const bar = [...document.querySelectorAll('body *')].find((element) => {
        const box = element.getBoundingClientRect();
        return (
          getComputedStyle(element).position === 'fixed' &&
          box.bottom >= window.innerHeight - 1 &&
          box.top > window.innerHeight / 2
        );
      });
      const limit = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      return titles.filter((title) => {
        const box = title.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= limit;
      }).length;
    });
    const overflowX = await main
      .locator('[data-ledger-part="toolbar"]')
      .evaluate((element) => getComputedStyle(element).overflowX);

    expect(visibleTitles).toBeGreaterThanOrEqual(MIN_TITLES_ON_FIRST_PHONE_SCREEN);
    expect(overflowX).toBe('auto');
  });

  test('phone: a shared link to a chip past the screen’s edge scrolls the toolbar to it', async ({
    page,
  }) => {
    let main = await openAt(page, '', PHONE);
    const last = chipList(main).getByRole('link').last();
    const href = (await last.getAttribute('href')) ?? '';
    const label = readChip(await last.textContent()).label;
    expect(href).toMatch(/^\/certifications\?issuer=/);

    main = await openAt(page, href.slice(PATH.length), PHONE);
    await hydrated(page);
    const toolbar = main.locator('[data-ledger-part="toolbar"]');

    await expect(chipList(main).locator(CURRENT_CHIP)).toHaveText(new RegExp(`^${label} `));
    await expect
      .poll(() =>
        toolbar.evaluate((element) => {
          const chip = element.querySelector('a[aria-current="true"]');
          const view = element.getBoundingClientRect();
          const box = chip?.getBoundingClientRect();
          return box !== undefined && box.left >= view.left && box.right <= view.right;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.scrollX), 'the page itself scrolled sideways').toBe(0);
  });

  /** The header's height, and the toolbar's offset under the header's top. */
  async function footprint(
    browser: Browser,
    viewport: Viewport,
    javaScriptEnabled: boolean,
  ): Promise<{ header: number; toolbar: number | null }> {
    const context = await browser.newContext({ viewport, javaScriptEnabled });
    try {
      const page = await context.newPage();
      await page.goto(`${getTargetUrl()}${PATH}`);
      if (javaScriptEnabled) await settle(page);
      else await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator(`${MAIN} header`).filter({ visible: true }).first();
      const toolbar = page
        .locator(`${MAIN} [data-ledger-part="toolbar"]`)
        .filter({ visible: true })
        .first();
      const featured = await page.locator(`${MAIN} [data-featured]`).count();
      const headerBox = await header.boundingBox();
      const toolbarBox = featured === 0 ? await toolbar.boundingBox() : null;
      if (!headerBox) throw new Error('no visible header');
      return {
        header: headerBox.height,
        toolbar: toolbarBox ? toolbarBox.y - headerBox.y : null,
      };
    } finally {
      await context.close();
    }
  }

  for (const viewport of [PHONE, DESKTOP]) {
    test(`${viewport.width}px: hydration keeps the header and toolbar where the server HTML put them`, async ({
      browser,
    }) => {
      // Without JavaScript the page stays as the server sent it, so it can be measured as it shows.
      const server = await footprint(browser, viewport, false);
      const hydrated = await footprint(browser, viewport, true);

      expect(Math.abs(server.header - hydrated.header), 'header height').toBeLessThanOrEqual(
        SAME_PX,
      );
      // The toolbar is measured only without a Featured row (footprint returns null with one).
      if (hydrated.toolbar !== null && server.toolbar !== null) {
        expect(Math.abs(server.toolbar - hydrated.toolbar), 'toolbar top').toBeLessThanOrEqual(
          SAME_PX,
        );
      }
    });
  }
});
