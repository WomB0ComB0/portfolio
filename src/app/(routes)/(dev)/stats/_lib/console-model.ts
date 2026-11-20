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
 * @file The /stats console's data, as the server loads it (console-loaders.ts), and the pure
 * shaping its tiles read. No directive and no server imports (the handler and integration types
 * are type-only), so tests and any component can use it.
 *
 * Never a made-up number: a source that failed is the error state, one with nothing to show is
 * idle, and neither is ever 0. Stale data keeps when it was read, so the tile can say how old it is.
 */

import type { ReactNode } from 'react';
import type { TypingTileData } from '@/app/_components/home/data/selectors';
import type { LiveInitial, TileResult } from '@/app/_components/home/data/tile-result';
import { joinMeta } from '@/app/_components/home/tiles/tile-states';
import type { GitHubStatsData, TopRepo } from '@/app/api/v1/[[...route]]/github-stats/handlers';
import type { LanyardData } from '@/app/api/v1/[[...route]]/lanyard/handlers';
import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import type { WakaTimeData } from '@/app/api/v1/[[...route]]/wakatime/handlers';
import { numberFormatter, type StatStripItem } from '@/components/console';
import { ageOn } from '@/constants/age';
import type { GitHubActivity } from '@/lib/api-integrations/github-activity';

/** Everything the console shows, each source settled on its own (never a throw). */
export interface StatsConsoleData {
  /** Twelve weeks of contributions and the latest public commit (the home tile's source). */
  readonly activity: TileResult<GitHubActivity>;
  /** Repositories, stars, followers and the top repositories. */
  readonly totals: TileResult<GitHubStatsData>;
  readonly leetcode: TileResult<LeetCodeStats>;
  /** The fastest 60 s Monkeytype test (the home tile's source). */
  readonly typing: TileResult<TypingTileData>;
  /** All-time coding time from WakaTime. */
  readonly codingTime: TileResult<WakaTimeData>;
  /** Google Analytics page views over the last 30 days. */
  readonly pageViews: TileResult<number>;
  /** Discord presence from Lanyard: a live island's server snapshot. */
  readonly discord: LiveInitial<LanyardData>;
  /** Spotify's now playing, which the Discord tile falls back to (the home tile's snapshot). */
  readonly nowPlaying: LiveInitial<NowPlayingResponse>;
}

/**
 * Every source of {@link StatsConsoleData} as its own promise, all started together, so a part of
 * the page that streams waits on its own sources only and the page frame waits on none of them
 * for longer than its short wait. Like the data, no promise ever rejects.
 */
export type StatsConsoleSources = {
  readonly [Source in keyof StatsConsoleData]: Promise<StatsConsoleData[Source]>;
};

/** The accuracy switch: a plain figure in the context line, or a gauge beside the wpm. */
export type AccuracyStyle = 'figures' | 'gauge';

/** What a StatTile shows for one source: its state, its figure and when it was read. */
export interface StatFigure {
  readonly state: 'ready' | 'stale' | 'idle' | 'error';
  /** Null outside ready and stale: there is no figure to show. */
  readonly value: number | null;
  /** ISO 8601; present when the source knows when it answered. */
  readonly updatedAt?: string;
}

/**
 * A source's result as a stat figure. Error stays error; empty, or data `pick` finds no figure
 * in, is idle; otherwise ready (stale when the source served its last good answer), with when it
 * was read.
 */
export function statFigure<T>(result: TileResult<T>, pick: (data: T) => number | null): StatFigure {
  if (result.status === 'error') return { state: 'error', value: null };
  if (result.status === 'empty') return { state: 'idle', value: null };
  const value = pick(result.data);
  if (value === null) return { state: 'idle', value: null };
  const figure: StatFigure = { state: result.stale ? 'stale' : 'ready', value };
  return result.asOf ? { ...figure, updatedAt: result.asOf } : figure;
}

const SECONDS_PER_HOUR = 3_600;

/** All-time coding time in whole hours (rounded down); null for zero or a non-finite total. */
export function codingHours(data: WakaTimeData): number | null {
  const seconds = data.total_seconds;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.floor(seconds / SECONDS_PER_HOUR);
}

const formatCount = (value: number): string => numberFormatter().format(value);
const formatPercent = (value: number): string =>
  numberFormatter({ maximumFractionDigits: 1 }).format(value);

/** True for a number worth printing: finite and above zero. */
const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * A no-break space, as the home tiles use it: it holds a figure to its word ('93% accuracy'), so a
 * narrow tile wraps a context line after a separator, never inside a part. joinMeta's separator
 * carries one before its dot for the same reason.
 */
const NBSP = ' ';

/**
 * '73.5% acceptance · rank 103,899'. A part that is not a positive finite number is left out, so
 * the line never prints a 0 that stands for nothing.
 */
export function leetCodeMeta(stats: LeetCodeStats): string {
  return joinMeta([
    isPositive(stats.acceptanceRate)
      ? `${formatPercent(stats.acceptanceRate)}%${NBSP}acceptance`
      : null,
    isPositive(stats.ranking) ? `rank${NBSP}${formatCount(stats.ranking)}` : null,
  ]);
}

/** The test the typing figure is from, as the home typing tile words it. */
const BEST_60 = `60${NBSP}s best`;

export interface TypingContextOptions {
  /** Says the accuracy in words; off when a gauge shows it. */
  readonly accuracy: boolean;
}

/**
 * '60 s best · 93% accuracy · 1,022 tests': the test, its accuracy to the whole percent (unless a
 * gauge shows it, or it is not finite) and how many tests were taken (unless none were counted).
 */
export function typingContext(data: TypingTileData, { accuracy }: TypingContextOptions): string {
  const percent = data.best60.accuracy;
  return joinMeta([
    BEST_60,
    accuracy && Number.isFinite(percent) ? `${Math.round(percent)}%${NBSP}accuracy` : null,
    isPositive(data.completedTests) ? `${formatCount(data.completedTests)}${NBSP}tests` : null,
  ]);
}

/** The hero's GitHub totals. */
export interface HeroTotals {
  readonly repos: number;
  readonly stars: number;
  readonly languages: readonly string[];
}

export type HeroSource = 'activity' | 'totals';

/** What the GitHub hero shows. */
export interface HeroModel {
  /**
   * 'ready': both sources answered. 'stale': at least one is a last good answer. 'partial': one
   * source has nothing to show, and `missing` says which. 'error': neither has.
   */
  readonly state: 'ready' | 'stale' | 'partial' | 'error';
  readonly activity: GitHubActivity | null;
  readonly totals: HeroTotals | null;
  /** The sources with nothing to show, activity first. */
  readonly missing: readonly HeroSource[];
  /** When the older of the shown sources was read (ISO 8601), so the age never flatters. */
  readonly asOf?: string;
}

const dataOf = <T>(result: TileResult<T>): T | null =>
  result.status === 'ok' ? result.data : null;

const isStale = (result: TileResult<unknown>): boolean => result.status === 'ok' && result.stale;

const asOfOf = (result: TileResult<unknown>): string | undefined =>
  result.status === 'ok' ? result.asOf : undefined;

/** The earliest of the valid ISO 8601 moments given; undefined without any. */
function olderOf(moments: readonly (string | undefined)[]): string | undefined {
  let oldest: string | undefined;
  for (const moment of moments) {
    if (moment === undefined || !Number.isFinite(Date.parse(moment))) continue;
    if (oldest === undefined || Date.parse(moment) < Date.parse(oldest)) oldest = moment;
  }
  return oldest;
}

/** The hero's state from what it has: missing anything is partial (both, error); stale wins. */
function heroState(
  missing: readonly HeroSource[],
  activity: TileResult<unknown>,
  totals: TileResult<unknown>,
): HeroModel['state'] {
  if (missing.length === 2) return 'error';
  if (missing.length === 1) return 'partial';
  return isStale(activity) || isStale(totals) ? 'stale' : 'ready';
}

/**
 * The hero from its two sources: the contributions and latest commit (activity) and the
 * repository, star and language totals. Each shows whenever its source has data, so one failure
 * never hides the other.
 */
export function heroModel(
  activity: TileResult<GitHubActivity>,
  totals: TileResult<GitHubStatsData>,
): HeroModel {
  const activityData = dataOf(activity);
  const totalsData = dataOf(totals);
  const missing: HeroSource[] = [];
  if (!activityData) missing.push('activity');
  if (!totalsData) missing.push('totals');
  const asOf = olderOf([asOfOf(activity), asOfOf(totals)]);
  const model: HeroModel = {
    state: heroState(missing, activity, totals),
    activity: activityData,
    totals: totalsData
      ? {
          repos: totalsData.user.repos,
          stars: totalsData.stats.totalStars,
          languages: totalsData.stats.topLanguages,
        }
      : null,
    missing,
  };
  return asOf ? { ...model, asOf } : model;
}

/** The header strip's labels, shared by the loaded strip and the one waiting on its sources. */
const AGE_LABEL = 'years old';
const PAGE_VIEWS_LABEL = 'page views in 30 days';
const FOLLOWERS_LABEL = 'GitHub followers';

/** The age item: whole years as its value, and `figure` (LiveAge) shown in their place if given. */
function ageItem(now: Date, figure?: ReactNode): StatStripItem {
  const age: StatStripItem = { label: AGE_LABEL, value: ageOn(now) };
  return figure === undefined ? age : { ...age, figure };
}

/**
 * The header strip: figures the tiles below don't repeat. Age (worked out now, in UTC, as the old
 * Dev Stats card did), page views over 30 days and GitHub followers. A source with nothing to
 * show gives null, which the strip prints as an em dash read as 'unavailable'.
 *
 * The age's value is whole years; `ageFigure` (the console passes LiveAge, the age to eight
 * decimals) is shown in its place.
 */
export function stripItems(
  data: Pick<StatsConsoleData, 'totals' | 'pageViews'>,
  now: Date,
  ageFigure?: ReactNode,
): StatStripItem[] {
  return [
    ageItem(now, ageFigure),
    { label: PAGE_VIEWS_LABEL, value: dataOf(data.pageViews) },
    { label: FOLLOWERS_LABEL, value: dataOf(data.totals)?.user.followers ?? null },
  ];
}

/**
 * The header strip while its sources load: the same labels, the age (which needs no source) and a
 * placeholder for each figure still on its way, so the loaded strip takes exactly this room. The
 * age takes `ageFigure` as in stripItems, so it is live from the first frame.
 */
export function pendingStripItems(now: Date, ageFigure?: ReactNode): StatStripItem[] {
  return [
    ageItem(now, ageFigure),
    { label: PAGE_VIEWS_LABEL, value: null, loading: true },
    { label: FOLLOWERS_LABEL, value: null, loading: true },
  ];
}

/** How many repositories the table lists. */
export const TOP_REPOS_SHOWN = 6;

/**
 * The floors of the table's two content-sized columns, in characters: a name column that never
 * closes up on a set of short names, and room for a four-character count ('1,234', or three
 * digits and air) under the 'Stars' label.
 */
const MIN_NAME_CHARS = 16;
const MIN_STARS_CHARS = 4;

/** How wide the table's content-sized columns have to be, in characters. */
export interface RepoColumnSizes {
  /** The longest repository name shown. */
  readonly nameChars: number;
  /** The widest star count shown, counted as it is printed: '12,345' is six. */
  readonly starsChars: number;
}

/**
 * The name and star columns measured on `rows`, never under their floors. The table's columns are
 * fixed (the kit lays every row out from one colgroup), so a width sized for today's data cut a
 * five-digit count and wrapped a longer name beside an About cell with room to spare; counted
 * here, the columns follow whatever GitHub returns.
 */
export function repoColumnSizes(rows: readonly Pick<TopRepo, 'name' | 'stars'>[]): RepoColumnSizes {
  return {
    nameChars: Math.max(MIN_NAME_CHARS, ...rows.map((row) => row.name.length)),
    starsChars: Math.max(MIN_STARS_CHARS, ...rows.map((row) => formatCount(row.stars).length)),
  };
}

/** The top repositories table: its rows, most stars first, and how many repositories there are. */
export interface TopReposTable {
  readonly rows: readonly TopRepo[];
  readonly total: number;
  /** The content-sized columns, measured on `rows`. */
  readonly columns: RepoColumnSizes;
}

/** The first {@link TOP_REPOS_SHOWN} repositories by stars; null without totals or rows. */
export function topRepos(totals: TileResult<GitHubStatsData>): TopReposTable | null {
  const data = dataOf(totals);
  if (!data || data.topRepos.length === 0) return null;
  const rows = data.topRepos.slice(0, TOP_REPOS_SHOWN);
  return { rows, total: data.user.repos, columns: repoColumnSizes(rows) };
}
