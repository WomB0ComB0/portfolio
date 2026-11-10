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
 * @file /places on the shared FilterBar kit, against the live data. Nothing hard-codes a count:
 * each check compares the page with its own figures (the header's "N locations visited", the
 * chips' counts, the cards).
 * - Every past place is a card in the first HTML (no loading.tsx), as many as the header counts.
 * - Old links land on their chip (the Studio label, its %20 and + forms, the slug); a bogus one
 *   and 'all' show everything.
 * - The list keeps up with typing: with the page's clock paused, each keystroke filters the
 *   cards; ?q is then written in place (no navigation, no new history entry).
 * - A chip filters in place and rewrites the URL; Back after a place page shows what the URL
 *   names.
 * - Without JavaScript: every card, the count, the search and the map's note show; the search is
 *   a GET form; a chip is a link; the phone's Filters sheet opens natively.
 * - At 390 and 1440: no sideways scroll; at 1440 all seven chips on one line; at 390 the sheet's
 *   chips wrap inside it, focus lands on the current chip and "Show N places" closes it.
 * - Keyboard, at 1440 and at 1024 (where the chip row scrolls): search, then the chips in order,
 *   each shown in full with its ring, clear of the end fades; Enter on a chip filters and keeps
 *   focus; focus moving into the stuck bar keeps the page still. Reduced motion starts no view
 *   transition.
 * - On a landscape phone (844x390) the bar stays in the page, so a card link Tab brings in from
 *   above is never under it.
 * - The map's markers stand for exactly the cards (skipped only when Maps never draws).
 * - Nothing tells where the owner is now: no such words, no geolocation call, only q and category
 *   in the URL, no place id in web storage.
 * GET only, on the built server (localhost:3108); nothing signs in or writes.
 */

import { expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  BAR,
  CARD,
  CHIPS,
  CURRENT_CHIP,
  cardIds,
  cardTexts,
  chipCounts,
  currentChip,
  DESKTOP,
  expectMarkersFor,
  focusedChipFit,
  headerFigure,
  hydrated,
  LANDSCAPE,
  MAIN,
  MAP,
  mapDrawn,
  narrowingChip,
  openAt,
  PATH,
  PHONE,
  readChip,
  STREAMED,
  settle,
  showWholeWorld,
  WIDE,
} from '../fixtures/places';

/** Words that would tell where the owner is now. */
const LIVE_WORDS = /here now|right now|upcoming|currently at/i;
/** The only keys the URL may carry. */
const URL_KEYS = new Set(['q', 'category']);

/** A word from a card's name, at least four letters, that some but not all cards contain. */
async function searchWord(page: Page): Promise<string> {
  const cards = await cardTexts(page.locator(MAIN));
  const words = cards.flatMap(({ haystack }) => haystack.split(/[^A-Za-z]+/));
  const word = words.find((each) => {
    if (each.length < 4) return false;
    const hits = cards.filter(({ haystack }) =>
      haystack.toLowerCase().includes(each.toLowerCase()),
    );
    return hits.length > 1 && hits.length < cards.length;
  });
  if (!word) throw new Error('no word narrows the cards');
  return word;
}

/** The URL's search keys, so a check can see nothing else rides along. */
const urlKeys = (page: Page): string[] => [...new URL(page.url()).searchParams.keys()];

/** Marks the window, so a later check can tell the page did not navigate. */
const markWindow = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { placesMarker: boolean }).placesMarker = true;
  });
const stillMarked = (page: Page) => page.evaluate(() => 'placesMarker' in window);

test.describe('/places: search and category chips', () => {
  test('every past place is a card in the first HTML, as many as the header counts', async ({
    page,
  }) => {
    const html = await (await page.request.get(`${getTargetUrl()}${PATH}`)).text();
    expect(html.match(/<div hidden id="S:/g) ?? []).toHaveLength(0);

    const main = await openAt(page, '', WIDE);
    const total = await headerFigure(main);
    expect((html.match(/data-place-card=""/g) ?? []).length).toBe(total);
    await expect(main.locator(CARD)).toHaveCount(total);
    await expect(main.locator('h1')).toHaveCount(1);
    expect((await chipCounts(main))[0]?.count).toBe(total);
  });

  test('old links land on their chip; a bogus value and all show everything', async ({ page }) => {
    for (const [query, label] of [
      ['?category=Hackathon', 'Hackathon'],
      ['?category=Tech%20Office', 'Tech Office'],
      ['?category=Tech+Office', 'Tech Office'],
      ['?category=tech-office', 'Tech Office'],
    ] as const) {
      const main = await openAt(page, query, WIDE);
      const chip = await currentChip(main);
      expect(chip.label, query).toBe(label);
      await expect(main.locator(CARD), query).toHaveCount(chip.count);
    }
    for (const query of ['?category=Bogus', '?category=all']) {
      const main = await openAt(page, query, WIDE);
      await expect(main.locator(CARD), query).toHaveCount(await headerFigure(main));
      await expect(main.locator('[data-filter-part="applied"]'), query).toHaveCount(0);
    }
  });

  test('the list keeps up with typing, with no timer to wait for', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const cards = await cardTexts(main);
    const word = await searchWord(page);
    const entries = await page.evaluate(() => window.history.length);
    await markWindow(page);
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 60_000);

    const field = main.getByRole('searchbox', { name: 'Search places' });
    for (let end = 1; end <= word.length; end += 1) {
      const typed = word.slice(0, end);
      await field.press(typed.at(-1) ?? '');
      const expected = cards.filter(({ haystack }) =>
        haystack.toLowerCase().includes(typed.toLowerCase()),
      );
      await expect(main.locator(CARD), `after "${typed}"`).toHaveCount(expected.length);
    }
    expect(await cardIds(main)).toEqual(
      cards
        .filter(({ haystack }) => haystack.toLowerCase().includes(word.toLowerCase()))
        .map(({ id }) => id),
    );

    await page.clock.resume();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(word);
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
    expect(await stillMarked(page), 'the page navigated').toBe(true);
  });

  test('a chip filters in place, rewrites the URL and Clear all brings every card back', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const total = await headerFigure(main);
    const chip = await narrowingChip(main);
    const entries = await page.evaluate(() => window.history.length);
    await markWindow(page);

    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();

    await expect(main.locator(CARD)).toHaveCount(chip.count);
    await expect(page).toHaveURL(new RegExp(`/places\\?category=${chip.slug}$`));
    // LiveNumber: an sr-only twin with the final figure, and a visible copy that counts to it.
    const count = main.locator('[data-filter-part="count"]');
    await expect(count.locator('.sr-only')).toHaveText(String(chip.count));
    await expect(count.locator('[aria-hidden="true"]')).toHaveText(String(chip.count));
    await expect(count).toContainText(` of ${total} places`);
    await expect(main.getByRole('link', { name: `Remove Category: ${chip.label}` })).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(entries);

    await main.getByRole('link', { name: 'Clear all' }).click();
    await expect(main.locator(CARD)).toHaveCount(total);
    await expect(page).toHaveURL(/\/places$/);
    expect(await stillMarked(page), 'the page navigated').toBe(true);
  });

  test('a chip, a place, then Back: the cards and chip are the ones the URL names', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const chip = await narrowingChip(main);
    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`\\?category=${chip.slug}$`));

    await main.locator(`${CARD} a[href^="/places/"]`).first().click();
    await expect(page).toHaveURL(/\/places\/[^/?]+$/);
    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`/places\\?category=${chip.slug}$`));
    await settle(page);
    await expect(main.locator(CARD)).toHaveCount(chip.count);
    await expect.poll(() => currentChip(main)).toEqual({ label: chip.label, count: chip.count });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    for (const viewport of [PHONE, WIDE]) {
      test(`${viewport.width}px: every card, the count, the search and the map's note show; links and the form filter`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${getTargetUrl()}${PATH}`);
        const main = page.locator(MAIN);
        await expect(page.locator(STREAMED)).toHaveCount(0);
        const total = await headerFigure(main);
        const shown = await main
          .locator(CARD)
          .evaluateAll((cards) => cards.filter((card) => card.checkVisibility()).length);
        expect(shown).toBe(total);
        await expect(main.locator('[data-filter-part="count"]')).toBeVisible();
        await expect(main.getByRole('searchbox', { name: 'Search places' })).toBeVisible();
        // Playwright's text engine skips <noscript>, so the note is found by CSS.
        const note = main.locator(`${MAP} noscript p`);
        await expect(note).toBeVisible();
        await expect(note).toHaveText('The map needs JavaScript. Every place is listed below.');

        const word = await searchWord(page);
        await main.getByRole('searchbox').fill(word);
        await main.getByRole('searchbox').press('Enter');
        await expect(page).toHaveURL(new RegExp(`/places\\?q=${word}$`));
        const found = await main.locator(CARD).count();
        expect(found).toBeGreaterThan(0);
        expect(found).toBeLessThan(total);

        await page.goto(`${getTargetUrl()}${PATH}`);
        const chip = await narrowingChip(main);
        if (viewport === PHONE) {
          await main.getByRole('button', { name: /^Filters/ }).click();
          await expect(page.locator('[data-filter-part="sheet"]')).toBeVisible();
        }
        await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
        await expect(page).toHaveURL(new RegExp(`/places\\?category=${chip.slug}$`));
        await expect(main.locator(CARD)).toHaveCount(chip.count);
      });
    }
  });

  for (const viewport of [PHONE, WIDE]) {
    test(`${viewport.width}px: no sideways scroll, and the chips fit`, async ({ page }) => {
      const main = await openAt(page, '', viewport);
      await hydrated(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      if (viewport === WIDE) {
        const row = await main.locator(CHIPS).evaluate((list) => ({
          tops: [...list.querySelectorAll('a[data-filter-part="chip"]')].map((chip) =>
            Math.round(chip.getBoundingClientRect().top),
          ),
          overflow: (list as HTMLElement).dataset.overflow ?? null,
        }));
        expect(row.tops).toHaveLength(7);
        expect(new Set(row.tops).size, 'the chips sit on one line').toBe(1);
        expect(row.overflow).toBeNull();
        return;
      }

      await main.getByRole('button', { name: /^Filters/ }).click();
      const sheet = page.locator('[data-filter-part="sheet"]');
      await expect(sheet).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-current')))
        .toBe('true');
      const fit = await sheet.evaluate((element) => ({
        right: element.getBoundingClientRect().left + element.clientWidth,
        chips: [...element.querySelectorAll('a[data-filter-part="chip"]')].map(
          (chip) => chip.getBoundingClientRect().right,
        ),
      }));
      for (const right of fit.chips) expect(right).toBeLessThanOrEqual(fit.right + 1);
      const shown = await main.locator(CARD).count();
      await sheet.getByRole('button', { name: `Show ${shown} places` }).click();
      await expect(sheet).toBeHidden();
    });
  }

  // At 1440 every chip fits; at 1024 the row scrolls, and each chip Tab reaches must still show
  // in full with its ring (the row reveals it; Chrome alone leaves a part-shown chip clipped).
  for (const viewport of [WIDE, DESKTOP]) {
    test(`keyboard at ${viewport.width}: search, then each chip in order and in full; Enter filters in place`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      await hydrated(page);
      const chips = await chipCounts(main);
      await main.getByRole('searchbox').focus();
      const order: string[] = [];
      for (const _ of chips) {
        await page.keyboard.press('Tab');
        // The row's data-overflow is re-marked on its scroll event, a frame after the reveal.
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const fit = await focusedChipFit(page);
        order.push(fit.slug);
        expect(fit.ringLeft, `${fit.slug}'s ring starts inside the row`).toBeGreaterThanOrEqual(
          fit.rowLeft - 0.5,
        );
        expect(fit.ringRight, `${fit.slug}'s ring ends inside the row`).toBeLessThanOrEqual(
          fit.rowRight + 0.5,
        );
      }
      expect(order).toEqual(chips.map(({ slug }) => slug));

      const target = chips.find(({ slug, count }) => slug !== 'all' && count > 0) ?? chips[1];
      await main.locator(`${CHIPS} a[data-chip="${target?.slug}"]`).focus();
      await page.keyboard.press('Enter');
      await expect(main.locator(CARD)).toHaveCount(target?.count ?? 0);
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-chip'))).toBe(
        target?.slug,
      );
    });
  }

  test('a short landscape screen: the bar stays in the page, and a Tab-focused card link clears it', async ({
    page,
  }) => {
    const main = await openAt(page, '', LANDSCAPE);
    await hydrated(page);
    const links = main.locator(`${CARD} a[href^="/places/"]`);
    const target = links.nth(Math.min(5, (await links.count()) - 1));
    // Park the card link just above the top edge, a sliver showing, then Tab onto it from the
    // card's own map link above it: the browser brings it in at the top's scroll padding.
    await target.evaluate((link) => {
      const box = link.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + box.bottom - 8, behavior: 'instant' });
      const before = link.closest('li')?.querySelector<HTMLElement>('a[target="_blank"]');
      before?.focus({ preventScroll: true });
    });
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('href') ?? ''))
      .toMatch(/^\/places\//);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const { link, bar } = await page.evaluate(() => ({
      link: document.activeElement?.getBoundingClientRect().top ?? -1,
      bar: document.querySelector('[data-filter-part="bar"]')?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(bar, 'the bar is not stuck over the page').toBeLessThanOrEqual(0);
    expect(link, 'the focused link is not under the bar').toBeGreaterThanOrEqual(Math.max(bar, 0));
  });

  test('stuck: the bar holds the top edge, and focus moving into it keeps the page still', async ({
    page,
  }) => {
    await openAt(page, '', DESKTOP);
    await hydrated(page);
    const y = await page.evaluate(() => {
      window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.6 });
      return window.scrollY;
    });
    await expect
      .poll(() => page.locator(BAR).evaluate((bar) => Math.round(bar.getBoundingClientRect().top)))
      .toBe(0);
    await page.evaluate(() =>
      (document.querySelector('main input[type="search"]') as HTMLElement).focus(),
    );
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  });

  test('reduced motion starts no view transition; otherwise a chip crossfades', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { transitions: number };
      w.transitions = 0;
      const proto = Document.prototype as unknown as {
        startViewTransition?: (...a: unknown[]) => unknown;
      };
      const original = proto.startViewTransition;
      if (typeof original !== 'function') return;
      proto.startViewTransition = function spy(this: Document, ...args: unknown[]) {
        w.transitions += 1;
        return original.apply(this, args);
      };
    });
    const transitions = () =>
      page.evaluate(() => (window as unknown as { transitions: number }).transitions);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    let main = await openAt(page, '', WIDE);
    await hydrated(page);
    let chip = await narrowingChip(main);
    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
    await expect(main.locator(CARD)).toHaveCount(chip.count);
    expect(await transitions()).toBe(0);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    main = await openAt(page, '', WIDE);
    await hydrated(page);
    const supported = await page.evaluate(() => 'startViewTransition' in document);
    chip = await narrowingChip(main);
    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
    await expect(main.locator(CARD)).toHaveCount(chip.count);
    expect(await transitions()).toBe(supported ? 1 : 0);
  });

  test('the map’s markers stand for exactly the cards: at rest, after a chip, after typing', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    test.skip(!(await mapDrawn(page)), 'Google Maps is not configured or did not load here');
    await showWholeWorld(page);
    await expectMarkersFor(page, await main.locator(CARD).count());

    const chip = await narrowingChip(main);
    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
    await expect(main.locator(CARD)).toHaveCount(chip.count);
    await expectMarkersFor(page, chip.count);

    await main.getByRole('link', { name: 'Clear all' }).click();
    await main.getByRole('searchbox').fill(await searchWord(page));
    await expectMarkersFor(page, await main.locator(CARD).count());
  });

  test('nothing tells where the owner is now, and nothing is kept on the device', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { geoCalls: number };
      w.geoCalls = 0;
      const geo = navigator.geolocation as unknown as Record<string, unknown> | undefined;
      if (!geo) return;
      for (const name of ['getCurrentPosition', 'watchPosition']) {
        geo[name] = () => {
          w.geoCalls += 1;
          return 0;
        };
      }
    });
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    const ids = await cardIds(main);
    const chip = await narrowingChip(main);

    await main.locator(`${CHIPS} a[data-chip="${chip.slug}"]`).click();
    expect(urlKeys(page).every((key) => URL_KEYS.has(key))).toBe(true);
    await main.getByRole('searchbox').fill(await searchWord(page));
    await expect.poll(() => urlKeys(page).includes('q')).toBe(true);
    expect(urlKeys(page).every((key) => URL_KEYS.has(key))).toBe(true);
    await main.getByRole('link', { name: 'Clear all' }).click();

    expect(await main.textContent()).not.toMatch(LIVE_WORDS);
    expect(await page.evaluate(() => (window as unknown as { geoCalls: number }).geoCalls)).toBe(0);
    const stored = await page.evaluate(() =>
      [localStorage, sessionStorage].flatMap((store) =>
        Object.keys(store).map((key) => store.getItem(key) ?? ''),
      ),
    );
    for (const id of ids) {
      expect(
        stored.some((value) => value.includes(id)),
        `${id} is in web storage`,
      ).toBe(false);
    }
    expect(
      readChip((await main.locator(`${CHIPS} ${CURRENT_CHIP}`).textContent()) ?? '').label,
    ).toBe('All');
    await expect(page.locator(MAP)).toBeVisible();
  });
});

test.describe('/places: the quiet photo folder and the "Places | Photos" links', () => {
  test('each card opens its place page by the folder: "N photos of <place>" or "Details of <place>"', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    const names = await main
      .locator(`${CARD} a[href^="/places/"]`)
      .evaluateAll((links) =>
        links.map((link) => (link.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
    expect(names).toHaveLength(await headerFigure(main));
    for (const name of names) expect(name).toMatch(/^(?:\d+ photos?|Details) of \S/);
    const slivers = await main
      .locator(`${CARD} [data-photo-folder]`)
      .evaluateAll((folders) => folders.map((folder) => folder.querySelectorAll('img').length));
    expect(slivers.every((count) => count >= 1 && count <= 3)).toBe(true);
  });

  test('the links carry q and category both ways, the current page marked', async ({ page }) => {
    const main = await openAt(page, '?category=Hackathon', WIDE);
    const nav = main.getByRole('navigation', { name: 'Places views' });

    await expect(nav.getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'href',
      '/places/photos?category=hackathon',
    );
    await hydrated(page);
    await main.getByRole('searchbox').fill(await searchWord(page));
    await expect.poll(() => urlKeys(page).includes('q')).toBe(true);
    const photosHref = (await nav.getByRole('link', { name: 'Photos' }).getAttribute('href')) ?? '';
    const carried = new URL(photosHref, getTargetUrl()).searchParams;
    expect(carried.get('category')).toBe('hackathon');
    expect(carried.get('q')).toBe(new URL(page.url()).searchParams.get('q'));

    await nav.getByRole('link', { name: 'Photos' }).click();
    await page.waitForURL(/\/places\/photos\?/);
    expect(urlKeys(page).every((key) => URL_KEYS.has(key))).toBe(true);
    expect(await page.locator(MAIN).textContent()).not.toMatch(LIVE_WORDS);
    await page.goBack();
    await page.waitForURL(/\/places\?/);
    expect(new URL(page.url()).searchParams.get('category')).toBe('hackathon');
  });
});
