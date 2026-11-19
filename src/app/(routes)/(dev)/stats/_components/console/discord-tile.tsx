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
 * @file The console's live tile: Discord presence, seeded with the server's snapshot so the status
 * and activity are in the server HTML, then polled every 30 s (Lanyard through /api/v1/lanyard),
 * as the old card did.
 *
 * The status is a StatusDot and its word on the palette (online live, and only online pulses;
 * idle ongoing; do not disturb down; offline faint). The activity rows keep the card's behaviour
 * (discord-presence.ts); while Discord reports no listening, Spotify's own now playing is polled
 * too (seeded from the home tile's snapshot), reset whenever Discord reports listening again, and
 * an answer older than two polls is never shown.
 *
 * The age under the tile is the presence's: when the server read Lanyard (the snapshot's time, or
 * a poll's `read_at` when the route sends one), not when the browser's request came back, since
 * the route answers from a cache. A failed poll keeps the last presence and its age, and so does
 * an answer read before it (presenceAfterPoll): the newer presence stays and its age keeps
 * counting. Reads are ordered by the server's clock, and the time between arrivals by this
 * browser's monotonic clock (performance.now()), so neither a browser clock off the server's,
 * nor a step of it between polls, nor a slow answer puts an older copy back over a newer one; a
 * `read_at` later than the server says it served the answer counts as read when it was served.
 * The age line counts in this browser's clock from the arrival, less how old the read was when
 * the server served it: the response's Date plus Age for a poll (fetchServedJson), the render's
 * time for the snapshot. A presence kept over a step of the clock moves with the step, so its
 * age stays true after the next poll. An answer that does not say when it was read is dated by
 * its arrival; one without a Date header is dated as before, by this browser's clock standing in
 * for the server's. The line is one line tall whatever it says.
 *
 * Plain fetch and lucide only (no Effect, no react-icons), as the home islands. A snapshot that
 * timed out or failed says so in words, and the island keeps polling.
 *
 * Nothing in the tile is cut to fit: the status word drops under the label, the name under the
 * avatar and an activity's words under its art when the tile is too narrow to hold them side by
 * side, and a line takes a second line before it is shortened. The tile's place in the grid is
 * in console-layout.ts.
 *
 * The tile is the same height in every live state, at every width and text size: under the name
 * sits one room for the activities (ROOM_CLASS), as tall as the tallest list the tile ever shows
 * and measured in lines of its own text, so it grows with text a phone enlarges. An activity
 * starting or stopping changes what is in the room, never the tile, so nothing below it moves;
 * nor does a change of status, whose word sits in the room of the widest one. The room is
 * designed for the quieter states too: one activity, the usual state, is featured (larger art,
 * centred in the room) rather than left as one small row over an empty surface, no activity is a
 * glyph and a line in the same place, and a source that has not answered holds the same height
 * for the answer.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Code, Headphones, Moon } from 'lucide-react';
import { type ReactElement, useEffect, useReducer, useState } from 'react';
import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import { fetchJson, parseNowPlaying } from '@/app/_components/home/live/live-fetch';
import { LoadingNote, TileLabel, TileUnavailable } from '@/app/_components/home/tiles/tile-states';
import type { LanyardData } from '@/app/api/v1/[[...route]]/lanyard/handlers';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { StatusDot, type StatusTone } from '@/components/console/status-dot';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import Image from '@/components/ui/cdn-image';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { cn } from '@/lib/utils';
import {
  type ActivityKind,
  type ActivityRow,
  activityRows,
  avatarUrl,
  type DatedPresence,
  isListening,
  MAX_ACTIVITY_ROWS,
  presenceAfterPoll,
  presenceTone,
  profileUrl,
  selectActivities,
  snapshotPresence,
  WIDEST_PRESENCE_WORD,
} from '../../_lib/discord-presence';
import { fetchServedJson } from '../../_lib/served-json';
import { DISCORD_SPAN, DISCORD_TABLET_ROWS_CLASS } from './console-layout';
import { PresentAge } from './present-age';

const LABEL_ID = 'stats-discord';
const LANYARD_URL = '/api/v1/lanyard';
const NOW_PLAYING_URL = '/api/v1/now-playing';
/** Lanyard's poll, as the old card's: fresh for 30 s, asked again every 30 s. */
const PRESENCE_POLL_MS = 30_000;
const PRESENCE_KEY = ['stats', 'discord'] as const;
/** Spotify's fallback poll, as the old card's. */
const NOW_PLAYING_POLL_MS = 30_000;
/** Two polls: one failed poll keeps the song, one left over from repeated failures is not shown. */
const NOW_PLAYING_MAX_AGE_MS = 2 * NOW_PLAYING_POLL_MS;
const NOW_PLAYING_KEY = ['stats', 'discord', 'now-playing'] as const;
/** The art's intrinsic size: 40px in a list row, 96px when a lone row is featured. */
const ART_SIZE = 40;
const FEATURED_ART_SIZE = 96;
const AVATAR_SIZE = 40;

/** The status word's colour, matching its dot. */
const TONE_TEXT: Readonly<Record<StatusTone, string>> = {
  live: 'text-live',
  ongoing: 'text-ongoing',
  down: 'text-down',
  info: 'text-info',
  idle: 'text-muted-foreground',
};

const GLYPHS: Readonly<Record<ActivityKind, typeof Activity>> = {
  spotify: Headphones,
  code: Code,
  other: Activity,
};

/** The label and the status word: one row, or the word under the label when both do not fit. */
const HEAD_CLASS = 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5';
/**
 * The status word's room in that row: as wide as the widest word there is ('Do not disturb'),
 * laid out unseen in the word's own cell as generated content (the age room's way, age-room.tsx)
 * and padded by the dot and its gap, which are not text. In enlarged text 'Do not disturb' does
 * not fit beside the label where 'Idle' does: left to its own width the word dropped under the
 * label for some statuses only, and a change of status moved the page by that line. In the room
 * the row breaks the same way whatever the status. The room takes the row's spare width on its
 * left and the word ends where the room does, so the word rests on the tile's right edge beside
 * the label and on the row under it alike.
 */
const STATUS_ROOM_CLASS =
  'ml-auto inline-grid max-w-full min-w-0 justify-items-end tile-label before:invisible before:col-start-1 before:row-start-1 before:pl-3.5 before:content-[attr(data-widest)]';
/** The dot and the word, in the room's one cell. */
const STATUS_WORD_CLASS = 'col-start-1 row-start-1 inline-flex min-w-0 items-center gap-1.5';
/**
 * A row of the tile (who, or one activity): its picture, then its words. The words stay beside
 * the picture while that leaves them 8rem, and otherwise take the next line whole.
 */
const ROW_CLASS = 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2';
/** An activity's words and, in a linked row, its arrow: they wrap under the art together. */
const ROW_WORDS_CLASS = 'flex min-w-0 flex-[1_1_8rem] items-center gap-3';
/** One line of an activity: a long word breaks inside. How many lines it may take is below. */
const ROW_LINE_CLASS = '[overflow-wrap:anywhere]';
/** The activity rows, top to bottom. */
const LIST_CLASS = 'flex flex-col gap-3';
/**
 * The tile's parts (label, name, room, age) sit 12px apart, so the room below costs the page as
 * little height as it can: the tile is 369px at the default text size (361px on a phone grid,
 * where it is padded 16px).
 */
const TILE_GAP_CLASS = 'gap-3';
/**
 * The room's height: that of the tallest list the tile ever shows (ROW_LINES below), in lines of
 * a row's heading. `leading-5` makes one line of the room one heading line (20px at the default
 * size; a detail line is nine tenths of one). A line grows with the text however it is enlarged.
 * A rem does not when a phone scales text alone, and the fuller states then outgrew a room
 * measured in rem and moved the page. By the tile's own width:
 * - words beside their art: two rows with every line they may take (two heading lines, two of
 *   the first detail and one of the last: 4.7 lines a row) and the 0.75rem between them, 12.5rem
 *   at the default size. Three rows of one line each (2.8 lines a row and two gaps) and a lone
 *   row at its fullest (8.4 lines) are shorter.
 * - a tile under 12.5rem, where a lone row's words drop under its featured art (30% of the
 *   tile): that row too, which is the art, 0.5rem and its 8.4 lines.
 * - a tile under 11.25rem, where every row's words drop under its 2.5rem art: two such rows, or
 *   three of one line each, whichever is taller.
 * Each ends with the room's own 1rem of padding and its 1px rule. It is a minimum, never a
 * height: were a row ever taller, the room would grow rather than cut it.
 *
 * A browser that does not read lh keeps the first of these in rem (13.5rem and the rule), which
 * is the same room at the default text size; the three in lines apply only where lh is read.
 */
const ROOM_HEIGHT_CLASS =
  'leading-5 min-h-[calc(13.5rem+1px)] supports-[height:1lh]:min-h-[calc(47lh/5+1.75rem+1px)] supports-[height:1lh]:@min-[11.25rem]:@max-[12.5rem]:min-h-[calc(max(47lh/5+0.75rem,42lh/5+30cqi+0.5rem)+1rem+1px)] supports-[height:1lh]:@max-[11.25rem]:min-h-[calc(max(47lh/5+6.75rem,42lh/5+10.5rem)+1rem+1px)]';
/** The room for the activities, under the rule. */
const ROOM_CLASS = `flex flex-1 flex-col border-t border-hairline pt-4 ${ROOM_HEIGHT_CLASS}`;
/**
 * A tile that has no answer yet holds the height of one that has, part for part, the tile's
 * 0.75rem apart: a stand-in for the name row, the room at its own height with the words in its
 * middle (where 'no activity' sits), and a stand-in for the age line. A late answer then fills
 * the tile without moving the page. Each stand-in is sized as what it stands in for, so this
 * holds at any text size: the avatar's 2.5rem or a line of the name, whichever is taller (the
 * name under the avatar in a tile too narrow for both), and one line of the age (1.125rem where
 * lh is not read).
 */
const UNAVAILABLE_CLASS = `flex flex-1 flex-col ${TILE_GAP_CLASS}`;
const NAME_STAND_IN_CLASS =
  'min-h-10 shrink-0 tile-title supports-[height:1lh]:h-[1lh] supports-[height:1lh]:@max-[11.25rem]:h-[calc(3rem+1lh)]';
const HELD_ROOM_CLASS = `flex flex-1 flex-col justify-center ${ROOM_HEIGHT_CLASS}`;
const AGE_STAND_IN_CLASS = 'h-4.5 shrink-0 tile-meta supports-[height:1lh]:h-[1lh]';
/**
 * The age line, at the tile's foot: one line tall whatever it says, as its stand-in above is. An
 * age formatAge cannot word (a read over a minute ahead of this browser's clock, which PresentAge
 * now clamps) left the line empty, and an empty line took no height: the tile shrank by it and
 * grew back at the next poll, moving everything under it.
 */
const AGE_LINE_CLASS = 'mt-auto min-h-4.5 shrink-0 text-faint supports-[height:1lh]:min-h-[1lh]';

/**
 * How many lines each line of an activity (its heading, then its two details) may take before it
 * is shortened, by how many rows share the room:
 * - a lone row is featured: centred in the room, its art as large as the tile allows (a third of
 *   the tile's width, 40px at least and 96px from a 20rem tile), and a line may run to three
 *   lines, since the words have the art's height to fill;
 * - two rows keep a second line for the heading and the first detail (a song's title, the file
 *   being edited), and one for the last (the artist, the workspace). A row is then 4.7 heading
 *   lines at most (5.875rem at the default size), and the room is sized to hold two of those, so
 *   any two rows fit;
 * - three rows take one line each (a row is then 2.8 heading lines, 3.5rem), so three always
 *   fit: the one state where a heading is shortened without a second line.
 */
type RowDensity = 'solo' | 'pair' | 'full';
interface RowLines {
  readonly heading: string;
  readonly primary: string;
  readonly secondary: string;
}
const ROW_LINES: Readonly<Record<RowDensity, RowLines>> = {
  solo: { heading: 'line-clamp-3', primary: 'line-clamp-3', secondary: 'line-clamp-3' },
  pair: { heading: 'line-clamp-2', primary: 'line-clamp-2', secondary: 'line-clamp-1' },
  full: { heading: 'line-clamp-1', primary: 'line-clamp-1', secondary: 'line-clamp-1' },
};
const densityOf = (rows: number): RowDensity =>
  rows <= 1 ? 'solo' : rows < MAX_ACTIVITY_ROWS ? 'pair' : 'full';

const SOLO_LIST_CLASS = 'grow justify-center';
const ART_BOX_CLASS = 'size-10 shrink-0 rounded-md';
/** Sized by the tile itself (cqi), so the art never asks the grid what tier it is in. */
const SOLO_ART_BOX_CLASS = 'size-[clamp(2.5rem,30cqi,6rem)]';
/** The glyph of a featured row without art: 28px in the 96px box, never under the usual 16px. */
const SOLO_GLYPH_CLASS = 'size-[max(1rem,29%)]';
const ROW_LINK_CLASS = `group/row relative z-10 -mx-2 -my-1.5 rounded-lg px-2 py-1.5 transition-colors duration-(--motion-base) ease-effect hover:bg-surface-2 hover:duration-(--motion-instant) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${ROW_CLASS}`;

/**
 * No activity: a quiet glyph over the words, centred in whatever height the tile has. Beside the
 * two-row hero that is the middle of the tile, not one line over an empty surface.
 */
const IDLE_CLASS =
  'flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center tile-sub text-muted-foreground';
const IDLE_GLYPH_CLASS = 'grid size-10 place-items-center rounded-full bg-surface-2 text-faint';

type Snapshot<T> = Extract<LiveInitial<T>, { kind: 'data' }>;

const seedOf = <T,>(initial: LiveInitial<T>): Snapshot<T> | undefined =>
  initial.kind === 'data' ? initial : undefined;

/**
 * Discord presence: the server's snapshot first (read at its `fetchedAt` and served at
 * `renderedAt`, both by the server's clock), then a poll every 30 s. A poll's answer is ordered
 * by its `read_at` and aged through the response's Date plus Age; one read before the presence
 * shown leaves that presence and its age as they are (presenceAfterPoll). The monotonic clock
 * (performance.now()) times each request and each arrival, so a step of the device's clock
 * changes neither the order nor an age.
 */
function usePresence(initial: LiveInitial<LanyardData>, renderedAt: number) {
  const queryClient = useQueryClient();
  const seed = seedOf(initial);
  return useQuery({
    queryKey: PRESENCE_KEY,
    queryFn: async ({ signal }): Promise<DatedPresence> => {
      const sent = performance.now();
      const { json, servedAt } = await fetchServedJson(LANYARD_URL, { signal });
      const shown = queryClient.getQueryData<DatedPresence>(PRESENCE_KEY);
      return presenceAfterPoll(json, Date.now(), shown, servedAt, {
        sent,
        received: performance.now(),
      });
    },
    initialData:
      seed &&
      snapshotPresence(seed.data, seed.fetchedAt, Date.now(), renderedAt, performance.now()),
    initialDataUpdatedAt: seed?.fetchedAt,
    staleTime: PRESENCE_POLL_MS,
    refetchInterval: PRESENCE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Whether `at` is still younger than `maxAgeMs` by this browser's clock. It is read again the
 * moment `at` ages out, so what it guards goes then rather than at the next poll.
 */
function useYoungerThan(at: number, maxAgeMs: number): boolean {
  const expiresAt = at + maxAgeMs;
  const [, wake] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const left = expiresAt - Date.now();
    if (left <= 0) return undefined;
    const timer = setTimeout(wake, left);
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return Date.now() < expiresAt;
}

/**
 * The song Spotify's own now playing gives the fallback row, asked only while `enabled` (Discord
 * reports no listening). A failure leaves the rows to Discord, never an error state.
 * - A song shows until it is two polls old by when it was fetched: one failed poll keeps it, one
 *   left over from repeated failures is gone. (The query's isStale is no guide: it turns true on
 *   any failed poll.)
 * - While disabled the answer is dropped, back to the server's snapshot and with no request, so
 *   turning the fallback back on asks again rather than showing an old track. (resetQueries
 *   would ask at once: it runs before the query has heard that it is disabled.)
 * - The server HTML, and the render that hydrates it, judge the snapshot by the server's clock
 *   (`renderedAt`), so the two agree whatever this browser's clock says; every later render
 *   judges by this browser's clock.
 */
function useNowPlayingFallback(
  enabled: boolean,
  initial: LiveInitial<NowPlayingResponse>,
  renderedAt: number,
): NowPlayingResponse | undefined {
  const queryClient = useQueryClient();
  const seed = seedOf(initial);
  const serverHtml = useIsServerHtmlRender();
  useEffect(() => {
    if (!enabled)
      queryClient.getQueryCache().find({ queryKey: NOW_PLAYING_KEY, exact: true })?.reset();
  }, [enabled, queryClient]);
  const { data, dataUpdatedAt } = useQuery({
    queryKey: NOW_PLAYING_KEY,
    queryFn: async ({ signal }) => parseNowPlaying(await fetchJson(NOW_PLAYING_URL, { signal })),
    enabled,
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
    staleTime: NOW_PLAYING_MAX_AGE_MS,
    refetchInterval: NOW_PLAYING_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const young = useYoungerThan(dataUpdatedAt, NOW_PLAYING_MAX_AGE_MS);
  if (serverHtml) {
    return seed && renderedAt - seed.fetchedAt < NOW_PLAYING_MAX_AGE_MS ? seed.data : undefined;
  }
  return young ? data : undefined;
}

/**
 * The status at the tile's top right: its dot and word, in the word's colour, laid out in the
 * room of the widest word (STATUS_ROOM_CLASS).
 */
function StatusWord({ status }: { readonly status: string }): ReactElement {
  const { word, tone, pulse } = presenceTone(status);
  return (
    <p data-widest={WIDEST_PRESENCE_WORD} className={cn(STATUS_ROOM_CLASS, TONE_TEXT[tone])}>
      <span className={STATUS_WORD_CLASS}>
        <StatusDot tone={tone} pulse={pulse} />
        {word}
      </span>
    </p>
  );
}

interface RowProps {
  readonly row: ActivityRow;
  /** How many rows share the room: a lone row is featured, three take one line each. */
  readonly density: RowDensity;
}

/**
 * Album art, or a glyph on a surface for the kind of activity. Both 40 px, or up to 96 px for a
 * featured lone row. Art that fails to load gives way to the glyph (never the browser's broken
 * image); another image gets its own try.
 */
function RowArt({ row, density }: RowProps): ReactElement {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const art = row.art && row.art.src !== failedSrc ? row.art : undefined;
  const solo = density === 'solo';
  const box = cn(ART_BOX_CLASS, solo && SOLO_ART_BOX_CLASS);
  if (art) {
    const size = solo ? FEATURED_ART_SIZE : ART_SIZE;
    return (
      <Image
        src={art.src}
        alt={art.alt}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailedSrc(art.src)}
        className={cn(box, 'object-cover shadow-[inset_0_0_0_1px_var(--hairline)]')}
      />
    );
  }
  const Glyph = GLYPHS[row.kind];
  return (
    <span
      aria-hidden="true"
      data-row-glyph=""
      className={cn(box, 'grid place-items-center bg-surface-2 text-muted-foreground')}
    >
      <Glyph className={cn('size-4', solo && SOLO_GLYPH_CLASS)} />
    </span>
  );
}

/**
 * One activity: art, then its words (the heading, 'Listening to Spotify', and up to two details)
 * with the new-tab arrow of a linked row after them. The words and the arrow wrap under
 * the art together, so the arrow never lands on a line of its own.
 */
function RowBody({ row, density }: RowProps): ReactElement {
  const lines = ROW_LINES[density];
  return (
    <>
      <RowArt row={row} density={density} />
      <span className={ROW_WORDS_CLASS}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(ROW_LINE_CLASS, lines.heading, 'tile-sub font-medium text-foreground')}
          >
            {row.heading}
          </span>
          {row.primary && (
            <span className={cn(ROW_LINE_CLASS, lines.primary, 'tile-meta text-muted-foreground')}>
              {row.primary}
            </span>
          )}
          {row.secondary && (
            <span className={cn(ROW_LINE_CLASS, lines.secondary, 'tile-meta text-faint')}>
              {row.secondary}
            </span>
          )}
        </span>
        {row.link && (
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-[color,translate] duration-(--motion-fast) ease-out-expo group-hover/row:text-foreground motion-safe:group-hover/row:translate-x-0.5 motion-safe:group-hover/row:-translate-y-0.5"
          />
        )}
      </span>
    </>
  );
}

/** A row; a linked one (Spotify's track) is its own link above the tile's overlay. */
function ActivityRowView({ row, density }: RowProps): ReactElement {
  if (!row.link) {
    return (
      <div className={ROW_CLASS}>
        <RowBody row={row} density={density} />
      </div>
    );
  }
  return (
    <a
      href={row.link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={row.link.label}
      className={ROW_LINK_CLASS}
    >
      <RowBody row={row} density={density} />
    </a>
  );
}

interface PresenceBodyProps {
  readonly data: LanyardData;
  readonly rows: readonly ActivityRow[];
}

/** Who (avatar and name), then the room: what they're up to, or words when nothing. */
function PresenceBody({ data, rows }: PresenceBodyProps): ReactElement {
  const user = data.discord_user;
  const avatar = avatarUrl(user);
  const density = densityOf(rows.length);
  const solo = density === 'solo';
  return (
    <>
      <div className={ROW_CLASS}>
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            className="size-10 shrink-0 rounded-full shadow-[0_0_0_1px_var(--hairline)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 tile-label text-muted-foreground"
          >
            {user.username.slice(0, 2).toUpperCase()}
          </span>
        )}
        <p className="min-w-0 flex-[1_1_8rem] tile-title text-foreground [overflow-wrap:anywhere]">
          {user.username}
        </p>
      </div>
      <div data-discord-room="" className={ROOM_CLASS}>
        {rows.length > 0 ? (
          <ul
            aria-label="Current activity"
            data-solo={solo ? '' : undefined}
            className={cn(LIST_CLASS, solo && SOLO_LIST_CLASS)}
          >
            {rows.map((row) => (
              <li key={row.key}>
                <ActivityRowView row={row} density={density} />
              </li>
            ))}
          </ul>
        ) : (
          <p data-discord-idle="" className={IDLE_CLASS}>
            <span aria-hidden="true" className={IDLE_GLYPH_CLASS}>
              <Moon className="size-4" />
            </span>
            Not in an activity right now
          </p>
        )}
      </div>
    </>
  );
}

export interface DiscordTileProps {
  /** The server's Lanyard snapshot. */
  readonly initial: LiveInitial<LanyardData>;
  /** The server's Spotify snapshot (the home tile's), for the fallback row. */
  readonly nowPlaying: LiveInitial<NowPlayingResponse>;
  /** The Discord user id, for the profile link even when Lanyard failed. */
  readonly profileId: string;
  /**
   * When the server rendered the page, by its clock (epoch ms): the server HTML and the render
   * that hydrates it judge the Spotify snapshot's age against this, so they always agree, and
   * the presence snapshot's age line counts from its age at this moment.
   */
  readonly renderedAt: number;
}

/** The Discord tile in its state (see the file comment). */
export function DiscordTile({
  initial,
  nowPlaying,
  profileId,
  renderedAt,
}: DiscordTileProps): ReactElement {
  const presence = usePresence(initial, renderedAt);
  const polled = presence.data;
  const data = polled?.presence;
  const discordListening = data ? selectActivities(data.activities).some(isListening) : true;
  const fallback = useNowPlayingFallback(
    data !== undefined && !discordListening,
    nowPlaying,
    renderedAt,
  );
  const failed = !data && (presence.isError || initial.kind === 'error');

  return (
    <Tile
      as="section"
      aria-labelledby={LABEL_ID}
      variant={profileId ? 'linked' : 'plain'}
      span={DISCORD_SPAN}
      className={`${TILE_GAP_CLASS} ${DISCORD_TABLET_ROWS_CLASS}`}
      data-stats-tile="discord"
      data-state={data ? 'ready' : failed ? 'error' : 'empty'}
    >
      <div className={HEAD_CLASS}>
        <TileLabel id={LABEL_ID}>
          <TileLink
            href={profileUrl(profileId)}
            external
            srSuffix="profile"
            className="text-inherit"
          >
            Discord
          </TileLink>
        </TileLabel>
        {data && <StatusWord status={data.discord_status} />}
      </div>
      {data ? (
        <PresenceBody data={data} rows={activityRows(data.activities, fallback)} />
      ) : (
        <div data-discord-unavailable="" className={UNAVAILABLE_CLASS}>
          <div aria-hidden="true" className={NAME_STAND_IN_CLASS} />
          <div className={HELD_ROOM_CLASS}>
            <TileUnavailable
              message={failed ? 'Discord status unavailable' : 'Discord didn’t answer in time'}
            />
          </div>
          <div aria-hidden="true" className={AGE_STAND_IN_CLASS} />
        </div>
      )}
      {polled && polled.readAt > 0 && <PresentAge at={polled.readAt} className={AGE_LINE_CLASS} />}
    </Tile>
  );
}

/** The quiet bar in the held room while the snapshot loads, where 'no activity' would sit. */
const ROOM_PLACEHOLDER_CLASS =
  'mx-auto block h-3 w-32 max-w-full rounded-sm bg-surface-3 motion-safe:animate-pulse forced-colors:outline';

/**
 * The tile while the server's snapshot is on its way (/stats streams it on its own): the label,
 * the status word's room (so the head wraps as a loaded one does) and the stand-ins a tile with
 * no answer holds the loaded height with (the name, the room and the age), marked busy. Static:
 * nothing polls until the snapshot lands and the tile itself takes over.
 */
export function DiscordTileSkeleton(): ReactElement {
  return (
    <Tile
      aria-busy="true"
      span={DISCORD_SPAN}
      className={`${TILE_GAP_CLASS} ${DISCORD_TABLET_ROWS_CLASS}`}
      data-stats-skeleton="discord"
      data-state="loading"
    >
      <div className={HEAD_CLASS}>
        <TileLabel>Discord</TileLabel>
        <p aria-hidden="true" data-widest={WIDEST_PRESENCE_WORD} className={STATUS_ROOM_CLASS} />
      </div>
      <div aria-hidden="true" className={UNAVAILABLE_CLASS}>
        <div className={NAME_STAND_IN_CLASS} />
        <div className={HELD_ROOM_CLASS}>
          <span className={ROOM_PLACEHOLDER_CLASS} />
        </div>
        <div className={AGE_STAND_IN_CLASS} />
      </div>
      <LoadingNote>Loading Discord status</LoadingNote>
    </Tile>
  );
}
