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
 * @file /media's own layout on the shared kits: the island's root, the columns as data for the
 * IndexTable kit (style 2, the open index, as /projects) and the insides of the title cell: the
 * small 16:9 still, the title, its summary, its "see also" line (the other version, the series,
 * the project, the topics) and the parts of a folded stream. The bar, chips and empty state come from the
 * FilterBar kit; rows, section bars and the tint hover from the IndexTable kit. Server-safe (no
 * directive). Palette tokens only: kinds are told apart by words and position, never colour.
 *
 * A section shows only the columns that vary inside it (SECTION_COLUMNS): Writing has Where,
 * Video and Streams have Length, and every section ends on Date, so the dates line up down the
 * page. The one feed (the lab's alternative) keeps all five (FEED_COLUMNS).
 *
 * Every size answers to the shell's `page` container: a section's columns show from a 40rem
 * page (a phone's row is the still, the title, its notes and one meta line).
 */

import type { IndexColumn } from '@/components/console/index-table';
import type { FeedKind } from '../_lib/media-feed';

/** The island's root: the bar, the results header, then the sections. */
export const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-5';
/** One column of a media table: the kit's column, with an id the row knows how to fill. */
export type FeedColumn = IndexColumn & {
  readonly id: 'item' | 'kind' | 'where' | 'length' | 'date';
};

const TITLE = { id: 'item', label: 'Title' } as const satisfies FeedColumn;
const WHERE = {
  id: 'where',
  label: 'Where',
  priority: 1,
  width: 'w-[8.5rem] @min-[64rem]/page:w-[11rem]',
} as const satisfies FeedColumn;
// 7.5rem: a folded stream's total ("124 h 50 min") fits whole.
const LENGTH = {
  id: 'length',
  label: 'Length',
  align: 'end',
  priority: 1,
  width: 'w-[7.5rem]',
} as const satisfies FeedColumn;
// 8rem: "Nov 12, 2024" measured 92px in Linux Chromium, plus the cell's 24px padding. It wraps
// rather than cutting the year off with an ellipsis when a reader widens letter and word spacing
// (WCAG 1.4.12): at the browser's own spacing it still fits one line.
const DATE_FULL = {
  id: 'date',
  label: 'Date',
  align: 'end',
  priority: 1,
  width: 'w-[8rem]',
  sort: 'date',
  wrap: true,
} as const satisfies FeedColumn;

/**
 * Each section's columns: only what varies inside it. The kind is the section's heading, and
 * every video lives on YouTube, so neither is a column there.
 */
export const SECTION_COLUMNS = {
  post: [TITLE, WHERE, DATE_FULL],
  article: [TITLE, WHERE, DATE_FULL],
  video: [TITLE, LENGTH, DATE_FULL],
  stream: [TITLE, LENGTH, DATE_FULL],
  talk: [TITLE, WHERE, { ...LENGTH, priority: 2 }, DATE_FULL],
  presentation: [TITLE, WHERE, DATE_FULL],
} as const satisfies Readonly<Record<FeedKind, readonly FeedColumn[]>>;

/** The one feed's columns: Title, Kind, Where, Length and the day (its year bar holds the year). */
export const FEED_COLUMNS = [
  { id: 'item', label: 'Title' },
  { id: 'kind', label: 'Kind', priority: 1, width: 'w-[6.5rem] @min-[64rem]/page:w-[7.5rem]' },
  {
    id: 'where',
    label: 'Where',
    priority: 2,
    width: 'w-[8.5rem] @min-[64rem]/page:w-[11rem]',
  },
  // 7.5rem: a folded stream's total ("124 h 50 min") fits whole.
  { id: 'length', label: 'Length', align: 'end', priority: 2, width: 'w-[7.5rem]' },
  // The day ("Dec 29") wraps, as DATE_FULL does, rather than losing its number to an ellipsis
  // when a reader widens letter and word spacing (WCAG 1.4.12).
  {
    id: 'date',
    label: 'Date',
    align: 'end',
    priority: 1,
    width: 'w-[5rem]',
    sort: 'date',
    wrap: true,
  },
] as const satisfies readonly FeedColumn[];

/**
 * The title cell's insides: the still beside the text, which takes the rest. They pad themselves
 * at every width (8px on a phone, 9.5px from a 40rem page), because a row grows with what it
 * holds: a title that wraps, a summary, a "see also" line. 9.5px keeps a plain row the kit's
 * 64px: the 45px still and one title line over one "see also" line (20 + 24) both fit inside
 * it. Anything more makes the row taller instead of running into the rows around it. With its
 * parts open, the still stays up beside the title instead of centring in a tall row.
 */
export const ITEM_CLASS =
  'flex min-w-0 items-center gap-3 py-2 has-[details[open]]:items-start @min-[40rem]/page:gap-3.5 @min-[40rem]/page:py-[0.59375rem]';
/** The title cell of a row whose parts are open: aligned to the top; its insides pad themselves. */
export const OPEN_ROW_ITEM_CELL_CLASS = '[tr:has(details[open])_&]:align-top';
/**
 * Every other cell of a row whose parts are open: aligned to the top, on the line the title
 * keeps (10px down, beside the title cell's own padding).
 */
export const OPEN_ROW_CELL_CLASS =
  '[tr:has(details[open])_&]:align-top @min-[40rem]/page:[tr:has(details[open])_&]:pt-2.5';
export const ITEM_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col';
export const TITLE_LINE_CLASS = 'flex min-w-0 items-center';
/** The title link's insides: the title is cut, never its new-tab arrow or play mark. */
export const TITLE_LINK_CLASS = 'inline-flex max-w-full items-center gap-1 align-bottom';
/**
 * The title wraps and is never cut, at any width: rows of one series ("... - Project 11 - ...")
 * can then be told apart on a touch screen, which has no hover to read a title attribute with,
 * and a tablet's narrow column shows its long titles whole. The row grows with it, and a long
 * unbroken word wraps inside the cell.
 */
export const TITLE_TEXT_CLASS = 'min-w-0 whitespace-normal wrap-break-word';
/**
 * A title's own part marker ("(Part 2/2)"): one piece of text that never breaks inside, so a
 * narrow line breaks before it instead of leaving "(Part" on one line and "2/2)" on the next.
 */
export const TITLE_MARKER_CLASS = 'whitespace-nowrap';
/** The arrow or play mark after a title: faint, brand-ink with its row. */
export const TITLE_MARK_CLASS =
  'flex-none text-faint transition-colors duration-(--motion-base) ease-effect group-hover/row:text-brand-ink group-hover/row:duration-(--motion-instant)';
/**
 * The new-tab arrow inside the title's own run of text (glued to its last word by the kit's word
 * joiner, so a wrapped title ends with it): faint, brand-ink with its row.
 */
export const TITLE_ARROW_CLASS =
  'text-faint transition-colors duration-(--motion-base) ease-effect group-hover/row:text-brand-ink group-hover/row:duration-(--motion-instant)';

/**
 * A row's "see also" line, under its title: the words "See also", then the list of what the row
 * points at. Two boxes side by side that never wrap as a pair: the words keep their width and the
 * list takes the rest, so a reference too long for the line wraps inside the list, beside the
 * words, instead of moving under them and leaving them alone on a line. No layer of its own (see
 * the list).
 *
 * It starts 2px under the line above it and gives those 2px back below (the negative margin), so
 * a row is exactly as tall as without them: a focused reference's ring (SEE_LINK_CLASS) then ends
 * where the line above does, instead of inside its words.
 */
export const SEE_LINE_CLASS =
  'mt-0.5 -mb-0.5 flex min-w-0 items-start gap-x-3 tile-meta text-muted-foreground';
/**
 * The list of what a row points at (its other version, its series, its project, its topics). It
 * wraps at every width, so nothing in it is ever pushed out of the row; each line is the links'
 * own 24px. The list is no layer of its own: only its links sit above the row's stretched link,
 * so the gaps between them still open the row. Two lines of it stand 4px apart, so two references
 * that wrap under each other read as two, not as one underlined block. On a touch screen they
 * stand 8px apart: each link's hit area reaches 4px past its box (SEE_LINK_CLASS), so the areas
 * of two stacked links meet instead of the lower one covering the upper one's underline.
 */
export const SEE_ALSO_CLASS =
  'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pointer-coarse:gap-y-2';
/**
 * The words "See also" before the list: faint, on the first line of references (the links' own
 * 24px), and unspoken (the list is named by them). Under a 40rem page they are left out: a
 * phone's text column is about 200px, where they took a line of their own on most rows, and every
 * reference opens with its own label there ("Project:", "Series:", "Video version").
 */
export const SEE_LEAD_CLASS =
  'inline-flex min-h-6 flex-none items-center text-faint @max-[40rem]/page:hidden';
/** One reference; a topic group lays its links out the same way (4px between lines, 8 on touch). */
export const SEE_ITEM_CLASS =
  'flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 pointer-coarse:gap-y-2';
/**
 * A reference: a link that looks like one. Brand ink with a thin underline in the brand rim that
 * turns full ink when pointed at or focused, where the title above it is plain ink and the
 * summary and dates are grey. Above the row's stretched link (so it keeps its own click), a 24px
 * target, never wider than the line. On a touch screen its hit area reaches a little past its box
 * (an invisible ::after: 4px above and below, 8px either side), so a finger meant for it does not
 * open the row; no further, because the title's last line sits right above it. Nothing moves or
 * scales.
 *
 * Focused from the keyboard, its ring is drawn by a box laid over it (::before, which takes no
 * click and no room): as tall as the link's 24px, which already stands 3px clear of its words,
 * and 2px wider either side, as the base ring is. The base ring's 2px offset above the link
 * reached into the summary or meta line there.
 */
export const SEE_LINK_CLASS =
  "group/see relative z-[1] inline-flex min-h-6 min-w-0 max-w-full items-center gap-0.5 rounded-sm text-brand-ink no-underline before:pointer-events-none before:absolute before:-inset-x-0.5 before:inset-y-0 before:rounded-sm before:content-[''] focus-visible:outline-none focus-visible:before:outline-2 focus-visible:before:outline-(--focus) pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-1 pointer-coarse:after:content-[''] @min-[40rem]/page:max-w-[28rem]";
/** A reference's underline: thin, in the brand rim, full ink when pointed at or focused. */
const SEE_UNDERLINE_CLASS =
  'underline decoration-(--brand-rim) decoration-1 underline-offset-[3px] transition-[text-decoration-color] duration-(--motion-fast) ease-effect group-hover/see:decoration-current group-focus-visible/see:decoration-current';
/**
 * A reference's words: underlined, and never cut at any width. A pair's title, a project, a
 * series, a topic and "Show all" wrap when the line is too short for them, so a long name is read
 * whole on a tablet's narrow column too, where a touch screen has no hover to read a cut name
 * with.
 */
export const SEE_TEXT_CLASS = `min-w-0 whitespace-normal wrap-break-word ${SEE_UNDERLINE_CLASS}`;
/**
 * A row's place in its series said as text ("Upload 3 of 27"), where a link to the series would
 * lead nowhere new: quiet, on the references' own 24px, so the row is as tall as with the link.
 */
export const SEE_PLACE_CLASS = 'inline-flex min-h-6 items-center tile-meta text-muted-foreground';
/**
 * The other piece's title after "Video version": on a phone it is left to screen readers (the
 * label alone is the link there), from a 40rem page it shows.
 */
export const SEE_NAME_CLASS = '@max-[40rem]/page:sr-only';
/** The word "Topics:" before a row's topic links. */
export const SEE_LABEL_CLASS = 'flex-none text-muted-foreground';
/** "proposed", after a project the map only proposes (the lab): faint, not part of the underline. */
export const SEE_PROPOSED_CLASS = 'ml-1 flex-none text-faint';

/**
 * The line that closes a long series' rows when only its newest uploads are listed: how many
 * more there are, and the link to all of them. Indented to the titles (past the still), quiet,
 * with no tint: it is not a row of the list. Where the link wraps under the count (a phone, a
 * tablet) it stands 2px below it, which is how far its focus ring reaches.
 */
export const MORE_CELL_CLASS =
  'px-2 pt-1 pb-3 tile-meta text-muted-foreground whitespace-normal @min-[40rem]/page:px-3';
export const MORE_LINE_CLASS =
  'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pl-19 @min-[40rem]/page:pl-[5.875rem]';

/**
 * The still: 16:9 on surface-2, a hairline drawn over the image (an inset shadow under an image
 * would be covered), which turns brand ink with its row on the kit's spring (opaque: the
 * translucent brand edge dissolves over image pixels). Nothing scales: the row's tint and this
 * edge are the whole hover. A block, so it keeps its box inside a stack as well as in the row.
 */
export const THUMB_CLASS =
  "relative isolate block aspect-video w-16 flex-none overflow-hidden rounded-md bg-surface-2 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--hairline)] after:transition-[box-shadow] after:duration-(--motion-spring-out) after:ease-spring after:content-[''] group-hover/row:after:shadow-[inset_0_0_0_1px_var(--brand-ink)] group-hover/row:after:duration-(--motion-spring-in) group-focus-within/row:after:shadow-[inset_0_0_0_1px_var(--brand-ink)] @min-[40rem]/page:w-20";
/** A folded stream's still: a second frame peeks out behind it, so it reads as a stack. */
export const THUMB_STACK_CLASS =
  "relative block flex-none before:absolute before:inset-0 before:translate-x-[3px] before:-translate-y-[3px] before:rounded-md before:bg-surface-3 before:shadow-[inset_0_0_0_1px_var(--hairline)] before:content-['']";
export const THUMB_IMAGE_CLASS = 'size-full object-cover';
/** A still without an image: the kind's glyph, faint, on surface-2. */
export const THUMB_GLYPH_CLASS = 'absolute inset-0 m-auto size-4 text-faint';
/** The number of parts on a stack's still, bottom right, on solid canvas (no tinted text). */
export const THUMB_COUNT_CLASS =
  'absolute right-1 bottom-1 z-[1] rounded-[0.3125rem] bg-canvas px-1 text-[0.625rem] font-medium leading-4 tabular-nums text-foreground';
/** The play mark on a video's still when it plays in place: a small disc, centred. */
export const THUMB_PLAY_CLASS =
  'absolute inset-0 z-[1] m-auto grid size-6 place-items-center rounded-full bg-canvas text-foreground shadow-[inset_0_0_0_1px_var(--hairline-strong)]';

/**
 * A folded stream's parts: a disclosure under the title (above the row's stretched link, so it
 * keeps its own click), closed by default. Open, the parts wrap as small links, oldest first.
 * The summary is a 24px target (the row's link lies all around it) and, focused, scrolls clear
 * of the sticky bar, year and column labels as the kit's links do (the kit's row gives it the
 * scroll margin).
 */
export const PARTS_CLASS = 'relative z-[1] min-w-0 [&[open]]:pb-2';
export const PARTS_SUMMARY_CLASS =
  'inline-flex min-h-6 max-w-full cursor-pointer list-none items-center gap-1.5 rounded-sm tile-meta text-muted-foreground transition-colors duration-(--motion-fast) ease-effect hover:text-foreground [&::-webkit-details-marker]:hidden';
export const PARTS_CHEVRON_CLASS =
  'size-3 flex-none transition-transform duration-(--motion-spring-out) ease-spring [[open]>summary_&]:rotate-90 motion-reduce:transition-none';
export const PARTS_LIST_CLASS = 'mt-2 flex flex-wrap gap-1.5 whitespace-normal';
export const PART_LINK_CLASS =
  'inline-flex h-7 items-center gap-1.5 rounded-md px-2 tile-meta tabular-nums text-muted-foreground no-underline shadow-[inset_0_0_0_1px_var(--hairline)] transition-[color,background-color,box-shadow] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground hover:shadow-[inset_0_0_0_1px_var(--hairline-strong)]';
export const PART_LENGTH_CLASS = 'text-faint';
/** "27 parts · Aug 24 – Dec 30": one line; on a phone it may break, but only before the range. */
export const PARTS_LINE_CLASS = 'min-w-0 truncate @max-[40rem]/page:whitespace-normal';
export const PARTS_RANGE_CLASS = 'whitespace-nowrap';
/** A part the search matched (on its <li>): its link in full ink with a brand edge. */
export const PART_MATCH_CLASS =
  '[&>a]:text-foreground [&>a]:shadow-[inset_0_0_0_1px_var(--brand)] [&>a:hover]:shadow-[inset_0_0_0_1px_var(--brand-ink)]';

/** The line naming sources that could not load: quiet, above the bar. */
export const MISSING_CLASS = 'flex items-center gap-2 tile-meta text-muted-foreground';
