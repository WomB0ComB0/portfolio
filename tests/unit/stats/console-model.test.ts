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
 * @file The /stats console's data shaping: what the hero, the strip, each stat tile and the
 * repository table show for every state a source can be in. Never a made-up number: a failed or
 * empty source shows its state in words (or an em dash read as 'unavailable'), never 0, and stale
 * data says how old it is.
 */

import { describe, expect, it } from 'vitest';
import type { TileResult } from '@/app/_components/home/data/tile-result';
import {
  codingHours,
  heroModel,
  leetCodeMeta,
  pendingStripItems,
  repoColumnSizes,
  statFigure,
  stripItems,
  topRepos,
  typingContext,
} from '@/app/(routes)/(dev)/stats/_lib/console-model';
import type { GitHubStatsData } from '@/app/api/v1/[[...route]]/github-stats/handlers';
import type { GitHubActivity } from '@/lib/api-integrations/github-activity';

const NOW = new Date('2026-11-10T15:00:00Z');
const FRESH_AT = '2026-11-10T14:57:00Z';
const OLD_AT = '2026-11-10T11:00:00Z';

const ACTIVITY: GitHubActivity = {
  weeks: [
    { start: '2026-08-23', count: 30 },
    { start: '2026-08-30', count: 61 },
  ],
  total: 91,
  latestCommit: {
    repo: 'WomB0ComB0/portfolio',
    repoUrl: 'https://github.com/WomB0ComB0/portfolio',
    headline: 'feat(seo): Live Console sharing cards (#636)',
    url: 'https://github.com/WomB0ComB0/portfolio/commit/abc1234',
    sha: 'abc1234',
    committedAt: '2026-11-10T14:28:00Z',
  },
  fetchedAt: FRESH_AT,
};

const repo = (name: string, stars: number, description: string | null = null) => ({
  name,
  description,
  stars,
  language: 'TypeScript',
  url: `https://github.com/WomB0ComB0/${name}`,
});

const TOTALS: GitHubStatsData = {
  user: { repos: 324, followers: 190, avatar_url: 'https://example.com/a.png' },
  stats: { totalStars: 87, topLanguages: ['TypeScript', 'Python', 'Go'] },
  topRepos: [
    repo('portfolio', 13, '2025 - present portfolio'),
    repo('headstarter', 8),
    repo('browser-use', 7),
    repo('leetcode', 4),
    repo('link-shortener', 4),
    repo('dotfiles', 3),
    repo('extra', 2),
  ],
};

const ok = <T>(data: T, asOf = FRESH_AT): TileResult<T> => ({
  status: 'ok',
  data,
  stale: false,
  asOf,
});
const stale = <T>(data: T, asOf = OLD_AT): TileResult<T> => ({
  status: 'ok',
  data,
  stale: true,
  asOf,
});
const EMPTY: TileResult<never> = { status: 'empty' };
const ERROR: TileResult<never> = { status: 'error' };

/**
 * A context line as the home tiles join it: a no-break space before each dot, so a narrow tile
 * wraps after a separator, never inside a part (each part holds its own no-break space).
 */
const meta = (...parts: string[]): string => parts.join(' · ');

describe('statFigure', () => {
  const solved = (stats: { solved: number }) => stats.solved;

  it('shows a fresh figure with when it was read', () => {
    expect(statFigure(ok({ solved: 692 }), solved)).toEqual({
      state: 'ready',
      value: 692,
      updatedAt: FRESH_AT,
    });
  });

  it('marks a stale figure stale and keeps when it was read', () => {
    expect(statFigure(stale({ solved: 692 }), solved)).toEqual({
      state: 'stale',
      value: 692,
      updatedAt: OLD_AT,
    });
  });

  it('turns an empty source, or a figure the data lacks, into the idle state (never 0)', () => {
    expect(statFigure(EMPTY, solved)).toEqual({ state: 'idle', value: null });
    expect(statFigure(ok({ solved: 1 }), () => null)).toEqual({ state: 'idle', value: null });
  });

  it('turns a failed source into the error state with no figure', () => {
    expect(statFigure(ERROR, solved)).toEqual({ state: 'error', value: null });
  });
});

describe('the tiles’ context lines', () => {
  it('rounds coding time down to whole hours, and has none for zero or nonsense', () => {
    const waka = (total_seconds: number) => ({ text: '', digital: '', decimal: '', total_seconds });
    expect(codingHours(waka(15_202_921.4))).toBe(4223);
    expect(codingHours(waka(3_599))).toBe(0);
    expect(codingHours(waka(0))).toBeNull();
    expect(codingHours(waka(Number.NaN))).toBeNull();
  });

  it('words LeetCode’s acceptance to one decimal and its rank in en-US', () => {
    expect(
      leetCodeMeta({
        totalSolved: 692,
        easySolved: 215,
        mediumSolved: 379,
        hardSolved: 98,
        acceptanceRate: 73.46,
        ranking: 103_899,
      }),
    ).toBe(meta('73.5% acceptance', 'rank 103,899'));
  });

  it('leaves a missing rank or acceptance out instead of printing 0', () => {
    expect(
      leetCodeMeta({
        totalSolved: 1,
        easySolved: 1,
        mediumSolved: 0,
        hardSolved: 0,
        acceptanceRate: Number.NaN,
        ranking: 0,
      }),
    ).toBe('');
  });

  it('gives the typing test, its accuracy when the figure has no gauge, and the test count', () => {
    const typing = { best60: { wpm: 101, accuracy: 93.2 }, completedTests: 1022 };
    expect(typingContext(typing, { accuracy: true })).toBe(
      meta('60 s best', '93% accuracy', '1,022 tests'),
    );
    expect(typingContext(typing, { accuracy: false })).toBe(meta('60 s best', '1,022 tests'));
  });
});

describe('heroModel', () => {
  it('combines activity and totals, dated by the older of the two', () => {
    const hero = heroModel(ok(ACTIVITY, FRESH_AT), ok(TOTALS, '2026-11-10T14:10:00Z'));
    expect(hero).toMatchObject({
      state: 'ready',
      activity: ACTIVITY,
      totals: { repos: 324, stars: 87, languages: ['TypeScript', 'Python', 'Go'] },
      asOf: '2026-11-10T14:10:00Z',
    });
  });

  it('is stale when either source is, dated by the stale one', () => {
    const hero = heroModel(stale(ACTIVITY, OLD_AT), ok(TOTALS));
    expect(hero.state).toBe('stale');
    expect(hero.asOf).toBe(OLD_AT);
  });

  it('shows what it has when one source failed, and says which is missing', () => {
    const noTotals = heroModel(ok(ACTIVITY), ERROR);
    expect(noTotals).toMatchObject({ state: 'partial', missing: ['totals'], totals: null });
    expect(noTotals.activity).toEqual(ACTIVITY);

    const noActivity = heroModel(EMPTY, ok(TOTALS));
    expect(noActivity).toMatchObject({ state: 'partial', missing: ['activity'], activity: null });
  });

  it('is the error state only when both sources failed', () => {
    expect(heroModel(ERROR, ERROR)).toMatchObject({
      state: 'error',
      activity: null,
      totals: null,
      missing: ['activity', 'totals'],
    });
  });
});

describe('stripItems', () => {
  it('gives age, page views and followers, in that order', () => {
    expect(stripItems({ totals: ok(TOTALS), pageViews: ok(2615) }, NOW)).toEqual([
      { label: 'years old', value: 22 },
      { label: 'page views in 30 days', value: 2615 },
      { label: 'GitHub followers', value: 190 },
    ]);
  });

  it('shows a source that failed or has nothing as unavailable, never 0', () => {
    const items = stripItems({ totals: ERROR, pageViews: EMPTY }, NOW);
    expect(items.map((item) => item.value)).toEqual([22, null, null]);
  });

  it('shows the age figure it is given in place of the whole years, which stay the value', () => {
    const figure = '22.65753424';
    const [age, ...rest] = stripItems({ totals: ok(TOTALS), pageViews: ok(2615) }, NOW, figure);

    expect(age).toEqual({ label: 'years old', value: 22, figure });
    expect(rest.every((item) => !('figure' in item))).toBe(true);
  });

  it('gives the age the action it is given (its Pause toggle), and no other item one', () => {
    const figure = '22.65753424';
    const action = 'Pause';
    const [age, ...rest] = stripItems(
      { totals: ok(TOTALS), pageViews: ok(2615) },
      NOW,
      figure,
      action,
    );

    expect(age).toEqual({ label: 'years old', value: 22, figure, action });
    expect(rest.every((item) => !('action' in item))).toBe(true);
  });
});

describe('pendingStripItems', () => {
  it('keeps the loaded strip’s labels and age, with the two sourced figures loading', () => {
    const loaded = stripItems({ totals: ok(TOTALS), pageViews: ok(2615) }, NOW);

    expect(pendingStripItems(NOW)).toEqual([
      { label: 'years old', value: 22 },
      { label: 'page views in 30 days', value: null, loading: true },
      { label: 'GitHub followers', value: null, loading: true },
    ]);
    expect(pendingStripItems(NOW).map((item) => item.label)).toEqual(
      loaded.map((item) => item.label),
    );
  });

  it('shows the age figure it is given while the sourced figures load', () => {
    const figure = '22.65753424';
    const [age, ...rest] = pendingStripItems(NOW, figure);

    expect(age).toEqual({ label: 'years old', value: 22, figure });
    expect(rest.every((item) => item.loading === true && !('figure' in item))).toBe(true);
  });

  it('gives the age its action while the sourced figures load', () => {
    const [age, ...rest] = pendingStripItems(NOW, '22.65753424', 'Pause');

    expect(age).toEqual({ label: 'years old', value: 22, figure: '22.65753424', action: 'Pause' });
    expect(rest.every((item) => !('action' in item))).toBe(true);
  });
});

describe('topRepos', () => {
  it('takes the first six by stars, out of every repository counted', () => {
    const table = topRepos(ok(TOTALS));
    expect(table?.rows.map((row) => row.name)).toEqual([
      'portfolio',
      'headstarter',
      'browser-use',
      'leetcode',
      'link-shortener',
      'dotfiles',
    ]);
    expect(table?.total).toBe(324);
    // A missing description stays missing: no 'No description' filler.
    expect(table?.rows[1]?.description).toBeNull();
  });

  it('has no table without totals', () => {
    expect(topRepos(ERROR)).toBeNull();
    expect(topRepos(ok({ ...TOTALS, topRepos: [] }))).toBeNull();
  });
});

describe('repoColumnSizes', () => {
  it('counts the longest name and the widest printed star count, in characters', () => {
    const sizes = repoColumnSizes([
      repo('a-forty-character-repository-name-abcdef', 12345),
      repo('ralph', 3),
    ]);

    // '12,345' is six characters as printed; the name is forty.
    expect(sizes).toEqual({ nameChars: 40, starsChars: 6 });
  });

  it('never goes under the floor today’s short names and two-digit counts sit on', () => {
    expect(repoColumnSizes([repo('ralph', 3)])).toEqual({ nameChars: 16, starsChars: 4 });
    expect(repoColumnSizes([])).toEqual({ nameChars: 16, starsChars: 4 });
    // Four digits print as five characters ('1,234'), one more than the floor.
    expect(repoColumnSizes([repo('ralph', 1234)]).starsChars).toBe(5);
  });

  it('comes with the table, measured on the rows it shows and no others', () => {
    const table = topRepos(
      ok({
        ...TOTALS,
        topRepos: [
          ...TOTALS.topRepos.slice(0, 6),
          // The seventh repository is not shown, so its long name sizes nothing.
          repo('a-repository-that-is-not-shown-and-has-a-very-long-name', 99999),
        ],
      }),
    );

    expect(table?.rows).toHaveLength(6);
    expect(table?.columns).toEqual({ nameChars: 16, starsChars: 4 });
  });
});
