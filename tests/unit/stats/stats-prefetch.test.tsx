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
 * @file The /stats page renders its numeric cards on the server. Each card's server source is
 * prefetched behind its own boundary, so the numbers are in the server HTML, hydrate without a
 * count from 0 or a mismatch, and the browser never fetches them again. A source that fails or
 * misses its deadline leaves only its own card on a skeleton, and that card fetches for itself
 * once mounted.
 *
 * The page is rendered as Next would: the server components (Stats, PrefetchBoundary) are
 * resolved first, with no browser window, as on the server (TanStack never retries there); the
 * result is rendered to HTML with one QueryClient and hydrated with another, the app's own.
 * The route handlers are mocked; the browser fetcher is the real one, spied on, over a stubbed
 * fetch.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, waitFor, within } from '@testing-library/react';
import {
  cloneElement,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getGitHubStats,
  getGoogleAnalytics,
  getLeetCodeStats,
  getMonkeytypeProfile,
  getWakaTimeData,
  refresh,
} = vi.hoisted(() => ({
  getGitHubStats: vi.fn(),
  getGoogleAnalytics: vi.fn(),
  getLeetCodeStats: vi.fn(),
  getMonkeytypeProfile: vi.fn(),
  getWakaTimeData: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/api/v1/[[...route]]/github-stats/handlers', () => ({ getGitHubStats }));
vi.mock('@/app/api/v1/[[...route]]/google/handlers', () => ({ getGoogleAnalytics }));
vi.mock('@/app/api/v1/[[...route]]/leetcode/handlers', () => ({ getLeetCodeStats }));
vi.mock('@/app/api/v1/[[...route]]/wakatime/handlers', () => ({ getWakaTimeData }));
vi.mock('@/lib/api-integrations/monkeytype', () => ({ getMonkeytypeProfile }));
// The cards' browser fetcher, spied on so a test can tell whether a card fetched for itself.
vi.mock('@/lib/http-clients/effect-fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http-clients/effect-fetcher')>();
  return { ...actual, get: vi.fn(actual.get) };
});
// Discord is a live widget with its own tests; here it only holds its slot.
vi.mock('@/app/(routes)/(dev)/stats/_components/discord', () => {
  const Discord = () => <section aria-label="Discord stub" />;
  return { Discord, default: Discord };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
vi.mock('@/lib/observability/report', () => ({
  reportError: vi.fn(() => true),
  reportApiFailure: vi.fn(() => true),
}));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/components' barrel initialises Firebase; StatCard only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));

import { Stats } from '@/app/(routes)/(dev)/stats/_interface/stats/stats';
import StatsPage, { metadata } from '@/app/(routes)/(dev)/stats/page';
import { get } from '@/lib/http-clients/effect-fetcher';
import { PREFETCH_DEADLINE_MS, PrefetchBoundary } from '@/lib/query/prefetch';
import { makeQueryClient } from '@/providers/server/query-client';
import { logger } from '@/utils';

const githubStats = {
  user: { repos: 1234, followers: 56, avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  stats: { totalStars: 7890, topLanguages: ['TypeScript'] },
  topRepos: [
    {
      name: 'portfolio',
      description: 'Personal site',
      stars: 12,
      language: 'TypeScript',
      url: 'https://github.com/example/portfolio',
    },
  ],
};
const leetcodeStats = {
  totalSolved: 520,
  easySolved: 200,
  mediumSolved: 260,
  hardSolved: 60,
  acceptanceRate: 73.46,
  ranking: 103_562,
};
const wakatime = {
  text: '343 hrs',
  digital: '342:56',
  decimal: '342.94',
  total_seconds: 1_234_567,
};
const monkeytypeProfile = {
  name: 'WomB0ComB0',
  personalBests: {
    time: {
      '60': [
        { wpm: 98, acc: 97.1 },
        { wpm: 112, acc: 94.2 },
      ],
    },
  },
  typingStats: { completedTests: 812 },
};

const LEETCODE_PATH = '/api/v1/leetcode';
/** NumberTicker's copy that shows a count in progress; a ticker at rest has none. */
const COUNTING_COPY = '[class*="data-count"]';

// ---------------------------------------------------------------------------------------------
// The server render

type AsyncComponent = (props: object) => Promise<ReactNode>;

const isAsyncComponent = (type: unknown): type is AsyncComponent =>
  typeof type === 'function' && type.constructor.name === 'AsyncFunction';

const isRenderable = (name: string, value: unknown): boolean =>
  name === 'children' || isValidElement(value);

/** The dehydrated state crosses to the browser as JSON in the RSC payload. */
const overTheWire = (element: ReactElement): ReactElement => {
  if (element.type !== HydrationBoundary) return element;
  const { state } = element.props as { state?: unknown };
  return cloneElement(element as ReactElement<{ state?: unknown }>, {
    state: JSON.parse(JSON.stringify(state)),
  });
};

/**
 * What the RSC renderer does with the tree: every async server component (PrefetchBoundary) is
 * awaited, in parallel, wherever it sits, including in element props such as a Suspense
 * fallback or a frame slot. Client components are left for react-dom.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  if (isAsyncComponent(node.type)) {
    const output = await node.type(node.props);
    return resolveServerTree(isValidElement(output) ? overTheWire(output) : output);
  }
  const props = await Promise.all(
    Object.entries(node.props).map(async ([name, value]) => [
      name,
      isRenderable(name, value) ? await resolveServerTree(value as ReactNode) : value,
    ]),
  );
  return cloneElement(node, Object.fromEntries(props));
}

/** The /stats server components, resolved with no browser window, as on the server. */
const renderServerComponents = async (): Promise<ReactNode> => {
  vi.stubGlobal('window', undefined);
  try {
    return await resolveServerTree(Stats());
  } finally {
    vi.unstubAllGlobals();
  }
};

// ---------------------------------------------------------------------------------------------
// The HTML and the browser

const withClient = (tree: ReactNode) =>
  createElement(QueryClientProvider, { client: makeQueryClient() }, tree);

let container: HTMLElement | null = null;
let root: Root | null = null;

/** The server HTML, put in the document so it can be queried by role. */
const serveHtml = (tree: ReactNode): HTMLElement => {
  container = document.createElement('div');
  container.innerHTML = renderToString(withClient(tree));
  document.body.append(container);
  return container;
};

/** The browser hydrating the server HTML with its own QueryClient; effects (fetches) run. */
const hydrateInBrowser = async (html: HTMLElement, tree: ReactNode) => {
  const onRecoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(html, withClient(tree), { onRecoverableError });
  });
  return { onRecoverableError };
};

/** A card's region, named by its h2. */
const card = (scope: HTMLElement, title: string): HTMLElement =>
  within(scope).getByRole('region', { name: title });

const hasSkeleton = (element: HTMLElement): boolean =>
  element.querySelector('.animate-pulse') !== null;

/** The value shown above a stat's label. */
const valueAbove = (scope: HTMLElement, label: string): HTMLElement | null =>
  within(scope).getByText(label).parentElement;

/** Answers the browser's /api/v1/leetcode; any other browser request is a test bug. */
const stubBrowserFetch = () => {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      requests.push(url.pathname);
      if (url.pathname !== LEETCODE_PATH) throw new Error(`unexpected request: ${url.pathname}`);
      return new Response(JSON.stringify(leetcodeStats), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return requests;
};

const fetchedUrls = (): unknown[] => vi.mocked(get).mock.calls.map(([url]) => url);

beforeEach(() => {
  getGitHubStats.mockResolvedValue(githubStats);
  getGoogleAnalytics.mockResolvedValue({ total_pageviews: 4321 });
  getLeetCodeStats.mockResolvedValue(leetcodeStats);
  getMonkeytypeProfile.mockResolvedValue(monkeytypeProfile);
  getWakaTimeData.mockResolvedValue(wakatime);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
});

afterEach(async () => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(get).mockClear();
  // A card that mounts in the browser makes motion read window.innerWidth on the next animation
  // frame. Let that frame run now: as the file's last test, it would otherwise fire after jsdom is
  // torn down and fail the run with an uncaught TypeError.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
});

describe('/stats with every source answering', () => {
  it('has the GitHub numbers in the server HTML, and no skeleton', async () => {
    const html = serveHtml(await renderServerComponents());

    const github = card(html, 'GitHub Stats');
    expect(valueAbove(github, 'Repositories')).toHaveTextContent('1,234');
    expect(valueAbove(github, 'Total Stars')).toHaveTextContent('7,890');
    expect(valueAbove(github, 'Followers')).toHaveTextContent('56');
    expect(hasSkeleton(github)).toBe(false);
    expect(within(html).getByRole('link', { name: /^portfolio\b/ })).toBeInTheDocument();
  });

  it('has every numeric card in the server HTML, Dev Stats and Monkeytype from one boundary', async () => {
    const html = serveHtml(await renderServerComponents());

    const leetcode = card(html, 'LeetCode Stats');
    expect(valueAbove(leetcode, 'Total Solved')).toHaveTextContent('520');
    const devStats = card(html, 'Dev Stats');
    expect(valueAbove(devStats, 'Page views (30 days)')).toHaveTextContent('4,321');
    expect(valueAbove(devStats, 'Hours coded (all time)')).toHaveTextContent('343');
    const monkeytype = card(html, 'Monkeytype Stats');
    expect(valueAbove(monkeytype, 'WPM')).toHaveTextContent('112');
    expect(valueAbove(monkeytype, 'Tests')).toHaveTextContent('812');
    expect(within(monkeytype).getByText('94%')).toBeInTheDocument();
    for (const element of [leetcode, devStats, monkeytype])
      expect(hasSkeleton(element)).toBe(false);
    expect(within(html).getByRole('region', { name: 'Discord stub' })).toBeInTheDocument();
  });

  it('hydrates without a mismatch, never counts from 0 and never fetches in the browser', async () => {
    const requests = stubBrowserFetch();
    const tree = await renderServerComponents();
    const html = serveHtml(tree);
    const serverText = card(html, 'GitHub Stats').textContent;

    const { onRecoverableError } = await hydrateInBrowser(html, tree);

    expect(onRecoverableError).not.toHaveBeenCalled();
    const github = card(html, 'GitHub Stats');
    expect(github.textContent).toBe(serverText);
    expect(valueAbove(github, 'Repositories')).toHaveTextContent('1,234');
    expect(html.querySelector(COUNTING_COPY)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  it('server-renders the repositories and the LeetCode bars at rest, not hidden or empty', async () => {
    const html = serveHtml(await renderServerComponents());

    const repo = within(html).getByRole('link', { name: /^portfolio\b/ });
    expect(repo.getAttribute('style') ?? '').not.toMatch(/opacity:\s*0/);
    // Easy is 200 of 520 solved: its fill rests (200 / 520 - 1) * 100 = -61.54% off its track.
    const easyFill = within(card(html, 'LeetCode Stats'))
      .getByText('Easy')
      .parentElement?.querySelector('.overflow-hidden > div');
    expect(easyFill?.getAttribute('style')).toMatch(/translateX\(-61\.53\d*%\)/);
  });

  it('server-renders every card frame visible, with no entrance that hides it', async () => {
    const html = serveHtml(await renderServerComponents());

    for (const title of ['GitHub Stats', 'LeetCode Stats', 'Dev Stats', 'Monkeytype Stats']) {
      // MagicCard's hover overlay serialises opacity:0.8, which is not an entrance.
      expect(card(html, title).getAttribute('style') ?? '').not.toMatch(/opacity:\s*0(?![.\d])/);
    }
  });
});

describe('/stats with one source failing', () => {
  /** The LeetCode card: a skeleton on the server, then its own browser fetch after mount. */
  const expectLeetCodeFetchedInBrowser = async (tree: ReactNode) => {
    const requests = stubBrowserFetch();
    const html = serveHtml(tree);

    const leetcode = card(html, 'LeetCode Stats');
    expect(hasSkeleton(leetcode)).toBe(true);
    expect(within(leetcode).queryByText('Total Solved')).toBeNull();
    expect(valueAbove(card(html, 'GitHub Stats'), 'Repositories')).toHaveTextContent('1,234');
    expect(hasSkeleton(card(html, 'Dev Stats'))).toBe(false);

    const { onRecoverableError } = await hydrateInBrowser(html, tree);

    await waitFor(() =>
      expect(valueAbove(card(html, 'LeetCode Stats'), 'Total Solved')).toHaveTextContent('520'),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(fetchedUrls()).toEqual([LEETCODE_PATH]);
    expect(requests).toEqual([LEETCODE_PATH]);
  };

  it('leaves LeetCode to fetch in the browser when its source rejects; the rest render', async () => {
    getLeetCodeStats.mockRejectedValue(new Error('LeetCode is down'));

    const tree = await renderServerComponents();

    expect(getLeetCodeStats).toHaveBeenCalledTimes(1);
    await expectLeetCodeFetchedInBrowser(tree);
  });

  it(`stops waiting for LeetCode after ${PREFETCH_DEADLINE_MS} ms; the rest render`, async () => {
    vi.useFakeTimers();
    getLeetCodeStats.mockReturnValue(new Promise(() => {}));

    let settled = false;
    const rendering = renderServerComponents().finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(PREFETCH_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const tree = await rendering;
    vi.useRealTimers();

    await expectLeetCodeFetchedInBrowser(tree);
  });
});

// ---------------------------------------------------------------------------------------------
// The route segment

const STATS_SEGMENT = join(process.cwd(), 'src/app/(routes)/(dev)/stats');

/** Whether each PrefetchBoundary in the tree has a Suspense above it, in tree order. */
const prefetchesUnderSuspense = (node: ReactNode, isUnderSuspense = false): boolean[] => {
  if (Array.isArray(node))
    return node.flatMap((child) => prefetchesUnderSuspense(child, isUnderSuspense));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  if (node.type === PrefetchBoundary) return [isUnderSuspense];
  const isSuspense = isUnderSuspense || node.type === Suspense;
  return Object.entries(node.props).flatMap(([name, value]) =>
    isRenderable(name, value) ? prefetchesUnderSuspense(value as ReactNode, isSuspense) : [],
  );
};

describe('/stats route segment', () => {
  // The page awaits nothing above its cards and each card has its own skeleton, so the header,
  // the grid and the skeletons are ready at once. A loading.tsx would only show a copy of them
  // first, then remount every card (and the live Discord card) when the page replaced it.
  it('has no loading.tsx, because nothing awaits above the cards and each card suspends alone', () => {
    const loadingFiles = readdirSync(STATS_SEGMENT).filter((name) =>
      /^loading\.[cm]?[jt]sx?$/.test(name),
    );

    expect(loadingFiles).toEqual([]);
    expect(isAsyncComponent(Stats)).toBe(false);
    expect(prefetchesUnderSuspense(Stats())).toEqual([true, true, true]);
  });
});

describe('/stats page module', () => {
  it('renders the Stats view directly (no next/dynamic) and keeps its metadata', () => {
    expect(StatsPage().type).toBe(Stats);
    expect(metadata.openGraph).toMatchObject({ title: 'Stats' });
    expect(String(metadata.openGraph?.url)).toMatch(/\/stats$/);
  });
});
