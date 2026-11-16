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
 * @file The room an age is laid out in, wherever its width decides how a row wraps. Server-safe
 * (no directive, no hooks); the age inside is the kit's Freshness.
 *
 * An age is re-read every 30 s while the page is open. Left to its own width, 'updated 9 min ago'
 * turning into 'updated 10 min ago' can push it to a new line (the end of a stat tile's context
 * line, the hero's age beside its label in a narrow tile), grow the tile by that line and move
 * everything under it. So the widest wording there is gets laid out in the same grid cell as the
 * age: generated content, hidden by visibility, which takes room and wraps as the age would
 * while the document holds none of it. Where the row breaks then no longer depends on the clock.
 */

import type { ReactElement, ReactNode } from 'react';

import { formatAge } from '@/components/console';
import { cn } from '@/lib/utils';

const MINUTE_MS = 60_000;
/**
 * The widest an age alone reads: '59 min ago' (two digits and the longest unit; the digits are
 * tabular, so every two-digit minute is this wide, and hours and days are narrower up to 999 d).
 * Worded by the same function the age is, so the two cannot drift apart. An age goes without its
 * word where a note before it says the same (a stale tile's, stat-tiles.tsx).
 */
export const WIDEST_BARE_AGE = formatAge(0, 59 * MINUTE_MS);
/** The widest an age reads with its word: 'updated 59 min ago'. */
export const WIDEST_AGE = `updated ${WIDEST_BARE_AGE}`;

/**
 * The room is a fifth of an em wider than that wording. Tabular digits are one width as designed,
 * but hinted text (Linux) rounds each glyph's place, and 29 of the 59 minute wordings set 1 to
 * 2px wider than '59 min' at 13px ('updated 22 min ago': 122px against 120px). Without the slack
 * a tile's height followed the minute shown at about twenty window widths.
 */
const ROOM_CLASS =
  'inline-grid tile-meta before:invisible before:col-start-1 before:row-start-1 before:pr-[0.2em] before:content-[attr(data-widest)]';
/** The room's one cell, shared with the widest wording: what the room holds carries this. */
export const AGE_CELL_CLASS = 'col-start-1 row-start-1';

export interface AgeRoomProps {
  /** The widest wording the room will hold; an age alone by default. */
  readonly widest?: string;
  readonly className?: string;
  /** One element carrying {@link AGE_CELL_CLASS}: the age, or a note that ends with it. */
  readonly children: ReactNode;
}

/** A box as wide as the widest wording, with `children` laid over it in the same cell. */
export function AgeRoom({ widest = WIDEST_AGE, className, children }: AgeRoomProps): ReactElement {
  return (
    <span data-age-room="" data-widest={widest} className={cn(ROOM_CLASS, className)}>
      {children}
    </span>
  );
}
