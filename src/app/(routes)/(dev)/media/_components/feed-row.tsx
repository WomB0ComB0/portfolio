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
 * @file One row of /media (IndexTable style 2, the open index), rendered on the server and handed
 * to the filter island as markup. Server-safe: no directive, no hooks.
 *
 * The row's cells come from its table's column set (feed-classes.ts), so a section shows only
 * what varies in it: Writing has Where, Video and Streams have Length, and the one feed keeps
 * Kind, Where and Length. On a wide page it is the still and the title (the row's one link,
 * stretched over the row, onward to where the item lives, in a new tab with an arrow), under it
 * its first real sentence and then its "see also" line (its other version, its series, its
 * project, its topics: feed-see-also.tsx), then its cells. A row is at least the kit's 64px and
 * grows with what it holds; no title is cut. The date carries its year in a section ("Dec 30,
 * 2025"); in the one feed the year bar holds it ("Dec 30"). A folded stream says "3 parts ·
 * Dec 29 – 30" under its title instead, and opens to every part as a small link. On a phone the
 * cells hide and one meta line reads "11:34 · May 5, 2026" (a section) or "Video · 11:34 · Dec 30"
 * (the one feed), above the "see also" line. With the embed option a video's link opens the
 * in-page player (data-play, picked up by the island); without JavaScript it still goes to
 * YouTube.
 */

import type { ReactElement, ReactNode } from 'react';
import { FiChevronRight, FiPlay } from 'react-icons/fi';

import {
  INDEX_META_CLASS,
  INDEX_SUB_CLASS,
  INDEX_TITLE_TEXT_CLASS,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';
import { INDEX_TITLE_LINK_CLASS } from '@/components/console/index-table/index-table-classes';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import {
  type FeedEntry,
  type FeedRow as FeedRowData,
  KIND_WORDS,
  UNDATED,
} from '../_lib/media-feed';
import { fullDay, isoDay, lengthSeconds, monthDay, totalLength } from '../_lib/media-format';
import type { PlayMode } from '../_lib/media-options';
import { markerSpan } from '../_lib/media-parts';
import {
  type FeedColumn,
  ITEM_CLASS,
  ITEM_TEXT_CLASS,
  OPEN_ROW_CELL_CLASS,
  OPEN_ROW_ITEM_CELL_CLASS,
  PART_LENGTH_CLASS,
  PART_LINK_CLASS,
  PARTS_CHEVRON_CLASS,
  TITLE_ARROW_CLASS,
  TITLE_LINE_CLASS,
  TITLE_LINK_CLASS,
  TITLE_MARK_CLASS,
  TITLE_MARKER_CLASS,
  TITLE_TEXT_CLASS,
} from './feed-classes';
import { FeedParts, type FeedPartWords, FoldedDate, FoldedLength } from './feed-parts';
import { playAttributes, playsHere } from './feed-play';
import { FeedSeeAlso } from './feed-see-also';
import { FeedThumb } from './feed-thumb';

/** How a row writes its date: the day alone under a year bar, or with its year. */
export type DateStyle = 'day' | 'full';

export interface FeedRowProps {
  readonly row: FeedRowData;
  /** The row's table's columns: the first is the title, the rest are filled by id. */
  readonly columns: readonly FeedColumn[];
  readonly dateStyle: DateStyle;
  /** The page's URL showing only the row's series; null when it is in none. */
  readonly seriesHref: string | null;
  /** The page's URL showing only what is filed under a topic. */
  readonly topicHref: (slug: string) => string;
  readonly play: PlayMode;
  /** One of the first rows: its still loads at once. */
  readonly eager: boolean;
  /**
   * False when the row's kind is listed only in part (past the channel listing's cap): its
   * series place then states no number ("Series: <name>", not "Upload 14 of 27").
   */
  readonly complete?: boolean;
}

type TitleProps = Pick<FeedRowProps, 'row' | 'play'>;

/**
 * A title's words, its own part marker ("(Part 2/2)") kept on one line: a narrow line breaks
 * before the marker, never inside it. The words themselves are unchanged.
 */
function TitleWords({ title }: { readonly title: string }): ReactNode {
  const span = markerSpan(title);
  if (!span) return title;
  const [start, end] = span;
  return (
    <>
      {title.slice(0, start)}
      <span data-title-marker="" className={TITLE_MARKER_CLASS}>
        {title.slice(start, end)}
      </span>
      {title.slice(end)}
    </>
  );
}

/**
 * The row's one link: the in-page player's (embed, a video), onward in a new tab (with the arrow
 * and the spoken words), or the title as text when the item has nowhere to go.
 */
function TitleLink({ row, play }: TitleProps): ReactElement {
  const words = <TitleWords title={row.title} />;
  const text = <span className={TITLE_TEXT_CLASS}>{words}</span>;
  if (row.href === null) {
    return (
      <span data-feed-title="" className={INDEX_TITLE_TEXT_CLASS}>
        {words}
      </span>
    );
  }
  const inPlace = playAttributes(row, play, row.title);
  if (inPlace) {
    return (
      <a
        href={row.href}
        data-feed-title=""
        {...inPlace}
        data-index-link=""
        className={cn(INDEX_TITLE_LINK_CLASS, TITLE_LINK_CLASS)}
      >
        {text}
        <FiPlay aria-hidden="true" className={cn(TITLE_MARK_CLASS, 'size-3')} />
      </a>
    );
  }
  // The title and its new-tab arrow are one run of text: the arrow is glued to the last word (the
  // kit's word joiner), so on a title that wraps it ends the last line, as on a project page.
  return (
    <IndexTitleLink
      href={row.href}
      external={row.external}
      data-feed-title=""
      className={TITLE_LINK_CLASS}
    >
      <span className={TITLE_TEXT_CLASS}>
        {words}
        {row.external && (
          <span className={TITLE_ARROW_CLASS}>
            <NewTabArrow />
          </span>
        )}
      </span>
    </IndexTitleLink>
  );
}

interface PartLinkProps {
  readonly part: FeedEntry;
  readonly index: number;
  readonly count: number;
  readonly title: string;
  readonly play: PlayMode;
}

/** One part: its day and length, said in full ("Part 1 of 3, Dec 29, 11:55:01") to a reader. */
function PartLink({ part, index, count, title, play }: PartLinkProps): ReactElement | null {
  if (part.href === null) return null;
  const inPlace = playAttributes(part, play, `${title}, part ${index + 1} of ${count}`);
  return (
    <a
      href={part.href}
      data-feed-part=""
      title={part.title}
      className={PART_LINK_CLASS}
      {...(inPlace ?? { target: '_blank', rel: 'noopener noreferrer' })}
    >
      <span className="sr-only">
        Part {index + 1} of {count},{' '}
      </span>
      {part.date ? <time dateTime={isoDay(part.date)}>{monthDay(part.date)}</time> : 'Undated'}
      {part.duration && <span className={PART_LENGTH_CLASS}>{part.duration}</span>}
      {!inPlace && <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>}
    </a>
  );
}

/**
 * What a search reads of each part, its length and its date: for the parts' count and span and
 * the Length and Date cells.
 */
const partWords = (row: FeedRowData): FeedPartWords[] =>
  row.parts.map((part) => ({
    id: part.id,
    haystack: part.haystack,
    seconds: lengthSeconds(part.duration),
    date: part.date,
  }));

type PartsProps = TitleProps & Pick<FeedRowProps, 'dateStyle'>;

/**
 * A folded stream's parts: closed, a quiet "3 parts · Dec 29 – 30" ("1 of 3 parts · Dec 29"
 * while a search finds only some, with those parts' span); open, every part. The disclosure
 * (feed-parts.tsx) opens itself on the parts a search singles out.
 */
function Parts({ row, play, dateStyle }: PartsProps): ReactElement {
  const words = partWords(row);
  return (
    <FeedParts
      label={`Parts of ${row.title}`}
      chevron={<FiChevronRight aria-hidden="true" className={PARTS_CHEVRON_CLASS} />}
      year={dateStyle === 'full' && row.year !== UNDATED ? row.year : null}
      parts={row.parts.map((part, index) => ({
        ...(words[index] ?? {
          id: part.id,
          haystack: part.haystack,
          seconds: null,
          date: part.date,
        }),
        link: (
          <PartLink
            part={part}
            index={index}
            count={row.parts.length}
            title={row.title}
            play={play}
          />
        ),
      }))}
    />
  );
}

/** A body cell's classes: the kit's for its column, top-aligned while the row's parts are open. */
const cellClass = (column: FeedColumn): string =>
  cn(indexCellClass(column), OPEN_ROW_CELL_CLASS, column.id === 'length' && 'tabular-nums');

/** A dash a screen reader hears as `words`. */
function Missing({ words }: { readonly words: string }): ReactElement {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{words}</span>
    </>
  );
}

/** The row's length: a stream's parts added up, a video's or talk's own, else none. */
function lengthOf(row: FeedRowData): string | null {
  return row.parts.length > 1 ? totalLength(row.parts.map((part) => part.duration)) : row.duration;
}

/** What a row writes in its cells and its phone meta line. */
interface RowWords {
  readonly length: string | null;
  /** "Dec 30" or "Dec 30, 2025"; null when undated. */
  readonly day: string | null;
}

/** One cell's contents, by its column's id. */
function cellContent(column: FeedColumn, row: FeedRowData, words: RowWords): ReactNode {
  switch (column.id) {
    case 'kind':
      return KIND_WORDS[row.kind].one;
    case 'where':
      return row.where;
    case 'length':
      return words.length ?? <Missing words="No length" />;
    case 'date':
      return row.date && words.day ? (
        <time dateTime={isoDay(row.date)} className="tabular-nums">
          {words.day}
        </time>
      ) : (
        <Missing words="No date" />
      );
    default:
      return null;
  }
}

/**
 * A folded row's cell: its Length and Date follow the search (the found parts' length and newest
 * day, feed-parts.tsx); every other cell is the row's own.
 */
function foldedCell(
  column: FeedColumn,
  row: FeedRowData,
  words: RowWords,
  dateStyle: DateStyle,
): ReactNode {
  if (column.id === 'length') return <FoldedLength parts={partWords(row)} />;
  if (column.id === 'date') {
    return <FoldedDate parts={partWords(row)} withYear={dateStyle === 'full'} />;
  }
  return cellContent(column, row, words);
}

/**
 * A phone's one meta line, from what the row's columns would have shown: the kind in the one
 * feed ("Video · 11:34 · Dec 30"); in a section, whose heading names the kind, where it lives or
 * its length ("Hashnode · Nov 11, 2025", "11:34 · May 5, 2026").
 */
function phoneMeta(row: FeedRowData, columns: readonly FeedColumn[], words: RowWords): string {
  const has = (id: FeedColumn['id']): boolean => columns.some((column) => column.id === id);
  return [
    has('kind') ? KIND_WORDS[row.kind].one : null,
    !has('kind') && has('where') ? row.where : null,
    has('length') ? words.length : null,
    words.day,
  ]
    .filter(Boolean)
    .join(' · ');
}

type NotesProps = Pick<
  FeedRowProps,
  'row' | 'columns' | 'seriesHref' | 'topicHref' | 'play' | 'complete'
> & {
  readonly words: RowWords;
};

/** An item's lines under its title: its summary, a phone's meta line and its "see also" line. */
function ItemNotes({
  row,
  columns,
  words,
  seriesHref,
  topicHref,
  play,
  complete,
}: NotesProps): ReactElement {
  return (
    <>
      {row.summary && (
        <span data-feed-summary="" className={INDEX_SUB_CLASS}>
          {row.summary}
        </span>
      )}
      <span data-feed-meta="" className={INDEX_META_CLASS}>
        {phoneMeta(row, columns, words)}
      </span>
      <FeedSeeAlso
        row={row}
        play={play}
        seriesHref={seriesHref}
        topicHref={topicHref}
        complete={complete}
      />
    </>
  );
}

/** One item, or one folded stream. */
export function FeedRow({
  row,
  columns,
  dateStyle,
  seriesHref,
  topicHref,
  play,
  eager,
  complete = true,
}: FeedRowProps): ReactElement {
  const folded = row.parts.length > 1;
  const [item, ...rest] = columns;
  const words: RowWords = {
    length: lengthOf(row),
    day: row.date ? (dateStyle === 'full' ? fullDay(row.date) : monthDay(row.date)) : null,
  };
  return (
    <IndexRow data-feed-row="" data-kind={row.kind} data-series={row.series?.slug}>
      <td className={item ? cn(indexCellClass(item), OPEN_ROW_ITEM_CELL_CLASS) : undefined}>
        <div className={ITEM_CLASS}>
          <FeedThumb row={row} playsHere={playsHere(row, play)} eager={eager} />
          <div className={ITEM_TEXT_CLASS}>
            <span className={TITLE_LINE_CLASS}>
              <TitleLink row={row} play={play} />
            </span>
            {folded ? (
              <Parts row={row} play={play} dateStyle={dateStyle} />
            ) : (
              <ItemNotes
                row={row}
                columns={columns}
                words={words}
                seriesHref={seriesHref}
                topicHref={topicHref}
                play={play}
                complete={complete}
              />
            )}
          </div>
        </div>
      </td>
      {rest.map((column) => (
        <td key={column.id} className={cellClass(column)}>
          {folded ? foldedCell(column, row, words, dateStyle) : cellContent(column, row, words)}
        </td>
      ))}
    </IndexRow>
  );
}
