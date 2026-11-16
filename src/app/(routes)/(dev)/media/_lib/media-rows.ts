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
 * @file /media's entries as the rows the page lists, and the ways it groups and counts them:
 * one row per upload (or a series folded into one row, the lab's alternative), rows by kind (the
 * sections) or by year (the one feed), the kinds that have items and each kind's count. Pure and
 * server-safe; the island imports the grouping.
 */

import {
  FEED_KINDS,
  type FeedEntry,
  type FeedKind,
  type FeedRow,
  type FeedStats,
  isUpload,
  type KindGroup,
  type PartsMode,
  UNDATED,
  type YearGroup,
} from './media-feed';
import { MEDIA_NOT_SERIES, standaloneKeys, standsAlone } from './media-not-series';
import { foldParts } from './media-parts';

/** The uploads that never fold with others (media-not-series.ts), as video keys. */
const ALONE = standaloneKeys(MEDIA_NOT_SERIES);

/** Whether an entry may fold with the uploads that share its base title. */
const canFold = (each: FeedEntry): boolean => isUpload(each) && !standsAlone(each, ALONE);

/**
 * The entries as rows. `each` keeps one row per upload, each with its place in its series;
 * `fold` folds a series' uploads of one year into one row under its base title (see
 * media-parts.ts), which is then the series' presentation: no row carries a series place, and a
 * folded row, being several uploads, no pair, project or topic. An upload the not-a-series list
 * names stays a row of its own.
 */
export function feedRows(entries: readonly FeedEntry[], mode: PartsMode): FeedRow[] {
  if (mode === 'each') return entries.map((each) => ({ ...each, parts: [] }));
  return foldParts(entries, canFold).map(({ lead, title, parts }) =>
    parts.length > 1
      ? {
          ...lead,
          id: `parts:${lead.id}`,
          title,
          parts,
          series: null,
          pair: null,
          project: null,
          topics: [],
          // Folding changes presentation, not which uploads a search can find.
          haystack: [title, `${parts.length} parts`, ...parts.map((part) => part.haystack)].join(
            ' ',
          ),
        }
      : { ...lead, series: null, parts: [] },
  );
}

/** A year's rank: later years first, Undated last. */
const yearRank = (year: string): number =>
  year === UNDATED ? Number.NEGATIVE_INFINITY : Number(year);

/** Rows by year, newest year first, Undated last; each group keeps the rows' order. */
export function groupByYear<T extends { readonly year: string }>(
  rows: readonly T[],
): YearGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const members = groups.get(row.year);
    if (members) members.push(row);
    else groups.set(row.year, [row]);
  }
  return [...groups]
    .sort(([a], [b]) => yearRank(b) - yearRank(a))
    .map(([year, members]) => ({ year, rows: members }));
}

/** Rows by kind, in section order; a kind without rows is left out, and each keeps the rows' order. */
export function groupByKind<T extends { readonly kind: FeedKind }>(
  rows: readonly T[],
): KindGroup<T>[] {
  return FEED_KINDS.map((kind) => ({ kind, rows: rows.filter((row) => row.kind === kind) })).filter(
    (group) => group.rows.length > 0,
  );
}

/** The kinds that have at least one item, in section order. */
export function kindsWithItems(entries: readonly { readonly kind: FeedKind }[]): FeedKind[] {
  return FEED_KINDS.filter((kind) => entries.some((each) => each.kind === kind));
}

/** A row, or an entry not yet made one: it may carry the uploads it folds. */
type Countable = FeedEntry & { readonly parts?: readonly FeedEntry[] };

/** How many items a row stands for: every upload of a row that folds several, else one. */
export const itemsOf = ({ parts }: Pick<Countable, 'parts'>): number =>
  parts && parts.length > 1 ? parts.length : 1;

/**
 * Each kind's count, and the newest dated entry's date. The counts are of items: a row that
 * folds a series' uploads counts every one of them, so the figures are the same however the
 * rows are laid out.
 */
export function feedStats(entries: readonly Countable[]): FeedStats {
  const counts = Object.fromEntries(
    FEED_KINDS.map((kind) => [
      kind,
      entries.filter((each) => each.kind === kind).reduce((sum, each) => sum + itemsOf(each), 0),
    ]),
  ) as Record<FeedKind, number>;
  const newest = entries.reduce<FeedEntry | null>(
    (best, each) =>
      each.time !== null && (best?.time == null || each.time > best.time) ? each : best,
    null,
  );
  return { counts, newest: newest?.date ?? null };
}
