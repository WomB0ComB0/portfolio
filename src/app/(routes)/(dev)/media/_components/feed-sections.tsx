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
 * @file /media's sections, which the filter island renders from the rows it keeps: one IndexTable
 * group per kind that has rows, in section order (Writing, Articles, Video, Streams, Talks,
 * Presentations), each a flat list with its own heading, count and columns. A kind with no rows
 * (none published, or all filtered out) gets no section. The heading is the group's h2 ("Video,
 * 23 videos · 5 h 43 min" to a screen reader), sticky under the filter bar with the column labels
 * under it, exactly as a year bar behaves in the one feed. Server-safe: no directive, no hooks.
 *
 * A long series does not fill a section with one title: while no filter is on, a series of more
 * than LONG_SERIES_OVER uploads lists its newest LONG_SERIES_SHOWN, then one line says how many
 * earlier ones there are and links to all of them by the series' name (the series view, a real
 * link that also works without JavaScript). The section's count and total length still count
 * every upload, and a search, a kind, a topic or the series itself lists every row.
 *
 * Which rows then link their series is decided here too (plainSeriesRows): a row says its place
 * as text where every upload of its series is already in the list (wholeSeriesIn), since the
 * link would only show those rows again, or where the link would be one of many alike (the rows
 * of a long series, which its closing line or its first row links once). A series links only from
 * a list that holds part of it.
 */

import Link from 'next/link';
import { Fragment, type ReactElement, type ReactNode } from 'react';

import { INDEX_GROUPS_CLASS, IndexGroup, indexCellClass } from '@/components/console/index-table';
import { trimEnd } from '@/lib/text/trim';
import { cn } from '@/lib/utils';
import { type FeedKind, KIND_WORDS } from '../_lib/media-feed';
import { lengthText } from '../_lib/media-format';
import { SENTENCE_STOPS } from '../_lib/media-parts';
import { groupByKind } from '../_lib/media-rows';
import {
  type FeedColumn,
  MORE_CELL_CLASS,
  MORE_LINE_CLASS,
  SECTION_COLUMNS,
  SEE_LINK_CLASS,
  SEE_TEXT_CLASS,
} from './feed-classes';

/** A series longer than this lists only its newest uploads while no filter is on. */
export const LONG_SERIES_OVER = 8;
/** How many of a long series' uploads are listed then: the newest ones. */
export const LONG_SERIES_SHOWN = 5;

/** What a section needs of a row, plus the row itself. */
export interface SectionFeedRow {
  readonly id: string;
  readonly kind: FeedKind;
  /** The series the row is an upload of, for cutting a long one short; null in none. */
  readonly series?: { readonly slug: string; readonly name: string } | null;
  /** The row's length in seconds (a folded row's parts added up); null when it has none. */
  readonly seconds: number | null;
  /** How many items the row stands for: a folded row's uploads; one when left out. */
  readonly count?: number;
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

/** What stands in for the uploads of a long series that are not listed. */
export interface MoreOfSeries {
  readonly slug: string;
  readonly name: string;
  /** How many uploads the series has in this section. */
  readonly count: number;
  /** How many of them are not listed. */
  readonly hidden: number;
}

/** A section's lines: a row, or the line that closes a long series. */
export type SectionLine<T> =
  | { readonly row: T; readonly more?: never }
  | { readonly more: MoreOfSeries; readonly row?: never };

/** What telling a series' rows apart needs of a row. */
type SeriesRow = Pick<SectionFeedRow, 'id' | 'kind' | 'series'>;

/** What counting a series' uploads in a list needs of a row. */
interface CountedRow extends Pick<SectionFeedRow, 'series' | 'count'> {
  /** The uploads a folded row stands for (the lab's "Fold parts"); left out for one upload. */
  readonly folded?: readonly unknown[];
}

/**
 * How many of `rows` each series has, by its slug: rows by default, or what `weigh` makes of
 * each row.
 */
function countBySeries<T extends Pick<SeriesRow, 'series'>>(
  rows: readonly T[],
  weigh: (row: T) => number = () => 1,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.series) counts.set(row.series.slug, (counts.get(row.series.slug) ?? 0) + weigh(row));
  }
  return counts;
}

/** How many uploads a row stands for: those the filters kept of it, else all it folds, else one. */
const uploadsOf = (row: CountedRow): number => row.count ?? row.folded?.length ?? 1;

/**
 * The series (by slug) that `shown` holds whole: every upload of it on the page (`all`, every
 * row unfiltered) is in the list. A link to such a series would show the same rows again.
 */
export function wholeSeriesIn(
  shown: readonly CountedRow[],
  all: readonly CountedRow[],
): ReadonlySet<string> {
  const onPage = countBySeries(all, uploadsOf);
  return new Set(
    [...countBySeries(shown, uploadsOf)]
      .filter(([slug, count]) => count === onPage.get(slug))
      .map(([slug]) => slug),
  );
}

/**
 * A section's rows (newest first) as its lines: every row, except that a series of more than
 * LONG_SERIES_OVER uploads keeps its newest LONG_SERIES_SHOWN and gets one line, where its next
 * upload would have been, for the rest.
 */
export function cutLongSeries<T extends SectionFeedRow>(rows: readonly T[]): SectionLine<T>[] {
  const counts = countBySeries(rows);
  const listed = new Map<string, number>();
  return rows.flatMap((row): SectionLine<T>[] => {
    const count = row.series ? (counts.get(row.series.slug) ?? 0) : 0;
    if (!row.series || count <= LONG_SERIES_OVER) return [{ row }];
    const seen = listed.get(row.series.slug) ?? 0;
    listed.set(row.series.slug, seen + 1);
    if (seen < LONG_SERIES_SHOWN) return [{ row }];
    if (seen > LONG_SERIES_SHOWN) return [];
    const { slug, name } = row.series;
    return [{ more: { slug, name, count, hidden: count - LONG_SERIES_SHOWN } }];
  });
}

/** How a list is shown, as far as its rows' series references go. */
export interface SeriesListing {
  /** The list is the series view: one series, first part first. */
  readonly inSeries: boolean;
  /** A long series is cut to its newest uploads and closed by its "Show all" line. */
  readonly cut: boolean;
  /** The series the list holds whole (wholeSeriesIn), by slug; none when left out. */
  readonly whole?: ReadonlySet<string>;
}

const NO_SERIES: ReadonlySet<string> = new Set();

/** The series (by slug) that have more than LONG_SERIES_OVER of `rows`. */
function longSeriesIn(rows: readonly Pick<SeriesRow, 'series'>[]): ReadonlySet<string> {
  return new Set(
    [...countBySeries(rows)].filter(([, count]) => count > LONG_SERIES_OVER).map(([slug]) => slug),
  );
}

/** The rows of `rows` that are uploads of one of the `series`, by id. */
const rowsOfSeries = (rows: readonly SeriesRow[], series: ReadonlySet<string>): string[] =>
  rows.filter((row) => row.series && series.has(row.series.slug)).map((row) => row.id);

/**
 * The rows (by id) of a long series that `rows` holds only in part, after its first listed row:
 * one link to it is enough in a list.
 */
function laterRowsOfLongSeries(rows: readonly SeriesRow[], whole: ReadonlySet<string>): string[] {
  const long = longSeriesIn(rows);
  const linked = new Set<string>();
  return rows.flatMap(({ id, series }) => {
    if (!series || !long.has(series.slug) || whole.has(series.slug)) return [];
    if (linked.has(series.slug)) return [id];
    linked.add(series.slug);
    return [];
  });
}

/**
 * The rows (by id) that say their place in their series as text ("Upload 3 of 27") instead of
 * linking the series, for `rows` as they are listed:
 * - inside the series view, every row: the link would lead to the list the visitor is in;
 * - every row of a series the list holds whole (`whole`, from wholeSeriesIn), beside other rows
 *   or not: the link would show the same rows again. On the full list that is every series;
 * - where a long series is cut to its newest uploads, every listed row of it: the "Show all"
 *   line that closes them is the link. Each section cuts its own rows (cutLongSeries), so each
 *   is asked on its own;
 * - where a long series is listed only in part (a search, a topic), every row of it after the
 *   first listed.
 * A short series the list holds only in part keeps a link on every row: it opens the rest.
 */
export function plainSeriesRows(
  rows: readonly SeriesRow[],
  { inSeries, cut, whole = NO_SERIES }: SeriesListing,
): ReadonlySet<string> {
  if (inSeries) return new Set(rows.filter((row) => row.series).map((row) => row.id));
  const cutRows = cut
    ? groupByKind(rows).flatMap((section) => rowsOfSeries(section.rows, longSeriesIn(section.rows)))
    : laterRowsOfLongSeries(rows, whole);
  return new Set([...rowsOfSeries(rows, whole), ...cutRows]);
}

/** A series' title inside a sentence: without the stop it may close with itself. */
export const inSentence = (name: string): string => trimEnd(name, SENTENCE_STOPS);

interface MoreRowProps {
  readonly more: MoreOfSeries;
  readonly href: string;
  /** The section's columns: the line sits in the first, the rest stay empty. */
  readonly columns: readonly FeedColumn[];
  /** False when the kind is listed only in part: the series' count is then not stated. */
  readonly complete: boolean;
}

/** "22 earlier uploads."; where the kind is listed only in part, no count ("Earlier uploads."). */
function earlierWords(hidden: number, complete: boolean): string {
  if (!complete) return 'Earlier uploads.';
  return `${hidden} earlier ${hidden === 1 ? 'upload' : 'uploads'}.`;
}

/**
 * "22 earlier uploads." and the link to all of them, which names the series ("Show all 27
 * uploads of <series>"). Where the kind is listed only in part (past the channel listing's cap)
 * more earlier uploads may exist than are listed, so neither count is said: "Earlier uploads.
 * Show all listed uploads of <series>". It is the section's one link to the series, and reads on
 * its own in a list of links. Not a row of the list. It is written in the title column with the
 * other cells left empty, never as one cell spanning them: a phone hides those columns, and a
 * cell that still spans them would bring them back and squeeze every title into a sliver.
 */
function MoreRow({ more, href, columns, complete }: MoreRowProps): ReactElement {
  const [, ...rest] = columns;
  const all = complete ? `all ${more.count}` : 'all listed';
  return (
    <tr data-feed-more={more.slug}>
      <td className={MORE_CELL_CLASS}>
        <div className={MORE_LINE_CLASS}>
          <span>{earlierWords(more.hidden, complete)}</span>{' '}
          <Link href={href} prefetch={false} data-feed-more-link="" className={SEE_LINK_CLASS}>
            <span className={SEE_TEXT_CLASS}>
              Show {all} uploads of {inSentence(more.name)}
            </span>
          </Link>
        </div>
      </td>
      {rest.map((column) => (
        <td
          key={column.id}
          aria-hidden="true"
          className={cn(indexCellClass(column), 'border-b-0')}
        />
      ))}
    </tr>
  );
}

/**
 * A section's count: "2 posts", "1 post"; where the section has a Length column and at least one
 * length can be read, the lengths added up as well: "23 videos · 5 h 43 min". It counts items, so
 * a row that folds several uploads counts each of them, as the lengths already do. Where the kind
 * is listed only in part (`complete` false, past the channel listing's cap), the count of what is
 * listed alone, no total length: "200 videos".
 */
function sectionCount(kind: FeedKind, rows: readonly SectionFeedRow[], complete = true): string {
  const words = KIND_WORDS[kind];
  const items = rows.reduce((sum, row) => sum + (row.count ?? 1), 0);
  const count = `${items} ${(items === 1 ? words.one : words.many).toLowerCase()}`;
  const columns: readonly FeedColumn[] = SECTION_COLUMNS[kind];
  const timed = complete && columns.some((column) => column.id === 'length');
  const lengths = rows.flatMap((row) => (row.seconds === null ? [] : [row.seconds]));
  if (!timed || lengths.length === 0) return count;
  return `${count} · ${lengthText(lengths.reduce((sum, seconds) => sum + seconds, 0))}`;
}

export interface FeedSectionsProps {
  readonly items: readonly SectionFeedRow[];
  /**
   * The page's URL showing only one series. Given, a long series lists its newest uploads and a
   * line links to the rest; left out (a filter is on, or the lab's "Every upload"), every row is
   * listed.
   */
  readonly seriesHref?: (slug: string) => string;
  /** The kinds listed only in part (the uploads, past the channel listing's cap); none by default. */
  readonly uncounted?: readonly FeedKind[];
}

/** The rows in their sections, each section keeping the rows' order. */
export function FeedSections({
  items,
  seriesHref,
  uncounted = [],
}: FeedSectionsProps): ReactElement {
  return (
    <div className={INDEX_GROUPS_CLASS}>
      {groupByKind(items).map(({ kind, rows }) => {
        const columns: readonly FeedColumn[] = SECTION_COLUMNS[kind];
        const complete = !uncounted.includes(kind);
        const lines: readonly SectionLine<SectionFeedRow>[] = seriesHref
          ? cutLongSeries(rows)
          : rows.map((row) => ({ row }));
        return (
          <IndexGroup
            key={kind}
            id={`media-${kind}`}
            year={KIND_WORDS[kind].title}
            count={sectionCount(kind, rows, complete)}
            columns={columns}
            variant="open"
          >
            {lines.map((line) =>
              line.row ? (
                <Fragment key={line.row.id}>{line.row.row}</Fragment>
              ) : seriesHref && line.more ? (
                <MoreRow
                  key={`more:${line.more.slug}`}
                  more={line.more}
                  href={seriesHref(line.more.slug)}
                  columns={columns}
                  complete={complete}
                />
              ) : null,
            )}
          </IndexGroup>
        );
      })}
    </div>
  );
}
