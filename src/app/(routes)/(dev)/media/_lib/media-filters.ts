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
 * @file /media on the shared filter schema (src/lib/filters), pure and server-safe:
 * - ?kind, one kind at a time, as chips named as the sections are (Writing, Video, Streams): only
 *   the kinds that have items are offered (an empty kind never shows as an empty tab), and a
 *   link naming one with no items is read as no filter. It reads a slug, a plural, a section's
 *   name or an old tab name, in any case: video, Videos, writing, blog, posts.
 * - ?series, one series of uploads, by the slug its rows carry. It has no chips: a row's
 *   "Series: Upload 14 of 27" link sets it, and the Applied line shows it as a token with its
 *   remove link. A slug that names no series in the feed is read as no filter.
 * - ?topic, one hand-written topic (media-topics.ts), by its slug, handled as ?series is: no
 *   chips, set by a row's topic link, shown as a token, and an unknown slug is no filter. The
 *   page's canonical address stays /media whatever the filters.
 * - ?q over each row's title, kind word, where it lives and summary.
 * - An old ?tab= link (the five-tab page) maps to the ?kind= URL it now means.
 * The island builds the schema from the kinds and series lists (the schema holds functions, so
 * it never crosses the server-client boundary).
 */

import {
  defineFilters,
  type FilterSchema,
  firstOf,
  normaliseQuery,
  ownValue,
  type ParamValue,
} from '@/lib/filters';
import { trimEnd } from '@/lib/text/trim';
import { FEED_KINDS, type FeedKind, KIND_WORDS } from './media-feed';
import { SENTENCE_STOPS, SERIES_SLUG_MAX } from './media-parts';
import { topicSlugOf } from './media-topics';

export type MediaFacet = 'kind' | 'series' | 'topic';
export type MediaSchema<T extends MediaFilterItem = MediaFilterItem> = FilterSchema<T, MediaFacet>;

export const MEDIA_PATH = '/media';
const QUERY_MAX_LENGTH = 100;
/** The longest ?kind value read ("presentations" is 13); a longer one is dropped unread. */
const KIND_VALUE_MAX_LENGTH = 32;
/** The longest ?series value read: a series slug's own cap. */
export const SERIES_VALUE_MAX_LENGTH = SERIES_SLUG_MAX;
const MEDIA_NOUN = { one: 'item', many: 'items' } as const;
/** A series slug's shape: lower-case letters and digits in runs joined by single hyphens. */
const SERIES_SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A series as the filter knows it: its URL value and the title a token shows. */
export interface MediaSeries {
  readonly slug: string;
  readonly name: string;
}

/** A topic as the filter knows it: its URL value and the label a token shows. */
export interface MediaTopicOption {
  readonly slug: string;
  readonly label: string;
}

/** What the schema reads of a row. */
export interface MediaFilterItem {
  readonly kind: FeedKind;
  readonly haystack: string;
  /** The series the row is an upload of; null or absent when it is in none. */
  readonly series?: { readonly slug: string } | null;
  /** The topics the row is filed under; absent or empty when it has none. */
  readonly topics?: readonly { readonly slug: string }[];
}

/** Every spelling a link may use for a kind: its slug, its plural and the old tab names. */
const KIND_SPELLINGS: Readonly<Record<string, FeedKind>> = {
  video: 'video',
  videos: 'video',
  stream: 'stream',
  streams: 'stream',
  post: 'post',
  posts: 'post',
  blog: 'post',
  writing: 'post',
  talk: 'talk',
  talks: 'talk',
  presentation: 'presentation',
  presentations: 'presentation',
  article: 'article',
  articles: 'article',
};

const isFeedKind = (slug: string): slug is FeedKind =>
  (FEED_KINDS as readonly string[]).includes(slug);

/** The kind a URL value names, any case; too long or unknown is null. */
function kindOf(raw: string): FeedKind | null {
  if (raw.length > KIND_VALUE_MAX_LENGTH) return null;
  return ownValue(KIND_SPELLINGS, raw.trim().toLowerCase()) ?? null;
}

/**
 * A URL value shaped like a series slug (trimmed), or null: lower case, digits and single
 * hyphens, 80 characters at most. A shape check only; whether a series has that slug is the
 * schema's to say.
 */
export function seriesSlugOf(raw: string): string | null {
  const slug = raw.trim();
  return slug.length <= SERIES_VALUE_MAX_LENGTH && SERIES_SLUG_SHAPE.test(slug) ? slug : null;
}

/** The series a list of rows carries, each once, in the rows' order. */
export function seriesIn(rows: readonly { readonly series?: MediaSeries | null }[]): MediaSeries[] {
  const bySlug = new Map<string, MediaSeries>();
  for (const { series } of rows) {
    if (series && !bySlug.has(series.slug)) {
      bySlug.set(series.slug, { slug: series.slug, name: series.name });
    }
  }
  return [...bySlug.values()];
}

/** The topics a list of rows carries, each once, in the rows' order. */
export function topicsIn(
  rows: readonly { readonly topics?: readonly MediaTopicOption[] }[],
): MediaTopicOption[] {
  const bySlug = new Map<string, MediaTopicOption>();
  for (const { topics } of rows) {
    for (const topic of topics ?? []) {
      if (!bySlug.has(topic.slug)) bySlug.set(topic.slug, { slug: topic.slug, label: topic.label });
    }
  }
  return [...bySlug.values()];
}

/** A title as it reads inside a sentence: without the stops and marks it closes with itself. */
const withoutClosingStop = (title: string): string => trimEnd(title, SENTENCE_STOPS);

/**
 * The /media filter schema for the kinds that have items and the series and topics the rows
 * carry (none by default), on `path` (the lab passes its own).
 */
export function mediaFilters<T extends MediaFilterItem = MediaFilterItem>(
  kinds: readonly FeedKind[],
  path: string = MEDIA_PATH,
  series: readonly MediaSeries[] = [],
  topics: readonly MediaTopicOption[] = [],
): MediaSchema<T> {
  const offered = new Set(kinds);
  const seriesNames = new Map(series.map((each) => [each.slug, each.name]));
  const topicLabels = new Map(topics.map((each) => [each.slug, each.label]));
  return defineFilters<T, MediaFacet>({
    path,
    noun: MEDIA_NOUN,
    search: { haystack: (item) => item.haystack, maxLength: QUERY_MAX_LENGTH },
    facets: {
      kind: {
        label: 'Kind',
        valuesOf: (item) => [item.kind],
        labelOf: (slug) => (isFeedKind(slug) ? KIND_WORDS[slug].title : slug),
        values: FEED_KINDS.filter((kind) => offered.has(kind)),
        /** A kind with items, from any spelling; anything else is no filter. */
        resolve: (raw) => {
          const kind = kindOf(raw);
          return kind !== null && offered.has(kind) ? kind : null;
        },
        scope: (labels) => `in ${labels.join(' or ')}`,
      },
      series: {
        label: 'Series',
        valuesOf: (item) => (item.series ? [item.series.slug] : []),
        labelOf: (slug) => seriesNames.get(slug) ?? slug,
        values: [...seriesNames.keys()],
        /** A series the rows carry; anything else is no filter. */
        resolve: (raw) => {
          const slug = seriesSlugOf(raw);
          return slug !== null && seriesNames.has(slug) ? slug : null;
        },
        // A series is named by its title, which may end a sentence itself ("... marathon.").
        scope: (labels) => `in the series ${labels.map(withoutClosingStop).join(' or ')}`,
      },
      topic: {
        label: 'Topic',
        valuesOf: (item) => (item.topics ?? []).map((topic) => topic.slug),
        labelOf: (slug) => topicLabels.get(slug) ?? slug,
        values: [...topicLabels.keys()],
        /** A topic the rows carry; anything else is no filter. */
        resolve: (raw) => {
          const slug = topicSlugOf(raw);
          return slug !== null && topicLabels.has(slug) ? slug : null;
        },
        scope: (labels) => `about ${labels.join(' or ')}`,
      },
    },
  });
}

/**
 * Where an old ?tab= link now goes: /media with the kind it named (?kind= wins when both are
 * given) and its search kept; plain /media for a tab it never had. Null when there is no ?tab=,
 * so the page renders as it is.
 */
export function legacyTabHref(params: Readonly<Record<string, ParamValue>>): string | null {
  if (params.tab === undefined) return null;
  const named = firstOf(params.kind) || firstOf(params.tab);
  const kind = kindOf(named);
  const query = new URLSearchParams();
  if (kind) query.set('kind', kind);
  const q = normaliseQuery(params.q, QUERY_MAX_LENGTH);
  if (q) query.set('q', q);
  const search = query.toString();
  return search ? `${MEDIA_PATH}?${search}` : MEDIA_PATH;
}
