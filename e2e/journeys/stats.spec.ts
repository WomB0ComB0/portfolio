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
  expectReadable,
  expectSettled,
  openConsolePage,
  readOnly,
} from '../fixtures/console-routes';

const TILES = ['github', 'discord', 'leetcode', 'typing', 'coding'] as const;

/**
 * The tiles of each grid row at a window width, top to bottom, at the default text size. The grid
 * answers to its own width, so these follow the room the console has beside the rail: a row each
 * on a phone up to about 430px (typing's context would take four lines in half a row), typing
 * and coding sharing a row on a larger phone and an upright tablet, Discord standing beside the
 * three stat tiles (LeetCode over typing and coding) from about 880px, where a quarter holds
 * typing's context in three lines, and the hero beside Discord only once the hero has room for
 * its whole wide layout. There LeetCode starts under Discord, and typing and coding lower, under
 * the hero, which ends below Discord. The widths sit clear of each step, so a desktop
 * scrollbar's 10px does not move a case across one.
 */
const LAYOUTS = [
  { width: 280, rows: ['github', 'discord', 'leetcode', 'typing', 'coding'] },
  { width: 360, rows: ['github', 'discord', 'leetcode', 'typing', 'coding'] },
  { width: 412, rows: ['github', 'discord', 'leetcode', 'typing', 'coding'] },
  { width: 480, rows: ['github', 'discord', 'leetcode', 'typing coding'] },
  { width: 640, rows: ['github', 'discord', 'leetcode', 'typing coding'] },
  { width: 768, rows: ['github', 'discord', 'leetcode', 'typing coding'] },
  { width: 1024, rows: ['github', 'discord leetcode', 'typing coding'] },
  { width: 1440, rows: ['github discord', 'leetcode', 'typing coding'] },
] as const;

/** The most lines typing's context may take: three facts and an age, in three lines at most. */
const MOST_TYPING_CONTEXT_LINES = 3;

/** How far past its own height Discord may be stretched by the tiles beside it. */
const DISCORD_STRETCH = 8;

/** The most a repository row may be against the middle row's height. */
const TALLEST_ROW_RATIO = 2;

/**
 * In the 12-column tier, the most a stat tile's context line may sit under its figure (or the
 * split or gauge under it): the tile's own 12px, and one line more for the tile whose neighbour's
 * context takes two lines. Three equal tiles in a row left 58px in typing and 80px in coding time.
 */
const LOOSEST_CONTEXT_GAP = 40;

/**
 * The Discord tile's height at the default text size, whatever its live state: its activity room
 * holds the tallest list it ever shows, so it is at least this tall (16px of padding on a phone
 * grid, 20px from a 28rem one) and taller only when the tiles beside it are.
 */
const DISCORD_MIN_HEIGHT = { phone: 361, wide: 369 } as const;

/** The tiles grouped into rows by where they start, each row as its names joined by a space. */
async function tileRows(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const rows = new Map<number, string[]>();
    for (const tile of root.querySelectorAll<HTMLElement>('[data-stats-tile]')) {
      const top = Math.round(tile.getBoundingClientRect().top + window.scrollY);
      rows.set(top, [...(rows.get(top) ?? []), tile.dataset.statsTile ?? '']);
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([, names]) => names.join(' '));
  });
}

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

/**
 * Stat tiles stretched to the Discord tile's height: one that starts on Discord's row and ends
 * within 100px of where Discord ends. Discord is about twice a stat tile's height in every live
 * state, so a stat tile beside it would be half empty.
 */
async function stretchedTiles(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    for (const name of ['leetcode', 'typing', 'coding']) {
      const tile = root.querySelector<HTMLElement>(`[data-stats-tile="${name}"]`);
      const discord = root.querySelector<HTMLElement>('[data-stats-tile="discord"]');
      if (!tile || !discord) continue;
      const box = tile.getBoundingClientRect();
      const tall = discord.getBoundingClientRect();
      const sameRow = Math.abs(box.top - tall.top) < 1;
      if (sameRow && box.height > tall.height - 100) found.push(`${name}: ${box.height}px`);
    }
    return found;
  });
}

/**
 * Stat tiles taller than what they hold: the gap between a tile's figure (or what sits under it)
 * and its context line, where that is over `most`. A tile in a state without a figure has no
 * such gap and is left out.
 */
async function looseTiles(main: Locator, most: number): Promise<string[]> {
  return main.evaluate((root, limit) => {
    const found: string[] = [];
    for (const name of ['leetcode', 'typing', 'coding']) {
      const tile = root.querySelector<HTMLElement>(`[data-stats-tile="${name}"]`);
      const body = tile?.querySelector('.figure-row')?.parentElement?.lastElementChild;
      const line = tile?.querySelector('[data-context-line]');
      if (!body || !line) continue;
      const gap = line.getBoundingClientRect().top - body.getBoundingClientRect().bottom;
      if (gap > limit) found.push(`${name}: ${Math.round(gap)}px`);
    }
    return found;
  }, most);
}

/**
 * Descriptions that are shortened where they must show whole: any in the About column, and a
 * short one (a tagline, up to 80 characters) under the name.
 */
async function shortenedDescriptions(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    const shortened = (element: Element) =>
      getComputedStyle(element).webkitLineClamp !== 'none' ||
      element.scrollHeight > element.clientHeight + 1;
    for (const row of root.querySelectorAll<HTMLElement>('[data-stats-repo]')) {
      const column = row.children[2]?.firstElementChild;
      const line = row.querySelector('[data-repo-about]');
      const text = (line?.textContent ?? '').trim();
      if (column && getComputedStyle(row.children[2] as Element).display !== 'none') {
        if (shortened(column)) found.push(`About column: ${text.slice(0, 24)}`);
      } else if (line && text.length <= 80 && shortened(line)) {
        found.push(`under the name: ${text.slice(0, 24)}`);
      }
    }
    return found;
  });
}

/**
 * What crosses a tile's own edge: nothing visible inside a tile may. A box counts by the part of
 * it that shows: a context line clips its row on purpose (the row is pulled left so a wrapped
 * part's leading separator is cut off), and what a clipping ancestor hides crosses nothing.
 */
async function tileEscapes(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    for (const tile of root.querySelectorAll<HTMLElement>('[data-stats-tile]')) {
      const box = tile.getBoundingClientRect();
      for (const element of tile.querySelectorAll<HTMLElement>('*')) {
        if (element.closest('.sr-only')) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        let { left, right } = rect;
        for (let up = element.parentElement; up && up !== tile; up = up.parentElement) {
          if (getComputedStyle(up).overflowX === 'visible') continue;
          const clip = up.getBoundingClientRect();
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (right > box.right + 1 || left < box.left - 1) {
          found.push(`${tile.dataset.statsTile}: ${element.tagName.toLowerCase()}`);
        }
      }
    }
    return found;
  });
}

/** How many lines a tile's context line takes (its parts' distinct tops). */
async function contextLines(main: Locator, name: string): Promise<number> {
  return main.evaluate((root, tile) => {
    const line = root.querySelector(`[data-stats-tile="${tile}"] [data-context-line]`);
    const tops = [...(line?.querySelectorAll('[data-context-part]') ?? [])].map((part) =>
      Math.round(part.getBoundingClientRect().top),
    );
    return new Set(tops).size;
  }, name);
}

/**
 * Repository rows far taller than the rest: over `most` times the middle row's height. A long
 * description in a narrow About column once made one row four times its neighbours.
 */
async function tallRows(main: Locator, most: number): Promise<string[]> {
  return main.evaluate((root, limit) => {
    const rows = [...root.querySelectorAll<HTMLElement>('[data-stats-repo]')];
    const heights = rows.map((row) => row.getBoundingClientRect().height);
    const middle = [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 0;
    return rows.flatMap((row, index) => {
      const height = heights[index] ?? 0;
      const name = row.querySelector('[data-index-link]')?.textContent?.slice(0, 24);
      return height > middle * limit ? [`${name}: ${Math.round(height)}px`] : [];
    });
  }, most);
}

/** Descriptions shown twice: in the About column and under the name at once. */
async function doubledDescriptions(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const shown = (element: Element | null | undefined) =>
      !!element && getComputedStyle(element).display !== 'none';
    return [...root.querySelectorAll<HTMLElement>('[data-stats-repo]')]
      .filter((row) => {
        const line = row.querySelector('[data-repo-about]');
        return shown(row.children[2]) && shown(line);
      })
      .map((row) => row.querySelector('[data-repo-about]')?.textContent?.slice(0, 24) ?? '');
  });
}

/** The header figures and repository names wider than their own boxes (cut or overflowing). */
async function cutText(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const cut: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>('header dl dd, [data-index-link]')) {
      const box = element.parentElement ?? element;
      if (element.getBoundingClientRect().right > box.getBoundingClientRect().right + 1) {
        cut.push(element.textContent?.trim().slice(0, 24) ?? '');
      }
    }
    return cut;
  });
}

/**
 * Words that wrap while there is room beside them: the commit's meta line when the commit sits
 * beside the totals (it should have taken its own row instead), and a repository name beside a
 * shown About column.
 */
async function squeezedText(main: Locator): Promise<string[]> {
  return main.evaluate((root) => {
    const found: string[] = [];
    const tops = (rects: Iterable<DOMRect>) =>
      new Set([...rects].filter((rect) => rect.width > 1).map((rect) => Math.round(rect.top)));
    const meta = root.querySelector<HTMLElement>('[data-stats-tile="github"] [data-dated]');
    const totals = meta?.parentElement?.parentElement?.querySelector('dl');
    if (meta?.parentElement && totals) {
      const beside =
        meta.parentElement.getBoundingClientRect().left > totals.getBoundingClientRect().left + 10;
      const parts = [...meta.querySelectorAll('[data-context-part]')];
      const lines = tops(parts.map((part) => part.getBoundingClientRect())).size;
      if (beside && lines > 1) found.push(`commit meta on ${lines} lines beside the totals`);
    }
    for (const row of root.querySelectorAll<HTMLElement>('[data-stats-repo]')) {
      const about = row.children[2];
      const name = row.querySelector('[data-index-link]')?.firstChild;
      if (!about || !name || getComputedStyle(about).display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(name);
      if (tops(range.getClientRects()).size > 1) {
        found.push(`repository name wraps: ${name.textContent?.slice(0, 24)}`);
      }
    }
    return found;
  });
}

test.beforeEach(async ({ page }) => readOnly(page));

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Stats console, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('renders all five sources with figures or honest source states', async ({ page }) => {
      const main = await openConsolePage(page, '/stats', 'Stats');
      await expect(page).toHaveTitle(/Stats/);
      await expectSettled(main);
      for (const name of TILES) {
        const tile = main.locator(`[data-stats-tile="${name}"]`);
        await expectReadable(tile);
        await expect(tile).toHaveAttribute(
          'data-state',
          /^(ready|stale|partial|error|idle|empty)$/,
        );
        await expect(tile.locator('h2')).toHaveCount(1);
        const state = await tile.getAttribute('data-state');
        if (name !== 'discord' && ['ready', 'stale', 'partial'].includes(state ?? '')) {
          await expect(tile).toContainText(/\d/);
        }
      }
      const repositories = main.locator('[data-stats-repo]');
      if (await repositories.count()) {
        expect(await repositories.count()).toBeLessThanOrEqual(6);
        await expectReadable(repositories.first());
        await expect(main.getByRole('heading', { name: /^Top repositories/ })).toBeVisible();
      } else {
        await expect(
          main.getByRole('heading', { name: /^(Repositories unavailable|No repositories yet)$/ }),
        ).toBeVisible();
      }
      // The default uses plain accuracy; the gauge is a lab comparison only.
      await expect(main.locator('[data-gauge]')).toHaveCount(0);
      await expectExternalLinks(main);
    });

    for (const { width, rows } of LAYOUTS) {
      test(`lays the console out for the room it has at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const main = await openConsolePage(page, '/stats', 'Stats');
        await expectReadable(main.locator('[data-stats-tile="github"]'));
        await expectNoOverflow(page);
        expect(await tileRows(main)).toEqual([...rows]);
        expect(await tileEscapes(main)).toEqual([]);
        expect(await cutText(main)).toEqual([]);
        expect(await squeezedText(main)).toEqual([]);
        // Discord is as tall as its room in every live state, and the tiles beside it never
        // stretch it far past that; no stat tile is stretched to it.
        const discord = await main.locator('[data-stats-tile="discord"]').boundingBox();
        const ready = (await main.locator('[data-discord-room]').count()) > 0;
        if (ready) {
          const own = width <= 480 ? DISCORD_MIN_HEIGHT.phone : DISCORD_MIN_HEIGHT.wide;
          expect(Math.round(discord?.height ?? 0)).toBeGreaterThanOrEqual(own);
          expect(Math.round(discord?.height ?? 0)).toBeLessThanOrEqual(own + DISCORD_STRETCH);
        }
        expect(await stretchedTiles(main)).toEqual([]);
        // Typing's context is never a list of four short lines in a narrow tile.
        expect(await contextLines(main, 'typing')).toBeLessThanOrEqual(MOST_TYPING_CONTEXT_LINES);
        // Where the hero stands beside Discord, every stat tile is as tall as what it holds. (In
        // the narrower tiers typing and coding share a row as halves or quarters, and coding's
        // one line of context sits under typing's three.)
        if (rows[0] === 'github discord') {
          expect(await looseTiles(main, LOOSEST_CONTEXT_GAP)).toEqual([]);
        }
        // A description is never shortened in its own column, nor a short one under the name; it
        // shows in one place only, and no row is far taller than the rest.
        expect(await shortenedDescriptions(main)).toEqual([]);
        expect(await doubledDescriptions(main)).toEqual([]);
        expect(await tallRows(main, TALLEST_ROW_RATIO)).toEqual([]);
      });
    }

    test('keeps the wide hero in a short desktop window', async ({ page }) => {
      // The short-screen hero (figure at the top, a lower chart) is for a phone on its side: a
      // 1280 x 460 window has the same hero as a tall one.
      const heroShape = async (height: number) => {
        await page.setViewportSize({ width: 1280, height });
        const main = await openConsolePage(page, '/stats', 'Stats');
        return main.locator('[data-stats-tile="github"]').evaluate((hero) => {
          const box = hero.getBoundingClientRect();
          const figure = hero.querySelector('p > span')?.getBoundingClientRect();
          const chart = hero.querySelector('[data-sparkline]')?.getBoundingClientRect();
          return {
            height: Math.round(box.height),
            figure: Math.round((figure?.top ?? 0) - box.top),
            chart: Math.round(chart?.height ?? 0),
          };
        });
      };
      expect(await heroShape(460)).toEqual(await heroShape(900));
    });

    test('features a lone Discord activity in its room at every width, sized by the tile', async ({
      page,
    }) => {
      // The art is a third of the tile's own width, 40px at least and 96px at most.
      for (const [width, least, most] of [
        [320, 64, 88],
        [1024, 96, 96],
        [1440, 96, 96],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        const main = await openConsolePage(page, '/stats', 'Stats');
        const lone = main.locator('[data-stats-tile="discord"] ul[data-solo] li > *').first();
        // Presence is live: with no activity, or several, there is nothing to feature.
        if (!(await lone.count())) continue;
        const box = await lone.locator('img, [data-row-glyph]').first().boundingBox();
        expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(least);
        expect(Math.round(box?.width ?? 0)).toBeLessThanOrEqual(most);
        // Centred in the room: as much of it above the row as below, to the pixel.
        const gaps = await main.locator('[data-discord-room]').evaluate((room) => {
          const row = room.querySelector('li')?.getBoundingClientRect();
          const list = room.querySelector('ul')?.getBoundingClientRect();
          return row && list ? [row.top - list.top, list.bottom - row.bottom] : [0, 1000];
        });
        expect(Math.abs((gaps[0] ?? 0) - (gaps[1] ?? 0))).toBeLessThanOrEqual(1);
        expect(await tileEscapes(main)).toEqual([]);
      }
    });

    test('keeps the repository bars unpinned on a phone held sideways', async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const bar = main.locator('#stats-top-repositories');
      if (await bar.count()) {
        await expect(bar).toHaveCSS('position', 'relative');
        await expect(bar).toHaveCSS('top', '0px');
        await expect(bar).toHaveCSS('z-index', 'auto');
        await expect(main.locator('table th').first()).toHaveCSS('position', 'relative');
        await expect(main.locator('table th').first()).toHaveCSS('top', '0px');
      }
      await expectNoOverflow(page);
      expect(await tileEscapes(main)).toEqual([]);
    });
  });
}

/**
 * The Discord tile asks its source again every 30 s. Whatever comes back (no activity, one, two,
 * or the three rows the tile ever shows, with short lines or with every line as long as it may
 * be), the tile keeps its height, so nothing under or beside it moves. The two polls are answered
 * here, inside the browser (nothing is sent to the server for them), and the page's clock is
 * moved on to bring each one forward.
 */
test.describe('Stats console while Discord’s live state changes', () => {
  const USER = { username: 'console', id: '1', avatar: '', discriminator: '0' };
  const CODE = { name: 'Visual Studio Code', type: 0, details: 'Editing a file', state: 'A repo' };
  const SONG = { name: 'Spotify', type: 2, details: 'A song', state: 'An artist' };
  const GAME = { name: 'A Game', type: 0, details: 'In a match', state: 'Party of four' };
  /** Two activities whose heading and details all run past one line in the tile. */
  const LONG_CODE = {
    name: 'Visual Studio Code Insiders With Extensions',
    type: 0,
    details: 'Editing a-very-long-file-name-that-keeps-going-and-going.component.stories.tsx',
    state: 'Workspace: a-repository-with-a-very-long-synthetic-name-indeed',
  };
  const LONG_GAME = {
    name: 'A Synthetic Game With A Very Long Name: The Second Chapter Of Many',
    type: 0,
    details: 'In a ranked competitive match on a map with a very long synthetic name',
    state: 'Party of four in a lobby with a long synthetic name',
  };
  /**
   * Each state and words only it shows: one, two, three (a heading and two details each), the
   * tallest two (every line wrapped as far as it may), three long ones, none, then one again.
   */
  const STATES = [
    { activities: [CODE], shows: 'Playing Visual Studio Code' },
    { activities: [SONG, CODE], shows: 'Listening to Spotify' },
    { activities: [SONG, CODE, GAME], shows: 'Party of four' },
    { activities: [LONG_CODE, LONG_GAME], shows: 'Second Chapter' },
    { activities: [SONG, LONG_CODE, LONG_GAME], shows: 'Second Chapter' },
    { activities: [], shows: 'Not in an activity right now' },
    { activities: [CODE], shows: 'Playing Visual Studio Code' },
  ] as const;
  const POLL_MS = 31_000;
  const MINUTE_MS = 60_000;
  const HOUR_MS = 60 * MINUTE_MS;

  /** What the two polls answer: Discord's activities and status, and Spotify's own song if any. */
  interface Answer {
    readonly activities: readonly object[];
    /** Discord's status; online when left out. */
    readonly status?: string;
    /** Spotify's now playing; nothing playing when left out. */
    readonly song?: object;
  }

  /** Answers both polls in the browser with whatever `answer` returns at that moment. */
  async function answerPolls(page: Page, answer: () => Answer): Promise<void> {
    await page.route('**/api/v1/lanyard', (route) => {
      const { status = 'online', activities } = answer();
      return route.request().method() === 'GET'
        ? route.fulfill({ json: { discord_status: status, discord_user: USER, activities } })
        : route.abort();
    });
    await page.route('**/api/v1/now-playing', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: answer().song ?? { isPlaying: false } })
        : route.abort(),
    );
  }

  /** A poll at a time until the tile shows `words` in `rows` rows: the first may come early. */
  async function untilShown(page: Page, discord: Locator, words: string, rows: number) {
    await expect(async () => {
      await page.clock.fastForward(POLL_MS);
      await expect(discord).toContainText('console', { timeout: 2_000 });
      await expect(discord).toContainText(words, { timeout: 2_000 });
      await expect(discord.locator('ul li')).toHaveCount(rows, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  }

  for (const width of [280, 390, 768, 1024, 1440]) {
    test(`moves no tile and no table row at ${width}px`, async ({ page }) => {
      let activities: readonly object[] = STATES[0].activities;
      await answerPolls(page, () => ({ activities }));
      await page.clock.install();
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const discord = main.locator('[data-stats-tile="discord"]');
      test.skip(
        (await discord.locator('[data-discord-room]').count()) === 0,
        'Discord did not answer the server; there is no live tile to change',
      );

      let before: Record<string, string> | undefined;
      for (const state of STATES) {
        activities = state.activities;
        await untilShown(page, discord, state.shows, state.activities.length);
        const boxes = await tileBoxes(main);
        if (before) expect(boxes, `after: ${state.shows}`).toEqual(before);
        before = boxes;
        expect(await tileEscapes(main)).toEqual([]);
      }
    });
  }

  // Every age on the page is re-read while it stays open. 'updated 9 min ago' turning into
  // 'updated 10 min ago', an hour or a day must not re-wrap a row and move what is under it; the
  // narrowest window is where the hero's age only just fits beside its label.
  for (const width of [280, 390, 1440]) {
    test(`moves nothing as the ages grow at ${width}px`, async ({ page }) => {
      await answerPolls(page, () => ({ activities: [CODE] }));
      await page.clock.install();
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const discord = main.locator('[data-stats-tile="discord"]');
      test.skip(
        (await discord.locator('[data-discord-room]').count()) === 0,
        'Discord did not answer the server; there is no live tile to hold still',
      );
      await untilShown(page, discord, 'Playing Visual Studio Code', 1);
      const before = await tileBoxes(main);

      // An hour in five-minute steps (every wording in minutes), then into hours and days.
      const steps = [...Array.from({ length: 13 }, () => 5 * MINUTE_MS), 5 * HOUR_MS, 30 * HOUR_MS];
      let elapsed = 0;
      for (const step of steps) {
        await page.clock.fastForward(step);
        elapsed += step;
        await expect(discord).toContainText('Playing Visual Studio Code');
        await expect
          .poll(() => tileBoxes(main), { message: `${elapsed / MINUTE_MS} min on` })
          .toEqual(before);
      }
    });
  }

  /**
   * The same with the reader's text enlarged: by the phone alone (Android's text scaling, which
   * Chromium's phone emulation does for text-size-adjust: every line grows and no rem does) or
   * by a doubled browser font (every rem grows, and each row's words drop under its art). The
   * tile's room is measured in lines of its own text, so it holds the tallest state either way;
   * and the status word is laid out in the room of the widest one, so a change of status never
   * moves the head row either.
   */
  test.describe('with the text enlarged', () => {
    test.use({ isMobile: true, hasTouch: true });
    test.skip(
      ({ browserName }) => browserName !== 'chromium',
      'only Chromium’s phone emulation enlarges text this way',
    );

    /** Spotify's own now playing, for the row that leads when Discord reports no listening. */
    const LONG_SONG = {
      isPlaying: true,
      songName:
        'A very long synthetic song title that goes on and on, remastered, live at a synthetic hall (deluxe edition)',
      artistName: 'A synthetic artist with a long name, another artist and a third one featured',
      songURL: 'https://open.spotify.com/track/synthetic',
    };
    /** Every status, then none to three rows short and long, and a long song title. */
    const LARGE_STATES: readonly (Answer & { shows: string })[] = [
      { status: 'online', activities: [CODE], shows: 'Online' },
      { status: 'dnd', activities: [CODE], shows: 'Do not disturb' },
      { status: 'idle', activities: [SONG, CODE], shows: 'Idle' },
      { status: 'dnd', activities: [SONG, CODE, GAME], shows: 'Party of four' },
      { status: 'dnd', activities: [LONG_CODE, LONG_GAME], shows: 'Second Chapter' },
      { status: 'dnd', activities: [SONG, LONG_CODE, LONG_GAME], shows: 'Second Chapter' },
      { status: 'offline', activities: [], shows: 'Offline' },
      { status: 'online', activities: [LONG_CODE], song: LONG_SONG, shows: 'deluxe edition' },
      { status: 'online', activities: [CODE], shows: 'Playing Visual Studio Code' },
    ];
    const SCALES = [
      { width: 360, how: 'text-size-adjust', percent: 115 },
      { width: 390, how: 'text-size-adjust', percent: 130 },
      { width: 390, how: 'text-size-adjust', percent: 150 },
      { width: 390, how: 'text-size-adjust', percent: 200 },
      { width: 390, how: 'font-size', percent: 200 },
    ] as const;

    for (const { width, how, percent } of SCALES) {
      test(`moves no tile at ${width}px with ${how} at ${percent}%`, async ({ page }) => {
        let answer: Answer = { activities: [CODE] };
        await answerPolls(page, () => answer);
        await page.clock.install();
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/stats', 'Stats');
        const discord = main.locator('[data-stats-tile="discord"]');
        test.skip(
          (await discord.locator('[data-discord-room]').count()) === 0,
          'Discord did not answer the server; there is no live tile to change',
        );
        const h1Size = () =>
          main.locator('h1').evaluate((h1) => Number.parseFloat(getComputedStyle(h1).fontSize));
        const plain = await h1Size();
        await page.addStyleTag({
          content:
            how === 'font-size'
              ? `html{font-size:${percent}% !important}`
              : `html{-webkit-text-size-adjust:${percent}% !important;text-size-adjust:${percent}% !important}`,
        });
        // Wait until the enlarged size is in: the h1 grows by the same share.
        await expect.poll(h1Size).toBeGreaterThan(plain * (percent / 100) - 1);

        let before: Record<string, string> | undefined;
        for (const state of LARGE_STATES) {
          answer = state;
          // The fallback song is a row of its own, ahead of what Discord reports.
          const rows = state.activities.length + (state.song ? 1 : 0);
          await untilShown(page, discord, state.shows, rows);
          const boxes = await tileBoxes(main);
          if (before) expect(boxes, `after: ${state.shows}`).toEqual(before);
          before = boxes;
          expect(await tileEscapes(main)).toEqual([]);
        }
        await expectNoOverflow(page);
      });
    }
  });
});

/**
 * The repository table's name and star columns are as wide as the rows the server renders: it
 * counts their characters and hands the counts to the stylesheet (--name-ch and --stars-ch on the
 * section; the unit tests hold that half). Here longer text is swapped into the rendered rows
 * together with the counts the server would set for it, and the columns must hold it.
 */
test.describe('Stats console with a long repository name and a five-digit star count', () => {
  const NAME = 'a-forty-character-repository-name-abcdef';
  const STARS = '12,345';

  for (const width of [280, 390, 768, 1024, 1440]) {
    test(`shows the count whole and keeps the name beside About on one line at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const section = main.locator('section[aria-label="Top repositories"]');
      test.skip((await section.count()) === 0, 'GitHub did not answer; there is no table');
      const firstCount = section.locator('[data-stats-repo] td:last-child').first();

      // React claims the rows in order and puts back any text that differs from what it rendered:
      // once the last row's link carries its props, every row is past that.
      await expect
        .poll(() =>
          section
            .locator('[data-stats-repo] [data-index-link]')
            .last()
            .evaluate((link) => Object.keys(link).some((key) => key.startsWith('__reactProps'))),
        )
        .toBe(true);
      await section.evaluate(
        (element, { name, stars }) => {
          const row = element.querySelector('[data-stats-repo]');
          const title = row?.querySelector('[data-index-link]')?.firstChild;
          const figure = row?.querySelector('td:last-child span');
          if (title) title.textContent = name;
          if (figure) figure.textContent = stars;
          (element as HTMLElement).style.setProperty('--name-ch', String(name.length));
          (element as HTMLElement).style.setProperty('--stars-ch', String(stars.length));
        },
        { name: NAME, stars: STARS },
      );

      await expectNoOverflow(page);
      // The count is inside its cell's padding on both sides, and no ellipsis stands in for it.
      const count = await firstCount.evaluate((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return {
          text: cell.textContent?.trim(),
          pastLeft: text.left < box.left + Number.parseFloat(style.paddingLeft) - 0.5,
          pastRight: text.right > box.right - Number.parseFloat(style.paddingRight) + 0.5,
          ellipsis: style.textOverflow === 'ellipsis' && cell.scrollWidth > cell.clientWidth,
        };
      });
      expect(count).toEqual({ text: STARS, pastLeft: false, pastRight: false, ellipsis: false });
      // Beside a shown About column the forty-character name is on one line.
      expect(await squeezedText(main)).toEqual([]);
      expect(await cutText(main)).toEqual([]);
      // The swapped text stood throughout, so the checks above read it and not the original.
      await expect(firstCount).toHaveText(STARS);
      await expect(section.locator('[data-index-link]').first()).toContainText(NAME);
    });
  }
});

/**
 * On a touch screen the latest commit's headline is a comfortable target over the hero's own
 * link to the profile: 44px even where it fits one line (it was 24px), and nothing on the tile
 * moves for it (its padding is taken back by its margin).
 */
test.describe('Stats console on a touch phone', () => {
  test.use({ isMobile: true, hasTouch: true });
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'only Chromium’s phone emulation reports a coarse pointer here',
  );

  for (const width of [390, 412, 430]) {
    test(`gives the commit headline a 44px target at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/stats', 'Stats');
      const link = main.locator('[data-stats-tile="github"] a[href*="/commit/"]');
      test.skip((await link.count()) === 0, 'GitHub reported no public commit');
      expect(Math.round((await link.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
      expect(await tileEscapes(main)).toEqual([]);
    });
  }
});

/**
 * A phone can enlarge text without changing any length (Android's text scaling in a WebView);
 * Chromium's phone emulation does the same for text-size-adjust. Every tile then takes a row, and
 * no figure, label or digit leaves its box.
 */
test.describe('Stats console with a phone’s text enlarged', () => {
  test.use({ isMobile: true, hasTouch: true });
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'only Chromium’s phone emulation enlarges text this way',
  );

  for (const width of [320, 390, 430]) {
    for (const percent of [150, 200]) {
      test(`keeps every figure in its tile at ${width}px with text at ${percent}%`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/stats', 'Stats');
        await page.addStyleTag({
          content: `html{-webkit-text-size-adjust:${percent}% !important;text-size-adjust:${percent}% !important}`,
        });
        // The h1 is 32px on a phone; wait until the enlarged size is in.
        await expect
          .poll(() =>
            main.locator('h1').evaluate((h1) => Number.parseFloat(getComputedStyle(h1).fontSize)),
          )
          .toBeGreaterThan(40);
        await expectNoOverflow(page);
        expect(await tileRows(main)).toEqual([...TILES]);
        expect(await tileEscapes(main)).toEqual([]);
        expect(await cutText(main)).toEqual([]);
        // A short description under the name gains lines; it is never cut.
        expect(await shortenedDescriptions(main)).toEqual([]);
      });
    }
  }
});
