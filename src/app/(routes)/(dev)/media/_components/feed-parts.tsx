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

'use client';

/**
 * @file A folded stream's parts disclosure. A search also reads every part's own text
 * (media-feed.ts), so a query such as "Part 2/2" returns the folded row; this is the piece that
 * shows why: when the search matches some parts but not all of them, the disclosure opens and
 * the matching parts are marked (and it closes again once that search is cleared, unless the
 * visitor toggled it in between). When every part matches, the stream itself matched and nothing
 * is marked. It reads the search from the FilterBar's model, so the server HTML of a shared ?q=
 * link is already open and marked without JavaScript. The chevron and the part links arrive as
 * server-rendered markup.
 *
 * The row's own words follow the same search as its section's count does: "1 of 3 parts" and
 * the found parts' span in the summary, in its Length cell (FoldedLength) the length of the parts
 * the search found and in its Date cell (FoldedDate) the newest of them, so the row never says
 * more than the heading above it counts.
 */

import { type ReactElement, type ReactNode, useState } from 'react';

import { useFilterBar } from '@/components/console/filter-bar';
import { dateRange, fullDay, isoDay, lengthText, monthDay } from '../_lib/media-format';
import {
  PART_MATCH_CLASS,
  PARTS_CLASS,
  PARTS_LINE_CLASS,
  PARTS_LIST_CLASS,
  PARTS_RANGE_CLASS,
  PARTS_SUMMARY_CLASS,
} from './feed-classes';

/** What a search reads of a part, its length in seconds (null when it has none) and its date. */
export interface FeedPartWords {
  readonly id: string;
  readonly haystack: string;
  readonly seconds: number | null;
  /** The date as the source gave it (ISO); null when undated. */
  readonly date: string | null;
}

/** One part: what a search reads of it, its length and its link. */
export interface FeedPartItem extends FeedPartWords {
  readonly link: ReactNode;
}

export interface FeedPartsProps {
  /** The list's name: "Parts of <title>". */
  readonly label: string;
  /** The summary's chevron. */
  readonly chevron: ReactNode;
  /** The parts' year, written after their span where no year bar holds it; null to leave it out. */
  readonly year: string | null;
  /** Every part, oldest first. */
  readonly parts: readonly FeedPartItem[];
}

/** The ids of the parts `query` singles out: none when it matches no part, or every part. */
function singledOut(parts: readonly FeedPartWords[], query: string): ReadonlySet<string> {
  const needle = query.toLowerCase();
  if (needle === '') return new Set();
  const matched = parts.filter((part) => part.haystack.toLowerCase().includes(needle));
  return new Set(matched.length < parts.length ? matched.map((part) => part.id) : []);
}

/** The parts the search singled out, or every part when it singled out none. */
function partsInView<T extends FeedPartWords>(parts: readonly T[], query: string): readonly T[] {
  const matched = singledOut(parts, query);
  return matched.size > 0 ? parts.filter((part) => matched.has(part.id)) : parts;
}

/**
 * A folded row's Length cell: the parts' lengths added up, only the found parts' while a search
 * singles some out; a dash a screen reader hears as "No length" when none can be read.
 */
export function FoldedLength({ parts }: { readonly parts: readonly FeedPartWords[] }): ReactNode {
  const { model } = useFilterBar();
  const lengths = partsInView(parts, model.active.q).flatMap((part) =>
    part.seconds === null ? [] : [part.seconds],
  );
  if (lengths.length === 0) return <Missing words="No length" />;
  return lengthText(lengths.reduce((sum, seconds) => sum + seconds, 0));
}

/** A dash a screen reader hears as `words`. */
function Missing({ words }: { readonly words: string }): ReactElement {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{words}</span>
    </>
  );
}

/** The parts' dates, oldest first as the parts are; an undated part gives none. */
const datesOf = (parts: readonly FeedPartWords[]): string[] =>
  parts.flatMap((part) => (part.date === null ? [] : [part.date]));

export interface FoldedDateProps {
  readonly parts: readonly FeedPartWords[];
  /** "Dec 30, 2025" where no year bar holds the year, else "Dec 30". */
  readonly withYear: boolean;
}

/**
 * A folded row's Date cell: its newest part's day, the newest found part's while a search
 * singles some out; a dash a screen reader hears as "No date" when none is dated.
 */
export function FoldedDate({ parts, withYear }: FoldedDateProps): ReactNode {
  const { model } = useFilterBar();
  const newest = datesOf(partsInView(parts, model.active.q)).at(-1);
  if (newest === undefined) return <Missing words="No date" />;
  return (
    <time dateTime={isoDay(newest)} className="tabular-nums">
      {withYear ? fullDay(newest) : monthDay(newest)}
    </time>
  );
}

interface PartsRangeProps {
  /** The parts in view, oldest first. */
  readonly parts: readonly FeedPartWords[];
  /** The parts' year, written after the span where no year bar holds it; null to leave it out. */
  readonly year: string | null;
}

/** "Dec 29 – 30": the parts' span, kept whole on a narrow line; null when undated. */
function PartsRange({ parts, year }: PartsRangeProps): ReactElement | null {
  const dates = datesOf(parts);
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined) return null;
  return (
    <span data-parts-range="" className={PARTS_RANGE_CLASS}>
      {dateRange(first, last)}
      {year !== null && `, ${year}`}
    </span>
  );
}

interface PartsLineProps {
  /** How many parts the row folds. */
  readonly count: number;
  /** How many of them a search singled out; 0 when it singled out none. */
  readonly matched: number;
  /** The parts in view (the singled-out ones, or every one), oldest first. */
  readonly inView: readonly FeedPartWords[];
  readonly year: string | null;
}

/** "3 parts · Dec 29 – 30, 2025", or "1 of 3 parts · Dec 29, 2025" while a search singles one out. */
function PartsLine({ count, matched, inView, year }: PartsLineProps): ReactElement {
  return (
    <span className={PARTS_LINE_CLASS}>
      {matched > 0 ? `${matched} of ${count} parts` : `${count} parts`}
      {datesOf(inView).length > 0 && (
        <>
          {' · '}
          <PartsRange parts={inView} year={year} />
        </>
      )}
    </span>
  );
}

/** The disclosure: closed and quiet, or open on the parts a search singled out. */
export function FeedParts({ label, chevron, year, parts }: FeedPartsProps): ReactElement {
  const { model } = useFilterBar();
  const query = model.active.q;
  const matched = singledOut(parts, query);
  const matchKey = matched.size > 0 ? query : '';
  const [open, setOpen] = useState(matched.size > 0);
  /** True while the list is open only because a search opened it; a toggle by hand clears it. */
  const [openedBySearch, setOpenedBySearch] = useState(matched.size > 0);
  const [seenKey, setSeenKey] = useState(matchKey);
  // A new search that singles parts out opens the list, and clearing that search closes it
  // again. A list the visitor opened or closed by hand is theirs and is left alone on a clear.
  if (seenKey !== matchKey) {
    setSeenKey(matchKey);
    if (matchKey !== '') {
      if (!open) setOpenedBySearch(true);
      setOpen(true);
    } else if (openedBySearch) {
      setOpenedBySearch(false);
      setOpen(false);
    }
  }

  return (
    <details
      data-feed-parts=""
      className={PARTS_CLASS}
      open={open}
      onToggle={(event) => {
        // The toggle event also follows our own change of `open`; only a change that differs
        // from the state is the visitor's.
        const next = event.currentTarget.open;
        if (next === open) return;
        setOpenedBySearch(false);
        setOpen(next);
      }}
    >
      <summary className={PARTS_SUMMARY_CLASS}>
        {chevron}
        <PartsLine
          count={parts.length}
          matched={matched.size}
          inView={partsInView(parts, query)}
          year={year}
        />
      </summary>
      <ol aria-label={label} className={PARTS_LIST_CLASS}>
        {parts.map((part) => {
          const isMatch = matched.has(part.id);
          return (
            <li
              key={part.id}
              data-match={isMatch ? '' : undefined}
              className={isMatch ? PART_MATCH_CLASS : undefined}
            >
              {isMatch && <span className="sr-only">Matches your search: </span>}
              {part.link}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
