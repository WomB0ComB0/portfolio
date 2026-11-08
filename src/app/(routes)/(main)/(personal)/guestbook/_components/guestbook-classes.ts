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
 * @file The guestbook's layout classes, shared by the server rows and the client island.
 *
 * Sizes answer to the shell's `page` container (`@container/page` on main), never the viewport:
 * below a 64rem page the compose card sits above the list; from 64rem the list takes the left
 * column and the card a 20rem column on the right that stays in view while the list scrolls.
 * Type is the refined set from globals.css (tile-*, figure-*), each paired with a token colour;
 * nothing is upper case, under 12px or heavier than 600. Tailwind reads class names from source,
 * so each one is written out whole.
 */

/** The card first in the DOM (it is the page's one action), the list beside it from 64rem. */
export const BOARD_CLASS =
  'grid gap-8 @min-[64rem]/page:grid-cols-[minmax(0,1fr)_20rem] @min-[64rem]/page:items-start @min-[64rem]/page:gap-12';

/**
 * While the list scrolls, the card sticks half a rem below the top edge haze: its offset is the
 * haze's own height token (--edge-haze-top, 77 to 132 px), as html's scroll-padding is, so the
 * card's title is never blurred at any screen height.
 */
export const COMPOSE_SLOT_CLASS =
  'min-w-0 @min-[64rem]/page:sticky @min-[64rem]/page:top-[calc(var(--edge-haze-top)+0.5rem)] @min-[64rem]/page:col-start-2 @min-[64rem]/page:row-start-1';

export const LIST_SECTION_CLASS =
  'flex min-w-0 flex-col gap-3 @min-[64rem]/page:col-start-1 @min-[64rem]/page:row-start-1';
/** The list's h2 over a strong hairline, as the Ledger's year headings. */
export const LIST_HEAD_CLASS =
  'flex items-baseline justify-between gap-3 border-b border-hairline-strong pb-1.5';
export const LIST_TITLE_CLASS = 'tile-title text-foreground';
export const LIST_NOTE_CLASS = 'tile-meta text-muted-foreground';
export const LIST_CLASS = 'flex flex-col';

/** A message: its text, then "author · month", over a hairline. Dense: 12px above and below. */
export const ROW_CLASS = 'flex flex-col gap-1 border-b border-hairline py-3';
/** A long word or URL breaks instead of widening the page; a row still being posted is muted. */
export const ROW_TEXT_CLASS =
  'max-w-[70ch] tile-sub text-foreground wrap-break-word [[data-state=loading]_&]:text-muted-foreground';
export const ROW_META_CLASS = 'tile-meta text-muted-foreground wrap-break-word';
export const ROW_AUTHOR_CLASS = 'font-medium';

/** The empty and error states: a dashed box with a title and a line, as the Ledger's empty. */
export const STATE_BOX_CLASS =
  'flex flex-col items-start gap-1 rounded-tile border border-dashed border-hairline-strong px-5 py-6';
export const STATE_TITLE_CLASS = 'tile-title text-foreground';
export const STATE_TEXT_CLASS = 'max-w-[60ch] tile-sub text-muted-foreground';

/** The compose card: one surface with a hairline, compact. */
export const CARD_CLASS =
  'flex flex-col gap-3 rounded-tile border border-hairline bg-surface-1 p-4 @min-[40rem]/page:p-5';
export const CARD_TITLE_CLASS = 'tile-title text-foreground';
export const CARD_TEXT_CLASS = 'tile-sub text-muted-foreground';
export const PROVIDERS_CLASS = 'flex flex-wrap gap-2';
export const FIELD_LABEL_CLASS = 'tile-label text-muted-foreground';
/** 16px on a phone, so focusing the box never zooms the page; 14px from a 40rem page. */
export const TEXTAREA_CLASS =
  'min-h-24 resize-none rounded-lg border border-hairline bg-canvas px-3 py-2 text-[1rem] leading-6 text-foreground placeholder:text-faint focus-visible:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus @min-[40rem]/page:tile-sub';
export const COMPOSE_FOOT_CLASS = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2';
/** tile-meta sets tabular figures; the class says so too, so the count never jitters as you type. */
export const COUNTER_CLASS = 'tile-meta tabular-nums text-muted-foreground';
/** The count past the limit: the down colour, so a too-long draft shows before Post is pressed. */
export const COUNTER_OVER_CLASS = 'tile-meta tabular-nums text-down';
export const SIGNED_IN_CLASS = 'tile-sub text-muted-foreground';
/**
 * Sign out reads as a link inside the "Signed in as" line, at that line's size: these replace the
 * outline button's border, fill, height and padding (cn merges them over the variant's).
 */
export const TEXT_BUTTON_CLASS =
  'h-auto w-auto border-0 bg-transparent p-0 align-baseline font-normal text-brand-ink underline-offset-4 shadow-none hover:bg-transparent hover:text-brand-ink hover:underline';
export const ERROR_CLASS = 'tile-sub text-down';
/** Always rendered (a live region must exist before its text arrives), so it is never hidden. */
export const STATUS_CLASS = 'tile-sub text-muted-foreground';
