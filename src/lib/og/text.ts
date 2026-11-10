/**
 * Copyright 2025 Mike Odnis
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
 * @file Fitting a page's title and description to its link-preview card: reading them from the
 * card's query, clipping them at a word, and stepping a long title down a size so it stays within
 * three lines. Satori draws whatever it is given and does not clamp lines, so the card's limits
 * are applied here, before it draws.
 */

import { app } from '@/constants';

/** The longest title a page card draws: three lines at its smallest size. */
export const PAGE_TITLE_MAX = 80;

/** The longest description a page card draws: about three lines below the title. */
export const PAGE_DESCRIPTION_MAX = 160;

/** The longest description under a title set at the smallest size: about two lines. */
export const PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX = 110;

const ELLIPSIS = '…';

/** Control characters (newlines, tabs, bells), which a card would draw as nothing or as boxes. */
const CONTROL = /\p{Cc}+/gu;

/** `value` on one line: control characters become spaces, runs of spaces collapse, ends trimmed. */
const oneLine = (value: string | null): string =>
  (value ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();

/**
 * `text` cut to at most `max` characters: whole when it fits, otherwise at the last space that
 * keeps at least half of it, with any trailing punctuation dropped and an ellipsis added.
 */
export function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - ELLIPSIS.length);
  const lastSpace = room.lastIndexOf(' ');
  const cut = lastSpace >= max / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.–—-]+$/u, '')}${ELLIPSIS}`;
}

/** A page card's title as drawn: clipped to the card, with the size it is set in. */
export interface FittedTitle {
  readonly text: string;
  readonly fontSize: number;
}

/** Title sizes, largest first, each with the longest title it is used for. */
const TITLE_STEPS: ReadonlyArray<{ readonly upTo: number; readonly fontSize: number }> = [
  { upTo: 16, fontSize: 104 },
  { upTo: 32, fontSize: 80 },
  { upTo: PAGE_TITLE_MAX, fontSize: 64 },
];

/** The smallest title size, for anything the steps above do not cover. */
const SMALLEST_TITLE = 64;

/**
 * The size a page card sets `title` in: one line at the largest size for a short title, two at
 * the middle size, up to three at the smallest, clipped to PAGE_TITLE_MAX.
 */
export function fitTitle(title: string): FittedTitle {
  const text = clipText(title, PAGE_TITLE_MAX);
  const step = TITLE_STEPS.find(({ upTo }) => text.length <= upTo);
  return { text, fontSize: step?.fontSize ?? SMALLEST_TITLE };
}

/**
 * The description as drawn under `title`: as given, except under a title set at the smallest
 * size (up to three lines), where it is clipped to about two lines so the two fit the tile.
 */
export function fitDescription(description: string, title: FittedTitle): string {
  return title.fontSize > SMALLEST_TITLE
    ? description
    : clipText(description, PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX);
}

/** What a page card draws. */
export interface PageCardText {
  readonly title: string;
  readonly description: string;
}

/**
 * The page card the query asks for: its `title` and `description` on one line each and clipped
 * to the card, the site description standing in for a missing one. Null without a title (blank
 * counts as none), for which the route draws the site card instead.
 */
export function readPageCard(params: URLSearchParams): PageCardText | null {
  const title = oneLine(params.get('title'));
  if (!title) return null;
  const description = oneLine(params.get('description')) || app.description;
  return {
    title: clipText(title, PAGE_TITLE_MAX),
    description: clipText(description, PAGE_DESCRIPTION_MAX),
  };
}
