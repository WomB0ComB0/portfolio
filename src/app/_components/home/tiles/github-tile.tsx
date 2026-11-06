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
 * @file The home GitHub tile: contributions over the last twelve weeks as a figure and a
 * sparkline, and the latest public commit. A linked tile: its stretched link is the commit (or,
 * with no commit, the label, to the profile).
 *
 * The sparkline is decorative, so an sr-only sentence says what it shows. Above a 40rem tile the
 * figure and commit sit left (40%) and the sparkline right (60%, taller); below, they stack.
 */

import { Clock } from 'lucide-react';
import type { ReactElement } from 'react';

import { hasDestination, numberFormatter, Sparkline, Tile, TileLink } from '@/components/console';
import {
  ACTIVITY_WEEKS,
  type ContributionWeek,
  type GitHubActivity,
  type LatestCommit,
} from '@/lib/api-integrations/github-activity';
import { cn } from '@/lib/utils';
import { formatDay, formatRelative, type Instant } from '../data/format';
import { loadGitHubActivity } from '../data/loaders';
import type { TileResult } from '../data/tile-result';
import {
  asOfText,
  GITHUB_PROFILE_URL,
  joinMeta,
  LoadingNote,
  SkeletonBar,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

export const GITHUB_TILE_LABEL = `GitHub · ${ACTIVITY_WEEKS} weeks`;

const TILE_CLASS = 'gap-4';
/** Stacked below a 40rem tile; figure and commit 40%, sparkline 60% above it. */
const BODY_CLASS = 'grid gap-4 @[40rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @[40rem]:items-end';
const FIGURE_CLASS = 'figure text-stat text-foreground @[40rem]:text-display';
const UNIT_CLASS = 'ml-2 font-sans text-body-sm font-normal tracking-normal text-muted-foreground';
/** The sparkline's height on screen: 56 px, 72 px (h-18) in the two-column layout. */
const SPARKLINE_HEIGHT = 56;
const SPARKLINE_CLASS = '@[40rem]:h-18';
/** Where the sparkline was, in the error state: its box with a dashed baseline. */
const MISSING_TREND_CLASS = 'h-14 border-b border-dashed border-hairline @[40rem]:h-18';
/**
 * The commit link is a row of the clamped headline and TileLink's new-tab arrow, so the clamp
 * cuts the headline short and never the arrow after it.
 */
const COMMIT_LINK_CLASS = 'flex items-baseline text-foreground';
const HEADLINE_CLASS = 'line-clamp-1 min-w-0 wrap-break-word';
/**
 * The skeleton's text lines: boxes of the loaded lines' heights (globals.css: text-meta's
 * line-height is 1.125rem, text-body-sm's 1.375rem), each with a bar in it, so the tile does not
 * grow when it lands.
 */
const META_LINE_CLASS = 'flex h-[1.125rem] items-center';
const BODY_SM_LINE_CLASS = 'flex h-[1.375rem] items-center';

const formatCount = (value: number): string => numberFormatter().format(value);

/** The busiest week, the earliest on a tie; undefined without weeks. */
function busiestWeek(weeks: readonly ContributionWeek[]): ContributionWeek | undefined {
  return weeks.reduce<ContributionWeek | undefined>(
    (top, week) => (top === undefined || week.count > top.count ? week : top),
    undefined,
  );
}

/**
 * The sparkline in words, e.g. '412 contributions in the last 12 weeks; busiest week 61 (week of
 * Oct 12).' The busiest week is left out when no week has any.
 */
export function contributionSummary(activity: GitHubActivity, now: Instant): string {
  const total = `${formatCount(activity.total)} contributions in the last ${ACTIVITY_WEEKS} weeks`;
  const top = busiestWeek(activity.weeks);
  const weekOf = top ? formatDay(top.start, now) : '';
  if (!top || top.count === 0 || !weekOf) return `${total}.`;
  return `${total}; busiest week ${formatCount(top.count)} (week of ${weekOf}).`;
}

/** 'portfolio · a1b2c3d · 3 h ago', then the headline as the tile's link. */
function CommitLine({ commit, now }: { commit: LatestCommit; now: Instant }): ReactElement {
  const repoName = commit.repo.split('/').at(-1) || commit.repo;
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-meta text-muted-foreground">
        {joinMeta([repoName, commit.sha, formatRelative(commit.committedAt, now)])}
      </p>
      <p className="mt-1 text-body-sm">
        <TileLink
          href={commit.url}
          external
          srSuffix="(latest commit on GitHub)"
          className={COMMIT_LINK_CLASS}
        >
          <span className={HEADLINE_CLASS}>{commit.headline}</span>
        </TileLink>
      </p>
    </div>
  );
}

interface FreshnessLineProps {
  stale: boolean;
  asOf?: string;
  now: Instant;
}

/** 'updated 5 min ago', or, for stale data, 'as of Nov 5 11:02 AM ET' with a clock. */
function FreshnessLine({ stale, asOf, now }: FreshnessLineProps): ReactElement | null {
  if (!asOf) return null;
  if (stale) {
    const text = asOfText(asOf, now);
    if (!text) return null;
    return (
      <TileMeta className="flex items-center gap-1.5">
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        {text}
      </TileMeta>
    );
  }
  const age = formatRelative(asOf, now);
  if (!age) return null;
  return (
    <TileMeta>
      <time dateTime={asOf}>updated {age}</time>
    </TileMeta>
  );
}

interface ActivityViewProps extends FreshnessLineProps {
  activity: GitHubActivity;
}

/** The loaded tile. A commit without a link is left out, and the label links the profile. */
function ActivityView({ activity, stale, asOf, now }: ActivityViewProps): ReactElement {
  const latest = activity.latestCommit;
  const commit = latest && hasDestination(latest.url) ? latest : null;
  return (
    <Tile variant="linked" className={TILE_CLASS} data-state={stale ? 'stale' : 'ready'}>
      <TileLabel>
        {commit ? (
          GITHUB_TILE_LABEL
        ) : (
          <TileLink href={GITHUB_PROFILE_URL} external className="text-inherit">
            {GITHUB_TILE_LABEL}
          </TileLink>
        )}
      </TileLabel>
      <div className={BODY_CLASS}>
        <div className="flex min-w-0 flex-col gap-3">
          <p className={FIGURE_CLASS}>
            {formatCount(activity.total)}
            <span className={UNIT_CLASS}>contributions</span>
          </p>
          {commit && <CommitLine commit={commit} now={now} />}
        </div>
        <div className="min-w-0">
          <Sparkline
            values={activity.weeks.map((week) => week.count)}
            height={SPARKLINE_HEIGHT}
            className={SPARKLINE_CLASS}
          />
          <p className="sr-only">{contributionSummary(activity, now)}</p>
        </div>
      </div>
      <FreshnessLine stale={stale} asOf={asOf} now={now} />
    </Tile>
  );
}

export interface GitHubTileViewProps {
  result: TileResult<GitHubActivity>;
  now?: Instant;
}

/** The GitHub tile in each state; without data it keeps the sparkline's place, dashed. */
export function GitHubTileView({ result, now = Date.now() }: GitHubTileViewProps): ReactElement {
  if (result.status === 'ok') {
    return (
      <ActivityView activity={result.data} stale={result.stale} asOf={result.asOf} now={now} />
    );
  }
  const Note = result.status === 'error' ? TileUnavailable : TileEmpty;
  return (
    <Tile className={TILE_CLASS} data-state={result.status}>
      <TileLabel>{GITHUB_TILE_LABEL}</TileLabel>
      <div aria-hidden="true" className={MISSING_TREND_CLASS} />
      <Note
        className="mt-auto"
        message={
          result.status === 'error' ? 'GitHub activity unavailable' : 'No public activity yet'
        }
        href={GITHUB_PROFILE_URL}
        external
        linkLabel="GitHub profile"
      />
    </Tile>
  );
}

/**
 * The loading GitHub tile, line for line the loaded one: the real label, the figure's own element
 * holding a 1em bar (its type size changes with the tile), the commit's two lines, the
 * sparkline's box and the meta line. Streaming the data in moves nothing below it.
 */
export function GitHubTileSkeleton(): ReactElement {
  return (
    <Tile className={TILE_CLASS} aria-busy="true" data-state="loading">
      <TileLabel>{GITHUB_TILE_LABEL}</TileLabel>
      <div className={BODY_CLASS}>
        <div className="flex min-w-0 flex-col gap-3">
          <p aria-hidden="true" className={FIGURE_CLASS}>
            <SkeletonBar className="h-[1em] w-[4ch]" />
          </p>
          <div className="min-w-0">
            <span className={META_LINE_CLASS}>
              <SkeletonBar className="h-3 w-40 rounded-sm" />
            </span>
            <span className={cn('mt-1', BODY_SM_LINE_CLASS)}>
              <SkeletonBar className="h-3.5 w-4/5" />
            </span>
          </div>
        </div>
        <SkeletonBar className="h-14 w-full @[40rem]:h-18" />
      </div>
      <span className={cn('mt-auto', META_LINE_CLASS)}>
        <SkeletonBar className="h-3 w-28 rounded-sm" />
      </span>
      <LoadingNote>Loading GitHub activity</LoadingNote>
    </Tile>
  );
}

export async function GitHubTile(): Promise<ReactElement> {
  return <GitHubTileView result={await loadGitHubActivity()} />;
}
