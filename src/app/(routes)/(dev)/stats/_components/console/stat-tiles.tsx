import 'server-only';

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
 * @file The console's secondary tiles: LeetCode, typing and coding time, one figure each on the
 * kit's StatTile, smaller than the GitHub hero (figure-md beside its display figure).
 *
 * They read the home bento's sources and pieces (its LeetCode and typing loaders, the LeetCode
 * split in LeetCode's own colours, the profile links), so home and /stats agree. What they add is
 * the age of every figure: the context line ends 'updated 3 min ago' (PresentAge), and a stale
 * figure says so first, the note standing in for 'updated' ('Stale · all time · 1 h ago'). The
 * age is re-read while the page is open, so it sits in the room of its
 * widest wording and a line never re-wraps as it grows. Every figure sits right under its label,
 * so a row of tiles lines up. A tile with a profile is one link to it (the kit's spring lift); in
 * the error state it is plain, with words and a link to the profile instead of a number.
 *
 * Where each tile sits in the grid is in console-layout.ts; its figure is the kit's fit tier,
 * which shrinks with the tile in half a phone row.
 */

import type { ReactElement, ReactNode } from 'react';

import type { TypingTileData } from '@/app/_components/home/data/selectors';
import type { TileResult } from '@/app/_components/home/data/tile-result';
import {
  LEETCODE_DIFFICULTIES,
  LEETCODE_PROFILE_URL,
  leetCodeSegments,
  MONKEYTYPE_PROFILE_URL,
} from '@/app/_components/home/tiles/metric-tiles';
import { ExternalAnchor } from '@/app/_components/home/tiles/tile-states';
import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import type { WakaTimeData } from '@/app/api/v1/[[...route]]/wakatime/handlers';
import {
  SegmentBar,
  SegmentBarSkeleton,
  StatTile,
  StatTileSkeleton,
  type TileSpan,
} from '@/components/console';
import {
  type AccuracyStyle,
  codingHours,
  leetCodeMeta,
  type StatFigure,
  statFigure,
  typingContext,
} from '../../_lib/console-model';
import { AccuracyGauge } from './accuracy-gauge';
import { AGE_CELL_CLASS, AgeRoom, WIDEST_BARE_AGE } from './age-room';
import {
  CODING_AGE_LINE_CLASS,
  CODING_SPAN,
  LEETCODE_SPAN,
  STAT_PAIR_CLASS,
  TYPING_AGE_LINE_CLASS,
  TYPING_SPAN,
} from './console-layout';
import { MetaRow, metaParts } from './meta-row';
import { PresentAge } from './present-age';

/** Each tile's label, which its skeleton shows too. */
const LEETCODE_LABEL = 'LeetCode';
const TYPING_LABEL = 'Typing';
const CODING_LABEL = 'Coding time';

/** Typing's and coding time's places in the pair: their shared phone row and their ages' line. */
const TYPING_CLASS = `${STAT_PAIR_CLASS} ${TYPING_AGE_LINE_CLASS}`;
const CODING_CLASS = `${STAT_PAIR_CLASS} ${CODING_AGE_LINE_CLASS}`;

const ACTION_CLASS =
  'relative z-10 inline-flex items-center gap-0.5 font-medium text-brand-ink underline-offset-4 hover:underline';

/**
 * Beside the kit's stale note the context line takes the rest of the row while that leaves it
 * 8rem; in a narrower tile (half a phone row) it drops under the note and takes the full width,
 * rather than being squeezed beside it with its words clipped.
 */
const CONTEXT_LINE_CLASS = 'flex-[1_1_8rem]';

interface AgeProps {
  /** When the figure was read. */
  readonly at: string;
  /** The figure is stale: the kit's note ('Stale ·' and its clock) leads the line. */
  readonly stale: boolean;
}

interface ContextLineProps {
  /** The tile's own words, e.g. '73.5% acceptance · rank 103,899'; '' for none. */
  readonly text: string;
  /** When the figure was read; its age ends the line. */
  readonly updatedAt?: string;
  /** The figure is stale (see Age); fresh when left out. */
  readonly stale?: boolean;
}

/**
 * How old the figure is, in the room of the widest age (age-room.tsx): the line wraps part by
 * part, and where it breaks must not depend on the clock.
 *
 * Beside the kit's stale note the age goes without 'updated' ('Stale · all time · 1 h ago'): the
 * note says the figure is old, and it takes about that word's width before the line. With the
 * word, a line that was one line fresh took two (coding time in its 3 of 12 columns), and the
 * tile beside it was stretched by that line. Without it the line wraps as it does fresh at every
 * width but a few (where the note leaves the line just over its 8rem basis, or a fresh line fits
 * by a pixel), against most widths before.
 */
function Age({ at, stale }: AgeProps): ReactElement {
  if (stale) {
    return (
      <AgeRoom widest={WIDEST_BARE_AGE}>
        <PresentAge at={at} prefix="" className={AGE_CELL_CLASS} />
      </AgeRoom>
    );
  }
  return (
    <AgeRoom>
      <PresentAge at={at} className={AGE_CELL_CLASS} />
    </AgeRoom>
  );
}

/** The context line: the tile's words part by part (MetaRow), then how old the figure is. */
function ContextLine({ text, updatedAt, stale = false }: ContextLineProps): ReactNode {
  const age = updatedAt ? [{ key: 'age', body: <Age at={updatedAt} stale={stale} /> }] : [];
  return <MetaRow parts={metaParts(text, age)} className={CONTEXT_LINE_CLASS} />;
}

interface ConsoleStatProps {
  /** `data-stats-tile`, for the browser checks. */
  readonly tile: string;
  readonly label: string;
  readonly figure: StatFigure;
  readonly unit: string;
  /** Words for the context line while there is a figure. */
  readonly context: string;
  readonly idleText: string;
  readonly errorText: string;
  /** The profile the tile links to; without one the tile is plain. */
  readonly profile?: { readonly href: string; readonly name: string };
  /** The tile's place in the grid at every tier (console-layout.ts). */
  readonly span: TileSpan;
  /** Grid classes a span cannot say, e.g. the phone pair's own step (console-layout.ts). */
  readonly className?: string;
  /** Under the figure while there is one, e.g. the LeetCode split. */
  readonly children?: ReactNode;
}

/**
 * One stat tile in its state. With a figure (or idle text) and a profile it is one link to the
 * profile; in the error state, or without a profile, it is plain, and an error offers the profile
 * as an ordinary link.
 */
function ConsoleStat({
  tile,
  label,
  figure,
  unit,
  context,
  idleText,
  errorText,
  profile,
  span,
  className,
  children,
}: ConsoleStatProps): ReactElement {
  const hasFigure = figure.state === 'ready' || figure.state === 'stale';
  const shared = {
    label,
    labelAs: 'h2' as const,
    value: figure.value,
    unit,
    state: figure.state,
    idleText,
    errorText,
    // A fifth of the tile, 24px to 36px: five digits and their unit share a line in half a
    // phone row and in a quarter of the tablet grid.
    size: 'fit' as const,
    span,
    className,
    // Right under the label, so the tiles of one row put their figures on one line whatever
    // their context lines wrap to.
    align: 'start' as const,
    meta: hasFigure ? (
      <ContextLine text={context} updatedAt={figure.updatedAt} stale={figure.state === 'stale'} />
    ) : undefined,
    'data-stats-tile': tile,
    children: hasFigure ? children : undefined,
  };
  if (figure.state === 'error' || !profile) {
    const action = profile && (
      <ExternalAnchor href={profile.href} className={ACTION_CLASS}>
        {profile.name}
      </ExternalAnchor>
    );
    return <StatTile {...shared} action={figure.state === 'error' ? action : undefined} />;
  }
  return <StatTile {...shared} variant="interactive" href={profile.href} external />;
}

const dataOf = <T,>(result: TileResult<T>): T | null =>
  result.status === 'ok' ? result.data : null;

/** LeetCode: problems solved, the easy, medium and hard split, acceptance and rank. */
export function LeetCodeStat({
  result,
}: {
  readonly result: TileResult<LeetCodeStats>;
}): ReactElement {
  const data = dataOf(result);
  return (
    <ConsoleStat
      tile="leetcode"
      label={LEETCODE_LABEL}
      figure={statFigure(result, (stats) => stats.totalSolved)}
      unit="solved"
      context={data ? leetCodeMeta(data) : ''}
      idleText="No solved problems yet"
      errorText="LeetCode stats unavailable"
      profile={{ href: LEETCODE_PROFILE_URL, name: 'LeetCode profile' }}
      span={LEETCODE_SPAN}
    >
      {data && <SegmentBar segments={leetCodeSegments(data)} />}
    </ConsoleStat>
  );
}

export interface TypingStatProps {
  readonly result: TileResult<TypingTileData>;
  /** Accuracy in the context line ('figures') or as a gauge under the wpm ('gauge'). */
  readonly accuracy: AccuracyStyle;
}

/** Typing: the fastest 60 s Monkeytype test, its accuracy and how many tests were taken. */
export function TypingStat({ result, accuracy }: TypingStatProps): ReactElement {
  const data = dataOf(result);
  const percent = data?.best60.accuracy ?? Number.NaN;
  const gauge = accuracy === 'gauge' && Number.isFinite(percent);
  return (
    <ConsoleStat
      tile="typing"
      label={TYPING_LABEL}
      figure={statFigure(result, (typing) => typing.best60.wpm)}
      unit="wpm"
      context={data ? typingContext(data, { accuracy: !gauge }) : ''}
      idleText="No 60 s test yet"
      errorText="Typing stats unavailable"
      profile={{ href: MONKEYTYPE_PROFILE_URL, name: 'Monkeytype profile' }}
      span={TYPING_SPAN}
      className={TYPING_CLASS}
    >
      {gauge && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AccuracyGauge value={percent} label={`${Math.round(percent)}% accuracy`} />
          <span aria-hidden="true" className="tile-meta text-muted-foreground">
            accuracy
          </span>
        </div>
      )}
    </ConsoleStat>
  );
}

/** Coding time: all-time hours from WakaTime. No public profile to link, so a plain tile. */
export function CodingTimeStat({
  result,
}: {
  readonly result: TileResult<WakaTimeData>;
}): ReactElement {
  return (
    <ConsoleStat
      tile="coding"
      label={CODING_LABEL}
      figure={statFigure(result, codingHours)}
      unit="hours"
      context="all time"
      idleText="No coding time yet"
      errorText="Coding time unavailable"
      span={CODING_SPAN}
      className={CODING_CLASS}
    />
  );
}

interface ConsoleStatSkeletonProps {
  /** `data-stats-skeleton`, for the browser checks: the tile it stands in for. */
  readonly tile: string;
  readonly label: string;
  readonly span: TileSpan;
  readonly className?: string;
  /** Under the figure's placeholder, where the loaded tile has something there (the split). */
  readonly children?: ReactNode;
}

/**
 * A stat tile while its source loads (/stats streams each tile on its own): the kit's StatTile
 * skeleton with the loaded tile's label, heading, figure tier, alignment and place in the grid,
 * so its three rows sit where the loaded tile's do and the tile lands without moving its row.
 */
function ConsoleStatSkeleton({
  tile,
  label,
  span,
  className,
  children,
}: ConsoleStatSkeletonProps): ReactElement {
  return (
    <StatTileSkeleton
      label={label}
      labelAs="h2"
      size="fit"
      align="start"
      span={span}
      className={className}
      data-stats-skeleton={tile}
    >
      {children}
    </StatTileSkeleton>
  );
}

/** LeetCode while it loads, with the split's track and legend held (SegmentBarSkeleton). */
export function LeetCodeStatSkeleton(): ReactElement {
  return (
    <ConsoleStatSkeleton tile="leetcode" label={LEETCODE_LABEL} span={LEETCODE_SPAN}>
      <SegmentBarSkeleton segments={LEETCODE_DIFFICULTIES} />
    </ConsoleStatSkeleton>
  );
}

/** Typing while it loads, in its place in the pair (the phone row it shares, its age's line). */
export function TypingStatSkeleton(): ReactElement {
  return (
    <ConsoleStatSkeleton
      tile="typing"
      label={TYPING_LABEL}
      span={TYPING_SPAN}
      className={TYPING_CLASS}
    />
  );
}

/** Coding time while it loads, in its place in the pair. */
export function CodingTimeStatSkeleton(): ReactElement {
  return (
    <ConsoleStatSkeleton
      tile="coding"
      label={CODING_LABEL}
      span={CODING_SPAN}
      className={CODING_CLASS}
    />
  );
}
