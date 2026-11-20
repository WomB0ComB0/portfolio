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
 * @file The /stats age's Pause outlives the strip's skeleton (verification round 2).
 *
 * While the GitHub totals or the page views are on their way, the strip streams: its skeleton
 * (live age and Pause included) stands in a Suspense boundary until the loaded strip replaces it.
 * Each render had its own LiveAgeProvider, so a Pause pressed on the skeleton was undone when the
 * figures landed. The one provider now sits around the strip's slot, outside the boundary, for
 * both renders. LiveAgeProvider renders no markup of its own, so here it is wrapped in a marker
 * element to show where it sits in the server HTML; live-age.test.tsx checks that a figure and
 * toggle replaced under one provider keep its pause, and age-pause-skeleton.test.tsx that a real
 * Suspense swap keeps it, and the toggle's focus.
 *
 * The skeleton the server sends is never hydrated: React leaves a fallback's server HTML as it is
 * until the content replacing it arrives. So in that HTML the skeleton's toggle is a placeholder,
 * not a button that would take focus and presses and do nothing.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/app/(routes)/(dev)/stats/_components/console/live-age', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/app/(routes)/(dev)/stats/_components/console/live-age')
    >();
  // The marker each provider leaves in the HTML, around what it provides to.
  const MarkedProvider = ({ children }: { readonly children: ReactNode }): ReactElement => (
    <div data-live-age-provider="">
      <actual.LiveAgeProvider>{children}</actual.LiveAgeProvider>
    </div>
  );
  return { ...actual, LiveAgeProvider: MarkedProvider };
});

import { StreamedStatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type {
  StatsConsoleData,
  StatsConsoleSources,
} from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { consoleFixture, NOW } from './console-fixture';

const never = <T,>(): Promise<T> => new Promise<T>(() => {});

/** Every source answering the fixture at once, or (hung) never answering. */
function sourcesOf(hung: boolean): StatsConsoleSources {
  const data = consoleFixture();
  const source = <K extends keyof StatsConsoleData>(key: K): Promise<StatsConsoleData[K]> =>
    hung ? never() : Promise.resolve(data[key]);
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

const withQueries = (node: ReactElement): ReactElement => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
);

const parse = (markup: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
};

/** The first flush, with every source still on its way: each part behind its skeleton. */
const firstFlush = (): HTMLElement =>
  parse(
    renderToString(
      withQueries(<StreamedStatsConsole sources={sourcesOf(true)} profileId="42" now={NOW} />),
    ),
  );

/** The page with every part in place (every source answered within the first flush's wait). */
const settledInPlace = (): HTMLElement =>
  parse(
    renderToString(
      withQueries(
        <StreamedStatsConsole
          sources={sourcesOf(false)}
          settled={consoleFixture()}
          profileId="42"
          now={NOW}
        />,
      ),
    ),
  );

/** The page once every streamed part has landed. */
async function streamedIn(): Promise<HTMLElement> {
  const { prelude } = await prerender(
    withQueries(<StreamedStatsConsole sources={sourcesOf(false)} profileId="42" now={NOW} />),
    { progressiveChunkSize: Number.POSITIVE_INFINITY, onError: () => {} },
  );
  return parse(await new Response(prelude).text());
}

/** The start of every Suspense boundary inside `node` (React marks one with a `$` comment). */
function boundariesIn(node: Node): Comment[] {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT);
  const found: Comment[] = [];
  for (let comment = walker.nextNode(); comment; comment = walker.nextNode()) {
    if (comment instanceof Comment && /^\$[?!]?$/.test(comment.data)) found.push(comment);
  }
  return found;
}

const providersIn = (root: HTMLElement): Element[] =>
  Array.from(root.querySelectorAll('[data-live-age-provider]'));

const stripIn = (root: HTMLElement): Element | null =>
  root.querySelector('dl[aria-label="At a glance"]');

describe('/stats: one Pause state for the strip, skeleton and loaded alike', () => {
  it('holds the streaming strip’s Suspense boundary inside the one provider', () => {
    const root = firstFlush();
    const [provider, ...others] = providersIn(root);

    expect(others).toEqual([]);
    // The skeleton strip, with its age and the Pause toggle's placeholder, is under the provider...
    const strip = stripIn(root);
    expect(provider?.contains(strip)).toBe(true);
    expect(strip?.querySelector('[data-pause-placeholder]')).not.toBeNull();
    expect(strip?.querySelector('button')).toBeNull();
    // ...and so is the boundary the loaded strip replaces it in, so the swap keeps the provider.
    expect(boundariesIn(provider ?? root)).toHaveLength(1);
  });

  it('gives the loaded strip that same single provider, streamed or in place', async () => {
    for (const root of [await streamedIn(), settledInPlace()]) {
      const providers = providersIn(root);
      expect(providers).toHaveLength(1);
      expect(providers[0]?.contains(stripIn(root))).toBe(true);
      // The loaded strip, hydrated as any server HTML is, has the working toggle.
      expect(stripIn(root)?.querySelector('button[aria-label="Pause age counter"]')).not.toBeNull();
      expect(stripIn(root)?.querySelector('[data-pause-placeholder]')).toBeNull();
    }
  });
});
