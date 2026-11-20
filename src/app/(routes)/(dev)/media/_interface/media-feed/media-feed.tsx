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
 * @file /media, rendered on the server: a PageShell header (h1 "Media", as the nav says, and the
 * sections' counts as its figures), a quiet line naming any source that could not load, then the
 * filter island holding the server-rendered rows in their sections: Writing first, then Video,
 * then Streams, each a flat list, newest first. A row carries its "see also" line (its other
 * version, its series, its project, its topics) as plain links. The lab's alternative layout is
 * the one feed (all kinds together, in year groups). With nothing published, the EmptyState
 * instead (no filter bar over nothing).
 *
 * One frame (MediaFrame: the header and what goes under it), rendered two ways, which work the
 * feed out the same way (mediaFeedModel):
 * - MediaFeedView, from a feed already loaded: what /media renders when its feed is in within the
 *   page's short wait (every row in place in the first HTML), and what the lab and tests render;
 * - StreamedMediaFeed, when the feed is still loading then: the header goes out, and the strip's
 *   figures and the list (the notes, the filter bar and the sections) each stream in a Suspense
 *   boundary of their own once the feed has loaded, behind skeletons of their own size (the
 *   strip's placeholders; MediaFeedSkeleton). The list is one boundary because the filter island
 *   counts and filters every row of every kind together.
 */

import { type ReactElement, type ReactNode, Suspense } from 'react';

import {
  EmptyState,
  PageShell,
  StatStrip,
  type StatStripItem,
  StatusDot,
} from '@/components/console';
import { FEED_COLUMNS, MISSING_CLASS, SECTION_COLUMNS } from '../../_components/feed-classes';
import { FeedRow } from '../../_components/feed-row';
import { MediaFeedSkeleton } from '../../_components/feed-skeleton';
import {
  type FeedRowItem,
  type FeedRowPart,
  MediaFeedIndex,
} from '../../_components/media-feed-index';
import type { FeedLoad } from '../../_lib/load-feed';
import {
  type FeedKind,
  type FeedRow as FeedRowData,
  type FeedStats,
  isUpload,
  KIND_WORDS,
} from '../../_lib/media-feed';
import { mediaFilters, seriesIn, topicsIn } from '../../_lib/media-filters';
import { lengthSeconds, monthName, yearOf } from '../../_lib/media-format';
import {
  DEFAULT_LAYOUT,
  DEFAULT_SERIES_ROWS,
  type LayoutMode,
  type PartsMode,
  type PlayMode,
  type SeriesRowsMode,
} from '../../_lib/media-options';
import { feedRows, feedStats, groupByKind, kindsWithItems } from '../../_lib/media-rows';

export const MEDIA_TITLE = 'Media';
const MEDIA_EYEBROW = 'Writing and video';
const MEDIA_DESCRIPTION = 'Everything I write, record and present, newest first.';
const STATS_LABEL = 'Totals';
/** The header's figures: as many as the strip fits in one row on a phone. */
const FIGURES = 3;
/** Rows whose stills load at once: about a phone's first screen. */
const EAGER_ROWS = 4;

export interface MediaFeedViewProps {
  /**
   * The entries, the kinds that could not load and whether the channel's uploads were all read
   * (left out: they were). The map's proposals are the lab's to apply.
   */
  readonly feed: Pick<FeedLoad, 'entries' | 'missing'> & Partial<Pick<FeedLoad, 'videosComplete'>>;
  /** A section per kind (what /media ships), or one feed in year groups. */
  readonly layout?: LayoutMode;
  readonly parts: PartsMode;
  /** A long series as its newest uploads and a link to all (what /media ships), or every upload. */
  readonly longSeries?: SeriesRowsMode;
  readonly play: PlayMode;
  /** Where the filters' links and form point: /media, or the lab. */
  readonly path: string;
  /** Pads the sides; off inside a parent that already pads (the lab). */
  readonly gutter?: boolean;
}

/** "videos" for 50, "post" for 1. */
const kindLabel = (kind: FeedKind, count: number): string =>
  (count === 1 ? KIND_WORDS[kind].one : KIND_WORDS[kind].many).toLowerCase();

/**
 * The header's figures, which state the page's structure: each kind's count in section order
 * ("2 posts, 23 videos, 27 streams"). With more kinds than fit, the three largest, still in
 * section order; with fewer, the newest item's year over its month fills the last place.
 */
function statItems(stats: FeedStats, kinds: readonly FeedKind[]): StatStripItem[] {
  // Array#sort is stable, so kinds with the same count keep their section order.
  const largest = [...kinds].sort((a, b) => stats.counts[b] - stats.counts[a]).slice(0, FIGURES);
  const counted = kinds
    .filter((kind) => largest.includes(kind))
    .map((kind) => ({ label: kindLabel(kind, stats.counts[kind]), value: stats.counts[kind] }));
  if (counted.length >= FIGURES || !stats.newest) return counted;
  // The year alone is the figure ("May 2026" breaks onto two lines in a phone's column).
  return [...counted, { label: `latest, ${monthName(stats.newest)}`, value: yearOf(stats.newest) }];
}

/**
 * Said when the channel listing stopped at its cap: the uploads below are the newest ones, so
 * the page states no total, length, place or "of N" for them, only what it lists.
 */
const CAPPED_SENTENCE =
  'Only the newest uploads are listed, so older videos and streams are missing below.';

/** "Videos couldn't load", "Videos and posts couldn't load". */
function missingSentence(kinds: readonly FeedKind[]): string {
  const words = kinds.map((kind) => KIND_WORDS[kind].many.toLowerCase());
  const list =
    words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} couldn't load just now, so they're missing below.`;
}

/**
 * The rows in the order the page shows them: section by section (each newest first), or as they
 * are (newest first) in the one feed. The first rows of this order load their stills at once.
 */
const pageOrder = (rows: readonly FeedRowData[], layout: LayoutMode): readonly FeedRowData[] =>
  layout === 'sections' ? groupByKind(rows).flatMap((group) => group.rows) : rows;

/** A row's length in seconds: a folded row's parts added up; null when none can be read. */
function secondsOf(row: FeedRowData): number | null {
  const lengths = (row.parts.length > 1 ? row.parts : [row]).flatMap((each) => {
    const seconds = lengthSeconds(each.duration);
    return seconds === null ? [] : [seconds];
  });
  return lengths.length === 0 ? null : lengths.reduce((sum, seconds) => sum + seconds, 0);
}

/**
 * A folded row's uploads as the items the filters count: each is searched by the row's own words
 * and then its own, so a search for one upload counts one and a search for the series counts
 * them all. Undefined for a row that is one item.
 */
function foldedParts(row: FeedRowData): readonly FeedRowPart[] | undefined {
  if (row.parts.length <= 1) return undefined;
  const own = `${row.title} ${row.parts.length} parts`;
  return row.parts.map((part) => ({
    haystack: `${own} ${part.haystack}`,
    seconds: lengthSeconds(part.duration),
  }));
}

/** What the rows' markup is written with, beyond each row itself. */
interface RowContext {
  readonly layout: LayoutMode;
  readonly kinds: readonly FeedKind[];
  readonly path: string;
  readonly play: PlayMode;
  /** Whether a kind is listed in full (false for the uploads past the channel listing's cap). */
  readonly counted: (kind: FeedKind) => boolean;
}

/** The rows as the island's items: what it filters and groups by, and each row's server markup. */
function rowItems(rows: readonly FeedRowData[], context: RowContext): FeedRowItem[] {
  const { layout, kinds, path, play, counted } = context;
  const inSections = layout === 'sections';
  // The same schema the island builds, here only to write each series and topic link as the
  // island's own links are written (the lab's switches and anchor kept, the other filters cleared).
  const schema = mediaFilters(kinds, path, seriesIn(rows), topicsIn(rows));
  const topicHref = (slug: string): string => schema.hrefFor(schema.empty(), { topic: slug });
  return rows.map((row, index) => ({
    id: row.id,
    kind: row.kind,
    year: row.year,
    haystack: row.haystack,
    series: row.series
      ? { slug: row.series.slug, name: row.series.name, part: row.series.part }
      : null,
    topics: row.topics,
    seconds: secondsOf(row),
    folded: foldedParts(row),
    row: (
      <FeedRow
        row={row}
        columns={inSections ? SECTION_COLUMNS[row.kind] : FEED_COLUMNS}
        dateStyle={inSections ? 'full' : 'day'}
        seriesHref={row.series ? schema.hrefFor(schema.empty(), { series: row.series.slug }) : null}
        topicHref={topicHref}
        play={play}
        eager={index < EAGER_ROWS}
        complete={counted(row.kind)}
      />
    ),
  }));
}

interface FeedNotesProps {
  readonly missing: readonly FeedKind[];
  /** The channel listing stopped at its cap. */
  readonly capped: boolean;
}

/** The quiet lines above the list: sources that could not load, and a listing cut at its cap. */
function FeedNotes({ missing, capped }: FeedNotesProps): ReactElement {
  return (
    <>
      {missing.length > 0 && (
        <p className={MISSING_CLASS}>
          <StatusDot tone="down" />
          <span data-feed-missing="">{missingSentence(missing)}</span>
        </p>
      )}
      {capped && (
        <p className={MISSING_CLASS}>
          <StatusDot tone="idle" />
          <span data-feed-capped="">{CAPPED_SENTENCE}</span>
        </p>
      )}
    </>
  );
}

/** How the list is laid out and where its links point: what working the feed out depends on. */
interface FeedViewOptions {
  readonly layout: LayoutMode;
  readonly parts: PartsMode;
  readonly play: PlayMode;
  readonly path: string;
}

/** The feed worked out for the page: what the header's strip and the list each show. */
interface MediaFeedModel {
  readonly kinds: readonly FeedKind[];
  /** The kinds listed only in part (the uploads, past the channel listing's cap). */
  readonly uncounted: readonly FeedKind[];
  readonly items: readonly FeedRowItem[];
  /** The header's figures; none when nothing is published. */
  readonly stats: readonly StatStripItem[];
  readonly missing: readonly FeedKind[];
}

type FeedInput = MediaFeedViewProps['feed'];

/** The feed as the page shows it: its rows in page order, its kinds, figures and row items. */
function mediaFeedModel(
  feed: FeedInput,
  { layout, parts, play, path }: FeedViewOptions,
): MediaFeedModel {
  const rows = pageOrder(feedRows(feed.entries, parts), layout);
  const kinds = kindsWithItems(rows);
  // Past the channel listing's cap the uploads are its newest only: no total is stated for them.
  const uncounted = feed.videosComplete === false ? kinds.filter((kind) => isUpload({ kind })) : [];
  const counted = (kind: FeedKind): boolean => !uncounted.includes(kind);
  const items = rowItems(rows, { layout, kinds, path, play, counted });
  // Counted in items (a folded row's every upload), as the chips, the sections and "52 items" are.
  const stats = rows.length > 0 ? statItems(feedStats(rows), kinds.filter(counted)) : [];
  return { kinds, uncounted, items, stats, missing: feed.missing };
}

interface MediaFrameProps {
  /** Beside the title on wide screens: the strip, or the boundary that streams it. */
  readonly stats: ReactNode;
  readonly gutter: boolean;
  readonly children: ReactNode;
}

/** The header (its words need no feed) over the list. */
function MediaFrame({ stats, gutter, children }: MediaFrameProps): ReactElement {
  return (
    <PageShell
      eyebrow={MEDIA_EYEBROW}
      title={MEDIA_TITLE}
      description={MEDIA_DESCRIPTION}
      stats={stats}
      gutter={gutter}
    >
      {children}
    </PageShell>
  );
}

/** The header's figures, or nothing when nothing is published. */
function MediaStrip({ stats }: { readonly stats: readonly StatStripItem[] }): ReactElement | null {
  return stats.length > 0 ? <StatStrip aria-label={STATS_LABEL} items={stats} /> : null;
}

interface MediaFeedBodyProps {
  readonly model: MediaFeedModel;
  readonly layout: LayoutMode;
  readonly longSeries: SeriesRowsMode;
  readonly play: PlayMode;
  readonly path: string;
}

/** Any missing source, then the sections (or the feed) or the EmptyState. */
function MediaFeedBody({
  model,
  layout,
  longSeries,
  play,
  path,
}: MediaFeedBodyProps): ReactElement {
  const { kinds, uncounted, items, missing } = model;
  return (
    <>
      <FeedNotes missing={missing} capped={uncounted.length > 0} />
      {items.length === 0 ? (
        <EmptyState title="Nothing published yet">
          Posts, videos and streams show up here as they go out.
        </EmptyState>
      ) : (
        // The island follows the URL itself (Back, links, router.push), so it needs no key.
        <MediaFeedIndex
          rows={items}
          layout={layout}
          kinds={kinds}
          path={path}
          play={play}
          longSeries={longSeries}
          uncounted={uncounted}
        />
      )}
    </>
  );
}

/** The header, any missing source, and the sections (or the feed) or the EmptyState. */
export function MediaFeedView({
  feed,
  layout = DEFAULT_LAYOUT,
  parts,
  longSeries = DEFAULT_SERIES_ROWS,
  play,
  path,
  gutter = true,
}: MediaFeedViewProps): ReactElement {
  const model = mediaFeedModel(feed, { layout, parts, play, path });
  return (
    <MediaFrame stats={<MediaStrip stats={model.stats} />} gutter={gutter}>
      <MediaFeedBody
        model={model}
        layout={layout}
        longSeries={longSeries}
        play={play}
        path={path}
      />
    </MediaFrame>
  );
}

/** The strip once the feed has loaded. */
async function StripPart({
  model,
}: {
  readonly model: Promise<MediaFeedModel>;
}): Promise<ReactElement | null> {
  return <MediaStrip stats={(await model).stats} />;
}

/** The list once the feed has loaded. */
async function BodyPart({
  model,
  ...props
}: Omit<MediaFeedBodyProps, 'model'> & {
  readonly model: Promise<MediaFeedModel>;
}): Promise<ReactElement> {
  return <MediaFeedBody model={await model} {...props} />;
}

export interface StreamedMediaFeedProps extends Omit<MediaFeedViewProps, 'feed'> {
  /** The feed, loading (loadMediaFeed): it rejects only when every source failed. */
  readonly feed: Promise<FeedInput>;
}

/**
 * /media streamed (see the file comment): the header's words in the first flush, then the strip
 * and the list once the feed has loaded, each behind a skeleton of its own size. When every
 * source failed the feed rejects, both parts throw it, and the (routes) error view takes the page
 * as it does for any page that throws.
 */
export function StreamedMediaFeed({
  feed,
  layout = DEFAULT_LAYOUT,
  parts,
  longSeries = DEFAULT_SERIES_ROWS,
  play,
  path,
  gutter = true,
}: StreamedMediaFeedProps): ReactElement {
  // Worked out once for both parts, as soon as the feed is in.
  const model = feed.then((loaded) => mediaFeedModel(loaded, { layout, parts, play, path }));
  return (
    <MediaFrame
      gutter={gutter}
      stats={
        <Suspense
          fallback={
            <StatStrip aria-label={STATS_LABEL} items={[]} loading placeholderCount={FIGURES} />
          }
        >
          <StripPart model={model} />
        </Suspense>
      }
    >
      <Suspense fallback={<MediaFeedSkeleton />}>
        <BodyPart model={model} layout={layout} longSeries={longSeries} play={play} path={path} />
      </Suspense>
    </MediaFrame>
  );
}
