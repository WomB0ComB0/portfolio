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
 * @file Every age on /stats is dated by the server's clock and read by the browser's. A browser
 * clock a minute or more behind put those moments in its future, which formatAge leaves unworded:
 * the Discord tile lost its age line until the next poll, and a stat tile's line ended on a
 * separator with nothing after it ('1,022 tests ·'). PresentAge clamps the moment to the clock it
 * is rendered by, so each reads 'just now' instead; a clock ahead still reads the age by its own
 * count. Server HTML is hydrated here with the browser's clock moved, as a visitor's would be.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The console reuses home tile helpers, which import their loaders; nothing is loaded here.
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
import { PresentAge } from '@/app/(routes)/(dev)/stats/_components/console/present-age';
import { StatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type { StatsConsoleData } from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { consoleFixture, NOW } from './console-fixture';

/** Every source read 5 s before the server rendered the page. */
const READ_AT = NOW - 5_000;
const READ_ISO = new Date(READ_AT).toISOString();
/** A browser clock this far behind puts every read past formatAge's minute of slack. */
const BEHIND_MS = 90_000;

/** Server HTML of `node`, rendered at NOW, in a container on the page. */
function serverHtml(node: () => ReactElement): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToString(node());
  document.body.append(container);
  return container;
}

/** Hydrates `container` with `node` at the browser time `at`, and every hydration complaint. */
async function hydrateAt(container: HTMLElement, node: () => ReactElement, at: number) {
  vi.setSystemTime(at);
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const root = await act(async () => hydrateRoot(container, node(), { onRecoverableError }));
  const complaints = [
    ...onRecoverableError.mock.calls.map(([error]) => String(error)),
    ...consoleError.mock.calls.map((args) => args.map(String).join(' ')),
  ].filter((message) => /hydrat|did not match|didn't match/i.test(message));
  return { root, complaints };
}

const timesIn = (container: HTMLElement) =>
  [...container.querySelectorAll('time')].map((time) => time.textContent ?? '');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  // The Discord island polls only after 30 s; any request here is a test failure.
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      throw new Error(`unexpected request: ${String(input)}`);
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PresentAge', () => {
  it('reads a moment ahead of the browser’s clock as just now, never nothing', async () => {
    const node = () => <PresentAge at={READ_ISO} />;
    const container = serverHtml(node);
    expect(timesIn(container)).toEqual(['updated just now']);

    const { root, complaints } = await hydrateAt(container, node, NOW - BEHIND_MS);

    expect(complaints).toEqual([]);
    expect(timesIn(container)).toEqual(['updated just now']);
    // From there it ages by the browser's clock.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(timesIn(container)).toEqual(['updated 1 min ago']);
    act(() => root.unmount());
  });

  it('keeps the age of a moment the browser’s clock has passed, and its prefix', async () => {
    const node = () => <PresentAge at={NOW - 3 * 60_000} prefix="" />;
    const container = serverHtml(node);

    const { root, complaints } = await hydrateAt(container, node, NOW + BEHIND_MS);

    expect(complaints).toEqual([]);
    expect(timesIn(container)).toEqual(['4 min ago']);
    act(() => root.unmount());
  });

  it('renders nothing for a moment that is not one', () => {
    expect(renderToString(<PresentAge at="soon" />)).toBe('');
  });

  it.each([
    ['5 min behind', -5 * 60_000],
    ['5 min ahead', 5 * 60_000],
  ])('hydrates without a warning by a clock %s, and words the age', async (_, skew) => {
    const node = () => <PresentAge at={READ_ISO} />;
    const container = serverHtml(node);

    const { root, complaints } = await hydrateAt(container, node, NOW + skew);

    expect(complaints).toEqual([]);
    expect(timesIn(container)).toEqual([skew < 0 ? 'updated just now' : 'updated 5 min ago']);
    act(() => root.unmount());
  });

  it('reads just now, never nothing, when it renders after the clock stepped back past it', async () => {
    // Verify P4 (round eleven): a kept read rendered again after the device clock stepped back
    // 10 min kept its moment, which then lay in that clock's future, and the line said nothing.
    const { container, rerender } = render(<PresentAge at={READ_AT} />);
    expect(timesIn(container)).toEqual(['updated just now']);

    vi.setSystemTime(NOW - 10 * 60_000);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    rerender(<PresentAge at={READ_AT} />);

    expect(timesIn(container)).toEqual(['updated just now']);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(timesIn(container)).toEqual(['updated 1 min ago']);
  });
});

describe('/stats ages with the browser’s clock behind the server’s', () => {
  const fresh = <T,>(result: TileResult<T>): TileResult<T> =>
    result.status === 'ok' ? { ...result, asOf: READ_ISO } : result;

  /** The fixture with every source read 5 s before the page. */
  function justRead(): StatsConsoleData {
    const data = consoleFixture();
    if (data.discord.kind !== 'data') throw new Error('fixture must have Discord');
    return {
      ...data,
      activity: fresh(data.activity),
      totals: fresh(data.totals),
      leetcode: fresh(data.leetcode),
      typing: fresh(data.typing),
      codingTime: fresh(data.codingTime),
      discord: { ...data.discord, fetchedAt: READ_AT },
    };
  }

  it('words every age on the page, and no context line ends on a separator', async () => {
    const data = justRead();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const node = () => (
      <QueryClientProvider client={client}>
        <StatsConsole data={data} profileId="42" now={NOW} />
      </QueryClientProvider>
    );
    const container = serverHtml(node);
    const ages = timesIn(container);
    // The hero, three stat tiles, Discord and the table each say how old they are.
    expect(ages.length).toBeGreaterThanOrEqual(6);

    const { root, complaints } = await hydrateAt(container, node, NOW - BEHIND_MS);

    expect(complaints).toEqual([]);
    expect(timesIn(container)).toEqual(ages.map(() => 'updated just now'));
    for (const line of container.querySelectorAll('[data-context-line]')) {
      expect(line.textContent?.trim()).not.toMatch(/·$/);
    }
    act(() => root.unmount());
    client.clear();
  });
});
