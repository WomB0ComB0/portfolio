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
 * @file The /stats console body: one frame (ConsoleFrame: the header, the tile grid and the
 * repository table, in that order) holding seven parts (consoleParts: the strip's figures, the
 * hero, Discord, LeetCode, typing, coding time, the repositories), each written once with the
 * sources it shows and its skeleton. Rendered two ways:
 * - StreamedStatsConsole, what /stats renders: a part whose sources had answered when the page
 *   sent its frame is rendered in place (readable without JavaScript); any other awaits its own
 *   sources inside its own Suspense boundary, behind its skeleton in the same place and size, so
 *   a slow source holds back only the parts that show it.
 * - StatsConsole, the whole console from data already loaded (the lab and the tests).
 *
 * The kit's header and strip are sized by the page container (`sizing="container"`) and the grid
 * has one tier of this page's own and its own rows in the 12-column tier (console-layout.ts), so
 * every part answers to the width it actually has rather than to the viewport, and every tile is
 * as tall as what it holds.
 */

import { type ReactElement, type ReactNode, Suspense } from 'react';
import { PageShell, StatStrip, TileGrid } from '@/components/console';
import {
  DESKTOP_TIER_CLASS,
  PAIR_SHARE_CLASS,
  TABLET_TIER_CLASS,
} from '../../_components/console/console-layout';
import { DiscordTile, DiscordTileSkeleton } from '../../_components/console/discord-tile';
import { GitHubHero, GitHubHeroSkeleton } from '../../_components/console/github-hero';
import {
  RepositoryTable,
  RepositoryTableSkeleton,
} from '../../_components/console/repository-table';
import {
  CodingTimeStat,
  CodingTimeStatSkeleton,
  LeetCodeStat,
  LeetCodeStatSkeleton,
  TypingStat,
  TypingStatSkeleton,
} from '../../_components/console/stat-tiles';
import {
  type AccuracyStyle,
  heroModel,
  pendingStripItems,
  type StatsConsoleData,
  type StatsConsoleSources,
  stripItems,
} from '../../_lib/console-model';

const STRIP_LABEL = 'At a glance';

type ConsoleSource = keyof StatsConsoleData;

/** One part of the console: the sources it shows, how it shows them, and its skeleton. */
interface ConsolePart<K extends ConsoleSource> {
  readonly sources: readonly K[];
  readonly render: (data: Pick<StatsConsoleData, K>) => ReactNode;
  readonly skeleton: () => ReactNode;
}

const consolePart = <K extends ConsoleSource>(
  sources: readonly K[],
  render: (data: Pick<StatsConsoleData, K>) => ReactNode,
  skeleton: () => ReactNode,
): ConsolePart<K> => ({ sources, render, skeleton });

interface PartOptions {
  readonly accuracy: AccuracyStyle;
  readonly profileId: string;
  /**
   * The render's clock (epoch ms), read when a part renders: an age or Discord's `renderedAt` is
   * then when that part was rendered, in place or streamed.
   */
  readonly clock: () => number;
}

/** The seven parts, each the one place its render and its skeleton are written. */
function consoleParts({ accuracy, profileId, clock }: PartOptions) {
  return {
    strip: consolePart(
      ['totals', 'pageViews'],
      (data) => (
        <StatStrip
          aria-label={STRIP_LABEL}
          items={stripItems(data, new Date(clock()))}
          sizing="container"
        />
      ),
      () => (
        <StatStrip
          aria-label={STRIP_LABEL}
          items={pendingStripItems(new Date(clock()))}
          sizing="container"
        />
      ),
    ),
    hero: consolePart(
      ['activity', 'totals'],
      ({ activity, totals }) => <GitHubHero hero={heroModel(activity, totals)} now={clock()} />,
      () => <GitHubHeroSkeleton />,
    ),
    discord: consolePart(
      ['discord', 'nowPlaying'],
      ({ discord, nowPlaying }) => (
        <DiscordTile
          initial={discord}
          nowPlaying={nowPlaying}
          profileId={profileId}
          renderedAt={clock()}
        />
      ),
      () => <DiscordTileSkeleton />,
    ),
    leetcode: consolePart(
      ['leetcode'],
      ({ leetcode }) => <LeetCodeStat result={leetcode} />,
      () => <LeetCodeStatSkeleton />,
    ),
    typing: consolePart(
      ['typing'],
      ({ typing }) => <TypingStat result={typing} accuracy={accuracy} />,
      () => <TypingStatSkeleton />,
    ),
    coding: consolePart(
      ['codingTime'],
      ({ codingTime }) => <CodingTimeStat result={codingTime} />,
      () => <CodingTimeStatSkeleton />,
    ),
    repositories: consolePart(
      ['totals'],
      ({ totals }) => <RepositoryTable result={totals} />,
      () => <RepositoryTableSkeleton />,
    ),
  };
}

/** The console's parts, each already rendered (or a Suspense boundary that streams it). */
interface ConsoleFrameProps {
  readonly strip: ReactNode;
  readonly hero: ReactNode;
  readonly discord: ReactNode;
  readonly leetcode: ReactNode;
  readonly typing: ReactNode;
  readonly coding: ReactNode;
  readonly repositories: ReactNode;
  readonly gutter?: boolean;
}

/**
 * The header (its words need no source; the strip goes beside the title), then the tiles in
 * reading order (the hero, Discord, LeetCode, typing, coding time) and the repository table. The
 * one place the parts' order and the grid's tiers are written, for both ways of rendering.
 */
function ConsoleFrame({
  strip,
  hero,
  discord,
  leetcode,
  typing,
  coding,
  repositories,
  gutter,
}: ConsoleFrameProps): ReactElement {
  return (
    <PageShell
      eyebrow="Activity"
      title="Stats"
      description="What I'm building, practising and up to. Each source keeps its own clock."
      stats={strip}
      gutter={gutter}
      sizing="container"
    >
      <TileGrid
        aria-label="Activity and development stats"
        className={`${PAIR_SHARE_CLASS} ${TABLET_TIER_CLASS} ${DESKTOP_TIER_CLASS}`}
      >
        {hero}
        {discord}
        {leetcode}
        {typing}
        {coding}
      </TileGrid>
      {repositories}
    </PageShell>
  );
}

export interface StatsConsoleProps {
  readonly data: StatsConsoleData;
  readonly accuracy?: AccuracyStyle;
  readonly profileId: string;
  readonly now?: number;
  /** False inside the lab, whose surrounding frame already pads its content. */
  readonly gutter?: boolean;
}

/**
 * The full console from data already loaded: final server figures and isolated source failures,
 * with only Discord polling after hydration.
 */
export function StatsConsole({
  data,
  accuracy = 'figures',
  profileId,
  now = Date.now(),
  gutter,
}: StatsConsoleProps): ReactElement {
  const parts = consoleParts({ accuracy, profileId, clock: () => now });
  return (
    <ConsoleFrame
      gutter={gutter}
      strip={parts.strip.render(data)}
      hero={parts.hero.render(data)}
      discord={parts.discord.render(data)}
      leetcode={parts.leetcode.render(data)}
      typing={parts.typing.render(data)}
      coding={parts.coding.render(data)}
      repositories={parts.repositories.render(data)}
    />
  );
}

/**
 * A part's data from its sources' values, given in the order of `sources`: the one place a source
 * is paired with its value, each value being what that source answered.
 */
function partData<K extends ConsoleSource>(
  sources: readonly K[],
  values: readonly unknown[],
): Pick<StatsConsoleData, K> {
  return Object.fromEntries(sources.map((source, index) => [source, values[index]])) as Pick<
    StatsConsoleData,
    K
  >;
}

/** A part's sources from what had settled, or null while any of them had not. */
function settledFor<K extends ConsoleSource>(
  settled: Partial<StatsConsoleData>,
  sources: readonly K[],
): Pick<StatsConsoleData, K> | null {
  const values: readonly unknown[] = sources.map((source) => settled[source]);
  return values.every((value) => value !== undefined) ? partData(sources, values) : null;
}

/** A part that had not settled, rendered once its own sources have (never a rejection). */
async function LatePart<K extends ConsoleSource>({
  part,
  sources,
}: {
  readonly part: ConsolePart<K>;
  readonly sources: StatsConsoleSources;
}): Promise<ReactNode> {
  const values: readonly unknown[] = await Promise.all(
    part.sources.map((source) => sources[source]),
  );
  return part.render(partData(part.sources, values));
}

/** `part` in place when its sources had settled, else streamed behind its skeleton. */
function streamedPart<K extends ConsoleSource>(
  part: ConsolePart<K>,
  sources: StatsConsoleSources,
  settled: Partial<StatsConsoleData>,
): ReactNode {
  const ready = settledFor(settled, part.sources);
  if (ready) return part.render(ready);
  return (
    <Suspense fallback={part.skeleton()}>
      <LatePart part={part} sources={sources} />
    </Suspense>
  );
}

export interface StreamedStatsConsoleProps {
  /** Every source, started together (startStatsConsole). */
  readonly sources: StatsConsoleSources;
  /** What the sources had answered when the page stopped waiting (settledWithin). */
  readonly settled?: Partial<StatsConsoleData>;
  readonly accuracy?: AccuracyStyle;
  readonly profileId: string;
  /** Pins every part's clock (tests); left out, each part reads it when it renders. */
  readonly now?: number;
  readonly gutter?: boolean;
}

/**
 * The console with every part either in place or streamed (see the file comment). The header's
 * words and the strip's labels and age need no source; a streamed part's skeleton stands in its
 * own place in the grid at its size, so its landing moves nothing around it. No source ever
 * rejects (each settles to its data, its last answer or its error state), so no part can fail the
 * page.
 */
export function StreamedStatsConsole({
  sources,
  settled = {},
  accuracy = 'figures',
  profileId,
  now,
  gutter,
}: StreamedStatsConsoleProps): ReactElement {
  const parts = consoleParts({ accuracy, profileId, clock: () => now ?? Date.now() });
  return (
    <ConsoleFrame
      gutter={gutter}
      strip={streamedPart(parts.strip, sources, settled)}
      hero={streamedPart(parts.hero, sources, settled)}
      discord={streamedPart(parts.discord, sources, settled)}
      leetcode={streamedPart(parts.leetcode, sources, settled)}
      typing={streamedPart(parts.typing, sources, settled)}
      coding={streamedPart(parts.coding, sources, settled)}
      repositories={streamedPart(parts.repositories, sources, settled)}
    />
  );
}
