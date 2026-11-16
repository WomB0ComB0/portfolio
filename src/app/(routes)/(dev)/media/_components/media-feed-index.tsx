'use client';

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
 * @file /media's one client island, composed from the shared kits as /projects is: the FilterBar
 * (a sticky <search> with the search and the Kind chips, only for kinds that have items; on a
 * phone the search and a Filters button), the results header, the status line, and the rows in
 * their sections (one per kind; the lab's alternative is one feed in year groups), or the empty
 * state that names what removed everything. The rows are server-rendered markup it only filters
 * and arranges.
 *
 * Its filters live in the URL through useUrlFilters (?kind, ?series, ?topic, ?q; history replace,
 * shallow), so the server HTML of a shared link is already filtered and, without JavaScript, the
 * chips and the series and topic links are links and the search is a GET form. The schema is
 * built here from the kinds list and the series and topics the rows carry (it holds functions).
 * With one series chosen, its uploads are listed first part first; in every other state the
 * order is the server's (newest first). While nothing filters the list, a long series shows only
 * its newest uploads and a link to all of them (feed-sections.tsx); the server and the browser
 * decide that from the same URL, so the first HTML already has it.
 *
 * The filters count and search items, not rows: a row is one item unless it folds several
 * uploads (the lab's "Fold parts"), which then count one each. The rows listed are the rows of
 * the items kept, so every count on the page (the chips, "27 of 52 items", a section's "27
 * streams") is the same however the rows are laid out.
 *
 * A reference that only filters this list (a row's series or topic link, a long series' "Show
 * all") is followed here on a plain click: the list changes at once, as for a chip, instead of
 * waiting on the server for a page it already has. It goes exactly where the link says and adds
 * one history entry, so Back returns to the list the visitor left. The island also tells the rows
 * which of them say their series place as text (feed-series-ref.tsx): where the list already
 * holds every upload of a series (the series view, the full list, or a kind or a search that finds
 * them all), and on the rows of a long one (cut to its newest uploads, or after the first row of
 * one listed in part), a link to it would lead nowhere new or be one of many alike.
 *
 * With media-play=embed, a plain click on a link marked data-play opens the in-page player
 * (loaded on first use); a modified click and every visit without JavaScript follow the link.
 */

import { useQueryStates } from 'nuqs';
import {
  lazy,
  type ReactElement,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FILTER_SCOPE_CLASS,
  FilterBar,
  RESULTS_HEAD_CLASS,
  useFilterBar,
  useUrlFilters,
} from '@/components/console/filter-bar';
import { isPlainClick } from '@/lib/dom/plain-click';
import { focusInPlace } from '@/lib/dom/steady-focus';
import { cn } from '@/lib/utils';
import type { FeedKind } from '../_lib/media-feed';
import {
  type MediaFilterItem,
  type MediaSchema,
  type MediaSeries,
  type MediaTopicOption,
  mediaFilters,
  seriesIn,
  topicsIn,
} from '../_lib/media-filters';
import type { LayoutMode, PlayMode, SeriesRowsMode } from '../_lib/media-options';
import { LIST_CLASS } from './feed-classes';
import { FeedGroups } from './feed-groups';
import { FeedSections, plainSeriesRows, wholeSeriesIn } from './feed-sections';
import { PlainSeriesProvider } from './feed-series-ref';
import type { PlayingVideo } from './video-dialog';

const VideoDialog = lazy(() => import('./video-dialog'));

/** A row's place in its series, as the island needs it: to filter by, name and order. */
export interface FeedRowSeries extends MediaSeries {
  /** The upload's number in the series, from 1. */
  readonly part: number;
}

/** One upload of a row that folds several: what a search reads of it, and its length. */
export interface FeedRowPart {
  readonly haystack: string;
  /** The upload's length in seconds; null when it has none. */
  readonly seconds: number | null;
}

/** What the island needs of a row to filter and group it, plus the row itself. */
export interface FeedRowItem extends MediaFilterItem {
  readonly id: string;
  readonly year: string;
  readonly series: FeedRowSeries | null;
  /** The topics the row is filed under, to filter by and name; none for most rows. */
  readonly topics: readonly MediaTopicOption[];
  /** The row's length in seconds, for its section's total; null when it has none. */
  readonly seconds: number | null;
  /**
   * The uploads a folded row stands for (the lab's "Fold parts"), each counted and searched as
   * an item of its own; left out for a row that is one item.
   */
  readonly folded?: readonly FeedRowPart[];
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

/**
 * What the filters count and search: an item. A row is one item, except a row that folds
 * several uploads, which is one per upload, so the chips, "52 items" and the status line say the
 * same whether or not rows are folded.
 */
interface FeedUnit extends MediaFilterItem {
  readonly row: FeedRowItem;
  readonly seconds: number | null;
}

/** A row as the items the filters count: its uploads when it folds several, else itself. */
function unitsOf(row: FeedRowItem): FeedUnit[] {
  const parts: readonly FeedRowPart[] = row.folded ?? [row];
  return parts.map(({ haystack, seconds }) => ({
    kind: row.kind,
    haystack,
    series: row.series,
    topics: row.topics,
    seconds,
    row,
  }));
}

/** A row the filters kept: how many of its items they kept, and those items' length. */
interface KeptRow extends FeedRowItem {
  readonly count: number;
}

/** Two lengths added up; none only when neither can be read. */
const addSeconds = (a: number | null, b: number | null): number | null =>
  a === null ? b : a + (b ?? 0);

/** The rows of the items the filters kept, in the items' order, each with what was kept of it. */
function keptRows(units: readonly FeedUnit[]): KeptRow[] {
  const kept = new Map<FeedRowItem, { readonly count: number; readonly seconds: number | null }>();
  for (const { row, seconds } of units) {
    const sofar = kept.get(row);
    kept.set(row, {
      count: (sofar?.count ?? 0) + 1,
      seconds: addSeconds(sofar?.seconds ?? null, seconds),
    });
  }
  return [...kept].map(([row, { count, seconds }]) => ({ ...row, count, seconds }));
}

export interface MediaFeedIndexProps {
  /** Every row, in page order: by section then newest first, or newest first in the one feed. */
  readonly rows: readonly FeedRowItem[];
  /** Sections per kind, or one feed in year groups. */
  readonly layout: LayoutMode;
  /** The kinds that have items: the only chips. */
  readonly kinds: readonly FeedKind[];
  /** The base URL: /media, or the lab with its resolved switches and station anchor. */
  readonly path: string;
  readonly play: PlayMode;
  /** Whether a long series lists only its newest uploads while nothing filters the list. */
  readonly longSeries: SeriesRowsMode;
  /**
   * The kinds listed only in part (the uploads, past the channel listing's cap): their sections
   * state no total length and their "Show all" line no count. None by default.
   */
  readonly uncounted?: readonly FeedKind[];
}

interface Player {
  readonly video: PlayingVideo;
  readonly open: boolean;
  readonly opener: HTMLElement;
}

interface PlayerState {
  readonly player: Player | null;
  readonly close: (open: boolean) => void;
}

/**
 * The in-page player's state, opened from any link marked data-play inside `root` on a plain
 * click (one listener on the island, so the server rows stay plain markup). Off unless embed.
 */
function usePlayer(root: RefObject<HTMLDivElement | null>, play: PlayMode): PlayerState {
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => {
    const element = root.current;
    if (play !== 'embed' || !element) return undefined;
    /** Opens the player for a plain click on a play link; leaves every other click alone. */
    const onClick = (event: MouseEvent): void => {
      if (!isPlainClick(event) || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[data-play]');
      const videoId = link?.dataset.play;
      if (!link || !videoId || !element.contains(link)) return;
      event.preventDefault();
      const title = link.dataset.playTitle ?? link.textContent ?? '';
      setPlayer({ video: { videoId, title, href: link.href }, open: true, opener: link });
    };
    element.addEventListener('click', onClick);
    return () => element.removeEventListener('click', onClick);
  }, [root, play]);
  /** Closing keeps the video, so the player can play its exit before it goes. */
  const close = (open: boolean): void => {
    if (!open) setPlayer((current) => (current ? { ...current, open: false } : current));
  };
  return { player, close };
}

/** The links that only filter this list: a row's series or topic, a long series' "Show all". */
const FILTER_LINKS = 'a[data-feed-series], a[data-feed-topic], a[data-feed-more-link]';
/** Where focus goes once such a link has changed the list: the first row's title. */
const FIRST_TITLE = '[data-filter-part="results"] a[data-feed-title]';
/** A followed link is a step the visitor can go Back from; nothing is asked of the server. */
const FOLLOW_OPTIONS = { history: 'push', shallow: true, scroll: false } as const;

/**
 * Writes the filters a link's address names to the URL (nuqs, so the bar, the tokens and the
 * rows follow in the same render), every other filter cleared, as a new history entry. The
 * address is read with the page's own schema, so a click lands exactly where the link would
 * without JavaScript.
 */
function useFollow<T extends MediaFilterItem>(schema: MediaSchema<T>): (href: string) => void {
  const [, setUrl] = useQueryStates(schema.parsers, FOLLOW_OPTIONS);
  return useCallback(
    (href: string): void => {
      const state = schema.parse(new URL(href, window.location.href).search);
      void setUrl({
        q: state.q === '' ? null : state.q,
        ...Object.fromEntries(
          schema.keys.map((key) => [key, state[key].length === 0 ? null : [...state[key]]]),
        ),
      } as Parameters<typeof setUrl>[0]);
    },
    [schema, setUrl],
  );
}

interface FilterLinksProps {
  /** The island's root: one listener there, so the server rows stay plain markup. */
  readonly root: RefObject<HTMLDivElement | null>;
  /** Applies the filters a link's address names. */
  readonly follow: (href: string) => void;
}

/**
 * Follows a plain click on a link that only filters this list in place, through the bar's own
 * `change` (so the results crossfade and land under the bar, as for a chip), then moves focus to
 * the first row of the list it opened: the link itself may be gone from it. A modified click and
 * every visit without JavaScript follow the link. Renders nothing; it sits inside the Provider
 * for `change`.
 */
function FilterLinks({ root, follow }: FilterLinksProps): null {
  const { change, model } = useFilterBar();
  const [focusPending, setFocusPending] = useState(false);
  // Clearing a search can commit the new series before useDeferredValue reveals all its rows.
  // Wait for that final list: its first upload may have been excluded by the old search.
  useLayoutEffect(() => {
    if (!focusPending || model.active.q !== model.draft.q) return;
    setFocusPending(false);
    focusInPlace(root.current?.querySelector<HTMLElement>(FIRST_TITLE));
  }, [focusPending, model.active.q, model.draft.q, root]);
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    /** Takes a plain click on a filter link; leaves every other click alone. */
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>(FILTER_LINKS);
      if (!link || !element.contains(link)) return;
      event.preventDefault();
      // Every such link turns on a series or a topic, which only the results header shows: the
      // page goes straight to it, in one move.
      change(
        () => {
          setFocusPending(true);
          follow(link.href);
        },
        undefined,
        { head: true },
      );
    };
    element.addEventListener('click', onClick);
    return () => element.removeEventListener('click', onClick);
  }, [root, change, follow]);
  return null;
}

/** The filter's own parameters, which a GET form's hidden base fields must leave to it. */
const FILTER_KEYS: ReadonlySet<string> = new Set(['q', 'kind', 'series', 'topic']);

/** The rows of one series, first part first (every row kept by a series filter is in it). */
const byPart = (a: FeedRowItem, b: FeedRowItem): number =>
  (a.series?.part ?? 0) - (b.series?.part ?? 0);

/** The bar, the results header, the status line and the sections; the player when embedding. */
export function MediaFeedIndex({
  rows,
  layout,
  kinds,
  path,
  play,
  longSeries,
  uncounted,
}: MediaFeedIndexProps): ReactElement {
  const schema = useMemo(
    () => mediaFilters<FeedUnit>(kinds, path, seriesIn(rows), topicsIn(rows)),
    [kinds, path, rows],
  );
  const units = useMemo(() => rows.flatMap(unitsOf), [rows]);
  // GET submission replaces the action's query, so non-filter base parameters must also be
  // successful controls. /media has none; the lab supplies its already-validated switches.
  const preserved = useMemo(
    () =>
      [...new URLSearchParams(path.split('?')[1]?.split('#')[0] ?? '')].filter(
        ([key]) => !FILTER_KEYS.has(key),
      ),
    [path],
  );
  const { model, results } = useUrlFilters(schema, units);
  const kept = keptRows(results);
  // One series on its own reads as a series: first part first. In every other state the rows
  // keep the server's order.
  const inSeries = model.active.series?.length === 1;
  const shown = inSeries ? [...kept].sort(byPart) : kept;
  // A long series is cut to its newest uploads only while the visitor has asked for nothing.
  const cut = layout === 'sections' && longSeries === 'newest' && !model.filtered;
  const seriesHref = cut ? (slug: string): string => model.hrefFor({ series: [slug] }) : undefined;
  // A series the list holds whole says its place as text: its link would show the same rows.
  const plainSeries = plainSeriesRows(shown, {
    inSeries,
    cut,
    whole: wholeSeriesIn(shown, rows),
  });
  const root = useRef<HTMLDivElement>(null);
  const { player, close } = usePlayer(root, play);
  const follow = useFollow(schema);

  return (
    <div
      ref={root}
      data-filter-scope=""
      data-media-part="feed"
      className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}
    >
      <FilterBar.Provider model={model}>
        <FilterBar.Root sticky>
          {preserved.map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <FilterBar.Search />
          <FilterBar.Facets facets={['kind']}>
            <FilterBar.Chips facet="kind" layout="scroll" />
          </FilterBar.Facets>
        </FilterBar.Root>
        <div className={RESULTS_HEAD_CLASS}>
          <FilterBar.Count />
          <FilterBar.Applied />
        </div>
        <FilterBar.Status />
        <FilterBar.Results>
          <PlainSeriesProvider rows={plainSeries}>
            {shown.length === 0 ? (
              <FilterBar.Empty />
            ) : layout === 'sections' ? (
              <FeedSections items={shown} seriesHref={seriesHref} uncounted={uncounted} />
            ) : (
              <FeedGroups items={shown} />
            )}
          </PlainSeriesProvider>
        </FilterBar.Results>
        <FilterLinks root={root} follow={follow} />
      </FilterBar.Provider>
      {player && (
        <Suspense fallback={null}>
          <VideoDialog
            video={player.video}
            open={player.open}
            onOpenChange={close}
            returnFocusTo={player.opener}
          />
        </Suspense>
      )}
    </div>
  );
}
