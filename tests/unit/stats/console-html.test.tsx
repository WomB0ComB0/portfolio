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

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { consoleData, startStatsConsole } = vi.hoisted(() => {
  const keys = [
    'activity',
    'totals',
    'leetcode',
    'typing',
    'codingTime',
    'pageViews',
    'discord',
    'nowPlaying',
  ] as const;
  /** What every source answers, as one object (each test sets it). */
  const consoleData = vi.fn();
  /** The page's sources: each the matching part of what consoleData answers. */
  const startStatsConsole = vi.fn(() => {
    const data: Promise<Record<string, unknown>> = Promise.resolve(consoleData());
    return Object.fromEntries(keys.map((key) => [key, data.then((all) => all[key])]));
  });
  return { consoleData, startStatsConsole };
});
vi.mock('@/app/(routes)/(dev)/stats/_lib/console-loaders', () => ({ startStatsConsole }));
// Reused home tile helpers import their loaders; this test supplies the already-settled data.
vi.mock('@/app/_components/home/data/loaders', () => ({
  loadGitHubActivity: vi.fn(),
  loadLeetCode: vi.fn(),
  loadTyping: vi.fn(),
}));
vi.mock('@/env', () => {
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_DISCORD_ID: '42' };
  return { env, default: env };
});

import type { TileResult } from '@/app/_components/home/data/tile-result';
import { joinMeta } from '@/app/_components/home/tiles/tile-states';
import { MetaRow, metaParts } from '@/app/(routes)/(dev)/stats/_components/console/meta-row';
import { StatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type { StatsConsoleData } from '@/app/(routes)/(dev)/stats/_lib/console-model';
import StatsPage, { metadata } from '@/app/(routes)/(dev)/stats/page';

const AS_OF = '2026-11-10T15:00:00Z';
const ok = <T,>(data: T): TileResult<T> => ({ status: 'ok', data, stale: false, asOf: AS_OF });

/** Representative successful answers; every number must survive a render with no hydration. */
function fixture(): StatsConsoleData {
  return {
    activity: ok({
      total: 4321,
      weeks: [{ start: '2026-11-01', count: 4321 }],
      latestCommit: {
        repo: 'WomB0ComB0/portfolio',
        repoUrl: 'https://github.com/WomB0ComB0/portfolio',
        headline: 'Keep the public figures current',
        url: 'https://github.com/WomB0ComB0/portfolio/commit/abc1234',
        sha: 'abc1234',
        committedAt: AS_OF,
      },
      fetchedAt: AS_OF,
    }),
    totals: ok({
      user: { repos: 324, followers: 190, avatar_url: 'https://example.com/avatar.png' },
      stats: { totalStars: 87, topLanguages: ['TypeScript'] },
      topRepos: Array.from({ length: 8 }, (_, index) => ({
        name: `project-${index + 1}`,
        description: index === 0 ? 'A public project' : null,
        stars: 20 - index,
        language: index === 1 ? null : 'TypeScript',
        url: `https://github.com/WomB0ComB0/project-${index + 1}`,
      })),
    }),
    leetcode: ok({
      totalSolved: 692,
      easySolved: 215,
      mediumSolved: 379,
      hardSolved: 98,
      acceptanceRate: 73.4,
      ranking: 103899,
    }),
    typing: ok({ best60: { wpm: 101, accuracy: 93.2 }, completedTests: 1022 }),
    codingTime: ok({ text: '', digital: '', decimal: '', total_seconds: 15202921 }),
    pageViews: ok(2615),
    discord: {
      kind: 'data',
      fetchedAt: Date.parse(AS_OF),
      data: {
        discord_status: 'online',
        discord_user: { username: 'womb0.comb0', discriminator: '0', avatar: '', id: '42' },
        activities: [{ name: 'Visual Studio Code', type: 0, details: 'portfolio' }],
      },
    },
    nowPlaying: { kind: 'data', data: { isPlaying: false }, fetchedAt: Date.parse(AS_OF) },
  };
}

/**
 * /stats as the browser shows it once every part has streamed in, parsed without hydrating it:
 * prerender waits for each Suspense boundary, and progressiveChunkSize: Infinity keeps each in its
 * place (React's default sends a large part after its skeleton, for its inline script to move).
 */
async function pageHtml(): Promise<HTMLElement> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = await StatsPage();
  const { prelude } = await prerender(
    <QueryClientProvider client={client}>{page}</QueryClientProvider>,
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  );
  const root = document.createElement('div');
  root.innerHTML = await new Response(prelude).text();
  client.clear();
  return root;
}

/** Parses server markup without hydrating it or running any effects. */
function html(node: ReactElement): HTMLElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = document.createElement('div');
  root.innerHTML = renderToString(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
  client.clear();
  return root;
}

const textOf = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

beforeEach(() => {
  consoleData.mockReset().mockResolvedValue(fixture());
  startStatsConsole.mockClear();
});

describe('/stats console server HTML', () => {
  it('renders every final figure once each part has streamed in, with no loading.tsx', async () => {
    const root = await pageHtml();

    expect(startStatsConsole).toHaveBeenCalledOnce();
    expect(metadata.openGraph).toMatchObject({ title: 'Stats' });
    expect(String(metadata.openGraph?.url)).toMatch(/\/stats$/);
    expect(textOf(root.querySelector('h1'))).toBe('Stats');
    expect(textOf(root.querySelector('[data-stats-tile="github"]'))).toContain('4,321');
    expect(textOf(root.querySelector('[data-stats-tile="github"]'))).toContain('87');
    expect(textOf(root.querySelector('[data-stats-tile="leetcode"]'))).toContain('692');
    expect(textOf(root.querySelector('[data-stats-tile="typing"]'))).toContain('101');
    expect(root.querySelector('[data-gauge]')).toBeNull();
    expect(textOf(root.querySelector('[data-stats-tile="coding"]'))).toContain('4,223');
    expect(textOf(root)).toContain('2,615');
    expect(root.querySelector('[aria-busy="true"], div[hidden][id^="S:"]')).toBeNull();
    expect(existsSync(join(process.cwd(), 'src/app/(routes)/(dev)/stats/loading.tsx'))).toBe(false);
  });

  // Audit 2026-11-20 polish: the GitHub and Discord headings, and the regions they name, read
  // "GitHub profile (opens in a new tab)": the link sat inside the heading. The link wraps the
  // heading instead, so the region and heading are the title alone and the link says the rest.
  it.each([
    ['github', 'GitHub', 'https://github.com/WomB0ComB0'],
    ['discord', 'Discord', 'https://discord.com/users/42'],
  ])(
    'names the %s tile by its title, the link around its heading saying where it goes',
    async (tile, title, href) => {
      const root = await pageHtml();
      const section = root.querySelector(`[data-stats-tile="${tile}"]`);
      const heading = section?.querySelector('h2');
      const link = heading?.closest('a');
      // Without NewTabArrow's invisible U+2060 WORD JOINER, which no name includes.
      const words = (element: Element | null | undefined): string =>
        textOf(element).replace(/⁠/g, '');

      expect(section?.tagName).toBe('SECTION');
      expect(root.querySelector(`#${section?.getAttribute('aria-labelledby')}`)).toBe(heading);
      expect(words(heading)).toBe(title);
      expect(link?.getAttribute('href')).toBe(href);
      expect(words(link)).toBe(`${title} profile (opens in a new tab)`);
    },
  );

  it('renders the Discord snapshot and latest commit before the client polls', async () => {
    const root = await pageHtml();
    const discord = root.querySelector('[data-stats-tile="discord"]');

    expect(textOf(discord)).toContain('Online');
    expect(textOf(discord)).toContain('Playing Visual Studio Code');
    expect(textOf(discord)).toContain('womb0.comb0');
    expect(root.querySelector('a[href$="/commit/abc1234"]')).not.toBeNull();
    expect(discord?.querySelector('time')).not.toBeNull();
  });

  it('shows six ranked repository rows with external links and no description filler', async () => {
    const root = await pageHtml();
    const rows = root.querySelectorAll('[data-stats-repo]');

    expect(rows).toHaveLength(6);
    expect(textOf(rows[0])).toContain('project-1');
    expect(textOf(rows[0])).toContain('A public project');
    expect(rows[0]?.querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(rows[0]?.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(textOf(rows[1])).not.toContain('No description');
    expect(textOf(root.querySelector('table'))).toContain('Stars');
  });

  it('keeps failures local and never prints an invented zero for a missing source', async () => {
    consoleData.mockResolvedValue({
      ...fixture(),
      activity: { status: 'error' },
      totals: { status: 'error' },
      typing: { status: 'empty' },
      codingTime: { status: 'error' },
      discord: { kind: 'timeout' },
    });
    const root = await pageHtml();

    expect(textOf(root)).toContain('GitHub stats unavailable');
    expect(textOf(root)).toContain('No 60 s test yet');
    expect(textOf(root)).toContain('Coding time unavailable');
    expect(textOf(root)).toContain('Discord didn’t answer in time');
    expect(textOf(root)).toContain('Repositories unavailable');
    expect(textOf(root.querySelector('[data-stats-tile="leetcode"]'))).toContain('692');
    expect(root.querySelectorAll('[data-stats-repo]')).toHaveLength(0);
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('marks stale figures and keeps the last successful values', async () => {
    const data = fixture();
    if (data.typing.status !== 'ok') throw new Error('fixture must have typing');
    consoleData.mockResolvedValue({ ...data, typing: { ...data.typing, stale: true } });
    const root = await pageHtml();
    const typing = root.querySelector('[data-stats-tile="typing"]');

    expect(typing?.getAttribute('data-state')).toBe('stale');
    expect(textOf(typing)).toContain('101');
    expect(textOf(typing)).toContain('Stale');
  });
});

describe('/stats console layout (browser QA fixes)', () => {
  const classOf = (element: Element | null | undefined) => element?.getAttribute('class') ?? '';
  /** True when `name` is one of the element's own classes (not a prefix of a longer one). */
  const hasClass = (element: Element | null | undefined, name: string) =>
    classOf(element).split(/\s+/).includes(name);

  it('keeps every context separator inside the part it leads, never as an item of its own', async () => {
    const root = await pageHtml();
    const leetcode = root.querySelector('[data-stats-tile="leetcode"] [data-context-line]');
    const parts = [...(leetcode?.querySelectorAll('[data-context-part]') ?? [])];

    // Words, words, age: the line still reads with its separators as text.
    expect(parts).toHaveLength(3);
    expect(textOf(leetcode)).toMatch(/^73\.4% acceptance · rank 103,899 · updated /);
    expect(textOf(parts[0])).not.toContain('·');
    for (const part of parts.slice(1)) expect(textOf(part)).toMatch(/^· \S/);
    // The line clips the separator of whichever part starts a row.
    expect(classOf(leetcode)).toContain('overflow-hidden');
    for (const name of ['leetcode', 'typing', 'coding']) {
      const line = root.querySelector(`[data-stats-tile="${name}"] [data-context-line]`);
      expect(line, name).not.toBeNull();
      const lone = [...(line?.parentElement?.children ?? [])].filter(
        (child) => textOf(child) === '·',
      );
      expect(lone, name).toHaveLength(0);
    }
    expect(textOf(root.querySelector('[data-stats-tile="coding"] [data-context-line]'))).toMatch(
      /^all time · updated /,
    );
  });

  it('holds a context line’s age in the room of its widest wording, so the line never re-wraps as the age grows', async () => {
    const root = await pageHtml();

    for (const name of ['leetcode', 'typing', 'coding']) {
      const line = root.querySelector(`[data-stats-tile="${name}"] [data-context-line]`);
      const room = line?.querySelector('[data-age-room]');
      const age = room?.querySelector('time');

      // The age is re-read every 30 s. Its box is as wide as the widest age there is, laid out
      // (never shown, never in the document's text) in the same cell as the age itself: '9 min'
      // turning into '10 min' cannot push the part to a new line and grow the tile.
      expect(room?.getAttribute('data-widest'), name).toBe('updated 59 min ago');
      expect(hasClass(room, 'inline-grid'), name).toBe(true);
      expect(hasClass(room, 'before:invisible'), name).toBe(true);
      expect(hasClass(room, 'before:content-[attr(data-widest)]'), name).toBe(true);
      expect(hasClass(room, 'before:col-start-1'), name).toBe(true);
      expect(hasClass(room, 'before:row-start-1'), name).toBe(true);
      expect(hasClass(age, 'col-start-1'), name).toBe(true);
      expect(hasClass(age, 'row-start-1'), name).toBe(true);
      // The line still reads as before: the widest wording is not text of the page.
      expect(textOf(room), name).toMatch(/^updated \d+ (min|h|d) ago$|^updated just now$/);
      expect(textOf(line), name).not.toContain('59 min');
    }
  });

  // The page's own hero keeps its age in the same room (age-room.test.tsx holds the details).
  it('holds the hero’s age in a room too, so its head never re-wraps as the age grows', async () => {
    const root = await pageHtml();
    const head = root.querySelector('[data-stats-tile="github"]')?.firstElementChild;
    const room = head?.querySelector('[data-age-room]');

    expect(room?.getAttribute('data-widest')).toBe('updated 59 min ago');
    expect(room?.querySelector('time')).not.toBeNull();
    expect(textOf(head)).not.toContain('59 min');
  });

  it('anchors every secondary figure under its label, so a row of tiles lines up', async () => {
    const root = await pageHtml();
    for (const name of ['leetcode', 'typing', 'coding']) {
      const figure = root.querySelector(`[data-stats-tile="${name}"] .figure-row`);
      expect(classOf(figure?.parentElement), name).toContain('justify-start');
      expect(classOf(figure?.parentElement), name).not.toContain('justify-end');
    }
  });

  // Beside the kit's stale note a half-width phone tile leaves the line about 30px: it must drop
  // under the note instead of clipping its words.
  it('gives the context line a basis, so it wraps under a stale note in a narrow tile', async () => {
    const root = await pageHtml();
    for (const name of ['leetcode', 'typing', 'coding']) {
      const line = classOf(root.querySelector(`[data-stats-tile="${name}"] [data-context-line]`));
      expect(line, name).toContain('flex-[1_1_8rem]');
      expect(line, name).toContain('min-w-0');
    }
  });

  it('lets the gauge’s word wrap under the ring in a narrow tile', async () => {
    const root = html(<StatsConsole data={fixture()} profileId="42" accuracy="gauge" />);
    const row = root.querySelector('[data-gauge]')?.parentElement;

    expect(classOf(row)).toContain('flex-wrap');
  });

  it('lets the repositories bar grow on a phone page instead of overflowing its 40 px', async () => {
    const root = await pageHtml();
    const section = root.querySelector('section[aria-label="Top repositories"]');

    const bar = section?.querySelector('[data-index-part="year"]');

    expect(classOf(bar)).toContain('@max-[40rem]/page:h-auto');
    expect(classOf(bar)).toContain('@max-[40rem]/page:flex-wrap');
  });

  it('fills the Discord tile’s height when there is no activity', async () => {
    const data = fixture();
    if (data.discord.kind !== 'data') throw new Error('fixture must have Discord');
    consoleData.mockResolvedValue({
      ...data,
      discord: { ...data.discord, data: { ...data.discord.data, activities: [] } },
    });
    const root = await pageHtml();
    const idle = root.querySelector('[data-stats-tile="discord"] [data-discord-idle]');

    expect(textOf(idle)).toBe('Not in an activity right now');
    expect(classOf(idle)).toContain('flex-1');
    expect(classOf(idle?.parentElement)).toContain('flex-1');
  });

  it('wraps the commit headline instead of cutting it, and keeps its age whole', async () => {
    const root = await pageHtml();
    const link = root.querySelector('a[href$="/commit/abc1234"]');
    const headline = link?.querySelector('[aria-hidden="true"]');
    const dated = link?.closest('div')?.querySelector('[data-dated]');

    // The new-tab arrow is glued to the last word by a word joiner, inside the headline.
    expect(textOf(headline).replace('\u2060', '')).toBe('Keep the public figures current');
    expect(headline?.querySelector('[data-new-tab-arrow]')).not.toBeNull();
    expect(classOf(headline)).toContain('line-clamp-2');
    expect(classOf(headline)).not.toContain('truncate');
    expect(textOf(dated)).toMatch(/^Latest commit · portfolio · \S/);
    const age = dated?.querySelector('[data-commit-age]');
    expect(textOf(age)).not.toBe('');
    // The line wraps part by part; nothing in it is cut, and the age never breaks inside.
    expect(dated?.querySelector('.truncate')).toBeNull();
    expect(dated?.querySelectorAll('[data-context-part]')).toHaveLength(3);
    expect(classOf(age)).toContain('whitespace-nowrap');
  });

  it('gives the commit link a 24 px target, 44 px on touch, without moving the line', async () => {
    const root = await pageHtml();
    const link = root.querySelector('a[href$="/commit/abc1234"]');

    expect(hasClass(link, '-my-0.5')).toBe(true);
    expect(hasClass(link, 'py-0.5')).toBe(true);
    // A coarse pointer gets 12px over and under a one-line headline's 20px, taken back by the
    // margin, so the target grows and nothing on the tile moves.
    expect(hasClass(link, 'pointer-coarse:-my-3')).toBe(true);
    expect(hasClass(link, 'pointer-coarse:py-3')).toBe(true);
  });
});

describe('/stats console responsive layout (space-led, not viewport-led)', () => {
  const classOf = (element: Element | null | undefined) => element?.getAttribute('class') ?? '';
  const tile = (root: HTMLElement, name: string) =>
    root.querySelector(`[data-stats-tile="${name}"]`);
  /** True when `name` is one of the element's own classes (not a prefix of a longer one). */
  const hasClass = (element: Element | null | undefined, name: string) =>
    classOf(element).split(/\s+/).includes(name);

  it('starts the 12-column tier only once the hero has room for its wide layout', async () => {
    const root = await pageHtml();
    const grid = classOf(root.querySelector('[aria-label="Activity and development stats"]'));

    // A 56rem tier put a hero too narrow for its side-by-side layout beside Discord; at the kit's
    // 70rem its 8 columns hold the whole of it. The step is the kit's own: nothing is neutralised.
    expect(grid).toContain('@[70rem]/tiles:grid-cols-12');
    expect(grid).not.toContain('@4xl/');
    expect(grid).not.toContain('67.5rem');
    expect(classOf(tile(root, 'github'))).toContain('@[70rem]/tiles:col-span-8');
    // The hero ends a row lower than Discord there (console-fit.test.tsx holds that tier).
    expect(classOf(tile(root, 'github'))).toContain('@[70rem]/tiles:row-span-3');
    expect(classOf(tile(root, 'discord'))).toContain('@[70rem]/tiles:row-span-2');
    for (const name of ['github', 'discord', 'leetcode', 'typing', 'coding']) {
      expect(classOf(tile(root, name)), name).not.toContain('@4xl/tiles:');
    }
  });

  it('stands Discord beside the three stat tiles on a tablet grid, so no tile is stretched', async () => {
    const root = await pageHtml();
    const grid = root.querySelector('[aria-label="Activity and development stats"]');

    // The hero is the whole row whatever the column count, until the 12-column tier.
    expect(hasClass(tile(root, 'github'), 'col-span-full')).toBe(true);
    expect(classOf(tile(root, 'github'))).not.toContain('@xl/tiles:col-span-6');
    // From 31.5 lines of the grid's text (819px at the default size) the grid has 12 columns below
    // the hero: Discord, always as tall as its room, takes half of them over two rows; LeetCode
    // has the other half, and typing and coding a quarter each under it. Nothing beside Discord
    // is stretched to its height: a quarter that narrow holds typing's context in three lines
    // (from 27lh it took four, and stretched Discord to 408px). The step is in lh, so enlarged
    // text falls back to the stack. From 34.5lh the half under LeetCode splits three fifths and
    // two (its columns weigh 1.2 and 0.8, so Discord and LeetCode keep their halves), until the
    // kit's own 12 columns at 70rem.
    expect(hasClass(grid, '@min-[31.5lh]/tiles:@max-[34.5lh]/tiles:grid-cols-12!')).toBe(true);
    expect(
      hasClass(
        grid,
        '@min-[34.5lh]/tiles:@max-[70rem]/tiles:grid-cols-[repeat(6,minmax(0,1fr))_repeat(3,minmax(0,1.2fr))_repeat(3,minmax(0,0.8fr))]!',
      ),
    ).toBe(true);
    expect(hasClass(tile(root, 'discord'), '@min-[31.5lh]/tiles:row-span-2')).toBe(true);
    expect(classOf(grid)).not.toContain('27lh');
    // Under that step the same spans are a 6-column stack: Discord and LeetCode a row each,
    // typing and coding the next, in shares of two thirds and one (stats-tiles.spec.ts walks it).
    for (const name of ['discord', 'leetcode']) {
      expect(hasClass(tile(root, name), '@xl/tiles:col-span-6'), name).toBe(true);
    }
    for (const name of ['typing', 'coding']) {
      expect(hasClass(tile(root, name), '@xl/tiles:col-span-3'), name).toBe(true);
    }
    for (const name of ['discord', 'leetcode']) {
      expect(hasClass(tile(root, name), '@[70rem]/tiles:col-span-4'), name).toBe(true);
    }
  });

  // The step is measured in lines of the grid's own text (lh), not rem: a phone that enlarges
  // text without changing any length moves it, so the halves give way to a row each.
  // From 15 lines (390px) a half holds typing's context in three lines; from the kit's 13.5lh
  // (351px) it took four, with a hole beside it in coding time.
  it('gives typing and coding a row each until two halves hold their figures and context at the text size in use', async () => {
    const root = await pageHtml();
    for (const name of ['typing', 'coding']) {
      expect(hasClass(tile(root, name), 'col-span-2'), name).toBe(true);
      expect(hasClass(tile(root, name), '@min-[15lh]/tiles:@max-xl/tiles:col-span-1'), name).toBe(
        true,
      );
      expect(classOf(tile(root, name)), name).not.toContain('13.5lh');
      expect(classOf(tile(root, name)), name).not.toContain('@[21rem]/tiles:col-span-1');
    }
    expect(classOf(tile(root, 'leetcode'))).not.toContain(':col-span-1');
  });

  it('sizes every figure by its tile, capped so it always fits', async () => {
    const root = await pageHtml();
    const display = classOf(tile(root, 'github')?.querySelector('p > span'));

    // One cap on both sides of the 6 to 12 column step, and never wider than a third of the tile.
    expect(display).toContain('4.625rem');
    expect(display).toContain('33cqi');
    expect(display).not.toContain('6rem');
    // In a tile under seven lines of its own text wide (a phone with enlarged text) the figure is
    // a fifth of the tile, so twice the size still fits.
    expect(display).toContain('@max-[7lh]:text-[length:clamp(min(2.25rem,33cqi),19cqi,3.5rem)]');
    // A fifth of the tile: five digits and the unit stay on one line in half a phone row, and in
    // a quarter of a tablet grid, whose tile is narrower inside (so the floor is 24px, not 28px).
    for (const name of ['leetcode', 'typing', 'coding']) {
      // The kit's fit tier (StatTile size="fit"), on the figure row itself beside figure-md.
      const figure = tile(root, name)?.querySelector('.figure-row');
      expect(hasClass(figure, 'text-[length:clamp(1.5rem,20cqi,2.25rem)]'), name).toBe(true);
      expect(hasClass(figure, 'figure-md'), name).toBe(true);
    }
  });

  it('splits the header strip into equal parts across its row, each never narrower than its figure', async () => {
    const root = await pageHtml();
    const strip = root.querySelector('dl[aria-label="At a glance"]');

    // Under the title: equal parts across the row, as on the shipped pages, but as a wrapping row
    // whose items cannot shrink below their figure, so no figure crosses its divider and the last
    // item takes a new row only when the three cannot fit at their narrowest.
    // The kit's container-sized strip (StatStrip sizing="container"): the items carry the classes.
    const items = [...(strip?.children ?? [])];
    expect(hasClass(strip, 'flex')).toBe(true);
    expect(hasClass(strip, 'grid')).toBe(false);
    expect(classOf(strip)).toContain('flex-wrap');
    for (const item of items) {
      expect(hasClass(item, 'flex-[1_1_0]')).toBe(true);
      expect(hasClass(item, 'min-w-min')).toBe(true);
      // Beside the title each item is as wide as its words.
      expect(hasClass(item, '@min-[29lh]/page:flex-none')).toBe(true);
    }
    // The divider of whichever item starts a row is clipped by the wrapper: the first keeps its.
    expect(classOf(items[0])).not.toContain('first:border-l-0');
    expect(classOf(strip?.parentElement)).toContain('overflow-x-clip');
    expect(strip?.querySelectorAll('dt')).toHaveLength(3);
  });

  it('puts the strip beside the title by the page’s width in lines of text, never by the viewport', async () => {
    const root = await pageHtml();
    const header = root.querySelector('h1')?.closest('header');
    const shell = header?.parentElement;

    // One step, shared with the strip's own switch above (29 lines, 754px at the default text
    // size); enlarged text moves it, so the title is never squeezed beside the strip.
    // The kit's container-sized header (PageShell sizing="container"): no md step, short-screen gaps.
    expect(hasClass(header, '@min-[29lh]/page:grid-cols-[minmax(0,1fr)_auto]')).toBe(true);
    expect(`${classOf(shell)} ${classOf(header)}`).not.toMatch(/(?:^|\s)md:/);
    expect(hasClass(shell, '[@media(max-height:30rem)]:gap-2')).toBe(true);
  });

  it('drops the latest commit to its own row unless its meta line fits beside the totals', async () => {
    const root = await pageHtml();
    const link = root.querySelector('a[href$="/commit/abc1234"]');
    const commit = link?.closest('div');
    const foot = commit?.parentElement;
    const totals = foot?.querySelector('dl');

    // A wrapping row sized by its content, not a tile-width query: the commit asks for the width
    // of its meta line (the headline asks for none and fills what the commit gets), so beside the
    // totals it is never a sliver, and when both do not fit it takes the row under them.
    expect(hasClass(foot, 'flex')).toBe(true);
    expect(hasClass(foot, 'flex-wrap')).toBe(true);
    expect(classOf(foot)).not.toContain('grid-cols');
    expect(hasClass(commit, 'flex-[1_1_auto]')).toBe(true);
    expect(hasClass(link?.parentElement, 'w-0')).toBe(true);
    expect(hasClass(link?.parentElement, 'min-w-full')).toBe(true);
    // The totals take every spare pixel of a shared row, so the commit rests against the edge.
    expect(hasClass(totals, 'flex-[9999_1_auto]')).toBe(true);
  });

  it('lets the sparkline’s two labels wrap instead of running into each other', async () => {
    const root = await pageHtml();
    const labels = tile(root, 'github')?.querySelector('[data-sparkline] + p');

    expect(textOf(labels)).toMatch(/weeks ago\s*this week/);
    expect(hasClass(labels, 'flex-wrap')).toBe(true);
  });

  it('wraps the hero’s head row and balances the commit headline', async () => {
    const root = await pageHtml();
    const hero = tile(root, 'github');
    const headline = root.querySelector('a[href$="/commit/abc1234"] [aria-hidden="true"]');

    expect(classOf(hero?.firstElementChild)).toContain('flex-wrap');
    expect(classOf(headline)).toContain('text-balance');
    expect(classOf(headline)).toContain('@max-[10lh]:line-clamp-4');
  });

  it('gives the hero less air above its figure on a short screen', async () => {
    const root = await pageHtml();
    const hero = tile(root, 'github');
    const figure = hero?.querySelector('p > span');

    // Only below the 12-column tier: a short desktop window (1280 x 460) keeps the wide hero,
    // whose chart takes the height beside Discord, rather than a phone-on-its-side figure.
    const short = '@max-[70rem]/tiles:[@media(max-height:30rem)]';
    expect(hasClass(hero, `${short}:gap-2`)).toBe(true);
    expect(hasClass(hero, `${short}:p-5!`)).toBe(true);
    // The figure starts its row instead of resting on the taller sparkline's foot.
    expect(hasClass(figure?.closest('div'), `${short}:items-start!`)).toBe(true);
    expect(hasClass(hero?.querySelector('[data-sparkline]'), `${short}:h-20!`)).toBe(true);
    expect(classOf(hero)).not.toMatch(/(^|\s)\[@media\(max-height:30rem\)\]/);
  });

  it('never cuts the Discord status word, the name or an activity’s words', async () => {
    const root = await pageHtml();
    const discord = tile(root, 'discord');
    const head = discord?.firstElementChild;
    const status = head?.querySelector('p');

    expect(textOf(status)).toBe('Online');
    expect(classOf(head)).toContain('flex-wrap');
    expect(hasClass(status, 'shrink-0')).toBe(false);
    expect(discord?.querySelector('.truncate')).toBeNull();
    const row = discord?.querySelector('ul li > *');
    expect(classOf(row)).toContain('flex-wrap');
    expect(textOf(row)).toContain('Playing Visual Studio Code');
  });

  /** The page with Discord reporting `activities`. */
  const discordWith = async (
    activities: readonly { name: string; type: number; details?: string; state?: string }[],
  ) => {
    const data = fixture();
    if (data.discord.kind !== 'data') throw new Error('fixture must have Discord');
    consoleData.mockResolvedValue({
      ...data,
      discord: { ...data.discord, data: { ...data.discord.data, activities: [...activities] } },
    });
    return tile(await pageHtml(), 'discord');
  };
  const CODE = { name: 'Visual Studio Code', type: 0, details: 'portfolio', state: 'Workspace' };
  const TALK = { name: 'YouTube', type: 3, details: 'A talk', state: 'A channel' };
  const SONG = { name: 'Spotify', type: 2, details: 'A song', state: 'An artist' };

  // The room's height in every state, and the tile's while Discord has not answered, are held in
  // console-fit.test.tsx: both are measured in lines of the tile's own text.

  it('features a lone activity in the room at every tier, and lists several compactly', async () => {
    const list = (await discordWith([CODE]))?.querySelector('ul');

    // One activity (the usual state) is centred in the room with larger art. The art answers to
    // the tile's own width (40px in the narrowest tile, 96px from a 20rem one), never to the grid.
    expect(list?.getAttribute('data-solo')).toBe('');
    expect(hasClass(list, 'grow')).toBe(true);
    expect(hasClass(list, 'justify-center')).toBe(true);
    expect(
      hasClass(list?.querySelector('[data-row-glyph]'), 'size-[clamp(2.5rem,30cqi,6rem)]'),
    ).toBe(true);
    // A long title has the art's height to fill: three lines before it is shortened.
    expect(hasClass(list?.querySelector('.tile-meta'), 'line-clamp-3')).toBe(true);
    expect(list?.innerHTML).not.toContain('/tiles:');
    expect(list?.innerHTML).not.toContain('--lone-');

    const pair = (await discordWith([CODE, TALK]))?.querySelector('ul');

    expect(pair?.querySelectorAll('li')).toHaveLength(2);
    expect(pair?.hasAttribute('data-solo')).toBe(false);
    expect(hasClass(pair, 'grow')).toBe(false);
    expect(hasClass(pair?.querySelector('[data-row-glyph]'), 'size-10')).toBe(true);
    expect(classOf(pair?.querySelector('[data-row-glyph]'))).not.toContain('cqi');
    // Two rows keep a second line for the heading and for a long title before either is
    // shortened; the last detail has one, so any two such rows fit the room.
    const [heading, title, last] =
      pair?.querySelectorAll('li:first-child .tile-sub, li:first-child .tile-meta') ?? [];
    expect(hasClass(heading, 'line-clamp-2')).toBe(true);
    expect(hasClass(title, 'line-clamp-2')).toBe(true);
    expect(hasClass(last, 'line-clamp-1')).toBe(true);
  });

  it('gives each line of three activities one line, so three always fit the room', async () => {
    const full = (await discordWith([SONG, CODE, TALK]))?.querySelector('ul');
    const lines = [...(full?.querySelectorAll('li .tile-sub, li .tile-meta') ?? [])];

    expect(full?.querySelectorAll('li')).toHaveLength(3);
    // A heading and two details for each row: nine lines, none of them allowed a second.
    expect(lines).toHaveLength(9);
    for (const line of lines) {
      expect(hasClass(line, 'line-clamp-1'), textOf(line)).toBe(true);
      expect(hasClass(line, 'line-clamp-2'), textOf(line)).toBe(false);
    }
  });

  it('breaks a word wider than the hero instead of widening its row past the tile', async () => {
    const root = await pageHtml();
    const figure = tile(root, 'github')?.querySelector('p > span');
    const unit = figure?.nextElementSibling;

    // Stacked, the figure's column is the tile's width whatever its longest word, and the words
    // under a figure ('contributions', 'repositories') may break inside as a last resort.
    expect(hasClass(figure?.closest('div'), 'grid-cols-[minmax(0,1fr)]')).toBe(true);
    expect(textOf(unit)).toMatch(/^contributions in the last \d+ weeks$/);
    expect(hasClass(unit, '[overflow-wrap:anywhere]')).toBe(true);
    for (const label of tile(root, 'github')?.querySelectorAll('dl dt') ?? []) {
      expect(hasClass(label, '[overflow-wrap:anywhere]'), textOf(label)).toBe(true);
      expect(hasClass(label.parentElement, 'min-w-0'), textOf(label)).toBe(true);
    }
  });

  it('gives the repository table an About column and wrapping names', async () => {
    const root = await pageHtml();
    const table = root.querySelector('table');
    const labels = [...(table?.querySelectorAll('th') ?? [])].map((th) => textOf(th));
    const rows = [...root.querySelectorAll('[data-stats-repo]')];
    const cells = [...(rows[0]?.querySelectorAll('td') ?? [])];
    const link = rows[0]?.querySelector('a');

    expect(labels).toEqual(['#', 'Repository', 'About', 'Language', 'Stars']);
    expect(cells).toHaveLength(5);
    expect(textOf(cells[2])).toBe('A public project');
    // A row without a description has an empty About cell, never filler.
    expect(textOf(rows[1]?.querySelectorAll('td')[2])).toBe('');
    // The name wraps instead of being cut, and a phone row keeps the description.
    expect(hasClass(link, 'truncate')).toBe(false);
    expect(hasClass(link, 'whitespace-normal')).toBe(true);
    expect(link?.querySelector('.truncate')).toBeNull();
    const phoneLine = cells[1]?.querySelector('[data-repo-about]');
    expect(textOf(phoneLine)).toBe('A public project');
    expect(hasClass(phoneLine, 'hidden')).toBe(false);
    expect(classOf(phoneLine)).toContain('@min-[38lh]/page:hidden');
  });

  it('sizes the name and star columns from the rows shown, in characters of the text in use', async () => {
    const root = await pageHtml();
    const cols = [...root.querySelectorAll('table col')].map((col) => classOf(col));
    const section = root.querySelector('section[aria-label="Top repositories"]');

    // Beside About the name column is as wide as the longest name shown (--name-ch characters, its
    // arrow and the cell's padding), never under 29% of the page nor over 42% of it (about 45% of
    // the table), so About keeps its room and a longer name wraps there instead.
    expect(cols[1]).toBe(
      '@min-[38lh]/page:w-[clamp(29cqi,calc(var(--name-ch,24)*0.75ch+2.5rem),42cqi)]',
    );
    // The digit columns are measured in digits (ch), so enlarged text is not clipped; the stars
    // column counts the characters of the widest count shown.
    expect(cols[0]).toContain('w-[calc(1ch+1rem)]');
    expect(cols[4]).toContain('w-[calc(var(--stars-ch,4)*1ch+0.75rem)]');
    expect(cols[4]).toContain('@max-[20rem]/page:w-[calc((var(--stars-ch,4)_-_1)*1ch+0.75rem)]');
    expect(cols[4]).toContain('@min-[40rem]/page:w-[calc(var(--stars-ch,4)*1ch+1.25rem)]');
    // The fixture's names are 9 characters and its counts two digits: both columns at their floor.
    expect(section?.getAttribute('style')).toMatch(/--name-ch:\s*16\b/);
    expect(section?.getAttribute('style')).toMatch(/--stars-ch:\s*4\b/);
  });

  it('widens the star column for a five-digit count and the name column for a long name', async () => {
    const data = fixture();
    if (data.totals.status !== 'ok') throw new Error('fixture must have totals');
    const [first, ...rest] = data.totals.data.topRepos;
    if (!first) throw new Error('fixture must have repositories');
    const longName = 'a-forty-character-repository-name-abcdef';
    consoleData.mockResolvedValue({
      ...data,
      totals: {
        ...data.totals,
        data: {
          ...data.totals.data,
          topRepos: [{ ...first, name: longName, stars: 12345 }, ...rest],
        },
      },
    });
    const root = await pageHtml();
    const section = root.querySelector('section[aria-label="Top repositories"]');
    const stars = root.querySelector('[data-stats-repo] td:last-child');

    expect(textOf(stars)).toBe('12,345');
    // '12,345' is six characters and the name forty: the columns are told so.
    expect(section?.getAttribute('style')).toMatch(/--stars-ch:\s*6\b/);
    expect(section?.getAttribute('style')).toMatch(/--name-ch:\s*40\b/);
    // A figure is never cut: were the column ever too narrow, the count would show whole.
    expect(hasClass(stars, 'overflow-visible')).toBe(true);
    expect(hasClass(stars, 'overflow-hidden')).toBe(false);
    expect(hasClass(stars, 'text-ellipsis')).toBe(false);
  });

  it('unpins the repository bars on a short screen', async () => {
    const root = await pageHtml();
    const section = root.querySelector('section[aria-label="Top repositories"]');
    const bar = section?.querySelector('[data-index-part="year"]');

    const unpinned = '[@media(max-height:30rem)]:relative';
    // The kit's pin="tall-screens": the bar and each of the five labels carry it themselves.
    expect(classOf(bar)).toContain(unpinned);
    expect(section?.querySelectorAll(`th[class~="${unpinned}"]`)).toHaveLength(5);
  });
});

describe('MetaRow (a context line that wraps part by part)', () => {
  it('splits a joined line into its parts and appends the extra ones', () => {
    const age = { key: 'age', body: 'updated 3 h ago' };

    expect(metaParts(joinMeta(['60 s best', '1,022 tests']), [age])).toEqual([
      { key: '60 s best', body: '60 s best' },
      { key: '1,022 tests', body: '1,022 tests' },
      age,
    ]);
    expect(metaParts('', [age])).toEqual([age]);
    expect(metaParts('')).toEqual([]);
  });

  it('leads every part after the first with its separator, inside the part', () => {
    const root = html(<MetaRow parts={metaParts(joinMeta(['Latest commit', 'portfolio']))} />);
    const parts = [...root.querySelectorAll('[data-context-part]')];

    expect(parts).toHaveLength(2);
    expect(textOf(parts[0])).toBe('Latest commit');
    expect(textOf(parts[1])).toBe('· portfolio');
    expect(textOf(root)).toBe('Latest commit · portfolio');
    // The line clips the separator of whichever part starts a row; a long word breaks inside.
    expect(root.querySelector('[data-context-line]')?.getAttribute('class')).toContain(
      'overflow-hidden',
    );
    expect(parts[1]?.lastElementChild?.getAttribute('class')).toContain('[overflow-wrap:anywhere]');
  });

  // em does not follow a phone's text scaling (ch does), so an em-wide separator box ended up
  // narrower than its dot's own spaces and the words closed in on it.
  it('sizes the separator, the row’s pull and the first part’s inset by the text itself', () => {
    const root = html(<MetaRow parts={metaParts(joinMeta(['Latest commit', 'portfolio']))} />);
    const [first, second] = [...root.querySelectorAll('[data-context-part]')];
    const row = first?.parentElement;

    expect(row?.getAttribute('class')).toContain('-ml-[1.1ch]');
    expect(first?.getAttribute('class')).toContain('pl-[1.1ch]');
    expect(second?.firstElementChild?.getAttribute('class')).toContain('w-[1.1ch]');
    expect(root.innerHTML).not.toContain('0.75em');
  });

  it('renders nothing without parts', () => {
    expect(html(<MetaRow parts={[]} />).innerHTML).toBe('');
  });
});
