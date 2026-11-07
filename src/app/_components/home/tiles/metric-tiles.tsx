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

import 'server-only';

/**
 * @file The two single-figure home tiles, LeetCode solved and typing speed. Each exports a pure
 * view of its TileResult, the async server tile that loads it, and a skeleton the loaded tile's
 * size.
 *
 * With data, each is a linked tile whose label is its one stretched link, to the profile ('LeetCode
 * profile (opens in a new tab)'). Three type styles: the label, the figure with its unit, and the
 * context (LeetCode's legend, typing's '60 s best · 93% accuracy'). The tile hugs them: LeetCode
 * has no line under its legend. In the error state the tile is plain and its note links the
 * profile; it never shows a number.
 */

import type { ReactElement, ReactNode } from 'react';

import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import {
  numberFormatter,
  SegmentBar,
  type SegmentBarSegment,
  SegmentBarSkeleton,
  Tile,
  TileLink,
} from '@/components/console';
import type { Instant } from '../data/format';
import { loadLeetCode, loadTyping } from '../data/loaders';
import type { TypingTileData } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  asOfText,
  FigureRow,
  FigureRowSkeleton,
  joinMeta,
  LoadingNote,
  ShapePlaceholder,
  StaleNote,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

export const LEETCODE_PROFILE_URL = 'https://leetcode.com/u/WomB0ComB0/';
export const MONKEYTYPE_PROFILE_URL = 'https://monkeytype.com/profile/WomB0ComB0';

const LEETCODE_LABEL = 'LeetCode';
const TYPING_LABEL = 'Typing';
/** The test the figure is from. A no-break space keeps '60 s' on one line. */
const BEST_60 = '60 s best';

const TILE_CLASS = 'gap-3';
/** Words in the figure's place: the tile's primary line. */
const IDLE_CLASS = 'tile-title text-muted-foreground';
/** The skeleton's figure, three digits wide: LeetCode's 692 and typing's 101. */
const FIGURE_DIGITS = 3;

/**
 * LeetCode's difficulties in bar order: each one's name, LeetCode's own colour for it (teal, amber,
 * red, as on leetcode.com, so the split never reads in another palette) and solved count.
 */
const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', tone: 'leet-easy', solved: 'easySolved' },
  { key: 'medium', label: 'Medium', tone: 'leet-medium', solved: 'mediumSolved' },
  { key: 'hard', label: 'Hard', tone: 'leet-hard', solved: 'hardSolved' },
] as const satisfies readonly (Omit<SegmentBarSegment, 'value'> & {
  solved: keyof LeetCodeStats;
})[];

const formatCount = (value: number): string => numberFormatter().format(value);

/** The solved split as the bar's parts, easy to hard. */
export function leetCodeSegments(stats: LeetCodeStats): SegmentBarSegment[] {
  return DIFFICULTIES.map(({ key, label, tone, solved }) => ({
    key,
    label,
    value: stats[solved],
    tone,
  }));
}

interface LinkedMetricProps {
  label: string;
  href: string;
  /** Read after the label, e.g. 'profile': 'LeetCode profile (opens in a new tab)'. */
  srSuffix: string;
  state: 'ready' | 'stale' | 'empty';
  children: ReactNode;
}

/** A metric tile with somewhere to go: its label is the stretched link to the profile. */
function LinkedMetric({ label, href, srSuffix, state, children }: LinkedMetricProps): ReactElement {
  return (
    <Tile variant="linked" className={TILE_CLASS} data-state={state}>
      <TileLabel>
        <TileLink href={href} external srSuffix={srSuffix} className="text-inherit">
          {label}
        </TileLink>
      </TileLabel>
      {children}
    </Tile>
  );
}

interface MetricUnavailableProps {
  label: string;
  message: string;
  href: string;
  linkLabel: string;
}

/** The error state: a plain tile, words and an ordinary link to the profile. */
function MetricUnavailable({ label, ...note }: MetricUnavailableProps): ReactElement {
  return (
    <Tile className={TILE_CLASS} data-state="error">
      <TileLabel>{label}</TileLabel>
      <TileUnavailable {...note} external />
    </Tile>
  );
}

/** When stale data was read, or '' when that is not known. */
const staleWhen = (asOf: string | undefined, now: Instant): string =>
  asOf ? asOfText(asOf, now) : '';

export interface LeetCodeTileViewProps {
  result: TileResult<LeetCodeStats>;
  now?: Instant;
}

/** LeetCode's solved count and its easy, medium and hard split. */
export function LeetCodeTileView({
  result,
  now = Date.now(),
}: LeetCodeTileViewProps): ReactElement {
  if (result.status === 'error') {
    return (
      <MetricUnavailable
        label={LEETCODE_LABEL}
        message="LeetCode stats unavailable"
        href={LEETCODE_PROFILE_URL}
        linkLabel="LeetCode profile"
      />
    );
  }
  const link = { label: LEETCODE_LABEL, href: LEETCODE_PROFILE_URL, srSuffix: 'profile' };
  if (result.status === 'empty') {
    return (
      <LinkedMetric {...link} state="empty">
        <p className={IDLE_CLASS}>No solved problems yet</p>
      </LinkedMetric>
    );
  }
  const { data, stale, asOf } = result;
  return (
    <LinkedMetric {...link} state={stale ? 'stale' : 'ready'}>
      <FigureRow value={formatCount(data.totalSolved)} unit="solved" size="md" />
      <SegmentBar segments={leetCodeSegments(data)} />
      {stale && <StaleNote>{staleWhen(asOf, now)}</StaleNote>}
    </LinkedMetric>
  );
}

/** The loading LeetCode tile: the real label, the figure's row, the bar and its legend. */
export function LeetCodeTileSkeleton(): ReactElement {
  return (
    <Tile className={TILE_CLASS} aria-busy="true" data-state="loading">
      <TileLabel>{LEETCODE_LABEL}</TileLabel>
      <FigureRowSkeleton digits={FIGURE_DIGITS} unit="solved" size="md" />
      <SegmentBarSkeleton segments={DIFFICULTIES} />
      <LoadingNote>Loading LeetCode stats</LoadingNote>
    </Tile>
  );
}

export async function LeetCodeTile(): Promise<ReactElement> {
  return <LeetCodeTileView result={await loadLeetCode()} />;
}

export interface TypingTileViewProps {
  result: TileResult<TypingTileData>;
  now?: Instant;
}

/**
 * '60 s best · 93% accuracy': the test and its accuracy, to the whole percent. Without a finite
 * accuracy, just the test. A no-break space holds '93% accuracy' together, so a narrow tile (the
 * 181 px lane of a 375 px phone) wraps the line after the dot, not before 'accuracy'.
 */
export function typingMeta(accuracy: number): string {
  return joinMeta([
    BEST_60,
    Number.isFinite(accuracy) ? `${Math.round(accuracy)}% accuracy` : null,
  ]);
}

/** The fastest 60 s Monkeytype test, with its accuracy; a stale one says when it was read. */
export function TypingTileView({ result, now = Date.now() }: TypingTileViewProps): ReactElement {
  if (result.status === 'error') {
    return (
      <MetricUnavailable
        label={TYPING_LABEL}
        message="Typing stats unavailable"
        href={MONKEYTYPE_PROFILE_URL}
        linkLabel="Monkeytype profile"
      />
    );
  }
  const link = {
    label: TYPING_LABEL,
    href: MONKEYTYPE_PROFILE_URL,
    srSuffix: 'profile on Monkeytype',
  };
  if (result.status === 'empty') {
    return (
      <LinkedMetric {...link} state="empty">
        <p className={IDLE_CLASS}>No 60 s test yet</p>
      </LinkedMetric>
    );
  }
  const { data, stale, asOf } = result;
  const { wpm, accuracy } = data.best60;
  return (
    <LinkedMetric {...link} state={stale ? 'stale' : 'ready'}>
      <FigureRow value={formatCount(wpm)} unit="wpm" size="md" />
      {stale ? (
        <StaleNote>{joinMeta([BEST_60, staleWhen(asOf, now)])}</StaleNote>
      ) : (
        <TileMeta>{typingMeta(accuracy)}</TileMeta>
      )}
    </LinkedMetric>
  );
}

/** An accuracy as wide as most: the typing skeleton's context line holds room for two digits. */
const SKELETON_ACCURACY = 88;

/**
 * The loading typing tile: the real label, the figure's row and the context line. The line is a
 * bar the shape of '60 s best · 88% accuracy', so it wraps where the loaded line does: in a 181 px
 * lane (a 375 px window beside a scrollbar) the loaded line takes two lines, and a one-line bar
 * left the skeleton 18 px short.
 */
export function TypingTileSkeleton(): ReactElement {
  return (
    <Tile className={TILE_CLASS} aria-busy="true" data-state="loading">
      <TileLabel>{TYPING_LABEL}</TileLabel>
      <FigureRowSkeleton digits={FIGURE_DIGITS} unit="wpm" size="md" />
      <p aria-hidden="true" className="tile-meta">
        <ShapePlaceholder shape={typingMeta(SKELETON_ACCURACY)} />
      </p>
      <LoadingNote>Loading typing stats</LoadingNote>
    </Tile>
  );
}

export async function TypingTile(): Promise<ReactElement> {
  return <TypingTileView result={await loadTyping()} />;
}
