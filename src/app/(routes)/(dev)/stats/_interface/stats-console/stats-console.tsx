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

import type { ReactElement } from 'react';
import { PageShell, StatStrip, TileGrid } from '@/components/console';
import {
  DESKTOP_TIER_CLASS,
  PAIR_SHARE_CLASS,
  TABLET_TIER_CLASS,
} from '../../_components/console/console-layout';
import { DiscordTile } from '../../_components/console/discord-tile';
import { GitHubHero } from '../../_components/console/github-hero';
import { RepositoryTable } from '../../_components/console/repository-table';
import { CodingTimeStat, LeetCodeStat, TypingStat } from '../../_components/console/stat-tiles';
import {
  type AccuracyStyle,
  heroModel,
  type StatsConsoleData,
  stripItems,
} from '../../_lib/console-model';

export interface StatsConsoleProps {
  readonly data: StatsConsoleData;
  readonly accuracy?: AccuracyStyle;
  readonly profileId: string;
  readonly now?: number;
  /** False inside the lab, whose surrounding frame already pads its content. */
  readonly gutter?: boolean;
}

/**
 * The full console: final server figures and isolated source failures, with only Discord polling
 * after hydration. Both the real route and the lab use this same body and the same loader.
 *
 * The kit's header and strip are sized by the page container (`sizing="container"`) and the grid
 * has one tier of this page's own and its own rows in the 12-column tier (console-layout.ts), so
 * every part answers to the width it actually has rather than to the viewport, and every tile is
 * as tall as what it holds.
 */
export function StatsConsole({
  data,
  accuracy = 'figures',
  profileId,
  now = Date.now(),
  gutter,
}: StatsConsoleProps): ReactElement {
  return (
    <PageShell
      eyebrow="Activity"
      title="Stats"
      description="What I'm building, practising and up to. Each source keeps its own clock."
      stats={
        <StatStrip
          aria-label="At a glance"
          items={stripItems(data, new Date(now))}
          sizing="container"
        />
      }
      gutter={gutter}
      sizing="container"
    >
      <TileGrid
        aria-label="Activity and development stats"
        className={`${PAIR_SHARE_CLASS} ${TABLET_TIER_CLASS} ${DESKTOP_TIER_CLASS}`}
      >
        <GitHubHero hero={heroModel(data.activity, data.totals)} now={now} />
        <DiscordTile
          initial={data.discord}
          nowPlaying={data.nowPlaying}
          profileId={profileId}
          renderedAt={now}
        />
        <LeetCodeStat result={data.leetcode} />
        <TypingStat result={data.typing} accuracy={accuracy} />
        <CodingTimeStat result={data.codingTime} />
      </TileGrid>
      <RepositoryTable result={data.totals} />
    </PageShell>
  );
}
