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
 * @file Places /media's uploads in their series. A series is two or more uploads of one kind
 * that share a base title (media-parts.ts numbers them); here each entry gets its place and the
 * series its URL value, and the feed's order is made to agree with the numbering. Pure and
 * server-safe; media-feed.ts calls it once while building the feed.
 */

import type { FeedEntry } from './media-feed';
import {
  MEDIA_NOT_SERIES,
  type MediaSeriesRule,
  standaloneKeys,
  standsAlone,
} from './media-not-series';
import {
  SERIES_SLUG_MAX,
  type SeriesPlace,
  seriesPlaces,
  seriesSlug,
  shortHash,
} from './media-parts';

/** The room a slug has before the hyphen and the hash that tell two same-slug series apart. */
const SERIES_SLUG_ROOM = SERIES_SLUG_MAX - 1;

/**
 * The group an entry may form a series within: its kind for a YouTube upload, none otherwise, and
 * none for an upload the not-a-series list names (`alone`, as video keys).
 */
const seriesGroup =
  (alone: ReadonlySet<string>) =>
  (each: FeedEntry): string | null =>
    (each.kind === 'video' || each.kind === 'stream') && !standsAlone(each, alone)
      ? each.kind
      : null;

/**
 * `entries` with each series' uploads in falling order of their place, in the rows the series
 * already holds. The feed is newest first and a series is numbered oldest first, so this changes
 * nothing unless the parts of one broadcast went up out of order: then "(Part 2/2)" (upload 25)
 * is listed above "(Part 1/2)" (upload 24), as the numbers beside them read.
 */
function inSeriesOrder(entries: readonly FeedEntry[]): FeedEntry[] {
  const rowsOf = new Map<string, number[]>();
  entries.forEach((each, index) => {
    if (!each.series) return;
    const key = `${each.kind}\u0000${each.series.slug}`;
    rowsOf.set(key, [...(rowsOf.get(key) ?? []), index]);
  });
  const result = [...entries];
  for (const rows of rowsOf.values()) {
    const members = rows
      .map((index) => entries[index])
      .filter((each): each is FeedEntry => each !== undefined)
      .sort((a, b) => (b.series?.part ?? 0) - (a.series?.part ?? 0));
    rows.forEach((index, at) => {
      const member = members[at];
      if (member) result[index] = member;
    });
  }
  return result;
}

/**
 * The entries with each upload's place in its series. A series' URL value is its base title's
 * slug; two series whose titles write the same slug ("C++ stream", "C# stream") each get a short
 * hash of their own key after it, so one link never shows both. An upload `notSeries` names is in
 * no series (media-not-series.ts).
 */
export function withSeries(
  entries: readonly FeedEntry[],
  notSeries: readonly MediaSeriesRule[] = MEDIA_NOT_SERIES,
): FeedEntry[] {
  const places = seriesPlaces(entries, seriesGroup(standaloneKeys(notSeries)));
  const keysBySlug = new Map<string, Set<string>>();
  for (const place of places.values()) {
    const slug = seriesSlug(place.name);
    keysBySlug.set(slug, (keysBySlug.get(slug) ?? new Set<string>()).add(place.key));
  }
  /** The slug of a place's series, told apart from any other series that writes the same one. */
  const slugOf = (place: SeriesPlace): string => {
    const slug = seriesSlug(place.name);
    if ((keysBySlug.get(slug)?.size ?? 0) <= 1) return slug;
    const hash = shortHash(place.key);
    return `${slug.slice(0, SERIES_SLUG_ROOM - hash.length).replace(/-+$/, '')}-${hash}`;
  };
  return inSeriesOrder(
    entries.map((each) => {
      const place = places.get(each.id);
      if (!place) return each;
      const { key: _key, ...rest } = place;
      return { ...each, series: { ...rest, slug: slugOf(place) } };
    }),
  );
}
