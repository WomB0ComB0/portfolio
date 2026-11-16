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
 * @file What the /stats console tests share: settled answers from every source, a server render
 * parsed without hydration, and the two class checks. No mocks live here: a test file that renders
 * the console mocks the home loaders and the environment itself (vi.mock is hoisted per file).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

import type { TileResult } from '@/app/_components/home/data/tile-result';
import type { StatsConsoleData } from '@/app/(routes)/(dev)/stats/_lib/console-model';

export const AS_OF = '2026-11-10T15:00:00Z';
/** Three minutes after every source was read. */
export const NOW = Date.parse('2026-11-10T15:03:00Z');

const ok = <T,>(data: T): TileResult<T> => ({ status: 'ok', data, stale: false, asOf: AS_OF });

/** A short description (a tagline) and one as long as a paragraph, as GitHub allows. */
export const SHORT_DESCRIPTION = 'Surprisingly functional, sophisticated, Ralph Wiggum loop';
export const LONG_DESCRIPTION =
  'An enterprise-grade, LLM-powered data pipeline for automated web tasks and document extraction. Integrates OCR, multimodal file support, and browser automation to transform unstructured data into actionable workflows with real-time monitoring.';

/** Representative successful answers from every source. */
export function consoleFixture(): StatsConsoleData {
  return {
    activity: ok({
      total: 4321,
      weeks: [{ start: '2026-11-01', count: 4321 }],
      latestCommit: null,
      fetchedAt: AS_OF,
    }),
    totals: ok({
      user: { repos: 324, followers: 190, avatar_url: 'https://example.com/avatar.png' },
      stats: { totalStars: 87, topLanguages: ['TypeScript'] },
      topRepos: [SHORT_DESCRIPTION, LONG_DESCRIPTION, null].map((description, index) => ({
        name: `project-${index + 1}`,
        description,
        stars: 20 - index,
        language: 'TypeScript',
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

/** Parses server markup without hydrating it or running any effects. */
export function html(node: ReactElement): HTMLElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = document.createElement('div');
  root.innerHTML = renderToString(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
  client.clear();
  return root;
}

export const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

export const classOf = (element: Element | null | undefined): string =>
  element?.getAttribute('class') ?? '';

/** True when `name` is one of the element's own classes (not a prefix of a longer one). */
export const hasClass = (element: Element | null | undefined, name: string): boolean =>
  classOf(element).split(/\s+/).includes(name);

/** The tile named `name` (`data-stats-tile`). */
export const tileOf = (root: HTMLElement, name: string): Element | null =>
  root.querySelector(`[data-stats-tile="${name}"]`);
