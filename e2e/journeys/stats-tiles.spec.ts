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
 * @file The /stats tiles against what stats.spec.ts does not hold:
 * - a device clock off the server's: every age is dated by the server's clock and worded by the
 *   device's, and a clock a minute or more behind put a source read moments before the page in
 *   its future, where an age has no words. The Discord age line went empty and the tile 18px
 *   shorter until the first poll moved everything under it back, and a stat tile's line ended on
 *   its separator ('1,022 tests ·'). A clock ahead counts a stat tile's age its own way; the
 *   Discord age line counts the snapshot's age when the page was rendered, so any clock reads it
 *   alike.
 * - stat tiles sharing a row, each as tall as what it holds: the wide layout, and a phone row
 *   once typing takes three fifths of it (in equal halves coding time had 44px under its one line
 *   of context at 480px, beside typing's three).
 * - the Discord tile by a device clock 5 min behind, while the route alternates a newer read and
 *   an older cached copy, each with the server's Date: reads are ordered by the server's clock,
 *   so the older copy never shows, not even for one render (it did every other poll, each
 *   'updated just now', while reads were compared with this browser's clock).
 * - the Discord tile when the device clock steps 10 min forward or back between polls: the older
 *   copy after the step never shows, and the presence kept says its true age after each poll
 *   (a forward step showed the older copy for a poll; a step back left the age line empty until
 *   a newer read came).
 * The Discord polls are answered here, inside the browser; nothing else is sent anywhere.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import { openConsolePage, readOnly } from '../fixtures/console-routes';

/** A poll at a time is brought forward by moving the page's clock past it. */
const POLL_MS = 31_000;
const USER = { username: 'console', id: '1', avatar: '', discriminator: '0' };
const CODE = { name: 'Visual Studio Code', type: 0, details: 'Editing a file', state: 'A repo' };
const GAME = { name: 'A Game', type: 0, details: 'In a match' };

/** Room under a stat tile's context line beyond this is a tile taller than what it holds. */
const MOST_SPARE_UNDER_CONTEXT = 12;
/**
 * Beside Discord in the tablet tier, each of the two rows takes up to this much of the room the
 * fixed-height Discord tile has over LeetCode and the pair (17px at the default text size).
 */
const DISCORD_SPARE_PER_ROW = 9;

/** Where every tile and the repository table sit: 'top/height' in page pixels, by name. */
async function tileBoxes(main: Locator): Promise<Record<string, string>> {
  return main.evaluate((root) => {
    const boxes: Record<string, string> = {};
    const add = (name: string, element: Element) => {
      const rect = element.getBoundingClientRect();
      boxes[name] = `${Math.round(rect.top + window.scrollY)}/${Math.round(rect.height)}`;
    };
    for (const tile of root.querySelectorAll<HTMLElement>('[data-stats-tile]')) {
      add(tile.dataset.statsTile ?? '', tile);
    }
    const table = root.querySelector('table');
    if (table) add('table', table);
    return boxes;
  });
}

/** Ages with no words, and context lines that end on their separator. */
async function agesWithoutWords(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    for (const time of root.querySelectorAll('time')) {
      if (time.textContent?.trim()) continue;
      found.push(`no words: ${time.closest('[data-stats-tile]')?.getAttribute('data-stats-tile')}`);
    }
    for (const line of root.querySelectorAll('[data-context-line]')) {
      const text = line.textContent?.trim() ?? '';
      if (text.endsWith('·')) found.push(`ends on a separator: ${text.slice(-32)}`);
    }
    return found;
  });
}

/**
 * Stat tiles taller than what they hold: room under a tile's context line (its last row) over
 * `most` px. Each tile packs its rows to its top, so a tile stretched to its row's height keeps
 * the spare room there.
 */
async function spareUnderContext(main: Locator, most: number): Promise<string[]> {
  return main.evaluate((root, limit) => {
    const found: string[] = [];
    for (const name of ['leetcode', 'typing', 'coding']) {
      const tile = root.querySelector<HTMLElement>(`[data-stats-tile="${name}"]`);
      const row = tile?.querySelector('[data-context-line]')?.parentElement;
      if (!tile || !row) continue;
      const style = getComputedStyle(tile);
      const floor =
        tile.getBoundingClientRect().bottom -
        Number.parseFloat(style.paddingBottom) -
        Number.parseFloat(style.borderBottomWidth);
      const spare = floor - row.getBoundingClientRect().bottom;
      if (spare > limit) found.push(`${name}: ${Math.round(spare)}px`);
    }
    return found;
  }, most);
}

/** How many lines each stat tile's context line takes, by tile: its parts' distinct tops. */
async function contextLines(main: Locator): Promise<Record<string, number>> {
  return main.evaluate((root) => {
    const lines: Record<string, number> = {};
    for (const tile of root.querySelectorAll<HTMLElement>('[data-stats-tile]')) {
      const parts = [...tile.querySelectorAll('[data-context-part]')];
      if (parts.length === 0) continue;
      const tops = new Set(parts.map((part) => Math.round(part.getBoundingClientRect().top)));
      lines[tile.dataset.statsTile ?? ''] = tops.size;
    }
    return lines;
  });
}

/** Answers both Discord polls in the browser: one activity, and nothing playing on Spotify. */
async function answerPolls(page: Page): Promise<void> {
  await page.route('**/api/v1/lanyard', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: { discord_status: 'online', discord_user: USER, activities: [CODE] },
        })
      : route.abort(),
  );
  await page.route('**/api/v1/now-playing', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { isPlaying: false } })
      : route.abort(),
  );
}

/** Polls until the tile shows the answered presence: the first may come early. */
async function untilPolled(page: Page, discord: Locator): Promise<void> {
  await expect(async () => {
    await page.clock.fastForward(POLL_MS);
    await expect(discord).toContainText('console', { timeout: 2_000 });
    await expect(discord).toContainText('Playing Visual Studio Code', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** The Discord tile's height, or null when Discord did not answer the server. */
async function discordHeight(main: Locator): Promise<number | null> {
  const discord = main.locator('[data-stats-tile="discord"]');
  if ((await discord.locator('[data-discord-room]').count()) === 0) return null;
  return Math.round((await discord.boundingBox())?.height ?? 0);
}

test.beforeEach(async ({ page }) => readOnly(page));

test.describe('Stats tiles with the device clock off the server’s', () => {
  for (const width of [390, 1440]) {
    for (const skew of [-90_000, 90_000]) {
      test(`words every age and moves nothing at the poll, ${skew / 1000} s off at ${width}px`, async ({
        page,
        browser,
      }) => {
        // The tile's height with the clock in step, from a page of its own.
        const inStep = await browser.newPage({ viewport: { width, height: 900 } });
        await readOnly(inStep);
        const own = await discordHeight(await openConsolePage(inStep, '/stats', 'Stats'));
        await inStep.close();
        test.skip(own === null, 'Discord did not answer the server; there is no live tile to date');

        await answerPolls(page);
        await page.clock.install({ time: Date.now() + skew });
        await page.setViewportSize({ width, height: 900 });
        const main = await openConsolePage(page, '/stats', 'Stats');
        expect(await discordHeight(main)).toBe(own);
        expect(await agesWithoutWords(main)).toEqual([]);

        const before = await tileBoxes(main);
        await untilPolled(page, main.locator('[data-stats-tile="discord"]'));
        expect(await tileBoxes(main)).toEqual(before);
        expect(await agesWithoutWords(main)).toEqual([]);
      });
    }
  }
});

/** Resolves once React has hydrated the Discord tile (its section carries React's props). */
const discordHydrated = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const tile = document.querySelector('[data-stats-tile="discord"]');
    return tile !== null && Object.keys(tile).some((key) => key.startsWith('__reactProps'));
  });

/** Records every word the Discord status takes from now on, however briefly. */
const watchStatusWords = (discord: Locator): Promise<void> =>
  discord.evaluate((tile) => {
    const seen: string[] = [];
    Object.assign(window, { statusWords: seen });
    new MutationObserver(() => {
      const text = tile.querySelector('[data-widest] > span')?.textContent ?? '';
      if (text && text !== seen.at(-1)) seen.push(text);
    }).observe(tile, { subtree: true, childList: true, characterData: true });
  });

/** The words watchStatusWords recorded. */
const statusWords = (page: Page): Promise<string[] | undefined> =>
  page.evaluate(() => (window as { statusWords?: string[] }).statusWords);

test.describe('The Discord tile by a device clock 5 min behind the server’s', () => {
  test('never shows an older cached copy over a newer presence', async ({ page }) => {
    test.setTimeout(120_000);
    // The server's clock is this test's; the page's runs 5 min behind it, and both move on by
    // every poll brought forward.
    let forwarded = 0;
    let polls = 0;
    let newest = 0;
    await page.route('**/api/v1/lanyard', (route) => {
      if (route.request().method() !== 'GET') return route.abort();
      const now = Date.now() + forwarded;
      polls += 1;
      // Odd polls: read 2 s before it was served. Even polls: a copy read 30 s before that.
      if (polls % 2) newest = now - 2_000;
      const body =
        polls % 2
          ? { discord_status: 'dnd', discord_user: USER, activities: [CODE], read_at: newest }
          : {
              discord_status: 'idle',
              discord_user: USER,
              activities: [GAME],
              read_at: newest - 30_000,
            };
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', date: new Date(now).toUTCString() },
        body: JSON.stringify(body),
      });
    });
    await page.route('**/api/v1/now-playing', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { isPlaying: false } })
        : route.abort(),
    );
    await page.clock.install({ time: Date.now() - 5 * 60_000 });
    const main = await openConsolePage(page, '/stats', 'Stats');
    const discord = main.locator('[data-stats-tile="discord"]');
    const word = discord.locator('[data-widest] > span');
    await discordHydrated(page);
    await watchStatusWords(discord);

    // The first poll may wait for the island's timers to be set.
    await expect(async () => {
      forwarded += POLL_MS;
      await page.clock.fastForward(POLL_MS);
      expect(polls).toBeGreaterThan(0);
      await expect(word).toHaveText('Do not disturb', { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    // Four more: older, newer, older, newer. The last newer one shows after both older ones.
    const first = polls;
    for (let n = 1; n <= 4; n += 1) {
      const answered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/lanyard');
      forwarded += POLL_MS;
      await page.clock.fastForward(POLL_MS);
      await answered;
    }
    expect(polls - first).toBe(4);
    await expect(discord).toContainText('Playing Visual Studio Code');
    await expect(word).toHaveText('Do not disturb');
    expect(await statusWords(page)).not.toContain('Idle');
    await expect(discord).not.toContainText('Playing A Game');
  });
});

test.describe('The Discord tile when the device clock steps between polls', () => {
  for (const [label, step] of [
    ['10 min forward', 10 * 60_000],
    ['10 min back', -10 * 60_000],
  ] as const) {
    test(`keeps the newer presence and its true age after a step ${label}`, async ({ page }) => {
      test.setTimeout(120_000);
      // The server's clock is this test's. The page's starts 5 min behind it and then steps;
      // page.clock.setSystemTime moves the page's Date only, as a time sync or a manual change
      // moves a device's, and leaves performance.now() and the timers at their pace.
      let forwarded = 0;
      let polls = 0;
      let stepped = false;
      let afterStep = 0;
      let newest = 0;
      await page.route('**/api/v1/lanyard', (route) => {
        if (route.request().method() !== 'GET') return route.abort();
        const now = Date.now() + forwarded;
        polls += 1;
        // Before the step: a read made 2 s before it was served. After it: a copy read 30 s
        // before the last of those, then that read again.
        if (stepped) afterStep += 1;
        else newest = now - 2_000;
        const body =
          afterStep === 1
            ? {
                discord_status: 'idle',
                discord_user: USER,
                activities: [GAME],
                read_at: newest - 30_000,
              }
            : { discord_status: 'dnd', discord_user: USER, activities: [CODE], read_at: newest };
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json', date: new Date(now).toUTCString() },
          body: JSON.stringify(body),
        });
      });
      await page.route('**/api/v1/now-playing', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: { isPlaying: false } })
          : route.abort(),
      );
      await page.clock.install({ time: Date.now() - 5 * 60_000 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const discord = main.locator('[data-stats-tile="discord"]');
      const word = discord.locator('[data-widest] > span');
      const age = discord.locator('time');
      await discordHydrated(page);
      await watchStatusWords(discord);

      await expect(async () => {
        forwarded += POLL_MS;
        await page.clock.fastForward(POLL_MS);
        expect(polls).toBeGreaterThan(0);
        await expect(word).toHaveText('Do not disturb', { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      await expect(age).toHaveText('updated just now');

      stepped = true;
      await page.clock.setSystemTime((await page.evaluate(() => Date.now())) + step);
      // The older copy, 33 s after the read on screen; then that read again, 64 s after it.
      for (const words of ['updated just now', 'updated 1 min ago']) {
        const answered = page.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/v1/lanyard',
        );
        forwarded += POLL_MS;
        await page.clock.fastForward(POLL_MS);
        await answered;
        await expect(word).toHaveText('Do not disturb');
        await expect(age).toHaveText(words);
      }
      expect(afterStep).toBe(2);
      await expect(discord).toContainText('Playing Visual Studio Code');
      expect(await statusWords(page)).not.toContain('Idle');
    });
  }
});

test.describe('Stats tiles sharing a row', () => {
  // 480px: typing and coding time share a phone row in three fifths and two; 610px: two thirds
  // and one, where two fifths held coding time's context on one line beside typing's two; 760px:
  // the 6-column stack, also two thirds and one; 1100px: the tablet tier, three fifths and two of
  // the half under LeetCode (coding time had 44px there in quarters); 1440px: the wide layout.
  // (The tablet tier's first 78px of grid keep equal quarters: there three fifths do not yet hold
  // typing's context in two lines, with room to spare, nor two fifths coding time's age whole.)
  for (const width of [480, 610, 760, 1100, 1440]) {
    test(`keeps every stat tile as tall as what it holds at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      // In the tablet tier Discord's fixed height is 17px more than LeetCode and the pair beside
      // it, and their two rows share that spare; coding time's figure is also a few px smaller in
      // its narrower tile.
      const besideDiscord = width === 1100 ? DISCORD_SPARE_PER_ROW : 0;
      expect(await spareUnderContext(main, MOST_SPARE_UNDER_CONTEXT + besideDiscord)).toEqual([]);
    });
  }

  // Every width where typing and coding time share a row by shares: three fifths and two, then
  // two thirds and one (from a 464px window), and the 6-column tier (628 to 870px). In the
  // 6-column tier, left to wrap where each fits, typing's context went to one line a few px
  // before coding time's (688 to 694px here, 674 to 690px with unhinted text) and typing stood
  // 20px taller than what it held. (Below 464px the row is halves, where coding time keeps room
  // under its line: its share there would break its age.)
  test('gives typing and coding time the same lines wherever they share a row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    const main = await openConsolePage(page, '/stats', 'Stats');
    const uneven: string[] = [];
    for (let width = 464; width <= 870; width += 2) {
      await page.setViewportSize({ width, height: 900 });
      const { typing, coding } = await contextLines(main);
      const spare = await spareUnderContext(main, MOST_SPARE_UNDER_CONTEXT);
      if (typing !== coding || spare.length > 0) {
        uneven.push(`${width}px: typing ${typing} lines, coding ${coding} ${spare.join(' ')}`);
      }
    }
    expect(uneven).toEqual([]);
  });
});
