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

import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  expectExternalLinks,
  expectNoOverflow,
  expectRowsOrState,
  expectSettled,
  openConsolePage,
  readOnly,
} from '../fixtures/console-routes';

test.beforeEach(async ({ page }) => readOnly(page));

/**
 * The owner's "keep it at 20": the chart asks Spotify for twenty tracks and shows every one it
 * gets, which is twenty unless Spotify failed on one (the site skips an item Spotify cannot serve,
 * as on 2026-11-14, when it sent 19). So the table must show exactly what the site's own
 * /api/v1/top-tracks has, and that is never more than twenty.
 */
const TRACK_COUNT = 20;

/** How many tracks the site's own API has right now (a GET from the test runner). */
async function apiTrackCount(page: Page): Promise<number> {
  const response = await page.request.get(`${new URL(page.url()).origin}/api/v1/top-tracks`);
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.length : 0;
}

/**
 * Enlarged text, set without waiting on a load event, so it works with JavaScript off too: the
 * root font (what a desktop zoom of text only does), or text-size-adjust (what a phone's text
 * size setting does: it grows the text but not rem lengths, and needs a mobile context).
 */
async function enlargeText(
  page: Page,
  percent = 200,
  how: 'root' | 'adjust' = 'root',
): Promise<void> {
  const css =
    how === 'root'
      ? `html{font-size:${percent}%}`
      : `html{-webkit-text-size-adjust:${percent}%;text-size-adjust:${percent}%}`;
  await page.evaluate((text) => {
    const style = document.createElement('style');
    style.textContent = text;
    document.head.append(style);
  }, css);
}

/**
 * What a reader cannot see: boxes past the window's edges (the artist strip, which scrolls inside
 * itself, aside), and each track's length cut inside its line.
 */
async function hiddenContent(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const offScreen = Array.from(root.querySelectorAll('*'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || element.closest('.sr-only, ol')) return false;
        return box.right > window.innerWidth + 0.5 || box.left < -0.5;
      })
      .map((element) => `off screen: ${element.textContent?.trim().slice(0, 30)}`);
    const cutLengths = Array.from(root.querySelectorAll('[data-phone-meta] .shrink-0'))
      .filter((length) => length.scrollWidth > length.clientWidth + 1)
      .map((length) => `cut length: ${length.textContent}`);
    return [...offScreen, ...cutLengths];
  });
}

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Spotify ledger, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('renders the chart, artists and a readable now-playing state', async ({ page }) => {
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      await expectSettled(main);
      await expect(main.locator('[data-spotify-hero]')).toHaveAttribute(
        'data-state',
        /^(playing|playing-unknown|recent|nothing|unreachable)$/,
      );
      await expect(main.locator('[data-backlight]')).toHaveCount(0);
      const tracks = main.locator('[data-spotify-track]');
      if (
        await expectRowsOrState(
          tracks,
          main.getByRole('heading', { name: /^(No top tracks yet|Couldn't load top tracks)$/ }),
        )
      ) {
        await expect(tracks.first().locator('[data-rank]')).toHaveText('1');
        const served = await apiTrackCount(page);
        expect(served).toBeLessThanOrEqual(TRACK_COUNT);
        await expect(tracks).toHaveCount(served);
        const ranks = await tracks.locator('[data-rank]').allTextContents();
        expect(ranks.map((rank) => Number(rank.trim()))).toEqual(
          ranks.map((_, index) => index + 1),
        );
        await expect(main.getByRole('table', { name: /Top tracks/ })).toBeVisible();
      }
      const artists = main.locator('[data-spotify-artist]');
      if (
        await expectRowsOrState(
          artists,
          main.getByRole('heading', { name: /^(No top artists yet|Couldn't load top artists)$/ }),
        )
      ) {
        expect(await artists.count()).toBeLessThanOrEqual(10);
      }
      await expectExternalLinks(main);
    });

    for (const width of [390, 1440]) {
      test(`keeps the artist strip inside the page at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const main = await openConsolePage(page, '/spotify', 'Spotify');
        await expect(main.locator('[data-spotify-hero]')).toBeVisible();
        await expectNoOverflow(page);
      });
    }

    for (const width of [320, 390]) {
      test(`keeps every figure and length on screen with text at 200% at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/spotify', 'Spotify');
        await enlargeText(page);

        // "58 min" once ran past the screen and lengths were cut mid-digit.
        expect(await hiddenContent(main)).toEqual([]);
        await expectNoOverflow(page);
        // The covers give their width to the words.
        for (const art of await main.locator('[data-spotify-track] img').all()) {
          await expect(art).toBeHidden();
        }
      });

      test(`breaks no word that fits its line and keeps each arrow with its title at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/spotify', 'Spotify');
        await enlargeText(page);

        expect(await brokenWords(main)).toEqual([]);
        expect(await strayArrows(main)).toEqual([]);
      });
    }
  });
}

/**
 * Words split across two lines although they fit the line whole: in each track title and artist
 * line, each artist name and the hero's title. A word wider than its whole line may break; no
 * other may. Chinese and Japanese text breaks between characters by design, so it is skipped.
 */
async function brokenWords(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    const boxes = root.querySelectorAll(
      '[data-track-title], [data-phone-meta] > span:first-child, [data-spotify-hero] [data-tile-link], [data-artist-name]',
    );
    const lineWidth = (box: Element) => box.getBoundingClientRect().width;
    for (const box of boxes) {
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // The arrow (and the word joiner gluing it on) is aria-hidden, so it is skipped here.
        if (node.parentElement?.closest('.sr-only, [aria-hidden="true"]')) continue;
        for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
          if (/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/u.test(match[0])) continue;
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const lines = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)));
          if (lines.size < 2) continue;
          const probe = document.createElement('span');
          probe.style.whiteSpace = 'nowrap';
          probe.textContent = match[0];
          node.parentElement?.append(probe);
          const width = probe.getBoundingClientRect().width;
          probe.remove();
          if (width <= lineWidth(box)) found.push(`${match[0]} (${box.tagName})`);
        }
      }
    }
    return found;
  });
}

/** XXXTENTACION in place of a card's name: is it inside the card, and on how many lines? */
function longNameFit(card: Element): { inside: boolean; lines: number } | null {
  const name = card.querySelector('[data-artist-name]');
  const words = name?.lastChild;
  if (!name || !words) return null;
  words.textContent = ' XXXTENTACION';
  const box = card.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(name);
  const inside = Array.from(range.getClientRects()).every(
    (rect) => rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5,
  );
  const lineHeight = Number.parseFloat(getComputedStyle(name).lineHeight);
  return { inside, lines: Math.round(name.getBoundingClientRect().height / lineHeight) };
}

/**
 * New-tab arrows that are not right after their title's last word: on a line of their own (or
 * any line but the last word's), more than 8px past that word, or cut away by a box that clips
 * (a two-line clamp hid them on long titles). A track title must always show its arrow; the hero's
 * title keeps a line clamp for its fixed height (as many lines as today's chart needs, checked by
 * heroTitleFaults), so for whatever title is live there only a shown arrow is checked.
 */
async function strayArrows(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const clipped = (icon: Element): boolean => {
      const box = icon.getBoundingClientRect();
      for (let node = icon.parentElement; node && node !== root; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const edge = node.getBoundingClientRect();
        const outside = box.left < edge.left - 0.5 || box.right > edge.right + 0.5;
        if (outside || box.top < edge.top - 0.5 || box.bottom > edge.bottom + 0.5) return true;
      }
      return box.right > window.innerWidth + 0.5;
    };
    return Array.from(
      root.querySelectorAll('[data-track-title], [data-spotify-hero] [data-tile-link]'),
    )
      .map((link) => {
        const arrow = link.querySelector('[data-new-tab-arrow]');
        const icon = arrow?.querySelector('svg');
        const title = arrow?.previousElementSibling ?? link.firstElementChild;
        if (!arrow || !icon || !title) return null;
        const name = title.textContent ?? '';
        if (clipped(icon)) return link.matches('[data-track-title]') ? `${name}: cut away` : null;
        const range = document.createRange();
        range.selectNodeContents(title);
        const lines = Array.from(range.getClientRects()).filter((line) => line.width > 0);
        const last = lines[lines.length - 1];
        if (!last) return null;
        const box = icon.getBoundingClientRect();
        const middle = box.top + box.height / 2;
        if (middle < last.top || middle > last.bottom)
          return `${name}: not on the last word's line`;
        const gap = box.left - last.right;
        return gap > 8 || gap < -2 ? `${name}: ${Math.round(gap)}px from the last word` : null;
      })
      .filter((entry): entry is string => entry !== null);
  });
}

/**
 * Ranks that are not on their title's first line (by more than a pixel): with text enlarged a row
 * is three or more lines, and a rank in its middle read with the artist line.
 */
async function offsetRanks(main: Locator): Promise<string[]> {
  return main.evaluate((root) =>
    Array.from(root.querySelectorAll('[data-spotify-track]'))
      .map((row) => {
        const rank = row.querySelector('[data-rank]');
        const title = row.querySelector('[data-track-title] > span, [data-track-title]');
        if (!rank || !title) return null;
        const firstLine = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return Array.from(range.getClientRects()).find((line) => line.width > 0);
        };
        const [rankLine, titleLine] = [firstLine(rank), firstLine(title)];
        if (!rankLine || !titleLine) return null;
        const offset = rankLine.bottom - titleLine.bottom;
        return Math.abs(offset) > 1 ? `${rank.textContent}: ${Math.round(offset)}px` : null;
      })
      .filter((entry): entry is string => entry !== null),
  );
}

/** Ranks whose cell is narrower than the number, so it shows as "1…". */
async function cutRanks(main: Locator): Promise<string[]> {
  return main.evaluate((root) =>
    Array.from(root.querySelectorAll('[data-rank]'))
      .filter((rank) => {
        const cell = rank.closest('td');
        return cell ? cell.scrollWidth > cell.clientWidth + 0.5 : false;
      })
      .map((rank) => rank.textContent ?? ''),
  );
}

test.describe('Spotify ledger with a phone text size of 200%', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

  test('keeps every rank whole and grows the artist cards with the text', async ({ page }) => {
    // A 320px phone: the artist cards keep their full 3.5 lines there (390px narrows them, below).
    await page.setViewportSize({ width: 320, height: 844 });
    const main = await openConsolePage(page, '/spotify', 'Spotify');
    const before = await main.locator('[data-spotify-artist]').first().boundingBox();
    await enlargeText(page, 200, 'adjust');

    // text-size-adjust grows text but not rem lengths: ranks 10 to 20 once read "1…" and "2…".
    expect(await cutRanks(main)).toEqual([]);
    const after = await main.locator('[data-spotify-artist]').first().boundingBox();
    expect(after?.width ?? 0).toBeGreaterThanOrEqual((before?.width ?? 0) * 1.9);
    expect(await brokenWords(main)).toEqual([]);
    expect(await hiddenContent(main)).toEqual([]);
    await expectNoOverflow(page);
  });

  for (const width of [320, 390]) {
    test(`puts each rank on its title's first line and each arrow after its last word at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      await enlargeText(page, 200, 'adjust');

      // The rank once sat beside the artist line, and "Megalomaniac" left its arrow alone below it.
      expect(await offsetRanks(main)).toEqual([]);
      expect(await strayArrows(main)).toEqual([]);
      expect(await brokenWords(main)).toEqual([]);
    });
  }

  test('keeps every rank whole with the root font at 200% too', async ({ page }) => {
    const main = await openConsolePage(page, '/spotify', 'Spotify');
    await enlargeText(page, 200, 'root');

    expect(await cutRanks(main)).toEqual([]);
  });
});

const json = (body: object) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

interface HeroReading {
  readonly state: string;
  readonly height: number;
  readonly stripTop: number;
  /** The artist line's top inside the hero, for a track; null for the other states. */
  readonly artistTop: number | null;
  /** Whether "Back as soon as Spotify answers." shows; null in the states without it. */
  readonly explained: boolean | null;
  /** How many lines "Spotify unreachable" takes; null in the other states. */
  readonly titleLines: number | null;
}

/** A title long enough for two lines (and more) in every hero layout. */
const LONG_TITLE = 'A Considerably Longer Song Title That Keeps Going (feat. Somebody Else)';

type PollAnswer = { status: number; contentType?: string; body: string };

/**
 * Answers the polls with `answer` and moves the clock past the next one, then until the hero
 * shows `state` (a failed poll is retried once, a second later, before it says "unreachable").
 */
async function pollAs(page: Page, answer: PollAnswer, state: string, advance: string) {
  const hero = page.locator('[data-spotify-hero]');
  await page.unroute('**/api/v1/now-playing');
  await page.route('**/api/v1/now-playing', (route) => route.fulfill(answer));
  await page.clock.fastForward(advance);
  await expect
    .poll(async () => {
      const shown = await hero.getAttribute('data-state');
      if (shown !== state) await page.clock.fastForward('00:02');
      return shown;
    })
    .toBe(state);
}

/** The hero's height, the top of the artist strip under it and its own artist line's top. */
async function readHero(page: Page): Promise<HeroReading> {
  return page.evaluate(() => {
    const hero = document.querySelector('[data-spotify-hero]');
    const strip = document.querySelector('section[aria-labelledby="spotify-top-artists"]');
    const artist = hero?.querySelector('[data-equaliser]')?.closest('p');
    const top = hero?.getBoundingClientRect().top ?? 0;
    const words = Array.from(hero?.querySelectorAll('p') ?? []);
    const line = words.find((p) => p.textContent?.includes('Back as soon as'));
    const title = words.find((p) => p.textContent === 'Spotify unreachable');
    const titleLine = title ? Number.parseFloat(getComputedStyle(title).lineHeight) : 1;
    return {
      state: hero?.getAttribute('data-state') ?? '',
      height: Math.round((hero?.getBoundingClientRect().height ?? 0) * 10) / 10,
      stripTop: Math.round((strip?.getBoundingClientRect().top ?? 0) + window.scrollY),
      artistTop: artist ? Math.round((artist.getBoundingClientRect().top - top) * 10) / 10 : null,
      explained: line ? line.getBoundingClientRect().height > 0 : null,
      titleLines: title ? Math.round(title.getBoundingClientRect().height / titleLine) : null,
    };
  });
}

/** A playing track's poll answer, linked like the chart's first track and with its cover. */
async function playingAnswer(page: Page) {
  const track = await page.evaluate(() => {
    const image = document.querySelector('[data-spotify-track] img')?.getAttribute('src') ?? '';
    return {
      songURL: document.querySelector('[data-track-title]')?.getAttribute('href') ?? undefined,
      imageURL: image ? new URL(image, location.href).href : undefined,
    };
  });
  return { isPlaying: true, songName: 'A Song', artistName: 'An Artist', ...track };
}

/**
 * Today's chart titles, each written in turn into the hero's linked title, and what goes wrong
 * with each: a word split across lines although it fits the tile's whole width (the art can move
 * above the words to give it that line), or the new-tab arrow not shown right after the last word
 * (cut away by the title's line clamp, or off screen).
 */
async function heroTitleFaults(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const hero = root.querySelector('[data-spotify-hero]');
    const link = hero?.querySelector('[data-tile-link]');
    const title = link?.firstElementChild;
    const box = link?.closest('p');
    const icon = link?.querySelector('[data-new-tab-arrow] svg');
    if (!hero || !title || !box || !icon) return ['no linked track in the hero'];
    const tile = getComputedStyle(hero);
    const tileWidth =
      hero.clientWidth - Number.parseFloat(tile.paddingLeft) - Number.parseFloat(tile.paddingRight);
    const lines = (range: Range) =>
      Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5);
    const wordWidth = (word: string) => {
      const probe = document.createElement('span');
      probe.style.whiteSpace = 'nowrap';
      probe.textContent = word;
      box.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };
    const chart = Array.from(
      root.querySelectorAll('[data-track-title] > span:first-child'),
      (span) => span.textContent?.trim() ?? '',
    );
    const original = title.textContent;
    const faults: string[] = [];
    for (const name of new Set(chart.filter(Boolean))) {
      title.textContent = name;
      const text = title.firstChild;
      if (!text) continue;
      for (const match of name.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        if (new Set(lines(range).map((rect) => Math.round(rect.top))).size < 2) continue;
        if (wordWidth(match[0]) <= tileWidth) faults.push(`${name}: "${match[0]}" broken`);
      }
      const whole = document.createRange();
      whole.selectNodeContents(title);
      const last = lines(whole).at(-1);
      const arrow = icon.getBoundingClientRect();
      const middle = arrow.top + arrow.height / 2;
      const shown =
        !!last &&
        arrow.bottom <= box.getBoundingClientRect().bottom + 0.5 &&
        middle >= last.top &&
        middle <= last.bottom &&
        arrow.right <= window.innerWidth + 0.5;
      if (!shown) faults.push(`${name}: arrow not shown after the last word`);
    }
    title.textContent = original;
    return faults;
  });
}

/**
 * Walks the hero through every state, waiting for each to show, and returns what `read` read: a
 * one-line title, a long one, the one-line title again, no cover, then the states without a track.
 */
async function heroStates<T>(page: Page, read: (page: Page) => Promise<T>): Promise<T[]> {
  const playing = await playingAnswer(page);
  const hero = page.locator('[data-spotify-hero]');
  // A remembered track expires after twelve hours, so "nothing" follows a long idle stretch. The
  // answers that are all "playing" each wait for their own title or for the glyph.
  const steps: [PollAnswer, string, string, (() => Promise<void>)?][] = [
    [json(playing), 'playing', '00:31', () => expect(hero).toContainText('A Song')],
    [
      json({ ...playing, songName: LONG_TITLE }),
      'playing',
      '00:31',
      () => expect(hero).toContainText('Considerably'),
    ],
    [
      json({ ...playing, artistName: 'Another Artist' }),
      'playing',
      '00:31',
      () => expect(hero).toContainText('Another Artist'),
    ],
    [
      json({ ...playing, imageURL: undefined }),
      'playing',
      '00:31',
      () => expect(hero.locator('img')).toHaveCount(0),
    ],
    [json({ isPlaying: true }), 'playing-unknown', '00:31'],
    [json({ isPlaying: false }), 'recent', '00:31'],
    [{ status: 500, body: '' }, 'unreachable', '00:31'],
    [json({ isPlaying: false }), 'nothing', '13:00:00'],
  ];
  const readings: T[] = [];
  for (const [answer, state, advance, shown] of steps) {
    await pollAs(page, answer, state, advance);
    await shown?.();
    readings.push(await read(page));
  }
  return readings;
}

/**
 * One height in every state, nothing below it moving, a track's artist line held still, and the
 * unreachable state's line of explanation shown (a 320px tile once hid it with room to spare).
 */
function expectSteadyHero(readings: readonly HeroReading[]): void {
  const heights = readings.map((reading) => reading.height);
  expect(Math.max(...heights) - Math.min(...heights), JSON.stringify(readings)).toBeLessThan(1);
  expect(new Set(readings.map((reading) => reading.stripTop)).size).toBe(1);
  const artistTops = readings.flatMap((reading) => reading.artistTop ?? []);
  expect(new Set(artistTops).size, JSON.stringify(readings)).toBe(1);
  const unreachable = readings.find((reading) => reading.state === 'unreachable');
  expect(unreachable?.explained, JSON.stringify(unreachable)).toBe(true);
}

/** Narrow phones, 1px at a time: the band where the unreachable title beside the art wraps. */
const NARROW_WIDTHS = Array.from({ length: 49 }, (_, index) => 296 + index);

/** The hero at each narrow width; the window then goes back to 320px for the next poll. */
async function readAcross(page: Page): Promise<HeroReading[]> {
  const readings: HeroReading[] = [];
  for (const width of NARROW_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    readings.push(await readHero(page));
  }
  await page.setViewportSize({ width: 320, height: 844 });
  return readings;
}

/**
 * Per width, one height in every state, and the unreachable line shown wherever its title keeps
 * one line beside the art, give or take 3px: the step sits just past the widest the title is set
 * from 100 to 123% text (hinted, at 105.5%), so the line never shows beside a two-line title.
 */
function expectSteadyAcross(states: readonly HeroReading[][]): void {
  const uneven = NARROW_WIDTHS.filter((_, index) => {
    const heights = states.map((readings) => readings[index]?.height ?? 0);
    return Math.max(...heights) - Math.min(...heights) >= 1;
  });
  expect(uneven, 'widths where the states differ in height').toEqual([]);
  const unreachable = states.find((readings) => readings[0]?.state === 'unreachable') ?? [];
  expect(unreachable).toHaveLength(NARROW_WIDTHS.length);
  const wrapped = NARROW_WIDTHS.filter((_, index) => (unreachable[index]?.titleLines ?? 0) > 1);
  const hidden = NARROW_WIDTHS.filter(
    (width, index) =>
      unreachable[index]?.explained === false &&
      unreachable[index]?.titleLines === 1 &&
      !wrapped.some((last) => width > last && width - last <= 3),
  );
  expect(hidden, 'widths that hide the line beside a one-line title').toEqual([]);
}

test.describe('Spotify hero across poll answers', () => {
  test.describe.configure({ timeout: 90_000 });

  for (const { width, text } of [
    { width: 320, text: 150 },
    { width: 320, text: 200 },
    { width: 390, text: 150 },
    { width: 768, text: 150 },
    { width: 1280, text: 150 },
    { width: 1280, text: 100 },
  ]) {
    test(`keeps one height in every state at ${width}px with text at ${text}%`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await openConsolePage(page, '/spotify', 'Spotify');
      if (text !== 100) await enlargeText(page, text);

      expectSteadyHero(await heroStates(page, readHero));
    });
  }

  test('keeps the cover at 112px beside the words with text at 150%, above them on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const main = await openConsolePage(page, '/spotify', 'Spotify');
    await enlargeText(page, 150);
    const art = main.locator('[data-spotify-hero] img, [data-spotify-hero] [data-art-glyph]');
    expect((await art.boundingBox())?.width).toBe(112);

    await page.setViewportSize({ width: 390, height: 900 });
    const words = main.locator('[data-spotify-hero] :is(h2, p):not(.sr-only)').first();
    const [artBox, wordsBox] = [await art.boundingBox(), await words.boundingBox()];
    expect(artBox?.width).toBe(80);
    expect((artBox?.y ?? 0) + (artBox?.height ?? 0)).toBeLessThanOrEqual(wordsBox?.y ?? 0);
  });
});

test.describe('Spotify hero across poll answers with a phone text size', () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ isMobile: true, hasTouch: true });

  // Phone text at 150% keeps the art beside the words from a 375px phone, where a 12-letter word
  // fits beside it; on a 360px one "Megalomaniac" broke in two there, so it stacks. At 200% it
  // stacks on every phone. The heights are the room today's longest title needs (three lines
  // beside the art; above it two, three or four by width), so blank room cannot creep back.
  for (const { width, adjust, beside, tallest } of [
    { width: 320, adjust: 150, beside: false, tallest: 315 },
    { width: 360, adjust: 150, beside: false, tallest: 276 },
    { width: 390, adjust: 150, beside: true, tallest: 219 },
    { width: 320, adjust: 200, beside: false, tallest: 424 },
    { width: 390, adjust: 200, beside: false, tallest: 372 },
  ]) {
    test(`keeps one height and the artist line still at ${width}px with phone text at ${adjust}%`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.clock.install();
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      await enlargeText(page, adjust, 'adjust');

      const readings = await heroStates(page, readHero);
      expectSteadyHero(readings);
      expect(readings[0]?.height ?? 0).toBeLessThanOrEqual(tallest);
      const art = await main.locator('[data-spotify-hero] [data-art-glyph]').boundingBox();
      const words = await main.locator('[data-spotify-hero] h2').boundingBox();
      const artRight = (art?.x ?? 0) + (art?.width ?? 0);
      expect(artRight <= (words?.x ?? 0), JSON.stringify({ art, words })).toBe(beside);
    });
  }
});

// On a 320px phone (touch, default text) "Spotify unreachable" fits beside the art, yet its line was
// hidden, 50px blank; with a mouse the tile is 10px narrower, the title wraps and the line goes.
for (const touch of [true, false]) {
  test.describe(`Spotify hero on a narrow phone, ${touch ? 'touch' : 'mouse'}`, () => {
    test.describe.configure({ timeout: 180_000 });
    test.use({ isMobile: touch, hasTouch: touch, viewport: { width: 320, height: 844 } });

    test('keeps one height and shows the unreachable line wherever it fits, 296 to 344px', async ({
      page,
    }) => {
      await page.clock.install();
      await openConsolePage(page, '/spotify', 'Spotify');

      expectSteadyAcross(await heroStates(page, readAcross));
    });
  });
}

// With text enlarged the hero's title once kept two lines beside the art: "Megalomaniac" broke in
// two on a 360px phone with its text at 150%, and "Club classics featuring bb trickz" and "I'M A
// BLACKHOLE (STAR)" lost their ends and arrows at 320 to 412px. Each plays a linked, covered track.
for (const { how, percent, widths } of [
  { how: 'adjust', percent: 150, widths: [320, 360, 375, 412] },
  { how: 'adjust', percent: 200, widths: [320, 390, 430] },
  { how: 'root', percent: 150, widths: [320, 412] },
  { how: 'root', percent: 200, widths: [320, 390] },
] as const) {
  const phone = how === 'adjust';
  const group = phone ? 'phone text' : 'root font';
  test.describe(`Spotify hero with each of today's chart titles, ${group}`, () => {
    test.describe.configure({ timeout: 90_000 });
    test.use({ isMobile: phone, hasTouch: phone });

    for (const width of widths) {
      test(`keeps every title's words whole and its arrow at ${width}px with ${phone ? 'phone text' : 'text'} at ${percent}%`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.clock.install();
        const main = await openConsolePage(page, '/spotify', 'Spotify');
        await enlargeText(page, percent, how);

        await pollAs(page, json(await playingAnswer(page)), 'playing', '00:31');
        await expect(main.locator('[data-spotify-hero] [data-tile-link]')).toContainText('A Song');
        expect(await heroTitleFaults(main)).toEqual([]);
      });
    }
  });
}

/** The artist strip's list of cards. */
const STRIP_LIST = 'section[aria-labelledby="spotify-top-artists"] ol';

test.describe('Spotify artist strip', () => {
  // Each test loads the page at several widths.
  test.describe.configure({ timeout: 120_000 });

  test('starts the row of ten where each card has room, and before the tenth is half cut', async ({
    page,
  }) => {
    for (const width of [780, 820, 860, 870, 900, 940, 960, 1024, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      const { widths, scrolls } = await main.locator(STRIP_LIST).evaluate((list) => ({
        widths: Array.from(list.children, (card) => card.getBoundingClientRect().width),
        scrolls: list.scrollWidth > list.clientWidth + 1,
      }));
      expect(Math.min(...widths), `${width}px window`).toBeGreaterThanOrEqual(80);
      // From 870 the ten fit: a scroller there showed nine and a half-faded tenth (880 to 953).
      if (width >= 870) expect(scrolls, `${width}px window`).toBe(false);
    }
  });

  test('shows a clear part of the next artist with phone text at 200%', async ({ browser }) => {
    for (const width of [320, 340, 390, 412]) {
      const context = await browser.newContext({
        isMobile: true,
        hasTouch: true,
        viewport: { width, height: 844 },
      });
      const page = await context.newPage();
      await readOnly(page);
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      await enlargeText(page, 200, 'adjust');
      // At 390 two whole cards once ended the view and the third began under the fade, unseen.
      const shown = await main.locator(STRIP_LIST).evaluate((list) => {
        const right = Math.min(list.getBoundingClientRect().right, window.innerWidth);
        const cut = Array.from(list.children)
          .map((card) => card.getBoundingClientRect())
          .find((box) => box.right > right + 0.5);
        return cut ? (right - cut.left) / cut.width : 0;
      });
      expect(shown, `${width}px`).toBeGreaterThanOrEqual(0.3);
      expect(shown, `${width}px`).toBeLessThanOrEqual(0.8);
      await context.close();
    }
  });

  for (const { width, adjust } of [
    { width: 390, adjust: 100 },
    { width: 390, adjust: 200 },
    { width: 340, adjust: 200 },
    { width: 320, adjust: 200 },
  ]) {
    test(`scrolls each artist whole into the strip as the keyboard reaches it, ${width}px with phone text at ${adjust}%`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        isMobile: true,
        hasTouch: true,
        viewport: { width, height: 844 },
      });
      const page = await context.newPage();
      await readOnly(page);
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      if (adjust !== 100) await enlargeText(page, adjust, 'adjust');
      const cards = main.locator('[data-spotify-artist] a');
      await cards.first().focus();
      for (let index = 0; index < (await cards.count()); index += 1) {
        if (index > 0) await page.keyboard.press('Tab');
        await expect(cards.nth(index)).toBeFocused();
        const { card, strip } = await cards.nth(index).evaluate((link) => {
          const edges = (box: DOMRect | undefined) => ({
            left: box?.left ?? 0,
            right: box?.right ?? 0,
          });
          return {
            card: edges(link.getBoundingClientRect()),
            strip: edges(link.closest('ol')?.getBoundingClientRect()),
          };
        });
        expect(card.left, `artist ${index + 1}`).toBeGreaterThanOrEqual(strip.left - 0.5);
        expect(card.right, `artist ${index + 1}`).toBeLessThanOrEqual(strip.right + 0.5);
      }
      await context.close();
    });
  }

  test('keeps a long one-word name inside its card, on three lines at most', async ({ page }) => {
    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/spotify', 'Spotify');
      const fit = await main.locator('[data-spotify-artist]').nth(2).evaluate(longNameFit);
      expect(fit?.inside, `${width}px`).toBe(true);
      expect(fit?.lines ?? 9, `${width}px`).toBeLessThanOrEqual(3);
    }
  });
});
