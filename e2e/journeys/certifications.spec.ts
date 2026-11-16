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
 * @file /certifications as a Folio record, against the live data. Nothing here hard-codes a count
 * or an issuer: each check compares the page with its own figures (the header's byline, the year
 * jumps' counts, the first family chip's label and count).
 * - With no filter, every certificate is in the record, as many as the header counts, under year
 *   chapters (newest first) whose jump counts add up; there is no table; every credential link
 *   opens in a new tab, as many as the header says can be verified. A busy year is grouped under
 *   issuer names (the biggest set largest), a thin one sets each certificate large with 'Verify
 *   on <platform>' at body size, at least 24px tall. A jump link lands its chapter clear of the
 *   pinned bar.
 * - Today's shared links still work: ?issuer=Google Cloud Skills Boost lands on the Google chip
 *   with its certificates; ?skill=React.js filters on the split skills and shows a removable token
 *   that brings every certificate back and hands focus to the current chip.
 * - The URL stays the truth: a chip, then leaving and coming Back, shows what the URL says; so
 *   does a navigation to the page's own URL.
 * - The header's byline is the one count; a results line appears, and is said, only once a filter
 *   narrows the list. A PDF on a file host is linked, never counted as verifiable or 'Verify on'.
 * - A chip crossfades the results with a view transition, typing never does, and reduced motion
 *   turns it off. A grouped title draws no arrow at rest; the hover and keyboard focus reach one
 *   end state (brand ink, the arrow drawn and stepped out, the margin lifted, Copy ID shown) and
 *   nothing moves. (The sticky bar, the pinned issuer names and focus under them:
 *   certifications-sticky.spec.ts.)
 * - The page never scrolls sideways at 390 or 1280 px, and is at most 8 phone screens (390x844)
 *   and 6.5 desktop screens (1280x800). At 1280 every chip sits on one line. A phone's first
 *   screen shows the first year and a whole certificate above the bottom bar; its bar is the
 *   search and a Filters button that opens the chips as a sheet (without JavaScript too). No
 *   visible text is under 12px and none is set in capitals; with the browser's text at 200% in a
 *   320px window nothing scrolls sideways and no word in a title, name or skill breaks. A grouped
 *   certificate's skills (three at most, then '+N') sit in the margin beside its title at 1280
 *   and under it on a phone. In forced colours the current chip still stands out. Without
 *   JavaScript the search is a GET form that filters. (That hydration keeps the header and bar
 *   where the server HTML put them: certifications-sticky.spec.ts.)
 *
 * Each check waits until no streamed segment is hidden and nothing in main is aria-busy (as
 * shell-grid.spec.ts does), and for the fonts, before it measures.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  CURRENT_CHIP,
  DESKTOP,
  hydrated,
  MAIN,
  openAt,
  PATH,
  PHONE,
  settle,
  WIDE,
} from '../fixtures/ledger';

/** A certificate in the record: set large in a thin year, or in an issuer group. */
const ITEM = '[data-cert-item]';
const CHAPTER = 'section[data-chapter]';
const MAX_PHONE_SCREENS = 8;
const MAX_DESKTOP_SCREENS = 6.5;
const MIN_TEXT_PX = 12;
/** WCAG 2.5.8's minimum target height. */
const MIN_TARGET_PX = 24;

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

/** A count from the header's byline ('64 certificates', '62 you can verify'), as a number. */
async function headerCount(main: Locator, words: string): Promise<number> {
  const byline = (await main.locator('header [data-byline]').first().textContent()) ?? '';
  const match = new RegExp(`([\\d,]+) ${words}`).exec(byline);
  if (!match) throw new Error(`no "${words}" in the header byline: ${byline}`);
  return Number((match[1] ?? '').replaceAll(',', ''));
}

const chipList = (main: Locator): Locator => main.getByRole('list', { name: 'Filter by issuer' });
const yearJumps = (main: Locator): Locator => main.getByRole('navigation', { name: 'By year' });

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

/** The year jumps as { year, count }, from what each link holds ('2024, 26 certificates26'). */
async function jumpYears(main: Locator): Promise<{ year: string; count: number }[]> {
  const names = await yearJumps(main)
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.textContent ?? ''));
  return names.map((name) => {
    const match = /^(\S+?), (\d+) certificates?/.exec(name.replace(/\s+/g, ' ').trim());
    if (!match) throw new Error(`unreadable jump: ${name}`);
    return { year: match[1] ?? '', count: Number(match[2]) };
  });
}

/**
 * Visible text in main under 12px, or set in capitals, as 'text: reason'. Text only a screen
 * reader reads (sr-only: a box of 1px or less) is skipped, as is text faded out (Copy ID before
 * the hover).
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

/** Words in titles, issuer names, year numerals and skills that a line break cuts in two. */
function brokenWords(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const broken: string[] = [];
    // Each skill is a span of its own (the line opens with a screen-reader-only label).
    const selector =
      '[data-cert-title], [data-issuer-group] h3, section[data-chapter] h2, [data-cert-skills] > span:not(.sr-only)';
    for (const element of root.querySelectorAll(selector)) {
      const node = element.firstChild;
      if (!(node instanceof Text)) continue;
      // A hyphen is a fair place to break, so its halves count as words of their own.
      for (const match of node.data.matchAll(/[^\s-]+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index ?? 0);
        range.setEnd(node, (match.index ?? 0) + match[0].length);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        if (lines.size > 1) broken.push(match[0]);
      }
    }
    return broken;
  });
}

/**
 * Each grouped certificate's skills line: how many names it shows, and whether it sits in the
 * margin to its title's right or under the title, flush with it.
 */
function skillsLayout(main: Locator) {
  return main.locator('[data-cert-size="brief"]:has([data-cert-skills])').evaluateAll((items) =>
    items.map((item) => {
      const title = (item.querySelector('[data-cert-title]') as Element).getBoundingClientRect();
      const skills = item.querySelector('[data-cert-skills]') as Element;
      const box = skills.getBoundingClientRect();
      const shown = skills.cloneNode(true) as Element;
      for (const hidden of shown.querySelectorAll('.sr-only')) hidden.remove();
      const words = (shown.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        words,
        names: words.replace(/\s\+\d+$/, '').split(' · ').length,
        beside: box.left >= title.right - 1,
        under: box.top >= title.bottom - 1 && Math.abs(box.left - title.left) <= 1,
      };
    }),
  );
}

test.describe('/certifications: the Folio record', () => {
  test('every certificate is in the record, as many as the header counts, under year chapters', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    const total = await headerCount(main, 'certificates?');

    expect(total).toBeGreaterThan(0);
    await expect(main.locator(ITEM)).toHaveCount(total);
    expect((await currentChip(chipList(main))).count).toBe(total);
    await expect(main.locator('table')).toHaveCount(0);
    // The header's byline is the one count: no results line repeats it under the bar.
    await expect(main.locator('[data-filter-part="count"]')).toHaveCount(0);

    expect(await page.evaluate(() => document.querySelectorAll('h1').length)).toBe(1);
    await expect(main.locator('h1')).toHaveText('Certifications');

    const years = await jumpYears(main);
    const numbers = years.map((year) => Number(year.year));
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    expect(years.reduce((sum, year) => sum + year.count, 0)).toBe(total);
    const chapters = await main
      .locator(`${CHAPTER} > header h2`)
      .evaluateAll((headings) => headings.map((heading) => heading.textContent));
    expect(chapters).toEqual(years.map((year) => year.year));
  });

  test('every credential link opens in a new tab, as many as the header says can be verified', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    const verifiable = await headerCount(main, 'you can verify');
    const links = main.locator(`${ITEM} a[href^="http"]`);

    // A PDF on a file host is linked, but never counted as one you can verify, nor says so.
    await expect(main.locator(`${ITEM} a[href^="http"]:not([data-cert-file])`)).toHaveCount(
      verifiable,
    );
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    for (const file of await main.locator(`${ITEM}:has(a[data-cert-file])`).all()) {
      await expect(file).not.toContainText('Verify on');
      await expect(file).toContainText(/View certificate|Certificate file/);
    }
  });

  test('a busy year is grouped under issuer names, the biggest set largest', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    const [busiest] = (await jumpYears(main)).sort((a, b) => b.count - a.count);
    expect(busiest?.count ?? 0, 'a year busier than four').toBeGreaterThan(4);
    const year = main.locator(`${CHAPTER}#y${busiest?.year}`);
    const names = year.locator('[data-issuer-group] h3');

    expect(await names.count()).toBeGreaterThan(1);
    const sizes = await names.evaluateAll((headings) =>
      headings.map((heading) => Number.parseFloat(getComputedStyle(heading).fontSize)),
    );
    expect(sizes[0] ?? 0, 'the top issuer is the group’s visual').toBeGreaterThan(sizes[1] ?? 0);
    await expect(year.locator(ITEM)).toHaveCount(busiest?.count ?? 0);
    // Months in the margin: one per stack, each a <time>.
    expect(await year.locator('[data-month-stack] > span time').count()).toBeGreaterThan(0);
  });

  test('a thin year sets each certificate large, Verify on its platform at body size, 24px tall', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    const thin = (await jumpYears(main)).find((year) => year.count > 1 && year.count <= 4);
    test.skip(!thin, 'no year of two to four certificates in the data');
    const year = main.locator(`${CHAPTER}#y${thin?.year}`);
    const big = year.locator('[data-cert-size="big"]');

    await expect(big).toHaveCount(thin?.count ?? 0);
    await expect(year.locator('[data-issuer-group]')).toHaveCount(0);
    const verify = year.getByRole('link', { name: /^Verify on / }).first();
    const metrics = await verify.evaluate((link) => ({
      height: link.getBoundingClientRect().height,
      size: Number.parseFloat(getComputedStyle(link).fontSize),
    }));
    expect(metrics.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(metrics.size).toBeGreaterThanOrEqual(16);
    const title = await big
      .first()
      .locator('h3')
      .evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
    expect(title, 'the title is set at headline size').toBeGreaterThanOrEqual(24);
  });

  test('a jump link lands its chapter clear of the pinned bar', async ({ page }) => {
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    const last = (await jumpYears(main)).at(-1);

    await yearJumps(main).getByRole('link').last().click();
    await expect(page).toHaveURL(new RegExp(`#y${last?.year}$`));
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
          const top = (document.getElementById(id) as HTMLElement).getBoundingClientRect().top;
          return top >= bar.getBoundingClientRect().bottom - 1 && top < window.innerHeight / 2;
        }, `y${last?.year}`),
      )
      .toBe(true);
  });

  test('?issuer=Google Cloud Skills Boost lands on Google, as shared links always did', async ({
    page,
  }) => {
    const main = await openAt(page, '?issuer=Google%20Cloud%20Skills%20Boost', DESKTOP);
    const chip = await currentChip(chipList(main));

    expect(chip.label).toBe('Google');
    expect(chip.count).toBeGreaterThan(0);
    await expect(main.locator(ITEM)).toHaveCount(chip.count);
    for (const name of await main.locator('[data-issuer-group] h3').allTextContents()) {
      expect(name).toBe('Google');
    }
    const bylines = main.locator('[data-cert-size="big"] [data-byline]');
    for (const byline of await bylines.allTextContents()) expect(byline).toMatch(/^Google/);
  });

  test('?skill=React.js filters on the split skills; its token brings every certificate back and keeps focus', async ({
    page,
  }) => {
    const main = await openAt(page, '?skill=React.js', DESKTOP);
    const total = await headerCount(main, 'certificates?');
    const items = main.locator(ITEM);
    const clear = main
      .getByRole('list', { name: 'Applied filters' })
      .getByRole('link', { name: 'Remove Skill: React.js' });

    await expect(clear).toBeVisible();
    await expect(clear).toHaveText('Skill: React.js');
    const filtered = await items.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    // A certificate set large lists its skills.
    for (const text of await main.locator('[data-cert-size="big"]').allInnerTexts()) {
      expect(text).toContain('React.js');
    }

    await hydrated(page);
    await clear.focus();
    await page.keyboard.press('Enter');

    await expect(items).toHaveCount(total);
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
    const total = await headerCount(main, 'certificates?');
    await hydrated(page);
    await page.evaluate(() => {
      (window as unknown as { recordMarker: boolean }).recordMarker = true;
    });
    const items = main.locator(ITEM);

    const family = await firstFamilyChip(main);
    await family.link.click();
    await expect(items).toHaveCount(family.count);
    await expect(page).toHaveURL(new RegExp(`/certifications\\?issuer=${family.slug}$`));
    expect((await currentChip(chipList(main))).label).toBe(family.label);
    // Narrowed, the results line appears with what the filter keeps of the whole, and is said.
    // Its figure counts up in an aria-hidden copy beside a screen-reader twin that holds the value.
    const countLine = main.locator('[data-filter-part="count"]');
    await expect(countLine).toContainText(` of ${total} certificates`);
    await expect(countLine.locator('.sr-only')).toHaveText(String(family.count));
    await expect(main.locator('p[role="status"]')).toHaveText(
      `Showing ${family.count} of ${total} certificates`,
    );

    await chipList(main)
      .getByRole('link', { name: /^All \d+/ })
      .click();
    await main.getByRole('searchbox', { name: 'Search certificates' }).fill('react');
    await expect(page).toHaveURL(/\/certifications\?q=react$/);
    expect(await items.count()).toBeGreaterThan(0);

    expect(await page.evaluate(() => 'recordMarker' in window), 'the page navigated').toBe(true);
    expect(errors).toEqual([]);
  });

  test.describe('the URL stays the truth', () => {
    test('a chip, a navigation away, then Back: the record is the one the URL names', async ({
      page,
    }) => {
      const main = await openAt(page, '', DESKTOP);
      await hydrated(page);
      const family = await firstFamilyChip(main);
      await family.link.click();
      await expect(page).toHaveURL(new RegExp(`\\?issuer=${family.slug}$`));

      await routerPush(page, '/projects');
      await expect(page).toHaveURL(/\/projects$/);
      await expect(main.locator(ITEM)).toHaveCount(0);
      await page.goBack();

      await expect(page).toHaveURL(new RegExp(`/certifications\\?issuer=${family.slug}$`));
      await settle(page);
      await expect(main.locator(ITEM)).toHaveCount(family.count);
      await expect
        .poll(() => currentChip(chipList(main)))
        .toEqual({ label: family.label, count: family.count });
    });

    test('a chip, then a navigation to the page’s own URL: every certificate again', async ({
      page,
    }) => {
      const main = await openAt(page, '', DESKTOP);
      const total = await headerCount(main, 'certificates?');
      await hydrated(page);
      const family = await firstFamilyChip(main);
      await family.link.click();
      await expect(main.locator(ITEM)).toHaveCount(family.count);

      // What the nav's Certifications link and the command palette do.
      await routerPush(page, PATH);

      await expect(page).toHaveURL(/\/certifications$/);
      await expect(main.locator(ITEM)).toHaveCount(total);
      await expect(chipList(main).locator(CURRENT_CHIP)).toHaveText(/^All \d+/);
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    // The route has no loading.tsx (owner decision, 2026-11-07), so the record arrives inside the
    // shell's main, not in a hidden streamed segment: a visitor without JavaScript sees it all.
    test('a shared ?issuer link shows its filtered record', async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(`${getTargetUrl()}${PATH}?issuer=Google%20Cloud%20Skills%20Boost`);

      const main = page.locator(MAIN);
      const chip = await currentChip(main);
      expect(chip.label).toBe('Google');
      await expect(main.locator('h1')).toHaveText('Certifications');
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
      const items = main.locator(ITEM);
      expect(await items.count()).toBe(chip.count);
      const shown = await items.evaluateAll(
        (elements) => elements.filter((element) => element.checkVisibility()).length,
      );
      expect(shown).toBe(chip.count);
    });

    test('the search is a GET form that filters, and the phone sheet still opens', async ({
      page,
    }) => {
      await page.setViewportSize(PHONE);
      await page.goto(`${getTargetUrl()}${PATH}`);
      const main = page.locator(MAIN);

      await main.getByRole('searchbox', { name: 'Search certificates' }).fill('google');
      await main.getByRole('searchbox', { name: 'Search certificates' }).press('Enter');
      await expect(page).toHaveURL(/\/certifications\?q=google$/);
      expect(await main.locator(ITEM).count()).toBeGreaterThan(0);

      // A native popover: the button opens the sheet with no script at all.
      await main.getByRole('button', { name: /^Filters/ }).click();
      await expect(chipList(main)).toBeVisible();
      await expect(chipList(main).locator(CURRENT_CHIP)).toHaveText(/^All /);
    });
  });

  for (const [name, viewport, maxScreens] of [
    ['phone', PHONE, MAX_PHONE_SCREENS],
    ['desktop', DESKTOP, MAX_DESKTOP_SCREENS],
  ] as const) {
    test(`${name} ${viewport.width}x${viewport.height}: no sideways scroll, at most ${maxScreens} screens, no small or capital text, skills ${name === 'phone' ? 'under' : 'beside'} their titles`, async ({
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
      // A grouped certificate's skills: three at most, in the margin at 1280, under it on a phone.
      const skills = await skillsLayout(main);
      expect(skills.length, 'a busy year lists skills').toBeGreaterThan(0);
      for (const each of skills) {
        expect(each.names, each.words).toBeLessThanOrEqual(3);
        expect(name === 'phone' ? each.under : each.beside, each.words).toBe(true);
      }
    });
  }

  test('320px with the browser’s text at 200%: no sideways scroll, no word broken in two', async ({
    page,
    context,
  }) => {
    // The browser's own text size setting: its default font size, 16px at 100%.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    const main = await openAt(page, '', { width: 320, height: 640 });
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    expect(widths.scroll, 'the page scrolls sideways').toBeLessThanOrEqual(widths.client);
    expect(await brokenWords(main)).toEqual([]);
  });

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

  test('phone: the bar is the search and a Filters button; screen 1 shows the first year and a whole certificate', async ({
    page,
  }) => {
    const main = await openAt(page, '', PHONE);
    const filterBar = main.locator('[data-filter-part="bar"]');
    const seen = await main.evaluate((root) => {
      const bar = [...document.querySelectorAll('body *')].find((element) => {
        const box = element.getBoundingClientRect();
        return (
          getComputedStyle(element).position === 'fixed' &&
          box.bottom >= window.innerHeight - 1 &&
          box.top > window.innerHeight / 2
        );
      });
      const limit = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      const whole = (element: Element | null): boolean => {
        const box = element?.getBoundingClientRect();
        return box !== undefined && box.top >= 0 && box.bottom <= limit;
      };
      const titles = [...root.querySelectorAll('[data-cert-item] [data-cert-title]')];
      return {
        year: whole(root.querySelector('section[data-chapter] > header h2')),
        titles: titles.filter(whole).length,
      };
    });

    expect(seen.year, 'the first year shows whole').toBe(true);
    expect(seen.titles).toBeGreaterThanOrEqual(1);
    await expect(filterBar.getByRole('searchbox', { name: 'Search certificates' })).toBeVisible();
    await expect(filterBar.getByRole('button', { name: /^Filters/ })).toBeVisible();
    // The chips wait in the sheet: a closed popover until the button opens it.
    await expect(main.locator('[data-filter-part="chips"]')).toBeHidden();
  });

  test('phone: a shared link’s chip is current, and focused, in the sheet the Filters button opens', async ({
    page,
  }) => {
    let main = await openAt(page, '', PHONE);
    const last = main.locator('[data-filter-part="chips"] a[data-chip]').last();
    const href = (await last.getAttribute('href')) ?? '';
    const label = readChip(await last.textContent()).label;
    expect(href).toMatch(/^\/certifications\?issuer=/);

    main = await openAt(page, href.slice(PATH.length), PHONE);
    await hydrated(page);
    const button = main.getByRole('button', { name: /^Filters/ });
    await expect(button).toHaveText(/^Filters 1/);
    await expect(main.getByRole('list', { name: 'Applied filters' })).toContainText(label);

    await button.click();
    const sheet = page.locator('[data-filter-part="sheet"]');
    const current = chipList(main).locator(CURRENT_CHIP);
    await expect(sheet).toBeVisible();
    // Read the way `label` was, not as a pattern: an issuer like "C++ Institute" is no regex.
    await expect.poll(async () => (await currentChip(chipList(main))).label).toBe(label);
    await expect(current).toBeFocused();
    // It rises on translate over --motion-spring-in, then rests on the screen's bottom edge.
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.round((box?.y ?? 0) + (box?.height ?? 0));
      }, 'the sheet rests on the bottom edge')
      .toBe(PHONE.height);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => window.scrollX), 'the page itself scrolled sideways').toBe(0);
  });

  test('a chip crossfades the results; typing never does; reduced motion turns it off', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const counted = window as unknown as { transitions: number };
      counted.transitions = 0;
      const start = document.startViewTransition?.bind(document) as unknown as
        | ((update: () => void) => unknown)
        | undefined;
      if (!start) return;
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          counted.transitions += 1;
          return start(update);
        },
      });
    });
    const transitions = (): Promise<number> =>
      page.evaluate(() => (window as unknown as { transitions: number }).transitions);
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    const items = main.locator(ITEM);

    const family = await firstFamilyChip(main);
    await family.link.click();
    await expect(items).toHaveCount(family.count);
    expect(await transitions()).toBe(1);

    await main.getByRole('searchbox', { name: 'Search certificates' }).fill('a');
    await expect(page).toHaveURL(/q=a/);
    expect(await transitions(), 'typing started a view transition').toBe(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chipList(main)
      .getByRole('link', { name: /^All \d+/ })
      .click();
    await expect(page).not.toHaveURL(/issuer=/);
    expect(await transitions(), 'a transition ran under reduced motion').toBe(1);
  });

  test('a grouped title: hover and keyboard focus reach one end state, and nothing moves', async ({
    page,
    hasTouch,
  }) => {
    test.skip(hasTouch, 'a touch screen has no hover');
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    const item = main
      .locator('[data-cert-size="brief"]:has(button):has([data-cert-margin])')
      .first();
    const anchor = item.locator('a[data-cert-title]');
    await item.scrollIntoViewIfNeeded();
    const read = () =>
      item.evaluate((element) => {
        const link = element.querySelector('a') as HTMLElement;
        const arrow = link.querySelector('[data-new-tab-arrow] svg') as Element;
        const slot = element.querySelector('button')?.parentElement as Element;
        const margin = element.querySelector('[data-cert-margin] > *') as Element;
        const box = element.getBoundingClientRect();
        return {
          box: [box.top + window.scrollY, box.left, box.width, box.height],
          colour: getComputedStyle(link).color,
          arrow: getComputedStyle(arrow).opacity,
          step: getComputedStyle(arrow).translate,
          copy: getComputedStyle(slot).opacity,
          margin: getComputedStyle(margin).color,
        };
      });
    const brand = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--brand-ink)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    const before = await read();
    /** The hovered or focused look: brand ink, the arrow out and drawn, the margin lifted. */
    const lit = async (): Promise<void> => {
      await expect.poll(async () => (await read()).colour).toBe(brand);
      await expect.poll(async () => (await read()).arrow).toBe('1');
      await expect.poll(async () => (await read()).step).not.toBe(before.step);
      await expect.poll(async () => (await read()).margin).not.toBe(before.margin);
      expect((await read()).box).toEqual(before.box);
    };

    // At rest a busy year reads as titles: no arrow drawn, Copy ID waiting.
    expect(before.arrow).toBe('0');
    expect(before.copy).toBe('0');

    await anchor.hover();
    await lit();
    await expect.poll(async () => (await read()).copy).toBe('1');

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await read()).colour).toBe(before.colour);
    // Back onto the title from the keyboard, so it matches :focus-visible.
    await anchor.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(anchor).toBeFocused();
    await lit();
  });

  test('Copy ID copies a credential ID, and opens nothing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const popups: string[] = [];
    page.on('popup', (popup) => popups.push(popup.url()));
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    const copy = main.getByRole('button', { name: /^Copy the credential ID for / }).first();
    const id = await copy.getAttribute('title');

    await copy.click();

    await expect(main.locator('[data-index-announcer]')).toHaveText(
      /^Copied the credential ID for /,
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
    expect(popups, 'the click reached a credential link instead').toEqual([]);
  });
});
