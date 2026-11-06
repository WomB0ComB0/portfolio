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
 * @file The two single-figure home tiles, LeetCode solved and typing speed, on the console
 * StatTile. Each exports a pure view of its TileResult, the async server tile that loads it, and
 * a skeleton with the real label.
 *
 * With data, the whole tile is one link to the profile. In the error state it is a plain tile
 * whose action is an ordinary link to the same profile, and the figure is a dash next to words.
 */

import type { ReactElement } from 'react';

import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import {
  SegmentBar,
  type SegmentBarSegment,
  SegmentBarSkeleton,
  StatTile,
  StatTileSkeleton,
} from '@/components/console';
import type { Instant } from '../data/format';
import { loadLeetCode, loadTyping } from '../data/loaders';
import type { TypingTileData } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import { asOfText, ExternalAnchor, joinMeta } from './tile-states';

export const LEETCODE_PROFILE_URL = 'https://leetcode.com/u/WomB0ComB0/';
export const MONKEYTYPE_PROFILE_URL = 'https://monkeytype.com/profile/WomB0ComB0';

const LEETCODE_LABEL = 'LeetCode';
/** The LeetCode handler's CACHE_DURATION (leetcode/handlers.ts). */
const LEETCODE_META = 'refreshed every 6 h';
const TYPING_LABEL = 'Typing';

const ACTION_LINK_CLASS = 'inline-flex items-center gap-0.5 font-medium text-brand-ink';

/** LeetCode's difficulties in bar order: each one's name, fixed chart series and solved count. */
const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', tone: 1, solved: 'easySolved' },
  { key: 'medium', label: 'Medium', tone: 2, solved: 'mediumSolved' },
  { key: 'hard', label: 'Hard', tone: 3, solved: 'hardSolved' },
] as const satisfies readonly (Omit<SegmentBarSegment, 'value'> & {
  solved: keyof LeetCodeStats;
})[];

/** The solved split as the bar's parts, easy to hard. */
export function leetCodeSegments(stats: LeetCodeStats): SegmentBarSegment[] {
  return DIFFICULTIES.map(({ key, label, tone, solved }) => ({
    key,
    label,
    value: stats[solved],
    tone,
  }));
}

export interface LeetCodeTileViewProps {
  result: TileResult<LeetCodeStats>;
  now?: Instant;
}

/** LeetCode's solved count and its easy, medium and hard split. */
export function LeetCodeTileView({
  result,
  now = Date.now(),
}: LeetCodeTileViewProps): ReactElement {
  const shared = { label: LEETCODE_LABEL, labelAs: 'h2', size: 'lg' } as const;
  if (result.status === 'error') {
    return (
      <StatTile
        {...shared}
        state="error"
        errorText="LeetCode stats unavailable"
        action={
          <ExternalAnchor href={LEETCODE_PROFILE_URL} className={ACTION_LINK_CLASS}>
            LeetCode profile
          </ExternalAnchor>
        }
      />
    );
  }
  const profileLink = {
    variant: 'interactive',
    href: LEETCODE_PROFILE_URL,
    external: true,
  } as const;
  if (result.status === 'empty') {
    return <StatTile {...shared} {...profileLink} idleText="No solved problems yet" />;
  }
  const { data, stale, asOf } = result;
  const staleNote = stale && asOf ? asOfText(asOf, now) : '';
  return (
    <StatTile
      {...shared}
      {...profileLink}
      value={data.totalSolved}
      unit="solved"
      state={stale ? 'stale' : 'ready'}
      meta={staleNote || LEETCODE_META}
    >
      <SegmentBar segments={leetCodeSegments(data)} />
    </StatTile>
  );
}

/** The loading LeetCode tile: the real label, with room for the bar and its legend. */
export function LeetCodeTileSkeleton(): ReactElement {
  return (
    <StatTileSkeleton label={LEETCODE_LABEL} labelAs="h2" size="lg">
      <SegmentBarSkeleton segments={DIFFICULTIES} />
    </StatTileSkeleton>
  );
}

export async function LeetCodeTile(): Promise<ReactElement> {
  return <LeetCodeTileView result={await loadLeetCode()} />;
}

export interface TypingTileViewProps {
  result: TileResult<TypingTileData>;
  now?: Instant;
}

/** The fastest 60 s Monkeytype test, with its accuracy; a stale one says when it was read. */
export function TypingTileView({ result, now = Date.now() }: TypingTileViewProps): ReactElement {
  const shared = { label: TYPING_LABEL, labelAs: 'h2', size: 'lg' } as const;
  if (result.status === 'error') {
    return (
      <StatTile
        {...shared}
        state="error"
        errorText="Typing stats unavailable"
        action={
          <ExternalAnchor href={MONKEYTYPE_PROFILE_URL} className={ACTION_LINK_CLASS}>
            Monkeytype profile
          </ExternalAnchor>
        }
      />
    );
  }
  const profileLink = {
    variant: 'interactive',
    href: MONKEYTYPE_PROFILE_URL,
    external: true,
  } as const;
  if (result.status === 'empty') {
    return <StatTile {...shared} {...profileLink} idleText="No 60 s test yet" />;
  }
  const { data, stale, asOf } = result;
  const { wpm, accuracy } = data.best60;
  const meta = stale
    ? joinMeta(['60 s best', asOf ? asOfText(asOf, now) : null])
    : joinMeta(['60 s personal best', `${accuracy}% acc`]);
  return (
    <StatTile
      {...shared}
      {...profileLink}
      value={wpm}
      unit="wpm"
      state={stale ? 'stale' : 'ready'}
      meta={meta}
    />
  );
}

/** The loading typing tile, with the real label. */
export function TypingTileSkeleton(): ReactElement {
  return <StatTileSkeleton label={TYPING_LABEL} labelAs="h2" size="lg" />;
}

export async function TypingTile(): Promise<ReactElement> {
  return <TypingTileView result={await loadTyping()} />;
}
