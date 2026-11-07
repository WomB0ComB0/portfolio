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
 * sparkline, and the latest public commit. A linked tile: its stretched link is the commit's
 * headline (or, with no commit, the label, to the profile).
 *
 * The headline reads as a visitor would say it (commitHeadline: no 'feat(home): ', no '(#604)'),
 * while the link's name keeps it as written. The repository is a mono token, the one machine word
 * on the tile; the SHA is left out. Fresh, the tile says nothing of its own freshness (the
 * commit's age shows recency); stale, it says when it was read.
 *
 * The sparkline is decorative, so an sr-only sentence says what it shows. From a 34rem tile the
 * figure and commit sit left (2fr) and the sparkline right (3fr, taller); below, they stack. A
 * narrow bento from 30rem to 40rem (the 30rem estimate tier, bento.module.css) gives this tile its
 * whole width, and there it goes side by side too. Side by side, the figure's column is never
 * narrower than the figure's row.
 *
 * Tile states (tile-states.tsx): 'ready' with a commit (the reference content its skeleton
 * holds), 'empty' without one (no commit lines) or without activity, 'stale' or 'error'.
 */

import type { ReactElement } from 'react';

import { hasDestination, numberFormatter, Sparkline, Tile, TileLink } from '@/components/console';
import {
  ACTIVITY_WEEKS,
  type ContributionWeek,
  type GitHubActivity,
  type LatestCommit,
} from '@/lib/api-integrations/github-activity';
import { cn } from '@/lib/utils';
import { commitHeadline, formatDay, formatRelative, type Instant } from '../data/format';
import { loadGitHubActivity } from '../data/loaders';
import type { TileResult } from '../data/tile-result';
import {
  asOfText,
  FigureRow,
  FigureRowSkeleton,
  GITHUB_PROFILE_URL,
  LoadingNote,
  META_SEPARATOR,
  SkeletonBar,
  SkeletonLine,
  StaleNote,
  TileEmpty,
  TileLabel,
  TileUnavailable,
} from './tile-states';

export const GITHUB_TILE_LABEL = 'GitHub';
/** After the figure: the period is part of the unit, not the label. */
export const CONTRIBUTIONS_UNIT = `contributions in ${ACTIVITY_WEEKS} weeks`;

const TILE_CLASS = 'gap-3';
/**
 * Stacked below a 34rem tile; figure and commit 2fr, sparkline 3fr above it. In a narrow bento
 * (named container `bento`, 30rem to 40rem) the tile spans the bento and goes side by side too,
 * its unit on one line (TEXT_COLUMN_CLASS). From 30rem, not 29rem: the estimate tier changes
 * there, so each tier holds one shape.
 *
 * Both rules give the text column `minmax(min-content,2fr)`, never narrower than the figure's
 * row. They match at once in a 586 to 640 px bento (the tile is 34rem there), and the built CSS
 * orders them, not this list: with `minmax(0,2fr)` the 34rem rule came last and won, so the
 * nowrap row ran up to 80 px into the sparkline's column (its skeleton bar painted over
 * '12 weeks').
 */
const BODY_CLASS =
  'grid gap-4 @[34rem]:grid-cols-[minmax(min-content,2fr)_minmax(0,3fr)] @[34rem]:items-end @min-[30rem]/bento:@max-[40rem]/bento:grid-cols-[minmax(min-content,2fr)_minmax(0,3fr)] @min-[30rem]/bento:@max-[40rem]/bento:items-end';
/**
 * The figure and the commit lines. The column is sized by its min-content wherever it sits beside
 * the sparkline (BODY_CLASS), and that is the figure's row, never the commit's headline: the
 * commit lines contain their inline size (COMMIT_LINES_CLASS), so a long headline is cut, not
 * widening the column. In a 30 to 40rem bento the figure's row keeps its unit on one line and so
 * sets the width; the skeleton has the same figure row and no headline, so the loaded tile and
 * its skeleton split the same way. (Sized by the nowrap headline, the loaded column took 376 px
 * and kept the unit up, while the skeleton's took 197 px and wrapped it: 24 px taller in a 600 px
 * window.)
 *
 * In a wide bento (from 67.5rem) the unit always takes its own line, in any lane, loaded and
 * loading. GitHub's wide lane (a 1fr lane, 317.6 to 334.5 px, its text column at most 292.55 px)
 * is about 1 px narrower than a four-digit row ('0,000 contributions in 12 weeks') with Linux's
 * hinted advances and about 3 px wider unhinted (macOS, Windows). Without the rule the tile's
 * height, and so the lane roles packs into, would hang on the platform and the digit count; with
 * it the tile is 268 px everywhere.
 */
const TEXT_COLUMN_CLASS =
  'flex min-w-0 flex-col gap-3 @min-[30rem]/bento:@max-[40rem]/bento:[&>.figure-row]:flex-nowrap @min-[30rem]/bento:@max-[40rem]/bento:[&>.figure-row]:whitespace-nowrap @min-[67.5rem]/bento:[&>.figure-row>:last-child]:basis-full';
/** The commit lines take the column's width and never widen it: their headline is cut short. */
const COMMIT_LINES_CLASS = 'flex min-w-0 flex-col gap-1 contain-inline-size';
/** The sparkline's height on screen: 56 px, 72 px (h-18) side by side. */
const SPARKLINE_HEIGHT = 56;
const SPARKLINE_TALL_CLASS = '@[34rem]:h-18 @min-[30rem]/bento:@max-[40rem]/bento:h-18';
/** Where the sparkline was, without data: its box with a dashed baseline. */
const MISSING_TREND_CLASS = 'h-14 border-b border-dashed border-hairline';
/**
 * The commit link is a row of the truncated headline and TileLink's new-tab arrow, so the
 * ellipsis cuts the headline short and never the arrow after it.
 *
 * A cut headline's ellipsis stops short of its box (by up to a glyph), and the arrow inside the
 * 14 px icon starts 4 px in, so at 768 px a 10 to 12 px gap opened before the arrow. So:
 * - the arrow is pulled 4 px into the headline's box (`-ml-1` for its `ml-0.5`); the icon's
 *   empty inset covers only the box's end, never the text's ink. After a cut headline the ink gap
 *   from the ellipsis to the arrow is then 1 px plus whatever the cut left of the box: the
 *   ellipsis follows the last whole glyph that fits, so up to one glyph's width stays empty. That
 *   is about 1 to 8.5 px, by the headline and the width (5 to 6.5 px at 768 px with the headline
 *   of the day). CSS can't take that slack away: the box ends at the column's edge, not at the
 *   ellipsis.
 * - a 4 px spacer (the link's ::before, ordered between the headline and the arrow) keeps a whole
 *   headline's arrow as far from its last letter (3.5 px), rather than glued to it. Its huge
 *   flex-shrink makes it the first to give way: 4 px while the headline fits, 0 once the
 *   headline is cut (while the spacer gives way, the headline shrinks by under a tenth of a px).
 */
const COMMIT_LINK_CLASS =
  'flex items-baseline text-inherit group-hover/tile:text-brand-ink before:order-1 before:basis-1 before:shrink-[100000] [&>[data-new-tab-arrow]]:order-2 [&>[data-new-tab-arrow]>svg]:-ml-1';
/** The digits of the figure the skeleton holds room for: '1,300'. */
const FIGURE_DIGITS = 4;

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

/** What the commit link is called: its headline as written, and where it leads. */
export const commitLinkName = (commit: LatestCommit): string =>
  `Latest commit: ${commit.headline}, on GitHub`;

/**
 * 'portfolio · 32 min ago' (the repository as a mono token), then the headline as the tile's
 * link. The age is worded from now, so its line is dated.
 */
function CommitLines({ commit, now }: { commit: LatestCommit; now: Instant }): ReactElement {
  const repoName = commit.repo.split('/').at(-1) || commit.repo;
  const age = formatRelative(commit.committedAt, now);
  return (
    <div className={COMMIT_LINES_CLASS}>
      <p data-dated="" className="truncate tile-meta text-muted-foreground">
        <span className="mono-token">{repoName}</span>
        {age ? `${META_SEPARATOR}${age}` : null}
      </p>
      <p className="min-w-0 tile-sub text-muted-foreground">
        <TileLink href={commit.url} external className={COMMIT_LINK_CLASS}>
          <span aria-hidden="true" className="min-w-0 truncate">
            {commitHeadline(commit.headline)}
          </span>
          <span className="sr-only">{commitLinkName(commit)}</span>
        </TileLink>
      </p>
    </div>
  );
}

interface ActivityViewProps {
  activity: GitHubActivity;
  stale: boolean;
  asOf?: string;
  now: Instant;
}

/**
 * The tile's state: stale before all else; without a commit to show, 'empty', since the tile then
 * lacks the commit lines its skeleton (and the estimates) hold.
 */
function activityState(stale: boolean, commit: LatestCommit | null): 'stale' | 'empty' | 'ready' {
  if (stale) return 'stale';
  return commit ? 'ready' : 'empty';
}

/** The loaded tile. A commit without a link is left out, and the label links the profile. */
function ActivityView({ activity, stale, asOf, now }: ActivityViewProps): ReactElement {
  const latest = activity.latestCommit;
  const commit = latest && hasDestination(latest.url) ? latest : null;
  return (
    <Tile variant="linked" className={TILE_CLASS} data-state={activityState(stale, commit)}>
      <TileLabel>
        {commit ? (
          GITHUB_TILE_LABEL
        ) : (
          <TileLink href={GITHUB_PROFILE_URL} external srSuffix="profile" className="text-inherit">
            {GITHUB_TILE_LABEL}
          </TileLink>
        )}
      </TileLabel>
      <div className={BODY_CLASS}>
        <div className={TEXT_COLUMN_CLASS}>
          <FigureRow value={formatCount(activity.total)} unit={CONTRIBUTIONS_UNIT} size="lg" />
          {commit && <CommitLines commit={commit} now={now} />}
        </div>
        <div className="flex min-w-0 flex-col justify-end">
          <Sparkline
            values={activity.weeks.map((week) => week.count)}
            height={SPARKLINE_HEIGHT}
            className={SPARKLINE_TALL_CLASS}
          />
          <p className="sr-only">{contributionSummary(activity, now)}</p>
        </div>
      </div>
      {stale && <StaleNote>{asOf ? asOfText(asOf, now) : ''}</StaleNote>}
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
 * The loading GitHub tile, line for line the fresh one with a commit: the real label, the figure's
 * row with its real unit, the commit's two lines (each one line of its own type), and the
 * sparkline's box. Streaming the data in moves nothing below it.
 */
export function GitHubTileSkeleton(): ReactElement {
  return (
    <Tile className={TILE_CLASS} aria-busy="true" data-state="loading">
      <TileLabel>{GITHUB_TILE_LABEL}</TileLabel>
      <div className={BODY_CLASS}>
        <div className={TEXT_COLUMN_CLASS}>
          <FigureRowSkeleton digits={FIGURE_DIGITS} unit={CONTRIBUTIONS_UNIT} size="lg" />
          <div className={COMMIT_LINES_CLASS}>
            <SkeletonLine type="tile-meta" bar="h-3 w-32 rounded-sm" />
            <SkeletonLine type="tile-sub" bar="h-3.5 w-4/5" />
          </div>
        </div>
        <SkeletonBar className={cn('h-14 w-full', SPARKLINE_TALL_CLASS)} />
      </div>
      <LoadingNote>Loading GitHub activity</LoadingNote>
    </Tile>
  );
}

export async function GitHubTile(): Promise<ReactElement> {
  return <GitHubTileView result={await loadGitHubActivity()} />;
}
