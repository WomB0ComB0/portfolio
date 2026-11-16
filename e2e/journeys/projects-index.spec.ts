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
 * @file /projects in Folio, against the live data. Nothing hard-codes a count: each check compares
 * the page with its own figures (the header's byline, the chips' counts).
 * - Stories: every project is one link, as many as the header counts, under chapters (Featured
 *   first, then the years newest first); each chapter has at most one lead story; at most one
 *   chapter is the big numeral. The count is said once (no results line until a filter narrows).
 *   The work leads the first screen at 390, 320 and 1440 (Featured is a small heading). Every year
 *   with projects of its own has its #y<year> anchor (a year whose projects are all Featured is
 *   in Featured: a search for a Featured project shows no empty year), and a year's 'Also in
 *   Featured' lands on the story.
 * - Old links still work: ?category=Web Development lands on its kind; a whole old combined
 *   category on its first kind still known; ?category=bogus shows everything; ?tech=Python filters.
 * - A chip and a picker tick filter in place (no navigation) and rewrite the URL. The URL stays
 *   the truth: a chip, a project, then Back shows what the URL names.
 * - Views: Index lists every project by year, and a chip there keeps the view; Screens is the
 *   /places wall on a mouse and the grid on a phone (with the touch Wall sheet), and an image
 *   opens in a dialog that links to its project and gives focus back.
 * - Without JavaScript: every project is in the first HTML, a shared link is filtered, the search
 *   is a GET form (keeping the view), and the picker's Apply submits repeated keys.
 * - At 320, 390 and 1440, and at 200% text: no sideways scroll, no title past its column or
 *   broken inside a word; on a phone the briefs are compact rows. The hover lifts and lights a
 *   story on transform and opacity, and reduced motion keeps the light without the lift.
 * - The phone chapter row, touch targets, Index rules, Screens' own row and contact sheet, and
 *   uncut Screens names at 200% text: projects-index-layout.spec.ts.
 * - The Kind chips (the shared bar, unchanged): at 1440 every chip shows; at 1024 the
 *   row fades over a clipped end; a focused chip's ring has room; the phone sheet's chips wrap.
 * GET only, on the lab guard (127.0.0.1:3131); nothing signs in or writes.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  CURRENT_CHIP,
  DESKTOP,
  firstKindChip,
  hydrated,
  kindChips,
  MAIN,
  openAt,
  PATH,
  PHONE,
  readChip,
  settle,
  type Viewport,
  WIDE,
} from '../fixtures/project-index';

/** Every project's one link to its page. */
const STORY = 'a[data-story-link]';
const CHAPTER = 'section[data-chapter]';
/** An old shared link, from the live categories (a GET snapshot of /api/v1/sanity/projects). */
const OLD_SINGLE_CATEGORY = 'Web Development';
/** A later kind no project has: an old combined link made before a category was re-spelt. */
const RETIRED_KIND = 'Retired Kind';
/** Sub-pixel rounding between two renders of the same layout. */
const SAME_PX = 1;
/** A focused chip's ring: a 2px outline at a 2px offset. */
const RING_PX = 4;
/** The widest chip-row geometry, also covered by existing PR #653. */
const LAPTOP: Viewport = { width: 1280, height: 800 };
const NARROW: Viewport = { width: 320, height: 640 };

type Box = { left: number; right: number; top: number; bottom: number };

/** The kind chips' row: its box, its scroll extent, its overflow mark and each chip's box. */
function chipRow(main: Locator) {
  return kindChips(main).evaluate((list) => {
    const box = ({ left, right, top, bottom }: DOMRect): Box => ({ left, right, top, bottom });
    return {
      box: box(list.getBoundingClientRect()),
      overflows: list.scrollWidth > list.clientWidth + 1,
      overflow: (list as HTMLElement).dataset.overflow ?? null,
      chips: [...list.querySelectorAll('a[data-filter-part="chip"]')].map((chip) => ({
        label: (chip.textContent ?? '').replace(/\s+/g, ' ').trim(),
        box: box(chip.getBoundingClientRect()),
      })),
    };
  });
}

/** Whether `inner`, grown by `slack` on every side, lies inside `outer` (to a pixel). */
const inside = (inner: Box, outer: Box, slack = 0): boolean =>
  inner.left - slack >= outer.left - SAME_PX &&
  inner.right + slack <= outer.right + SAME_PX &&
  inner.top - slack >= outer.top - SAME_PX &&
  inner.bottom + slack <= outer.bottom + SAME_PX;

/** The header byline's project count ('32 projects · 20 with a live demo'). */
async function totalProjects(main: Locator): Promise<number> {
  const text = (await main.locator('header [data-byline]').first().textContent()) ?? '';
  const match = /(\d+) projects?/.exec(text);
  if (!match) throw new Error(`unreadable header byline: ${text}`);
  return Number(match[1]);
}

/** Each chapter's title and size, in page order. */
function chapters(main: Locator) {
  return main.locator(CHAPTER).evaluateAll((sections) =>
    sections.map((section) => ({
      title: (section.querySelector('h2')?.textContent ?? '').trim(),
      size: section.getAttribute('data-chapter'),
      leads: section.querySelectorAll('[data-project-story="lead"]').length,
      links: section.querySelectorAll('a[data-story-link]').length,
    })),
  );
}

const currentChip = async (main: Locator) =>
  readChip(await kindChips(main).locator(CURRENT_CHIP).textContent());

/**
 * The titles a line break splits inside a word: a letter that starts a new line right after a
 * letter on the line above. Whole words wrapping is fine.
 */
const brokenWords = (main: Locator): Promise<string[]> =>
  main.locator('h3').evaluateAll((titles) =>
    titles
      .filter((title) => {
        const range = document.createRange();
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        let lastTop: number | null = null;
        let lastChar = ' ';
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node as Text;
          for (let at = 0; at < text.length; at += 1) {
            const char = text.data[at] ?? ' ';
            if (char.trim() === '') {
              lastChar = ' ';
              continue;
            }
            range.setStart(text, at);
            range.setEnd(text, at + 1);
            const top = range.getClientRects()[0]?.top;
            if (top === undefined) continue;
            if (lastTop !== null && top > lastTop + 2 && /\w/.test(char) && /\w/.test(lastChar)) {
              return true;
            }
            lastTop = top;
            lastChar = char;
          }
        }
        return false;
      })
      .map((title) => (title.textContent ?? '').trim()),
  );

/** How far the page scrolls sideways (0 or less: none). */
const sideways = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('/projects: Stories', () => {
  test('every project is one link, as many as the header counts, under its chapters', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    const total = await totalProjects(main);
    const found = await chapters(main);

    await expect(main.locator(STORY)).toHaveCount(total);
    const hrefs = await main
      .locator(STORY)
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(new Set(hrefs).size, 'each project links once').toBe(total);
    expect(found.reduce((sum, chapter) => sum + chapter.links, 0)).toBe(total);
    await expect(main.locator('h1')).toHaveText('Projects');

    const titles = found.map(({ title }) => title);
    const years = titles.filter((title) => /^\d{4}$/.test(title));
    expect(years).toEqual([...years].sort().reverse());
    if (titles.includes('Featured')) expect(titles[0]).toBe('Featured');
    expect(found.filter(({ size }) => size === 'lead').length).toBeLessThanOrEqual(1);
    for (const chapter of found) expect(chapter.leads, chapter.title).toBeLessThanOrEqual(1);
    // The header's byline says the count; no second results line until a filter narrows.
    await expect(main.locator('[data-filter-part="count"]')).toHaveCount(0);
  });

  for (const [name, viewport, share] of [
    ['phone', PHONE, 0.6],
    ['narrow', NARROW, 1],
    ['wide', WIDE, 1],
  ] as const) {
    test(`${name}: the work leads the first screen, not a heading`, async ({ browser }) => {
      const touch = viewport.width < 768;
      const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      try {
        await page.goto(`${getTargetUrl()}${PATH}`);
        const main = await settle(page);
        const cover = await main
          .locator('[data-project-story="lead"] [data-story-cover]')
          .first()
          .boundingBox();
        const featured = await main.locator('#featured h2').boundingBox();

        expect(cover?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(viewport.height * share);
        // Featured is a small heading on the rule (on a phone, for screen readers only).
        expect(featured?.height ?? 0).toBeLessThan(64);
        expect((featured?.width ?? 0) * (featured?.height ?? 0)).toBeLessThan(
          (cover?.width ?? 0) * (cover?.height ?? 0),
        );
      } finally {
        await context.close();
      }
    });
  }

  test('every year with projects of its own has its anchor, and a year names its Featured stories', async ({
    page,
  }) => {
    const index = await openAt(page, '?view=index', WIDE);
    const byYear = await index.locator(CHAPTER).evaluateAll((sections) =>
      sections.map((section) => ({
        year: (section.querySelector('h2')?.textContent ?? '').trim(),
        ids: [...section.querySelectorAll('[data-project-entry]')].map(
          (entry) => entry.getAttribute('data-project-id') ?? '',
        ),
      })),
    );
    const main = await openAt(page, '', WIDE);

    for (const { year, ids } of byYear.filter(({ year }) => /^\d{4}$/.test(year))) {
      const featured = await main
        .locator('#featured [id^="story-"]')
        .evaluateAll((stories) => stories.map((story) => story.id.slice('story-'.length)));
      // A year whose projects are all Featured is in Featured, with no empty chapter of its own.
      const own = ids.filter((id) => !featured.includes(id));
      await expect(main.locator(`#y${year}`), year).toHaveCount(own.length > 0 ? 1 : 0);
    }
    const also = main.locator('[data-also-featured] a').first();
    test.skip((await also.count()) === 0, 'no year has a Featured project today');
    const target = (await also.getAttribute('href')) ?? '';
    expect(await main.locator('#featured').locator(target).count()).toBe(1);

    await also.click();

    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(main.locator(target)).toBeInViewport();
  });

  test('"In this issue" lands on each chapter', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    const jumps = main.getByRole('navigation', { name: 'In this issue' });
    const last = jumps.getByRole('link').last();
    const target = (await last.getAttribute('href')) ?? '';

    await last.click();

    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(main.locator(target)).toBeInViewport();
  });

  test('a search for a Featured project shows no year without projects of its own', async ({
    page,
  }) => {
    const first = await openAt(page, '', WIDE);
    const titles = (await first.locator(`#featured ${STORY}`).allTextContents())
      .map((title) => title.trim())
      .slice(0, 3);

    for (const title of titles) {
      const main = await openAt(page, `?q=${encodeURIComponent(title)}`, WIDE);
      const found = await chapters(main);
      expect(found[0]?.title, title).toBe('Featured');
      for (const chapter of found) {
        expect(chapter.links, `${title}: ${chapter.title} is empty`).toBeGreaterThan(0);
      }
    }
  });

  test('old links: a single category, a whole combined one, a bogus one and a single ?tech', async ({
    page,
  }) => {
    let main = await openAt(page, `?category=${encodeURIComponent(OLD_SINGLE_CATEGORY)}`, WIDE);
    const single = await currentChip(main);
    expect(single.label).toBe(OLD_SINGLE_CATEGORY);
    await expect(main.locator(STORY)).toHaveCount(single.count);

    const kind = await firstKindChip(main);
    const combined = `${kind.label} / ${RETIRED_KIND}`;
    main = await openAt(page, `?category=${encodeURIComponent(combined)}`, WIDE);
    expect((await currentChip(main)).label).toBe(kind.label);

    main = await openAt(page, '?category=bogus&tech=COBOL', WIDE);
    await expect(main.locator(STORY)).toHaveCount(await totalProjects(main));
    await expect(main.locator('[data-filter-part="applied"]')).toHaveCount(0);

    main = await openAt(page, '?tech=Python', WIDE);
    const shown = await main.locator(STORY).count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(await totalProjects(main));
    await expect(main.getByRole('link', { name: /Technology: Python/ })).toBeVisible();
  });

  test('a chip and the picker filter in place, with no navigation, and rewrite the URL', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    await page.evaluate(() => {
      (window as unknown as { indexMarker: boolean }).indexMarker = true;
    });

    const kind = await firstKindChip(main);
    await kind.link.click();
    await expect(main.locator(STORY)).toHaveCount(kind.count);
    await expect(page).toHaveURL(new RegExp(`/projects\\?category=${kind.slug}$`));

    await kindChips(main)
      .getByRole('link', { name: /^All \d+/ })
      .click();
    await main.getByRole('button', { name: /^Technology/ }).click();
    const options = page.locator('[data-filter-part="picker"] input[type="checkbox"]');
    await options.nth(0).check();
    await options.nth(1).check();
    await expect(page).toHaveURL(/\/projects\?tech=[^&]+&tech=[^&]+$/);

    expect(await page.evaluate(() => 'indexMarker' in window), 'the page navigated').toBe(true);
    expect(errors).toEqual([]);
  });

  test('a chip, a project, then Back: the stories and chip are the ones the URL names', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const kind = await firstKindChip(main);
    await kind.link.click();
    await expect(page).toHaveURL(new RegExp(`\\?category=${kind.slug}$`));

    await main.locator(STORY).first().click();
    await expect(page).toHaveURL(/\/projects\/[^/?]+$/);
    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`/projects\\?category=${kind.slug}$`));
    await settle(page);
    await expect(main.locator(STORY)).toHaveCount(kind.count);
    await expect.poll(() => currentChip(main)).toEqual({ label: kind.label, count: kind.count });
  });
});

test.describe('/projects: the views', () => {
  test('Index lists every project by year, and a chip there keeps the view', async ({ page }) => {
    const main = await openAt(page, '?view=index', WIDE);
    const total = await totalProjects(main);

    await expect(main.locator(`[data-project-entry] ${STORY}`)).toHaveCount(total);
    await expect(main.locator('[data-project-story="lead"]')).toHaveCount(0);
    const years = (await chapters(main))
      .map(({ title }) => title)
      .filter((title) => title !== 'Undated');
    expect(years).toEqual([...years].sort().reverse());

    await hydrated(page);
    const kind = await firstKindChip(main);
    await kind.link.click();
    await expect(page).toHaveURL(new RegExp(`/projects\\?view=index&category=${kind.slug}$`));
    await expect(main.locator(STORY)).toHaveCount(kind.count);
  });

  test('the switch carries the filters to Screens, the wall on a mouse', async ({ page }) => {
    const main = await openAt(page, '?tech=TypeScript', WIDE);
    await hydrated(page);
    const nav = main.getByRole('navigation', { name: 'Project views' });

    await nav.getByRole('link', { name: 'Screens' }).click();

    // The Technology is written as its key, in lower case.
    await expect(page).toHaveURL(/\/projects\?tech=typescript&view=screens$/);
    await expect(nav.getByRole('link', { name: 'Screens' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The /places wall itself, named for images of projects.
    const wall = main.locator('[data-photo-wall="page"]');
    await expect(wall).toBeVisible();
    await expect(wall).toHaveAttribute('aria-label', /^\d+ images? from \d+ projects?$/);
    await expect(main.getByRole('link', { name: /Technology: TypeScript/ })).toBeVisible();
  });

  test('on a phone Screens is the grid, and an image opens in a dialog, then gives focus back', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await page.goto(`${getTargetUrl()}${PATH}?view=screens`);
      const main = await settle(page);
      await hydrated(page);
      const grid = main.getByRole('list', { name: 'Images' });
      // Read by CSS, not by role: the open dialog hides the page from the accessibility tree.
      const first = grid.locator('a[data-photo-key]').first();
      const href = (await first.getAttribute('href')) ?? '';
      expect(href).toMatch(/^\/projects\/[^/?]+$/);
      await expect(first).toHaveAccessibleName(/, image \d+ of \d+/);

      await first.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: /^Open project/ })).toHaveAttribute(
        'href',
        href,
      );

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(first).toBeFocused();
    } finally {
      await context.close();
    }
  });

  test('on a phone Wall opens the wall full screen; Done gives focus back to Wall', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await page.goto(`${getTargetUrl()}${PATH}?view=screens`);
      const main = await settle(page);
      await hydrated(page);
      const wallButton = main.getByRole('group', { name: 'View' }).getByRole('button', {
        name: 'Wall',
      });
      test.skip((await wallButton.count()) === 0, 'fewer than twelve images: the grid alone');

      await wallButton.click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAccessibleName(/^\d+ images? ?from \d+ projects?$/);
      await expect(sheet.locator('[data-photo-wall="sheet"]')).toBeVisible();
      await sheet.getByRole('button', { name: 'Done' }).click();

      await expect(sheet).toBeHidden();
      await expect(wallButton).toBeFocused();
    } finally {
      await context.close();
    }
  });
});

test.describe('/projects without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('at 1440 every Kind chip shows whole on the one line', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`${getTargetUrl()}${PATH}`);
    const main = page.locator(MAIN);
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const row = await chipRow(main);

    expect(row.chips.map(({ label }) => label).join(' | ')).toMatch(/Other \d+ projects?$/);
    for (const { label, box } of row.chips) {
      expect(inside(box, row.box), `${label} is past the row's edge`).toBe(true);
    }
    expect(row.overflows).toBe(false);
  });

  test('every project is in the first HTML, visible, and a shared link is filtered', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`${getTargetUrl()}${PATH}`);
    const main = page.locator(MAIN);
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
    const total = await totalProjects(main);
    const links = main.locator(STORY);
    expect(await links.count()).toBe(total);
    const visible = await links.evaluateAll(
      (elements) => elements.filter((element) => element.checkVisibility()).length,
    );
    expect(visible).toBe(total);

    await page.goto(`${getTargetUrl()}${PATH}?category=${encodeURIComponent(OLD_SINGLE_CATEGORY)}`);
    const chip = readChip(await kindChips(main).locator(CURRENT_CHIP).textContent());
    expect(chip.label).toBe(OLD_SINGLE_CATEGORY);
    expect(await links.count()).toBe(chip.count);
  });

  test('the search is a GET form that keeps the view; the picker’s Apply submits repeated keys', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`${getTargetUrl()}${PATH}?view=index`);
    const main = page.locator(MAIN);
    const search = main.locator('[data-filter-part="bar"] input[type="search"][name="q"]');

    await search.fill('python');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/projects\?q=python&view=index$/);
    expect(await main.locator(`[data-project-entry] ${STORY}`).count()).toBeGreaterThan(0);

    await page.goto(`${getTargetUrl()}${PATH}`);
    await main.getByRole('button', { name: /^Technology/ }).click();
    const options = page.locator('[data-filter-part="picker"] input[type="checkbox"]');
    await options.nth(0).check();
    await options.nth(1).check();
    await page
      .locator('[data-filter-part="picker"]')
      .getByRole('button', { name: 'Apply' })
      .click();
    // A native GET form also sends the empty search field.
    await expect(page).toHaveURL(/\/projects\?(?:q=&)?tech=[^&]+&tech=[^&]+$/);
  });
});

test.describe('/projects layout', () => {
  for (const [name, viewport] of [
    ['narrow', NARROW],
    ['phone', PHONE],
    ['wide', WIDE],
  ] as const) {
    test(`${name} ${viewport.width}x${viewport.height}: no sideways scroll, no title past its column`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      const overflowing = await main
        .locator('h3')
        .evaluateAll(
          (titles) => titles.filter((title) => title.scrollWidth > title.clientWidth + 1).length,
        );
      expect(overflowing).toBe(0);
    });
  }

  test('on a phone the briefs are compact rows, a small picture beside the words', async ({
    page,
  }) => {
    const main = await openAt(page, '', PHONE);
    const brief = main.locator('[data-project-story="row"], [data-project-story="wide"]').first();
    const [cover, title] = await Promise.all([
      brief.locator('[data-story-cover]').boundingBox(),
      brief.locator('h3').boundingBox(),
    ]);

    expect(cover?.width ?? 0).toBeLessThanOrEqual(96);
    expect(title?.x ?? 0).toBeGreaterThan((cover?.x ?? 0) + (cover?.width ?? 0));
  });

  test('at 200% text a 320px window never scrolls sideways, cuts a title or lets the numeral loom', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the browser text size is set through Chromium’s CDP');
    // The browser's own text size (its settings' font size), as a visitor at 200% has it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await page.setViewportSize(NARROW);
    await page.goto(`${getTargetUrl()}${PATH}`);
    const main = await settle(page);

    expect(await sideways(page)).toBeLessThanOrEqual(0);
    const numeral = await main.locator(`${CHAPTER} h2`).first().boundingBox();
    expect(numeral?.height ?? 0).toBeLessThan(NARROW.height * 0.5);
    const cut = await main
      .locator('h3')
      .evaluateAll(
        (titles) =>
          titles.filter((title) => title.getBoundingClientRect().right > window.innerWidth + 1)
            .length,
      );
    expect(cut, 'titles past the window’s edge').toBe(0);
    expect(await brokenWords(main), 'titles broken inside a word').toEqual([]);
  });

  test('the hover lifts a lead’s cover and lights it; the words stay put', async ({
    page,
    hasTouch,
  }) => {
    test.skip(hasTouch, 'a touch screen has no hover');
    const main = await openAt(page, '', WIDE);
    const lead = main.locator('[data-project-story="lead"]').first();
    const cover = lead.locator('[data-story-cover]');
    const title = lead.locator('h3');
    await lead.scrollIntoViewIfNeeded();
    const before = await title.boundingBox();

    await lead.hover();

    await expect.poll(() => cover.evaluate((e) => getComputedStyle(e).translate)).not.toBe('none');
    await expect
      .poll(() => cover.evaluate((e) => getComputedStyle(e, '::after').opacity))
      .toBe('1');
    expect(await title.boundingBox()).toEqual(before);
  });

  test('reduced motion keeps the light and drops the lift', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'a touch screen has no hover');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const main = await openAt(page, '', WIDE);
    const lead = main.locator('[data-project-story="lead"]').first();
    const cover = lead.locator('[data-story-cover]');

    // The story's one link is stretched over it, so the pointer lands on the story.
    await lead.hover();

    await expect
      .poll(() => cover.evaluate((e) => getComputedStyle(e, '::after').opacity))
      .toBe('1');
    expect(await cover.evaluate((e) => getComputedStyle(e).translate)).toBe('none');
  });
});

test.describe('/projects: the Kind chips', () => {
  test('at 1280, where the bar is first at its widest, every chip shows too', async ({ page }) => {
    const main = await openAt(page, '', LAPTOP);
    await hydrated(page);
    const row = await chipRow(main);

    for (const { label, box } of row.chips) {
      expect(inside(box, row.box), `${label} is past the row's edge`).toBe(true);
    }
    expect(row.overflows).toBe(false);
    expect(row.overflow).toBeNull();
  });

  test('at 1440 every chip shows on the one line, with nothing faded', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const row = await chipRow(main);

    expect(row.chips.map(({ label }) => label).join(' | ')).toMatch(/Other \d+ projects?$/);
    for (const { label, box } of row.chips) {
      expect(inside(box, row.box), `${label} is past the row's edge`).toBe(true);
    }
    expect(row.overflows).toBe(false);
    expect(row.overflow).toBeNull();
  });

  test('at 1024 the row fades over each end with chips past it, and only there', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    await hydrated(page);
    const start = await chipRow(main);
    expect(start.overflow).toBe(start.overflows ? 'end' : null);
    test.skip(!start.overflows, 'every chip fits at 1024 with today’s kinds');

    await kindChips(main).evaluate((list) => {
      list.scrollLeft = list.scrollWidth;
    });

    await expect.poll(async () => (await chipRow(main)).overflow).toBe('start');
  });

  test('a focused chip’s ring has room inside the row’s clip', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    await main.locator('[data-filter-part="bar"] input[type="search"][name="q"]').focus();
    // Tab to the first chip, then one more: a chip inside the row, not at its edge.
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      const onChip = await page.evaluate(() =>
        Boolean(document.activeElement?.matches('a[data-filter-part="chip"]')),
      );
      if (onChip) break;
    }
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      const list = active.closest('ul') as HTMLElement;
      const box = ({ left, right, top, bottom }: DOMRect) => ({ left, right, top, bottom });
      return {
        isChip: active.matches('a[data-filter-part="chip"]'),
        outline: getComputedStyle(active).outlineStyle,
        chip: box(active.getBoundingClientRect()),
        list: box(list.getBoundingClientRect()),
      };
    });

    expect(focused.isChip).toBe(true);
    expect(focused.outline).not.toBe('none');
    expect(inside(focused.chip, focused.list, RING_PX)).toBe(true);
  });

  test('on a phone the sheet’s chips wrap, every one inside the sheet, Other included', async ({
    page,
  }) => {
    const main = await openAt(page, '', PHONE);
    await hydrated(page);
    await main.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.locator('[data-filter-part="sheet"]');
    await expect(sheet).toBeVisible();

    const widths = await sheet.evaluate((element) => ({
      sheet: element.getBoundingClientRect().left + element.clientWidth,
      chips: [...element.querySelectorAll('ul[aria-label="Filter by kind"] a')].map(
        (chip) => chip.getBoundingClientRect().right,
      ),
    }));
    for (const right of widths.chips) expect(right).toBeLessThanOrEqual(widths.sheet + SAME_PX);
    await expect(kindChips(sheet).getByRole('link', { name: /^Other \d+/ })).toBeInViewport();
  });
});
