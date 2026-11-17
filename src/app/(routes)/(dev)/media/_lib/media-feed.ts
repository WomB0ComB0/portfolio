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
 * @file The /media feed: blog posts, articles, videos, stream uploads, talks and presentations
 * as plain entries, newest first (undated last), and the shapes the page passes around. The page
 * lists them in one section per kind; the lab's "One feed" alternative lists them together by
 * year (media-rows.ts turns entries into rows and groups them).
 * Pure and server-safe (no directive): the server builds the entries, the island filters them.
 *
 * - Each entry links onward to where it lives (YouTube, the post, the slides), http(s) only; an
 *   entry with nowhere to go has no link rather than a dead one.
 * - A stream upload is a YouTube upload that carries Twitch's export line in its description, or
 *   shares its base title with one that does. It is its own kind, so the videos made on purpose
 *   are not buried under the broadcasts.
 * - A series is two or more uploads of one kind that share a base title (media-parts.ts): each
 *   entry knows its place in it, and a series reads newest first by that place (media-series.ts).
 * - What else an entry points at ("see also") is set on the server only, by modules this file
 *   never imports: `pair` (a post and the video of it, media-pairing.ts), `project` (the project
 *   of this site it is about, media-projects.ts) and `topics` (media-topic-index.ts).
 * - Summaries drop YouTube's link template and Twitch's "Broadcasted live" line, keeping the first
 *   real sentence (media-summary.ts).
 * - Only kinds that have items get a section and a chip.
 */

import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';
import type { Article, Presentation, Talk } from '@/hooks/sanity/schemas';
import type { ListedVideo } from '@/lib/sanity/enrich';
import { lengthSeconds } from './media-format';
import type { MediaSeriesRule } from './media-not-series';
import { partKey, type SeriesPlace } from './media-parts';
import { withSeries } from './media-series';
import { cleanSummary } from './media-summary';

/**
 * Every kind, in section order (also the chip order and the sort's tie-break): writing first
 * (the short list, and what videos are made from), then video, stream uploads, talks, slides.
 */
export const FEED_KINDS = ['post', 'article', 'video', 'stream', 'talk', 'presentation'] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

/** A kind's words: `one` and `many` count it ("1 post"), `title` heads its section and chip. */
export interface KindWords {
  readonly one: string;
  readonly many: string;
  readonly title: string;
}

/** Each kind in plain words: a count says "2 posts", its section and chip say "Writing". */
export const KIND_WORDS: Readonly<Record<FeedKind, KindWords>> = {
  post: { one: 'Post', many: 'Posts', title: 'Writing' },
  article: { one: 'Article', many: 'Articles', title: 'Articles' },
  video: { one: 'Video', many: 'Videos', title: 'Video' },
  stream: { one: 'Stream', many: 'Streams', title: 'Streams' },
  talk: { one: 'Talk', many: 'Talks', title: 'Talks' },
  presentation: { one: 'Presentation', many: 'Presentations', title: 'Presentations' },
};

/** The year group of an entry without a readable date. */
export const UNDATED = 'Undated';

/** An upload's place in its series: "Upload 14 of 27", or the titles' own "Part 1 of 2". */
export interface FeedSeries extends Omit<SeriesPlace, 'key'> {
  /** The series as a URL value (?series=). */
  readonly slug: string;
}

/** The other version of a piece: a post's video, or a video's written version. */
export interface FeedPair {
  /** The other entry's id. */
  readonly id: string;
  readonly kind: FeedKind;
  readonly title: string;
  /** The other piece's own address. */
  readonly href: string;
  /** Its YouTube id when it is filmed, for the in-page player; else null. */
  readonly videoId: string | null;
}

/** The project an item is about: a page of this site (/projects/<id>). */
export interface FeedProject {
  /** The project's id, the last part of its address. */
  readonly id: string;
  readonly title: string;
  /** True for a relation drafted from the titles and not yet confirmed: the lab only. */
  readonly proposed: boolean;
}

/** A hand-written topic an item is filed under. */
export interface FeedTopic {
  /** The topic as a URL value (?topic=). */
  readonly slug: string;
  readonly label: string;
}

/** One thing published, whatever its kind. Plain JSON, so the server can hand it to the island. */
export interface FeedEntry {
  /** `${kind}:${source id}`, unique across kinds. */
  readonly id: string;
  readonly kind: FeedKind;
  readonly title: string;
  /** Where it lives, http(s) only; null when it has nowhere to go. */
  readonly href: string | null;
  /** Whether the link leaves the site (every source today), so it opens in a new tab. */
  readonly external: boolean;
  /** "YouTube", "Hashnode", the venue or the publication. */
  readonly where: string;
  /** The date as the source gave it (ISO), or null when unreadable. */
  readonly date: string | null;
  /** The date in epoch ms, for sorting; null when undated. */
  readonly time: number | null;
  /** '2025', or UNDATED. */
  readonly year: string;
  /** "8:32:20" for a video or talk; null when unknown. */
  readonly duration: string | null;
  /** The first real sentence of its description, or ''. */
  readonly summary: string;
  /** A small 16:9 still, or null for the typographic one. */
  readonly thumb: string | null;
  /** The YouTube id, for the in-page player; null for anything else. */
  readonly videoId: string | null;
  /** What ?q searches: the title, the kind's word, where it lives and the summary. */
  readonly haystack: string;
  /** Its place in a series of uploads; null when it is in none. */
  readonly series: FeedSeries | null;
  /** Its other version; null from buildFeed (media-pairing.ts sets it on the server). */
  readonly pair: FeedPair | null;
  /** The project it is about; null from buildFeed (media-projects.ts sets it on the server). */
  readonly project: FeedProject | null;
  /** Its topics, three at most; none from buildFeed (media-topic-index.ts sets them). */
  readonly topics: readonly FeedTopic[];
}

/** A row of the index: an entry, plus every part when it is a folded stream (else none). */
export interface FeedRow extends FeedEntry {
  /** Oldest first; empty for a row that is one item. */
  readonly parts: readonly FeedEntry[];
}

/** Every source's items; a source that failed is simply absent. */
export interface FeedSources {
  readonly posts: readonly Blog[];
  readonly videos: readonly ListedVideo[];
  readonly talks: readonly Talk[];
  readonly presentations: readonly Presentation[];
  readonly articles: readonly Article[];
}

export type SanityImage = NonNullable<Talk['thumbnailImage']>;
/** A Sanity image as a small still's URL; the server passes the real builder. */
export type ImageUrl = (image: SanityImage) => string | null;

/** One year's rows. */
export interface YearGroup<T> {
  readonly year: string;
  readonly rows: readonly T[];
}

/** One kind's rows: a section. */
export interface KindGroup<T> {
  readonly kind: FeedKind;
  readonly rows: readonly T[];
}

/** Each kind's count, and the newest date. */
export interface FeedStats {
  readonly counts: Readonly<Record<FeedKind, number>>;
  readonly newest: string | null;
}

/** How rows treat a series' uploads: one row per upload, or one row per series and year. */
export type PartsMode = 'each' | 'fold';

/**
 * Twitch's own line on an exported broadcast. Anchored to a line's start, after spaces or tabs
 * only: a run of empty lines never makes it try each line to the end again.
 */
const TWITCH_EXPORT_LINE = /^[^\S\r\n]*broadcasted live on twitch\b/im;
/**
 * The most of a description the stream-line test reads: YouTube's own limit, so an oversized CMS
 * entry cannot burn CPU on every /media and project page (cleanSummary caps its own input too).
 */
const DESCRIPTION_READ_MAX = 5_000;

/** The first of `hrefs` that is an http(s) URL, trimmed; null when none is. */
function firstLink(...hrefs: readonly (string | null | undefined)[]): string | null {
  for (const href of hrefs) {
    const trimmed = href?.trim() ?? '';
    if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;
  }
  return null;
}

/** A date's epoch ms and year group; an unreadable date is undated. */
function dated(date: string | null | undefined): Pick<FeedEntry, 'date' | 'time' | 'year'> {
  const time = date ? Date.parse(date) : Number.NaN;
  if (!date || Number.isNaN(time)) return { date: null, time: null, year: UNDATED };
  return { date, time, year: String(new Date(time).getUTCFullYear()) };
}

type EntryFields = Omit<
  FeedEntry,
  | 'id'
  | 'date'
  | 'time'
  | 'year'
  | 'external'
  | 'haystack'
  | 'series'
  | 'pair'
  | 'project'
  | 'topics'
> & {
  readonly sourceId: string;
  readonly rawDate: string | null | undefined;
};

/** What ?q searches of an entry: its title, its kind's word, where it lives and its summary. */
const haystackOf = (fields: Pick<FeedEntry, 'title' | 'kind' | 'where' | 'summary'>): string =>
  [fields.title, KIND_WORDS[fields.kind].one, fields.where, fields.summary].join(' ');

/** An entry from its fields: the id, date, link flag and search text worked out once. */
function entry({ sourceId, rawDate, ...fields }: EntryFields): FeedEntry {
  return {
    ...fields,
    ...dated(rawDate),
    id: `${fields.kind}:${sourceId}`,
    external: fields.href !== null,
    haystack: haystackOf(fields),
    series: null,
    pair: null,
    project: null,
    topics: [],
  };
}

/** A blog post's own URL, or its address on the platform it came from. */
export const postHref = (post: Blog): string | null =>
  firstLink(
    post.url,
    post.source === 'devto'
      ? `https://dev.to/mikeodnis/${post.slug}`
      : `https://blog.mikeodnis.dev/${post.slug}`,
  );

const fromPost = (post: Blog): FeedEntry =>
  entry({
    sourceId: post.url ?? post.slug,
    kind: 'post',
    title: post.title,
    href: postHref(post),
    where: post.source === 'devto' ? 'dev.to' : 'Hashnode',
    rawDate: post.publishedAt,
    duration: null,
    summary: cleanSummary(post.excerpt),
    thumb: firstLink(post.imageUrl),
    videoId: null,
  });

/**
 * An upload's length, or null when it has none to tell: a live stream in progress or a scheduled
 * premiere reaches the page as "0:00" (YouTube's P0D), which is no length, and adds nothing true
 * to a section's total.
 */
const lengthOf = (duration: string | null | undefined): string | null =>
  duration && lengthSeconds(duration) !== 0 ? duration : null;

/** A YouTube upload as `kind`: a made video, or a stream upload (the same link, still and id). */
const fromVideo = (video: ListedVideo, kind: 'video' | 'stream'): FeedEntry =>
  entry({
    sourceId: video._id,
    kind,
    title: video.title,
    href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`,
    where: 'YouTube',
    rawDate: video.publishedDate,
    duration: lengthOf(video.duration),
    summary: cleanSummary(video.description),
    thumb: `https://img.youtube.com/vi/${encodeURIComponent(video.videoId)}/mqdefault.jpg`,
    videoId: video.videoId,
  });

/** An image's still, or null without one. */
const stillOf = (image: SanityImage | null | undefined, imageUrl: ImageUrl): string | null =>
  image ? imageUrl(image) : null;

const fromTalk = (talk: Talk, imageUrl: ImageUrl): FeedEntry =>
  entry({
    sourceId: talk._id,
    kind: 'talk',
    title: talk.title,
    href: firstLink(talk.videoUrl, talk.slidesPdfUrl, talk.slidesUrl),
    where: talk.venue,
    rawDate: talk.date,
    duration: talk.duration ?? null,
    summary: cleanSummary(talk.description),
    thumb: stillOf(talk.thumbnailImage, imageUrl),
    videoId: null,
  });

const fromPresentation = (presentation: Presentation, imageUrl: ImageUrl): FeedEntry =>
  entry({
    sourceId: presentation._id,
    kind: 'presentation',
    title: presentation.title,
    href: firstLink(
      presentation.slidesUrl,
      presentation.slidesPdfUrl,
      presentation.videoUrl,
      presentation.eventUrl,
    ),
    where: presentation.eventName,
    rawDate: presentation.date,
    duration: null,
    summary: cleanSummary(presentation.description),
    thumb: stillOf(presentation.thumbnailImage, imageUrl),
    videoId: null,
  });

const fromArticle = (article: Article, imageUrl: ImageUrl): FeedEntry =>
  entry({
    sourceId: article._id,
    kind: 'article',
    title: article.title,
    href: firstLink(article.publicationUrl),
    where: article.publication,
    rawDate: article.publishedDate,
    duration: null,
    summary: cleanSummary(article.excerpt),
    thumb: stillOf(article.coverImage, imageUrl),
    videoId: null,
  });

/** Undated entries sort after every dated one. */
const timeOrFirst = (time: number | null): number => time ?? Number.NEGATIVE_INFINITY;

/** Newest first; on the same moment, by kind (section order), then by title. */
const newestFirst = (a: FeedEntry, b: FeedEntry): number =>
  timeOrFirst(b.time) - timeOrFirst(a.time) ||
  FEED_KINDS.indexOf(a.kind) - FEED_KINDS.indexOf(b.kind) ||
  a.title.localeCompare(b.title);

/** Whether an entry is a YouTube upload: a made video or a stream upload. */
export const isUpload = (each: { readonly kind: FeedKind }): boolean =>
  each.kind === 'video' || each.kind === 'stream';

/**
 * The base-title keys of the stream uploads: every upload whose description carries Twitch's
 * export line names one, and an upload that shares it (an early one with an empty description)
 * is a stream too.
 */
function streamKeys(videos: readonly ListedVideo[]): ReadonlySet<string> {
  return new Set(
    videos
      .filter((video) =>
        TWITCH_EXPORT_LINE.test((video.description ?? '').slice(0, DESCRIPTION_READ_MAX)),
      )
      .map((video) => partKey(video.title)),
  );
}

/** What buildFeed may be told besides its sources. */
export interface BuildFeedOptions {
  /** Uploads that are in no series, whatever their titles share (media-not-series.ts's list). */
  readonly notSeries?: readonly MediaSeriesRule[];
}

/** Every source's items as one list, newest first, undated last, each upload placed in its series. */
export function buildFeed(
  sources: Partial<FeedSources>,
  imageUrl: ImageUrl,
  { notSeries }: BuildFeedOptions = {},
): FeedEntry[] {
  const videos = sources.videos ?? [];
  const streams = streamKeys(videos);
  return withSeries(
    [
      ...(sources.posts ?? []).map(fromPost),
      ...videos.map((video) =>
        fromVideo(video, streams.has(partKey(video.title)) ? 'stream' : 'video'),
      ),
      ...(sources.talks ?? []).map((talk) => fromTalk(talk, imageUrl)),
      ...(sources.presentations ?? []).map((item) => fromPresentation(item, imageUrl)),
      ...(sources.articles ?? []).map((article) => fromArticle(article, imageUrl)),
    ].sort(newestFirst),
    notSeries,
  );
}

/** `id` under the `video` kind's prefix ("stream:abc" as "video:abc"). */
const asVideoId = (id: string): string => `video:${id.slice(id.indexOf(':') + 1)}`;

/** What a search reads of an entry beyond its own fields: its project and its topics. */
const seeAlsoWords = (each: FeedEntry): string =>
  [each.project?.title, ...each.topics.map((topic) => topic.label)].filter(Boolean).join(' ');

/**
 * Every stream upload as a video (the lab's "With videos" option): its kind, id and search text
 * change, its place in its series, its project and its topics stay, and a pair that points at
 * one follows it. Returns new entries; the input is left as it was.
 */
export function streamsAsVideos(entries: readonly FeedEntry[]): FeedEntry[] {
  return entries.map((each) => {
    const pair =
      each.pair?.kind === 'stream'
        ? { ...each.pair, kind: 'video' as const, id: asVideoId(each.pair.id) }
        : each.pair;
    if (each.kind !== 'stream') return pair === each.pair ? each : { ...each, pair };
    const kind = 'video' as const;
    const haystack = [haystackOf({ ...each, kind }), seeAlsoWords(each)].filter(Boolean).join(' ');
    return { ...each, kind, id: asVideoId(each.id), haystack, pair };
  });
}
