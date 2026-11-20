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
 * @file /stats streamed part by part (StreamedStatsConsole), read from its server HTML alone:
 * - the page waits for its sources FIRST_FLUSH_WAIT_MS at most, never a source's deadline;
 * - a part whose sources answered within that wait is rendered in place, with no Suspense
 *   boundary, so it is in the first HTML where it belongs and reads without JavaScript;
 * - any other part streams behind its skeleton, in the order and the grid place the loaded part
 *   takes, and waits on its own sources only: the GitHub totals hold back the strip, the hero and
 *   the repositories and nothing else, and a hung LeetCode holds back LeetCode alone;
 * - once every part is in, the figures are final, as the whole console renders them.
 *
 * renderToString gives the first flush (every async part shows its fallback); prerender waits
 * for each boundary, or, aborted, ends with the parts still waiting on their fallbacks, as the
 * stream stands at that moment. progressiveChunkSize: Infinity keeps a finished part in place.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { startStatsConsole } = vi.hoisted(() => ({ startStatsConsole: vi.fn() }));
vi.mock('@/app/(routes)/(dev)/stats/_lib/console-loaders', () => ({ startStatsConsole }));
// The tiles reuse home tile helpers, which import their loaders; nothing is loaded here.
vi.mock('@/app/_components/home/data/loaders', () => ({
  loadGitHubActivity: vi.fn(),
  loadLeetCode: vi.fn(),
  loadTyping: vi.fn(),
}));
vi.mock('@/env', () => {
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_DISCORD_ID: '42' };
  return { env, default: env };
});

import { StreamedStatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type {
  StatsConsoleData,
  StatsConsoleSources,
} from '@/app/(routes)/(dev)/stats/_lib/console-model';
import StatsPage from '@/app/(routes)/(dev)/stats/page';
import { ageOn, formatExactAge } from '@/constants/age';
import { FIRST_FLUSH_WAIT_MS } from '@/lib/async/settled-within';
import { classOf, consoleFixture, NOW, textOf, tileOf } from './console-fixture';

/** The grid's tiles in reading order; the repository table follows the grid. */
const GRID_PARTS = ['github', 'discord', 'leetcode', 'typing', 'coding'] as const;
const never = <T,>(): Promise<T> => new Promise<T>(() => {});

/** Every source answering `data` at once, except those named in `hung`, which never answer. */
function sourcesOf(
  data: StatsConsoleData,
  hung: readonly (keyof StatsConsoleData)[] = [],
): StatsConsoleSources {
  const source = <K extends keyof StatsConsoleData>(key: K): Promise<StatsConsoleData[K]> =>
    hung.includes(key) ? never() : Promise.resolve(data[key]);
  return {
    activity: source('activity'),
    totals: source('totals'),
    leetcode: source('leetcode'),
    typing: source('typing'),
    codingTime: source('codingTime'),
    pageViews: source('pageViews'),
    discord: source('discord'),
    nowPlaying: source('nowPlaying'),
  };
}

const ALL_HUNG = Object.keys(consoleFixture()) as (keyof StatsConsoleData)[];

const consoleOf = (sources: StatsConsoleSources): ReactElement => (
  <StreamedStatsConsole sources={sources} profileId="42" now={NOW} />
);

const parse = (markup: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
};

/** The first flush: every part that awaits a source shows its fallback. */
function firstFlush(node: ReactElement): HTMLElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = parse(
    renderToString(<QueryClientProvider client={client}>{node}</QueryClientProvider>),
  );
  client.clear();
  return root;
}

/**
 * The page once every part with an answer is in. With `settleMs`, the render is cut off then,
 * so a part still waiting (a hung source) ends on its fallback, as the stream stands then.
 */
async function streamed(node: ReactElement, settleMs?: number): Promise<HTMLElement> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const controller = new AbortController();
  if (settleMs !== undefined) setTimeout(() => controller.abort(), settleMs);
  const { prelude } = await prerender(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
    {
      progressiveChunkSize: Number.POSITIVE_INFINITY,
      signal: controller.signal,
      onError: () => {},
    },
  );
  const root = parse(await new Response(prelude).text());
  client.clear();
  return root;
}

const skeletonOf = (root: HTMLElement, name: string): Element | null =>
  root.querySelector(`[data-stats-skeleton="${name}"]`);

/** The classes that place a tile in the grid at every tier: its spans and its pair's own steps. */
const placement = (element: Element | null): string[] =>
  classOf(element)
    .split(/\s+/)
    .filter((name) => /span|basis-full/.test(name))
    .sort();

const strip = (root: HTMLElement): Element | null =>
  root.querySelector('dl[aria-label="At a glance"]');
const stripLabels = (root: HTMLElement): string[] =>
  Array.from(strip(root)?.querySelectorAll('dt') ?? [], (dt) => textOf(dt));

/**
 * StatsPage on the fake clock, given every source and `hung` ones that never answer: how long it
 * took to return, in fake milliseconds (React's own scheduling stays real), and its element.
 */
async function pageAfterWait(
  hung: readonly (keyof StatsConsoleData)[],
): Promise<{ readonly waitedMs: number; readonly page: ReactElement }> {
  startStatsConsole.mockReturnValue(sourcesOf(consoleFixture(), hung));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const started = Date.now();
  let returnedAt: number | undefined;
  const pending = StatsPage().then((page) => {
    returnedAt = Date.now();
    return page;
  });
  await vi.advanceTimersByTimeAsync(FIRST_FLUSH_WAIT_MS);
  const page = await pending;
  vi.useRealTimers();
  return { waitedMs: (returnedAt ?? Number.NaN) - started, page };
}

afterEach(() => {
  vi.useRealTimers();
  startStatsConsole.mockReset();
});

describe('/stats: the frame never waits on a slow source', () => {
  it('waits for hung sources FIRST_FLUSH_WAIT_MS and no longer, then streams every part', async () => {
    const { waitedMs, page } = await pageAfterWait(ALL_HUNG);
    const root = firstFlush(page);

    expect(startStatsConsole).toHaveBeenCalledOnce();
    expect(waitedMs).toBe(FIRST_FLUSH_WAIT_MS);
    expect(textOf(root.querySelector('h1'))).toBe('Stats');
    expect(root.querySelector('[data-stats-tile]')).toBeNull();
    expect(root.querySelectorAll('[data-stats-skeleton]')).toHaveLength(6);
  });

  it('renders every part in place, with no boundary, when every source answers within the wait', async () => {
    const { waitedMs, page } = await pageAfterWait([]);
    // renderToString never waits: whatever it prints is in place in the first HTML, outside any
    // Suspense boundary, and so readable without JavaScript.
    const markup = renderToString(
      <QueryClientProvider client={new QueryClient()}>{page}</QueryClientProvider>,
    );
    const root = parse(markup);

    expect(waitedMs).toBeLessThan(FIRST_FLUSH_WAIT_MS);
    expect(markup).not.toContain('<!--$');
    expect(root.querySelector('[data-stats-skeleton], [aria-busy="true"]')).toBeNull();
    for (const name of GRID_PARTS) expect(tileOf(root, name)).not.toBeNull();
    expect(textOf(tileOf(root, 'github'))).toContain('4,321');
    expect(textOf(strip(root))).toContain('2,615');
    expect(root.querySelectorAll('[data-stats-repo]')).toHaveLength(3);
  });

  it('streams only the parts whose sources are still out after the wait', async () => {
    const { waitedMs, page } = await pageAfterWait(['leetcode']);
    const root = firstFlush(page);

    expect(waitedMs).toBe(FIRST_FLUSH_WAIT_MS);
    expect(skeletonOf(root, 'leetcode')).not.toBeNull();
    expect(root.querySelectorAll('[data-stats-skeleton]')).toHaveLength(1);
    for (const name of ['github', 'discord', 'typing', 'coding']) {
      expect(tileOf(root, name)).not.toBeNull();
    }
    expect(textOf(strip(root))).toContain('2,615');
  });

  it('holds the header, the strip’s labels and age, and every part’s skeleton in order', () => {
    const root = firstFlush(consoleOf(sourcesOf(consoleFixture(), ALL_HUNG)));
    const grid = root.querySelector('[aria-label="Activity and development stats"]');

    expect(textOf(root.querySelector('h1'))).toBe('Stats');
    expect(textOf(root)).toContain('Each source keeps its own clock.');
    expect(strip(root)?.getAttribute('aria-busy')).toBe('true');
    expect(stripLabels(root)).toEqual(['years old', 'page views in 30 days', 'GitHub followers']);
    // The age needs no source: live to eight decimals (LiveAge), the whole years for readers.
    const age = strip(root)?.querySelector('dd');
    expect(textOf(age?.querySelector('[data-digits]'))).toBe(formatExactAge(new Date(NOW)));
    expect(textOf(age?.querySelector('.sr-only'))).toBe(String(ageOn(new Date(NOW))));
    expect(strip(root)?.querySelectorAll('[data-placeholder]')).toHaveLength(2);
    expect(
      Array.from(grid?.querySelectorAll('[data-stats-skeleton]') ?? [], (part) =>
        part.getAttribute('data-stats-skeleton'),
      ),
    ).toEqual([...GRID_PARTS]);
    expect(skeletonOf(root, 'repositories')).not.toBeNull();
    for (const name of [...GRID_PARTS, 'repositories']) {
      expect(skeletonOf(root, name)?.getAttribute('aria-busy')).toBe('true');
    }
    // The table's heading and column labels are its own, before its rows are in.
    expect(textOf(skeletonOf(root, 'repositories'))).toContain('Top repositories');
    expect(root.querySelector('[data-stats-tile]')).toBeNull();
  });
});

describe('/stats: each part lands where its skeleton stood', () => {
  it('keeps the grid’s order and each tile’s place at every tier', async () => {
    const first = firstFlush(consoleOf(sourcesOf(consoleFixture(), ALL_HUNG)));
    const loaded = await streamed(consoleOf(sourcesOf(consoleFixture())));
    const grid = loaded.querySelector('[aria-label="Activity and development stats"]');

    expect(
      Array.from(grid?.querySelectorAll('[data-stats-tile]') ?? [], (tile) =>
        tile.getAttribute('data-stats-tile'),
      ),
    ).toEqual([...GRID_PARTS]);
    for (const name of GRID_PARTS) {
      expect(placement(skeletonOf(first, name)).length).toBeGreaterThan(0);
      expect(placement(skeletonOf(first, name))).toEqual(placement(tileOf(loaded, name)));
    }
  });

  it('gives the strip the loaded strip’s labels, figures’ places and age', async () => {
    const first = firstFlush(consoleOf(sourcesOf(consoleFixture(), ALL_HUNG)));
    const loaded = await streamed(consoleOf(sourcesOf(consoleFixture())));

    expect(stripLabels(first)).toEqual(stripLabels(loaded));
    expect(classOf(strip(first))).toBe(classOf(strip(loaded)));
    expect(textOf(strip(first)?.querySelector('dd'))).toBe(
      textOf(strip(loaded)?.querySelector('dd')),
    );
    expect(strip(loaded)?.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps the Discord tile’s held room, and LeetCode’s split, while they load', () => {
    const first = firstFlush(consoleOf(sourcesOf(consoleFixture(), ALL_HUNG)));

    expect(skeletonOf(first, 'discord')?.querySelector('[data-widest]')).not.toBeNull();
    expect(
      skeletonOf(first, 'leetcode')?.querySelector('[data-segment-bar-placeholder]'),
    ).not.toBeNull();
    expect(textOf(skeletonOf(first, 'leetcode'))).toContain('Medium');
  });

  it('ends with every final figure and no skeleton once every source has answered', async () => {
    const root = await streamed(consoleOf(sourcesOf(consoleFixture())));

    expect(root.querySelector('[data-stats-skeleton], [aria-busy="true"]')).toBeNull();
    expect(textOf(tileOf(root, 'github'))).toContain('4,321');
    expect(textOf(tileOf(root, 'leetcode'))).toContain('692');
    expect(textOf(tileOf(root, 'typing'))).toContain('101');
    expect(textOf(tileOf(root, 'coding'))).toContain('4,223');
    expect(textOf(tileOf(root, 'discord'))).toContain('Online');
    expect(textOf(strip(root))).toContain('2,615');
    expect(root.querySelectorAll('[data-stats-repo]')).toHaveLength(3);
  });
});

describe('/stats: a slow source holds back only the parts that show it', () => {
  it('holds the strip, the hero and the repositories for the GitHub totals, and nothing else', async () => {
    const root = await streamed(consoleOf(sourcesOf(consoleFixture(), ['totals'])), 50);

    expect(strip(root)?.getAttribute('aria-busy')).toBe('true');
    expect(skeletonOf(root, 'github')).not.toBeNull();
    expect(skeletonOf(root, 'repositories')).not.toBeNull();
    expect(tileOf(root, 'github')).toBeNull();
    for (const name of ['discord', 'leetcode', 'typing', 'coding']) {
      expect(skeletonOf(root, name)).toBeNull();
      expect(tileOf(root, name)).not.toBeNull();
    }
    expect(textOf(tileOf(root, 'leetcode'))).toContain('692');
  });

  it('holds LeetCode alone when its source hangs', async () => {
    const root = await streamed(consoleOf(sourcesOf(consoleFixture(), ['leetcode'])), 50);

    expect(skeletonOf(root, 'leetcode')).not.toBeNull();
    expect(tileOf(root, 'leetcode')).toBeNull();
    expect(root.querySelectorAll('[data-stats-skeleton]')).toHaveLength(1);
    for (const name of ['github', 'discord', 'typing', 'coding']) {
      expect(tileOf(root, name)).not.toBeNull();
    }
    expect(strip(root)?.hasAttribute('aria-busy')).toBe(false);
    expect(textOf(strip(root))).toContain('2,615');
  });
});
