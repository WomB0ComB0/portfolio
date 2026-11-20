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
 * @file The console's dominant tile: GitHub. Contributions over twelve weeks as the page's one
 * display figure beside a tall sparkline, then the repository and star totals at stat size, the
 * languages used most and the latest public commit.
 *
 * A linked tile: the label is its stretched link (the profile); the commit headline is an
 * ordinary link above the overlay. Its two sources (the home GitHub tile's activity and the
 * GitHub stats totals) each show whenever they have data; a missing one says so in words, and
 * only both missing is the error state. The age at the top is the older source's.
 *
 * Every part answers to the tile's own width (the tile is an inline-size container) or to its
 * own content: the figure sits beside the sparkline from 36rem, the commit beside the totals
 * whenever its meta line fits there, and otherwise each row wraps rather than cuts. The tile's
 * place in the grid is in console-layout.ts.
 */

import { CircleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import { commitHeadline, formatRelative } from '@/app/_components/home/data/format';
import { commitLinkName, contributionSummary } from '@/app/_components/home/tiles/github-tile';
import {
  FigurePlaceholder,
  GITHUB_PROFILE_URL,
  LoadingNote,
  ShapePlaceholder,
  TileLabel,
  TileUnavailable,
} from '@/app/_components/home/tiles/tile-states';
import {
  hasDestination,
  NEW_TAB_LABEL,
  NewTabArrow,
  numberFormatter,
  Sparkline,
  SrOnlyWords,
  Tile,
  TileLink,
} from '@/components/console';
import {
  ACTIVITY_WEEKS,
  type GitHubActivity,
  type LatestCommit,
} from '@/lib/api-integrations/github-activity';
import type { HeroModel, HeroTotals } from '../../_lib/console-model';
import { AGE_CELL_CLASS, AgeRoom } from './age-room';
import { HERO_SPAN_CLASS } from './console-layout';
import { type MetaPart, MetaRow } from './meta-row';
import { PresentAge } from './present-age';
import { StaleAge } from './stale-age';

const LABEL_ID = 'stats-github';

/**
 * The page's display figure, sized by the tile (an inline-size container): 56 px in a phone's
 * tile and 74 px at most. That cap is what the hero's 8 columns give it where the 12-column grid
 * starts, so the figure is the same size on both sides of the step from 6 to 12 columns and
 * never shrinks as the window grows. It is also never wider than a third of the tile, which
 * holds it when the reader's own font size is doubled (rem grows, the tile does not).
 *
 * A phone can also enlarge text without changing any length (see console-layout.ts). The tile is
 * then under seven lines of its own text wide, which no phone's tile is at the default size, and
 * the figure becomes a fifth of the tile: doubled, four digits still fit. It keeps 2.25rem at
 * least, so with a doubled font it stays the page's largest figure. Geist 600, tabular, tight.
 */
const DISPLAY_FIGURE_CLASS =
  'text-[length:min(33cqi,clamp(3.5rem,1rem+9cqi,4.625rem))] @max-[7lh]:text-[length:clamp(min(2.25rem,33cqi),19cqi,3.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums text-foreground';
/** The label and the age: one row, or the age under the label when both do not fit. */
const HEAD_CLASS = 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1';
/**
 * The age's room in that row. The age is re-read every 30 s, and in a narrow tile (a 280px
 * window) 'updated 9 min ago' fits beside the label where 'updated 10 min ago' does not: left to
 * its own width the age dropped under the label as it grew, the tile grew by that line and every
 * tile below moved. In the room of the widest wording (age-room.tsx) the row breaks the same way
 * whatever the clock says. The room takes the row's spare width on its left and the age ends
 * where the room does, so the age rests on the tile's right edge beside the label and on the row
 * under it alike.
 */
const HERO_AGE_ROOM_CLASS = 'ml-auto justify-items-end';
/**
 * A stale hero's note ('⏲ Stale · 1 h ago', stale-age.tsx) in the same room as the fresh age, so
 * the head breaks wherever a fresh one does: in a room of its own widest wording it was 15px
 * wider, and at 260 to 340px it dropped under the label where the fresh age did not, a line
 * taller. The note asks the room for no width (`w-0`), takes all of it (`min-w-full`) and ends on
 * its right edge. Only at its widest, a stale age of two-digit minutes ('⏲ Stale · 59 min ago'),
 * is it wider than the room, by about 7px, and that reaches left into the head's 12px gap beside
 * the label (about 5px stay clear of it), or into the empty row under it.
 */
const STALE_CELL_CLASS = 'flex w-0 min-w-full justify-end';
/**
 * On a short screen (a phone on its side, where the header and the bottom bar leave the tile a
 * strip of the first screen) the tile gives up air above its figure: tighter padding and gaps, a
 * lower sparkline, and the figure at the top of its row rather than resting on the sparkline's
 * foot. Each of these outranks a container-keyed class of the tile or the kit, hence the `!`.
 * Only below the 12-column tier (a tiles grid under 70rem): a short desktop window (1280 x 460)
 * keeps the wide hero, whose chart takes the height beside Discord; with these its figure jumped
 * to the top and left 180px empty under it beside a 252px chart.
 */
const SHORT_SCREEN_TILE_CLASS =
  '@max-[70rem]/tiles:[@media(max-height:30rem)]:gap-2 @max-[70rem]/tiles:[@media(max-height:30rem)]:p-5!';
const SHORT_SCREEN_ROW_CLASS = '@max-[70rem]/tiles:[@media(max-height:30rem)]:items-start!';
const SHORT_SCREEN_TREND_CLASS = '@max-[70rem]/tiles:[@media(max-height:30rem)]:h-20!';
/**
 * Side by side from a 36rem tile: the figure as wide as it is, the sparkline the rest. Stacked,
 * the one column is the tile's width and no wider, whatever its longest word.
 *
 * The row takes whatever height the tile has to spare (`grow`). There is none where the tile is
 * as tall as its own content, which is every tier but the 12-column one. There the hero ends
 * lower than Discord beside it (console-layout.ts), and that height goes to the chart: its
 * column stands the full height of the row and the chart takes what is left over its labels,
 * starting from the 112px it has beside the figure. The same twelve weeks drawn taller, never a
 * gap above the foot.
 */
const ACTIVITY_CLASS = `grid grow grid-cols-[minmax(0,1fr)] gap-5 @[36rem]:grid-cols-[auto_minmax(0,1fr)] @[36rem]:items-end @[36rem]:gap-10 ${SHORT_SCREEN_ROW_CLASS}`;
const TREND_COLUMN_CLASS = 'flex min-w-0 flex-col @[36rem]:self-stretch';
const TREND_CLASS = `grow @[36rem]:h-28 ${SHORT_SCREEN_TREND_CLASS}`;
/**
 * The words under a figure. One wider than the tile ('contributions' in doubled text on a 320px
 * phone) breaks inside rather than push its row past the tile's padding.
 */
const UNIT_WORDS_CLASS = 'figure-unit text-muted-foreground [overflow-wrap:anywhere]';
/** The sparkline's two labels: at the ends of one line, or one under the other in large text. */
const TREND_LABELS_CLASS = 'mt-2 flex flex-wrap justify-between gap-x-3 tile-meta text-faint';
/**
 * The foot: the totals and the latest commit as a wrapping row, placed by what they hold rather
 * than by a width. The commit asks for the width of its meta line ('Latest commit · portfolio ·
 * 11 h ago' whole; its headline asks for none). When that fits beside the totals it sits there,
 * and the totals take every spare pixel of the row, so the commit rests against the tile's right
 * edge. When it does not (a longer list of languages, a longer repository name, a narrower
 * tile), the commit takes the row under the totals and all of its width. It is never squeezed
 * into what the totals leave.
 */
const FOOT_CLASS = 'mt-auto flex flex-wrap items-end gap-x-8 gap-y-5 border-t border-hairline pt-5';
/** The totals' share of a row they share with the commit: all that is spare (see FOOT_CLASS). */
const TOTALS_GROW_CLASS = 'flex-[9999_1_auto]';
const TOTALS_CLASS = `flex ${TOTALS_GROW_CLASS} flex-wrap items-end gap-x-8 gap-y-4`;
const COMMIT_CLASS = 'flex max-w-full min-w-0 flex-[1_1_auto] flex-col gap-1';
/**
 * The headline's line: it adds nothing to the width the commit asks for and takes whatever the
 * commit gets (the meta line's width beside the totals, the row's under them).
 */
const HEADLINE_LINE_CLASS = 'w-0 min-w-full tile-sub';
/**
 * The headline: two balanced lines at most (no last line of one word), four in a tile under ten
 * lines of its text wide (a phone under about 340px, or any phone with its text enlarged), where
 * a line holds only a few words; a word longer than a line breaks inside. Its new-tab arrow is
 * glued to the last word, so it ends the text wherever that wraps.
 */
const HEADLINE_CLASS =
  'line-clamp-2 min-w-0 text-balance [overflow-wrap:anywhere] @max-[10lh]:line-clamp-4';
const MISSING_CLASS = 'flex items-center gap-2 tile-sub text-muted-foreground';
const MISSING_ICON_CLASS = 'size-4 shrink-0 text-down';
/** Where the sparkline was, without data: its box with a dashed baseline. */
const MISSING_TREND_CLASS = 'h-20 border-b border-dashed border-hairline';
/**
 * The commit link: 4 px taller than its 20 px line (padding taken back by the margin, so nothing
 * moves), which makes it a 24 px target over the tile's stretched profile link. On a coarse
 * pointer 12 px over and under, taken back the same way: a one-line headline is then a 44 px
 * target, and a tap just above it opens the commit rather than the profile. The padding reaches
 * over the meta line above, which names the same commit.
 */
const COMMIT_LINK_CLASS =
  'relative z-10 -my-0.5 block min-w-0 py-0.5 pointer-coarse:-my-3 pointer-coarse:py-3 text-foreground transition-colors duration-(--motion-base) ease-effect hover:text-brand-ink hover:duration-(--motion-instant)';
/** The languages named under the totals. */
const LANGUAGES_SHOWN = 3;
/** The list wraps between names; one name wider than the tile (very large text) breaks inside. */
const LANGUAGES_CLASS = 'order-1 tile-title text-foreground [overflow-wrap:anywhere]';

const formatCount = (value: number): string => numberFormatter().format(value);

/**
 * The age at the top: 'updated 3 min ago', or the page's stale note ('⏲ Stale · 3 h ago'). Both
 * sit in the room of the fresh age's widest wording (see HERO_AGE_ROOM_CLASS and
 * STALE_CELL_CLASS).
 */
function HeroAge({ hero }: { readonly hero: HeroModel }): ReactElement | null {
  if (!hero.asOf) return null;
  return (
    <AgeRoom className={HERO_AGE_ROOM_CLASS}>
      {hero.state === 'stale' ? (
        <span className={`${AGE_CELL_CLASS} ${STALE_CELL_CLASS}`}>
          <StaleAge at={hero.asOf} />
        </span>
      ) : (
        <PresentAge at={hero.asOf} className={`${AGE_CELL_CLASS} text-faint`} />
      )}
    </AgeRoom>
  );
}

/** The display figure and its unit, beside twelve weeks as a sparkline (said in words too). */
function Contributions({
  activity,
  now,
}: {
  readonly activity: GitHubActivity | null;
  readonly now: number;
}): ReactElement {
  if (!activity) {
    return (
      <div className="grid gap-4">
        <p className={MISSING_CLASS}>
          <CircleAlert aria-hidden="true" className={MISSING_ICON_CLASS} />
          Contributions unavailable
        </p>
        <div aria-hidden="true" className={MISSING_TREND_CLASS} />
      </div>
    );
  }
  return (
    <div className={ACTIVITY_CLASS}>
      <p className="flex flex-col gap-3">
        <span className={DISPLAY_FIGURE_CLASS}>{formatCount(activity.total)}</span>
        <span className={UNIT_WORDS_CLASS}>contributions in the last {ACTIVITY_WEEKS} weeks</span>
      </p>
      <div className={TREND_COLUMN_CLASS}>
        <Sparkline
          values={activity.weeks.map((week) => week.count)}
          height={80}
          className={TREND_CLASS}
        />
        <p aria-hidden="true" className={TREND_LABELS_CLASS}>
          <span>{ACTIVITY_WEEKS} weeks ago</span>
          <span className="text-right">this week</span>
        </p>
        <p className="sr-only">{contributionSummary(activity, now)}</p>
      </div>
    </div>
  );
}

/** One total: the figure over its word, in the DOM word first ('repositories, 324'). */
function Total({ label, value }: { readonly label: string; readonly value: number }): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className={`order-2 ${UNIT_WORDS_CLASS}`}>{label}</dt>
      <dd className="order-1 figure-md text-foreground">{formatCount(value)}</dd>
    </div>
  );
}

/** Repositories and stars at stat size, then the languages used most, in words. */
function Totals({ totals }: { readonly totals: HeroTotals | null }): ReactElement {
  if (!totals) {
    return (
      <p className={`${MISSING_CLASS} ${TOTALS_GROW_CLASS}`}>
        <CircleAlert aria-hidden="true" className={MISSING_ICON_CLASS} />
        Repository totals unavailable
      </p>
    );
  }
  const languages = totals.languages.slice(0, LANGUAGES_SHOWN);
  return (
    <dl className={TOTALS_CLASS}>
      <Total label="repositories" value={totals.repos} />
      <Total label="stars" value={totals.stars} />
      {languages.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1.5">
          <dt className={`order-2 ${UNIT_WORDS_CLASS}`}>used most</dt>
          <dd className={LANGUAGES_CLASS}>{languages.join(', ')}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * 'Latest commit · portfolio · 32 min ago' over the headline as written for people
 * (commitHeadline), an ordinary link above the tile's overlay. Nothing without a commit link.
 * Nothing is cut: the meta line wraps part by part (MetaRow) with its age kept whole when even a
 * row of its own is too narrow for it, and the headline wraps before it is clamped.
 */
function Commit({
  commit,
  now,
}: {
  readonly commit: LatestCommit | null;
  readonly now: number;
}): ReactElement | null {
  if (!commit || !hasDestination(commit.url)) return null;
  const repoName = commit.repo.split('/').at(-1) || commit.repo;
  const age = formatRelative(commit.committedAt, now);
  const parts: readonly MetaPart[] = [
    { key: 'label', body: 'Latest commit' },
    { key: 'repo', body: repoName },
    ...(age
      ? [
          {
            key: 'age',
            body: (
              <span data-commit-age="" className="whitespace-nowrap">
                {age}
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className={COMMIT_CLASS}>
      <p data-dated="" className="tile-meta text-muted-foreground">
        <MetaRow parts={parts} />
      </p>
      <p className={HEADLINE_LINE_CLASS}>
        <a
          href={commit.url}
          target="_blank"
          rel="noopener noreferrer"
          className={COMMIT_LINK_CLASS}
        >
          <span aria-hidden="true" className={HEADLINE_CLASS}>
            {commitHeadline(commit.headline)}
            <NewTabArrow />
          </span>
          <span className="sr-only">{commitLinkName(commit)}</span>
          <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
        </a>
      </p>
    </div>
  );
}

/** Both sources failed: a plain tile with words and the profile, never a number. */
function HeroUnavailable(): ReactElement {
  return (
    <Tile
      as="section"
      aria-labelledby={LABEL_ID}
      padding="lg"
      className={`gap-5 ${HERO_SPAN_CLASS}`}
      data-stats-tile="github"
      data-state="error"
    >
      <TileLabel id={LABEL_ID}>GitHub</TileLabel>
      <div aria-hidden="true" className={MISSING_TREND_CLASS} />
      <TileUnavailable
        message="GitHub stats unavailable"
        href={GITHUB_PROFILE_URL}
        external
        linkLabel="GitHub profile"
      />
    </Tile>
  );
}

export interface GitHubHeroProps {
  readonly hero: HeroModel;
  /** The render's clock, so the commit's age and the summary agree with the rest of the page. */
  readonly now: number;
}

/** The GitHub hero in its state (see the file comment). */
export function GitHubHero({ hero, now }: GitHubHeroProps): ReactElement {
  if (hero.state === 'error') return <HeroUnavailable />;
  return (
    <Tile
      as="section"
      aria-labelledby={LABEL_ID}
      variant="linked"
      tone="hero"
      padding="lg"
      className={`gap-7 ${HERO_SPAN_CLASS} ${SHORT_SCREEN_TILE_CLASS}`}
      data-stats-tile="github"
      data-state={hero.state}
    >
      <div className={HEAD_CLASS}>
        {/* The link wraps the label: the heading, and the region it names, are just "GitHub". */}
        <TileLink
          href={GITHUB_PROFILE_URL}
          external
          srSuffix="profile"
          arrow={false}
          className="block text-inherit"
        >
          <TileLabel id={LABEL_ID}>
            GitHub
            <NewTabArrow />
          </TileLabel>
        </TileLink>
        <HeroAge hero={hero} />
      </div>
      <Contributions activity={hero.activity} now={now} />
      <div className={FOOT_CLASS}>
        <Totals totals={hero.totals} />
        <Commit commit={hero.activity?.latestCommit ?? null} now={now} />
      </div>
    </Tile>
  );
}

/**
 * What the skeleton's bars are shaped as (ShapePlaceholder): what the loaded parts usually hold,
 * so each bar is as wide as its text will be and wraps where it would.
 */
const SKELETON_CONTRIBUTION_DIGITS = 4;
const SKELETON_REPO_DIGITS = 3;
const SKELETON_STAR_DIGITS = 2;
const SKELETON_LANGUAGES = 'TypeScript, Python, Go';
const SKELETON_COMMIT_META = 'Latest commit · portfolio · 11 h ago';
const SKELETON_HEADLINE = 'Keep the public figures current';
/** The sparkline's box (80px, 112px in the wide layout, its column's height beside Discord). */
const TREND_PLACEHOLDER_CLASS = `h-20 rounded-md bg-surface-3 motion-safe:animate-pulse forced-colors:outline ${TREND_CLASS}`;

/** A total while it loads: a bar as wide as its figure over the real word. */
function TotalSkeleton({
  label,
  digits,
}: {
  readonly label: string;
  readonly digits: number;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={`order-2 ${UNIT_WORDS_CLASS}`}>{label}</span>
      <FigurePlaceholder digits={digits} className="order-1 figure-md" />
    </div>
  );
}

/**
 * The hero while its two sources load (/stats streams it on its own): the loaded hero's tile,
 * place in the grid and parts, each a placeholder the size of what it holds (the figure, the
 * sparkline's box, the totals, the commit), under the real label and words. The head keeps the
 * age's room, so it wraps as the loaded head does, and nothing below moves when the hero lands.
 */
export function GitHubHeroSkeleton(): ReactElement {
  return (
    <Tile
      tone="hero"
      padding="lg"
      aria-busy="true"
      className={`gap-7 ${HERO_SPAN_CLASS} ${SHORT_SCREEN_TILE_CLASS}`}
      data-stats-skeleton="github"
      data-state="loading"
    >
      <div className={HEAD_CLASS}>
        <TileLabel>GitHub</TileLabel>
        <AgeRoom className={HERO_AGE_ROOM_CLASS}>
          <span aria-hidden="true" className={AGE_CELL_CLASS} />
        </AgeRoom>
      </div>
      <div aria-hidden="true" className={ACTIVITY_CLASS}>
        <p className="flex flex-col gap-3">
          <FigurePlaceholder
            digits={SKELETON_CONTRIBUTION_DIGITS}
            className={DISPLAY_FIGURE_CLASS}
          />
          <span className={UNIT_WORDS_CLASS}>contributions in the last {ACTIVITY_WEEKS} weeks</span>
        </p>
        <div className={TREND_COLUMN_CLASS}>
          <div className={TREND_PLACEHOLDER_CLASS} />
          <p className={TREND_LABELS_CLASS}>
            <span>{ACTIVITY_WEEKS} weeks ago</span>
            <span className="text-right">this week</span>
          </p>
        </div>
      </div>
      <div aria-hidden="true" className={FOOT_CLASS}>
        <div className={TOTALS_CLASS}>
          <TotalSkeleton label="repositories" digits={SKELETON_REPO_DIGITS} />
          <TotalSkeleton label="stars" digits={SKELETON_STAR_DIGITS} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className={`order-2 ${UNIT_WORDS_CLASS}`}>used most</span>
            <ShapePlaceholder shape={SKELETON_LANGUAGES} className={LANGUAGES_CLASS} />
          </div>
        </div>
        <div className={COMMIT_CLASS}>
          <p className="tile-meta">
            <ShapePlaceholder shape={SKELETON_COMMIT_META} />
          </p>
          <p className={HEADLINE_LINE_CLASS}>
            <ShapePlaceholder shape={SKELETON_HEADLINE} />
          </p>
        </div>
      </div>
      <LoadingNote>Loading GitHub stats</LoadingNote>
    </Tile>
  );
}
