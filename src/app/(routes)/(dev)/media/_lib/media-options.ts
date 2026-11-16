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
 * @file The calls /media's layout rests on, as values the page and the routes lab share. The
 * first of each is what /media ships; the lab shows the others on the same data:
 * - layout: one section per kind (Writing, Video, Streams), or one feed by year;
 * - parts: every upload of a series its own row, or a series folded into one row;
 * - long series: a series of many uploads lists its newest few with a link to all of them, or
 *   lists every upload;
 * - play: link out to YouTube, or play in an in-page dialog (which needs a CSP change).
 * Pure and server-safe.
 */

import type { PartsMode } from './media-feed';

export type { PartsMode } from './media-feed';

/** How the page arranges its rows: a section per kind, or one feed in year groups. */
export type LayoutMode = 'sections' | 'feed';
/** How a video row plays: link out to YouTube, or open the in-page player. */
export type PlayMode = 'link' | 'embed';
/** How a long series is listed while no filter is on: its newest uploads, or all of them. */
export type SeriesRowsMode = 'newest' | 'all';

export const LAYOUT_MODES = ['sections', 'feed'] as const satisfies readonly LayoutMode[];
export const PARTS_MODES = ['each', 'fold'] as const satisfies readonly PartsMode[];
export const PLAY_MODES = ['link', 'embed'] as const satisfies readonly PlayMode[];
export const SERIES_ROWS_MODES = ['newest', 'all'] as const satisfies readonly SeriesRowsMode[];

/** What /media ships: sections, one row per upload, a long series cut to its newest, links out. */
export const DEFAULT_LAYOUT: LayoutMode = 'sections';
export const DEFAULT_PARTS: PartsMode = 'each';
export const DEFAULT_PLAY: PlayMode = 'link';
export const DEFAULT_SERIES_ROWS: SeriesRowsMode = 'newest';

/** The origin an in-page player needs in the page CSP's frame-src (src/lib/security/csp.ts). */
export const EMBED_FRAME_SRC = 'https://www.youtube-nocookie.com';
