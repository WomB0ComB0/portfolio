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
 * @file The Ledger's layout classes, shared by the server rows and the filter island.
 *
 * Every size answers to the shell's `page` container (`@container/page` on main), never the
 * viewport: the table shows from a 40rem page (a phone gets one line per certificate), the
 * toolbar's chips wrap and the Verify column's ID shows from 48rem (below it the toolbar is one
 * row that scrolls sideways), the featured grid from 48rem. Type is the refined set from
 * globals.css (tile-*, mono-token for credential IDs only), each paired with a token colour.
 * Tailwind reads class names from source, so each one is written out whole.
 */

/** The island's root: toolbar, skill line, then the years. */
export const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-6';

/**
 * Search then chips. Below a 48rem page they share one row that scrolls sideways inside itself,
 * bleeding to the screen's edges (never the page); 4px of padding keeps the focus rings inside
 * the scroller. From 48rem the chips wrap beside the search, top-aligned, so the search stays
 * level with the first row of chips however many rows there are.
 */
export const TOOLBAR_CLASS =
  '-mx-(--page-gutter) -my-1 flex items-center gap-1.5 overflow-x-auto px-(--page-gutter) py-1 [scrollbar-width:none] @min-[48rem]/page:mx-0 @min-[48rem]/page:items-start @min-[48rem]/page:gap-4 @min-[48rem]/page:overflow-visible @min-[48rem]/page:px-0';

/**
 * The search slot: a pill in the scrolling row, then a 12rem field (10rem at least) that leaves
 * the chips the rest of the line.
 */
export const SEARCH_SLOT_CLASS =
  'h-8 w-44 flex-none @min-[48rem]/page:h-10 @min-[48rem]/page:w-auto @min-[48rem]/page:min-w-40 @min-[48rem]/page:flex-[0_1_12rem]';
export const SEARCH_FIELD_CLASS =
  'flex h-full items-center gap-2 rounded-full border border-hairline bg-surface-1 px-3 text-faint focus-within:border-hairline-strong focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus @min-[48rem]/page:rounded-lg';
/** 16px while it is a pill (phones and small tablets), so focusing the field never zooms. */
export const SEARCH_INPUT_CLASS =
  'min-w-0 flex-1 bg-transparent tile-sub text-foreground outline-none placeholder:text-faint @max-[48rem]/page:text-[1rem] [&::-webkit-search-cancel-button]:cursor-pointer';

/** From 48rem, 4px above and below centre the first 32px row of chips on the 40px search. */
export const CHIP_LIST_CLASS =
  'flex flex-none gap-1.5 @min-[48rem]/page:min-w-0 @min-[48rem]/page:flex-1 @min-[48rem]/page:flex-wrap @min-[48rem]/page:py-1';
/**
 * A chip. Current: the brand-subtle fill. Forced colours repaint fills and borders with system
 * colours, which would leave the current chip looking like the rest, so there it takes the
 * system's selected colours (Highlight, HighlightText) and a CanvasText focus ring.
 */
export const CHIP_CLASS =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground hover:border-hairline-strong hover:text-foreground motion-safe:transition-colors aria-[current=true]:border-(--brand-edge) aria-[current=true]:bg-brand-subtle aria-[current=true]:text-foreground forced-colors:aria-[current=true]:[forced-color-adjust:none] forced-colors:aria-[current=true]:border-[color:Highlight] forced-colors:aria-[current=true]:bg-[color:Highlight] forced-colors:aria-[current=true]:text-[color:HighlightText] forced-colors:aria-[current=true]:outline-[color:CanvasText]';
/**
 * A chip's count: faint, and muted on the current chip, where faint on the brand-subtle fill is
 * 4.27:1 (muted: 5.98:1). In forced colours it follows the current chip's HighlightText.
 */
export const CHIP_COUNT_CLASS =
  'tabular-nums text-faint [[aria-current=true]_&]:text-muted-foreground forced-colors:[[aria-current=true]_&]:text-[color:HighlightText]';

/** A year's heading: the year, then its count, over a strong hairline. */
export const YEAR_HEAD_CLASS =
  'flex items-baseline gap-2.5 border-b border-hairline-strong pb-1.5 tile-title text-foreground';
export const YEAR_COUNT_CLASS = 'tile-meta text-muted-foreground';

export const TABLE_CLASS = 'w-full table-fixed border-collapse';
/** Columns past the first exist from a 40rem page; on a phone the row is one cell. */
export const ISSUER_COL_CLASS =
  'hidden w-[9.5rem] @min-[40rem]/page:table-column @min-[64rem]/page:w-[13rem]';
export const ISSUED_COL_CLASS = 'hidden w-[5.5rem] @min-[40rem]/page:table-column';
/** Wide enough from 48rem for the host and some of the credential ID. */
export const VERIFY_COL_CLASS =
  'hidden w-[9.5rem] @min-[40rem]/page:table-column @min-[48rem]/page:w-[13rem] @min-[64rem]/page:w-[16rem]';
export const THEAD_CLASS = 'hidden @min-[40rem]/page:table-header-group';
export const TH_CLASS = 'px-3 pt-2 pb-1 text-left align-bottom tile-meta text-faint';
/**
 * The column headers of every year after the first: shown once, under the first year, as in the
 * lab, yet kept for screen readers in each table. Hidden inside the table's own layout (a 1px
 * row, its text clipped away), not with sr-only: an absolutely positioned cell drops out of
 * some browsers' table models, and the column would lose its header.
 */
export const TH_HIDDEN_CLASS =
  'h-px overflow-hidden whitespace-nowrap p-0 text-left leading-0 [clip-path:inset(50%)]';

export const ROW_CLASS =
  'border-b border-hairline align-top motion-safe:transition-colors @min-[40rem]/page:hover:bg-surface-1';
/**
 * The title cell sets its own type (tile-sub), so its line box is the title's 20px and not the
 * body's 26px strut: an inline link cannot make the line it sits in shorter than its block's.
 */
export const TITLE_CELL_CLASS = 'py-2 tile-sub @min-[40rem]/page:px-3 @min-[40rem]/page:py-1.5';
/** Issuer, Issued and Verify: on the title's 20px line, hidden on a phone. */
export const DESKTOP_CELL_CLASS =
  'hidden px-3 py-1.5 tile-meta leading-5 text-muted-foreground @min-[40rem]/page:table-cell';

/**
 * Verify: the host link keeps its width while it fits (only its text truncates, never its
 * new-tab arrow), and the credential ID takes what is left, with an ellipsis, from 48rem.
 */
export const VERIFY_CLASS = 'flex min-w-0 items-baseline gap-2';
export const HOST_LINK_CLASS =
  'inline-flex min-w-0 items-baseline text-brand-ink underline-offset-4 hover:underline';
export const HOST_TEXT_CLASS = 'min-w-0 truncate';
export const ID_CLASS =
  'hidden min-w-0 flex-1 truncate mono-token text-faint @min-[48rem]/page:block';

/** An empty list's designed state: no certificates at all, or none that match the filters. */
export const EMPTY_CLASS =
  'flex flex-col items-start gap-2 rounded-tile border border-dashed border-hairline-strong px-5 py-8';
