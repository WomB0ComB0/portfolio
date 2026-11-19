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
 * @file The console's repository table: the six most-starred public repositories on the kit's
 * open index table, laid out by the page's own width.
 *
 * - Under a 40rem page a row is one cell between the rank and the stars: the name, what the
 *   repository is and its language, each on a line of its own.
 * - From 40rem the language has its column; the description stays under the name.
 * - From a page 38 lines of its text wide (988px at the default size) the description has its
 *   column too (About), so a row reads across the whole width instead of leaving a short name
 *   alone in a wide column. The name's column is then as wide as the longest name shown. The
 *   step is where About has room for a long description in about five lines
 *   (ABOUT_COLUMN_LABEL_CLASS).
 *
 * The kit's columns are fixed, so the two that follow the data (names and stars) are told how
 * many characters they hold: the model counts them on the rows shown (repoColumnSizes) and the
 * section carries the counts as --name-ch and --stars-ch for the colgroup to read.
 *
 * Nothing is cut to fit a column: a name or a language wraps (inside a word only when the word
 * is longer than its line), a star count shows whole, and so does a description in its own
 * column, where its row simply grows. The one text that may be shortened is a long description
 * under the name, below the About step (ABOUT_LINE_CLASS); a short one never is.
 */

import type { CSSProperties, ReactElement } from 'react';
import type { TileResult } from '@/app/_components/home/data/tile-result';
import { LoadingNote, ShapePlaceholder } from '@/app/_components/home/tiles/tile-states';
import type { GitHubStatsData } from '@/app/api/v1/[[...route]]/github-stats/handlers';
import { EmptyState, NewTabArrow, numberFormatter } from '@/components/console';
import {
  type IndexColumn,
  IndexGroup,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';
import { cn } from '@/lib/utils';
import { type RepoColumnSizes, TOP_REPOS_SHOWN, topRepos } from '../../_lib/console-model';
import { WIDEST_AGE } from './age-room';
import { PresentAge } from './present-age';
import { StaleAge } from './stale-age';

/**
 * The two number columns are as wide as their characters (one for the rank; for the stars, the
 * widest count shown, --stars-ch, and never under four) plus the cell's padding, which is smaller
 * on a phone page and again under 20rem, where the column also gives up a character's width: a
 * column character is a digit of the page's 16px text, and the counts are set in 14px. The
 * characters are measured in ch, so the column grows with the text and a digit is never clipped
 * when a phone enlarges text without changing rem. At the default size and four characters these
 * are about 27, 23 and 35px for the rank and 54, 44 and 62px for the stars; '12,345' gets 76, 65
 * and 84px.
 *
 * Beside About the name's column is as wide as the longest name shown: --name-ch characters at
 * three quarters of a ch each (a 14px letter against a 16px digit; today's names average under
 * two thirds, so wider letters have room), plus 2.5rem for the new-tab arrow and the cell's
 * padding. It is never under 29% of the page (the 30% of the table it had on a wide page), so
 * short names still read as a column there, nor over 42% of it (about 45% of the table), so
 * About keeps the larger share and a name longer than that wraps instead. The bounds are
 * container units of the page, not percentages: a fixed table reads a width that mixes a
 * percentage with a length as no width at all.
 */
const COLUMNS = [
  {
    id: 'rank',
    label: '#',
    align: 'end',
    width:
      'w-[calc(1ch+1rem)] @max-[20rem]/page:w-[calc(1ch+0.75rem)] @min-[40rem]/page:w-[calc(1ch+1.5rem)]',
    sort: 'number',
  },
  {
    id: 'repository',
    label: 'Repository',
    width: '@min-[38lh]/page:w-[clamp(29cqi,calc(var(--name-ch,24)*0.75ch+2.5rem),42cqi)]',
    wrap: true,
  },
  // Shown from its own step, not the kit's (see ABOUT_COLUMN_LABEL_CLASS).
  { id: 'about', label: 'About', width: 'hidden @min-[38lh]/page:table-column', wrap: true },
  {
    id: 'language',
    label: 'Language',
    priority: 1,
    width: 'w-[24%] @min-[48rem]/page:w-[9.5rem]',
    wrap: true,
  },
  {
    id: 'stars',
    label: 'Stars',
    align: 'end',
    width:
      'w-[calc(var(--stars-ch,4)*1ch+0.75rem)] @max-[20rem]/page:w-[calc((var(--stars-ch,4)_-_1)*1ch+0.75rem)] @min-[40rem]/page:w-[calc(var(--stars-ch,4)*1ch+1.25rem)]',
    sort: 'number',
  },
] as const satisfies readonly IndexColumn[];
const [RANK, REPOSITORY, ABOUT, LANGUAGE, STARS] = COLUMNS;

/**
 * Where About shows: a page 38 lines of its own text wide, 988px at the default size (the page
 * container's width, its gutters included). With the rank, a name column sized for today's
 * longest name (about 300px), the language's 9.5rem and the stars, About then has about 375px,
 * and the longest description shown today (268 characters) takes five lines, a row half again as
 * tall as its neighbours. At the kit's 48rem (priority 2) About had 145px on an upright tablet and
 * that description stood 14 lines, four times its neighbours, beside a half-empty name column.
 * Below the step it stays under the name (LONG_ABOUT_LINE_CLASS). In lines, as the page's other
 * steps that hold words: text a phone enlarges without changing rem keeps the description under
 * the name for longer.
 *
 * The kit draws the column labels without a hook per column, so the section hides the third
 * label (About, the third of COLUMNS) below the step; its <col> (the column's `width`) and its
 * cells (ABOUT_CELL_CLASS) carry the same step.
 */
const ABOUT_COLUMN_LABEL_CLASS =
  '[&_thead_th:nth-child(3)]:hidden @min-[38lh]/page:[&_thead_th:nth-child(3)]:table-cell';

/** Under a 20rem page the cells give up half their side padding to the name. */
const NARROW_CELL_CLASS = '@max-[20rem]/page:px-1';
/**
 * The repository cell: room above and below once its lines stack (a phone row grows past the
 * kit's 60 px); from 40rem three lines of description still fit the kit's 64 px row. Like the
 * About and Language cells it wraps instead of cutting (the columns' `wrap`).
 */
const REPOSITORY_CELL_CLASS = cn(
  indexCellClass(REPOSITORY),
  NARROW_CELL_CLASS,
  'py-2 @min-[40rem]/page:py-1',
);
const ABOUT_CELL_CLASS = cn(indexCellClass(ABOUT), 'hidden py-1 @min-[38lh]/page:table-cell');
const LANGUAGE_CELL_CLASS = indexCellClass(LANGUAGE);
const RANK_CELL_CLASS = cn(indexCellClass(RANK), NARROW_CELL_CLASS);
/**
 * A figure is never cut. The column is sized for the widest count (see COLUMNS), so this is only
 * a last resort: were a count ever wider than its column, it would show whole rather than end in
 * an ellipsis (the kit's cells clip to one line), still ending on the column's right edge and
 * running left over the cell's own padding (STARS_FIGURE_CLASS: a row packed to its end
 * overflows at its start, where right-aligned text would overflow to the right).
 */
const STARS_CELL_CLASS = cn(indexCellClass(STARS), NARROW_CELL_CLASS, 'overflow-visible text-clip');
const STARS_FIGURE_CLASS = 'flex justify-end tabular-nums';

/** The counts the colgroup sizes its name and star columns from (see COLUMNS). */
const columnSizeStyle = ({ nameChars, starsChars }: RepoColumnSizes): CSSProperties =>
  ({ '--name-ch': nameChars, '--stars-ch': starsChars }) as CSSProperties;

/** What the repository is, in the meta style. */
const ABOUT_TEXT_CLASS = 'tile-meta text-muted-foreground';
/** The description under the name, until the About column shows it. */
const ABOUT_LINE_CLASS = `mt-0.5 ${ABOUT_TEXT_CLASS} @min-[38lh]/page:hidden`;
/**
 * A description up to this long is a tagline: about three lines under the name on the narrowest
 * phone at the default text size. It always shows whole, so enlarged text can only add lines to
 * it, never cut it.
 */
const SHORT_DESCRIPTION_CHARS = 80;
/**
 * A longer one (GitHub allows 350 characters) would make a phone row a paragraph, so under the
 * name it is shortened after three lines, or six once the page is under 9.84 lines of its own
 * text wide. That is the 16rem the step had at the default size (256px); measured in lines it
 * also reaches a phone that enlarges text without changing any length, where a line holds half
 * as much. From 40rem, with the language in its own column, it may take four: up to the About
 * step today's longest takes four to six lines there, so four show it whole from about a 780px
 * page and keep the row under twice its neighbours. Only the count changes there: a line-clamp
 * class would also set its display, after the About step's `hidden`, and show the description
 * twice beside About.
 */
const LONG_ABOUT_LINE_CLASS =
  'line-clamp-3 @max-[9.84lh]/page:line-clamp-6 @min-[40rem]/page:[-webkit-line-clamp:4]';
/** The classes of the description under the name: shortened only when it is a long one. */
const aboutLineClass = (description: string): string =>
  description.length > SHORT_DESCRIPTION_CHARS
    ? `${ABOUT_LINE_CLASS} ${LONG_ABOUT_LINE_CLASS}`
    : ABOUT_LINE_CLASS;
/**
 * The description in its own column: whole, on as many lines as it takes. The row grows with it
 * (the kit's rows have a least height, not a fixed one). A block, so its lines keep the meta
 * style's own height rather than the cell's.
 */
const ABOUT_COLUMN_CLASS = `block ${ABOUT_TEXT_CLASS}`;
/** The language under the name on a phone page, where it has no column. */
const LANGUAGE_LINE_CLASS = 'mt-0.5 block tile-meta text-faint @min-[40rem]/page:hidden';

/**
 * The section around the table. Its group bar grows with its two-line heading on a phone page
 * (the kit's `wrapHeading`), and on a short screen neither the bar nor the column labels stay
 * pinned (`pin="tall-screens"`): six rows never scroll far, and pinned bars over the bottom bar
 * left under half the screen for them.
 */
const SECTION_CLASS = `flex flex-col gap-2 ${ABOUT_COLUMN_LABEL_CLASS}`;

/** The table's heading and what it counts, which its skeleton shows too. */
const TABLE_HEADING = 'Top repositories';
const TABLE_COUNT = 'by stars · public, excluding forks';

/** The six most-starred public repositories, with an honest empty or unavailable state. */
export function RepositoryTable({
  result,
}: {
  readonly result: TileResult<GitHubStatsData>;
}): ReactElement {
  const table = topRepos(result);
  if (!table) {
    return (
      <EmptyState
        title={result.status === 'error' ? 'Repositories unavailable' : 'No repositories yet'}
      >
        {result.status === 'error'
          ? 'GitHub did not return the repository list.'
          : 'Public projects will appear here.'}
      </EmptyState>
    );
  }
  return (
    <section
      aria-label="Top repositories"
      className={SECTION_CLASS}
      style={columnSizeStyle(table.columns)}
    >
      <IndexGroup
        id="stats-top-repositories"
        year={TABLE_HEADING}
        count={TABLE_COUNT}
        columns={COLUMNS}
        variant="open"
        wrapHeading
        pin="tall-screens"
      >
        {table.rows.map((repo, index) => (
          <IndexRow key={repo.url} data-stats-repo="">
            <td className={RANK_CELL_CLASS}>
              <span className="tabular-nums text-faint">{index + 1}</span>
            </td>
            <td className={REPOSITORY_CELL_CLASS}>
              <span className="flex min-w-0 flex-col">
                {/* The name wraps instead of being cut; its arrow is glued to the last word. */}
                <IndexTitleLink href={repo.url} external wrap>
                  {repo.name}
                  <NewTabArrow />
                </IndexTitleLink>
                {repo.description && (
                  <span data-repo-about="" className={aboutLineClass(repo.description)}>
                    {repo.description}
                  </span>
                )}
                {repo.language && <span className={LANGUAGE_LINE_CLASS}>{repo.language}</span>}
              </span>
            </td>
            <td className={ABOUT_CELL_CLASS}>
              {repo.description && <span className={ABOUT_COLUMN_CLASS}>{repo.description}</span>}
            </td>
            <td className={LANGUAGE_CELL_CLASS}>{repo.language ?? '—'}</td>
            <td className={STARS_CELL_CLASS}>
              <span className={STARS_FIGURE_CLASS}>{numberFormatter().format(repo.stars)}</span>
            </td>
          </IndexRow>
        ))}
      </IndexGroup>
      {result.status === 'ok' && result.asOf && (
        <p className="flex items-center tile-meta text-faint">
          {result.stale ? <StaleAge at={result.asOf} /> : <PresentAge at={result.asOf} />}
        </p>
      )}
    </section>
  );
}

/**
 * What the skeleton's bars are shaped as (ShapePlaceholder): a name, a tagline, a language and a
 * two-digit count, about what the loaded rows hold.
 */
const SKELETON_NAME = 'a-public-project';
const SKELETON_ABOUT = 'What the repository is, in a line or two';
const SKELETON_LANGUAGE = 'TypeScript';
const SKELETON_STARS = '00';

/** One row while the list loads: the row's cells, each a bar the size of what it holds. */
function RepositoryRowSkeleton({ rank }: { readonly rank: number }): ReactElement {
  return (
    <IndexRow aria-hidden="true" data-stats-repo-skeleton="">
      <td className={RANK_CELL_CLASS}>
        <span className="tabular-nums text-faint">{rank}</span>
      </td>
      <td className={REPOSITORY_CELL_CLASS}>
        <span className="flex min-w-0 flex-col">
          <span className="self-start font-medium">
            <ShapePlaceholder shape={SKELETON_NAME} />
          </span>
          <span className={ABOUT_LINE_CLASS}>
            <ShapePlaceholder shape={SKELETON_ABOUT} />
          </span>
          <span className={LANGUAGE_LINE_CLASS}>
            <ShapePlaceholder shape={SKELETON_LANGUAGE} />
          </span>
        </span>
      </td>
      <td className={ABOUT_CELL_CLASS}>
        <span className={ABOUT_COLUMN_CLASS}>
          <ShapePlaceholder shape={SKELETON_ABOUT} />
        </span>
      </td>
      <td className={LANGUAGE_CELL_CLASS}>
        <ShapePlaceholder shape={SKELETON_LANGUAGE} />
      </td>
      <td className={STARS_CELL_CLASS}>
        <span className={STARS_FIGURE_CLASS}>
          <ShapePlaceholder shape={SKELETON_STARS} />
        </span>
      </td>
    </IndexRow>
  );
}

/**
 * The table while the GitHub totals load (/stats streams it on its own): the real heading, count
 * and column labels over as many rows as the table lists, in the table's own columns and cells,
 * and the age line under it, so the loaded table takes the same room.
 */
export function RepositoryTableSkeleton(): ReactElement {
  return (
    <section
      aria-label={TABLE_HEADING}
      aria-busy="true"
      className={SECTION_CLASS}
      data-stats-skeleton="repositories"
    >
      <IndexGroup
        id="stats-top-repositories-loading"
        year={TABLE_HEADING}
        count={TABLE_COUNT}
        columns={COLUMNS}
        variant="open"
        wrapHeading
        pin="tall-screens"
      >
        {Array.from({ length: TOP_REPOS_SHOWN }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
          <RepositoryRowSkeleton key={index} rank={index + 1} />
        ))}
      </IndexGroup>
      <p aria-hidden="true" className="flex items-center tile-meta text-faint">
        <ShapePlaceholder shape={WIDEST_AGE} />
      </p>
      <LoadingNote>Loading the top repositories</LoadingNote>
    </section>
  );
}
