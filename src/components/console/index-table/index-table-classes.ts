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
 * @file The IndexTable kit's columns-as-data and every class it draws with. No directive: server
 * rows import it. Palette only (canvas, surface-1, hairlines, the text tiers, brand-ink for the
 * row's hover and focus); refined type.
 *
 * Two styles share the markup, keyed by the table's data-variant:
 * - `ledger` (style 1, /certifications): hairline rules between rows, 40px rows.
 * - `open` (style 2, /projects): no rules between rows and 64px rows for a second line under
 *   the title (INDEX_SUB_CLASS); the year bar carries the only rule and the hover tint tracks
 *   the row.
 * On a page under 40rem every style is one cell and a meta line, 60px a row.
 *
 * The year bar is the h2 (sticky under the filter bar's --filter-bar-h) and the column labels
 * (sticky 2.5rem lower, the h2's own height), both above the edge haze (z-20) and under the filter
 * bar (z-30), painted on the canvas only while stuck (globals.css stuck-canvas). The labels'
 * sticky box is the table and the h2's is the section, so at a year's end the labels start to
 * leave 2rem before the h2 does: one z lower (24 to 25), they slide under the year bar instead of
 * over its year, and both leave with the last row.
 */

/** Text left, numbers and dates right. */
export type IndexAlign = 'start' | 'end';
/** 0: always. 1: from a 40rem page. 2: from a 48rem page. */
export type IndexPriority = 0 | 1 | 2;
export type IndexVariant = 'ledger' | 'open';

/** One column, as data: redesigning a table means editing its columns, not class strings. */
export interface IndexColumn {
  readonly id: string;
  readonly label: string;
  readonly align?: IndexAlign;
  readonly priority?: IndexPriority;
  /** The <col>'s width classes, written out whole (Tailwind reads them from source). */
  readonly width?: string;
  /** Sortable, and how: kept as data for a later sortable style; no header sorts yet. */
  readonly sort?: 'text' | 'date' | 'number';
}

const COL_PRIORITY: Readonly<Record<IndexPriority, string>> = {
  0: '',
  1: 'hidden @min-[40rem]/page:table-column',
  2: 'hidden @min-[48rem]/page:table-column',
};
const CELL_PRIORITY: Readonly<Record<IndexPriority, string>> = {
  0: '',
  1: 'hidden @min-[40rem]/page:table-cell',
  2: 'hidden @min-[48rem]/page:table-cell',
};
const ALIGN: Readonly<Record<IndexAlign, string>> = { start: 'text-left', end: 'text-right' };

/** The year groups, newest first, with room between them. */
export const INDEX_GROUPS_CLASS = 'flex min-w-0 flex-col gap-8';
/** A year: no bottom padding, so the sticky h2 leaves with the last row. */
export const INDEX_GROUP_CLASS = 'flex min-w-0 flex-col';

/** The year bar's first line: the year (20px/600) and its count. */
export const INDEX_YEAR_CLASS =
  'sticky top-[calc(env(safe-area-inset-top,0px)+var(--filter-bar-h,0px))] z-[25] flex h-10 items-end gap-2.5 stuck-canvas px-2 pb-1 @max-[40rem]/page:border-b @max-[40rem]/page:border-hairline-strong @min-[40rem]/page:px-3';
export const INDEX_YEAR_NUMBER_CLASS = 'tile-title-lg tabular-nums text-foreground';
export const INDEX_YEAR_COUNT_CLASS = 'tile-meta text-faint';

export const INDEX_TABLE_CLASS = 'w-full table-fixed border-separate border-spacing-0';
/** Labels show from a 40rem page; a phone's rows are one cell and a meta line. */
export const INDEX_THEAD_CLASS = 'hidden @min-[40rem]/page:table-header-group';
/** A column label: sticky right under the year (and one z under it), over a strong hairline. */
export const INDEX_TH_CLASS =
  'sticky top-[calc(env(safe-area-inset-top,0px)+var(--filter-bar-h,0px)+2.5rem)] z-[24] h-8 overflow-hidden text-ellipsis whitespace-nowrap border-b border-hairline-strong stuck-canvas px-3 pt-1 pb-2 align-bottom tile-label text-faint';

/**
 * A row. The stretched title link's box (relative, plus a transform: Safari ignores position on
 * <tr>). The tint: surface-1 in over --motion-instant, out over --motion-base, on --ease-effect;
 * nothing moves, nothing is coloured. Keyboard focus anywhere in the row tints it too. A row
 * scrolled into view stops clear of the sticky bars: html's scroll-padding already clears the edge
 * haze, so the margin adds only what the filter bar, year bar and labels cover past it. A Tab or
 * Shift+Tab scrolls by the focused link's or button's own margin, never its row's, so they carry
 * it too.
 */
export const INDEX_ROW_CLASS =
  'group/row relative [transform:translate(0)] h-10 scroll-mt-[max(0px,calc(var(--filter-bar-h,0px)+4.5rem-var(--edge-haze-top,0px)))] [&_:is(a,button)]:scroll-mt-[max(0px,calc(var(--filter-bar-h,0px)+4.5rem-var(--edge-haze-top,0px)))] transition-[background-color] duration-(--motion-base) ease-effect hover:bg-surface-1 hover:duration-(--motion-instant) focus-within:bg-surface-1 [[data-variant=open]_&]:h-16 @max-[40rem]/page:h-15 @max-[40rem]/page:[[data-variant=open]_&]:h-15';

/** Every cell: one line, never wrapping; ledger rows are ruled, open ones are not. */
const CELL_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap border-b border-hairline px-2 py-0 align-middle tile-sub text-muted-foreground [[data-variant=open]_&]:border-b-0 @min-[40rem]/page:px-3';

/** A secondary action (Copy ID, Code, Live): above the stretched link, so it keeps its own click. */
export const INDEX_ACTION_CLASS =
  'relative z-[1] inline-flex h-7 items-center justify-center rounded-md px-2 tile-meta text-faint transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground data-done:text-brand-ink';

/** The Copy ID action: the word "ID" in the mono token, one fixed width whatever it shows. */
export const INDEX_COPY_CLASS =
  'relative z-[1] inline-flex h-7 w-9 items-center justify-center rounded-md mono-token text-faint transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground data-done:text-brand-ink';

/** The title link: stretched over its row, brand-ink while the row is hovered. */
export const INDEX_TITLE_LINK_CLASS =
  "min-w-0 truncate font-medium text-foreground transition-colors duration-(--motion-base) ease-effect after:absolute after:inset-0 after:content-[''] group-hover/row:text-brand-ink group-hover/row:duration-(--motion-instant)";
/** A title without a link. */
export const INDEX_TITLE_TEXT_CLASS = 'min-w-0 truncate font-medium text-foreground';
/** Quiet text that turns brand-ink with its row (the Verify platform). */
export const INDEX_ROW_INK_CLASS =
  'text-muted-foreground transition-colors duration-(--motion-base) ease-effect group-hover/row:text-brand-ink group-hover/row:duration-(--motion-instant) group-focus-within/row:text-brand-ink';
/** The phone's meta line under the title. */
export const INDEX_META_CLASS =
  'mt-0.5 block truncate tile-meta text-muted-foreground @min-[40rem]/page:hidden';
/** An open row's second line under the title (a summary): from a 40rem page, one line. */
export const INDEX_SUB_CLASS =
  'mt-0.5 hidden truncate tile-meta text-muted-foreground @min-[40rem]/page:block';

/** A <col>'s classes. */
export const indexColClass = ({ priority = 0, width = '' }: IndexColumn): string =>
  [width, COL_PRIORITY[priority]].filter(Boolean).join(' ');

/** A column label's classes. */
export const indexHeaderClass = ({ align = 'start', priority = 0 }: IndexColumn): string =>
  [INDEX_TH_CLASS, ALIGN[align], CELL_PRIORITY[priority]].filter(Boolean).join(' ');

/** A body cell's classes for its column. */
export const indexCellClass = ({ align = 'start', priority = 0 }: IndexColumn): string =>
  [CELL_CLASS, ALIGN[align], CELL_PRIORITY[priority]].filter(Boolean).join(' ');
