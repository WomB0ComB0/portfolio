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
 * @file Every visual decision of the FilterBar family, as whole Tailwind class strings (Tailwind
 * reads class names from source). No directive, so a server skeleton imports these instead of
 * copying them. Palette only: surfaces, hairlines, the three text tiers, brand-subtle and
 * --brand-edge for the current chip, brand-ink for Clear. No glass, no white alphas, no red, no
 * per-kind colours. Refined type (tile-*): no capitals, weights at most 600, nothing under 12px.
 *
 * Sizes answer to the shell's `page` container, never the viewport. Below a 48rem page the bar
 * is the search field and a Filters button; the facets open as a bottom sheet. From 48rem the
 * sheet is laid out inline (display: contents), so the chips sit beside the search.
 *
 * Motion: colours fade on --ease-effect over --motion-fast; the current-chip pill slides on
 * clip-path over --motion-spring-in on --ease-spring; the sheet rises on translate. The global
 * reduced-motion rule (globals.css) cuts every one of them to 1ms.
 */

/**
 * The island's root around a FilterBar and its results. It holds the bar's height for the sticky
 * year bars below it (FilterBar.Root measures it; these are the values before it has, and
 * without JavaScript): 3.5rem on a phone (a 40px field and 8px above and below), 4rem from 48rem.
 */
export const FILTER_SCOPE_CLASS = '[--filter-bar-h:3.5rem] @min-[48rem]/page:[--filter-bar-h:4rem]';

/** The <search> landmark. */
export const BAR_CLASS = 'block min-w-0';
/**
 * Sticky: under the top edge, above the edge haze (z-20) and below the rail's flyouts (z-40). The
 * column's width, as the year bars and labels under it are, so stuck they read as one bar. Painted
 * (the canvas and a hairline under it) only while stuck (globals.css stuck-canvas): at rest the
 * page's glow shows through.
 */
export const BAR_STICKY_CLASS =
  'sticky top-[env(safe-area-inset-top,0px)] z-30 stuck-canvas py-2 [--stuck-edge:0_1px_0_var(--hairline)] @min-[48rem]/page:py-3';

/** The form: one row. From 48rem the search keeps its width and the chips take the rest. */
export const FORM_ROW_CLASS =
  'flex min-w-0 items-center gap-2 @min-[48rem]/page:items-start @min-[48rem]/page:gap-4';
/** `bar` density (/places): the same row on a surface-1 tile. */
export const FORM_TILE_CLASS =
  'flex min-w-0 items-center gap-2 rounded-tile border border-hairline bg-surface-1 p-2 shadow-tile @min-[48rem]/page:items-start @min-[48rem]/page:gap-3 @min-[48rem]/page:p-3';

export const SEARCH_SLOT_CLASS =
  'h-10 min-w-0 flex-1 @min-[48rem]/page:min-w-40 @min-[48rem]/page:flex-[0_1_12rem]';
export const SEARCH_FIELD_CLASS =
  'flex h-full items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-3 text-faint transition-[border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong focus-within:border-hairline-strong focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus [[data-density=bar]_&]:bg-canvas';
/** 16px below 48rem, so focusing the field never zooms an iPhone. */
export const SEARCH_INPUT_CLASS =
  'min-w-0 flex-1 bg-transparent tile-sub text-foreground outline-none placeholder:text-faint @max-[48rem]/page:text-[1rem] [&::-webkit-search-cancel-button]:cursor-pointer';

/** The phone's Filters button: hidden from 48rem, where the facets sit in the bar. */
export const FILTERS_BUTTON_CLASS =
  'inline-flex h-10 flex-none items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-[color,background-color,border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong hover:text-foreground data-active:border-(--brand-edge) data-active:bg-brand-subtle data-active:text-foreground @min-[48rem]/page:hidden';
export const BUTTON_COUNT_CLASS = 'tabular-nums text-muted-foreground';

/**
 * The facets. Below 48rem a bottom sheet (a popover: closed it is display: none, opened it rises
 * on translate); from 48rem `contents`, so its children sit in the bar's row.
 */
export const SHEET_CLASS =
  'fixed inset-x-0 top-auto bottom-0 m-0 max-h-[min(75dvh,36rem)] w-full max-w-none flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-0 border-t border-hairline-strong bg-surface-1 px-(--page-gutter) pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-raised transition-[translate,display,overlay] transition-discrete duration-(--motion-spring-in) ease-spring open:flex not-open:translate-y-full starting:open:translate-y-full backdrop:bg-[oklch(from_var(--canvas)_l_c_h/70%)] @min-[48rem]/page:contents';
export const SHEET_FOOT_CLASS = 'flex justify-end pt-1 @min-[48rem]/page:hidden';
export const SHEET_DONE_CLASS =
  'inline-flex h-10 items-center rounded-lg border border-hairline-strong bg-surface-2 px-4 tile-label text-foreground transition-[border-color] duration-(--motion-fast) ease-effect hover:border-(--brand-edge)';
/** A facet's name over its options in the sheet; from 48rem the list's own label names it. */
export const SHEET_LABEL_CLASS = 'tile-label text-muted-foreground @min-[48rem]/page:hidden';

/** A chip set. From 48rem, 4px above and below centre its first 32px row on the 40px search. */
export const CHIPS_SLOT_CLASS =
  'flex flex-col gap-2 @min-[48rem]/page:min-w-0 @min-[48rem]/page:flex-1 @min-[48rem]/page:py-1';
/** Chips that wrap (the sheet, and the bar from 48rem). */
export const CHIP_LIST_CLASS = 'relative isolate flex flex-wrap gap-1.5';
/**
 * Chips that wrap in the sheet and, from 48rem, sit on one line that scrolls sideways inside
 * itself (`scroll` layout, /projects). The scroller clips at its padding box, so it keeps 4px on
 * every side for a focused chip's ring (a 2px outline at a 2px offset), with a matching negative
 * margin so the chips sit where 2px of padding put them. With no scrollbar, the cue that it
 * scrolls is a fade over each end that has chips past it (data-overflow, set by FilterBar.Chips):
 * a mask, so alpha only, never a colour.
 */
export const CHIP_LIST_SCROLL_CLASS =
  'relative isolate flex flex-wrap gap-1.5 [scrollbar-width:none] @min-[48rem]/page:-m-0.5 @min-[48rem]/page:flex-nowrap @min-[48rem]/page:overflow-x-auto @min-[48rem]/page:p-1 data-[overflow=end]:[mask-image:linear-gradient(to_right,#000_calc(100%_-_1.5rem),transparent)] data-[overflow=start]:[mask-image:linear-gradient(to_right,transparent,#000_1.5rem)] data-[overflow=both]:[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%_-_1.5rem),transparent)]';

/**
 * A chip, a link. Current: the brand-subtle fill with the brand edge, until the pill has
 * measured and draws it instead (CHIP_CURRENT_FILL_CLASS is then left off). Forced colours repaint
 * fills and borders with system colours, which would leave the current chip looking like the
 * rest, so there it takes the system's selected colours (Highlight, HighlightText) and a
 * CanvasText focus ring. A chip at 0 stays where it is and works, only quieter. A focused chip
 * rises over the pill so its ring shows.
 */
export const CHIP_CLASS =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-[color,background-color,border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong hover:text-foreground focus-visible:relative focus-visible:z-[3] data-zero:text-faint aria-[current=true]:text-foreground forced-colors:aria-[current=true]:[forced-color-adjust:none] forced-colors:aria-[current=true]:border-[color:Highlight] forced-colors:aria-[current=true]:bg-[color:Highlight] forced-colors:aria-[current=true]:text-[color:HighlightText] forced-colors:aria-[current=true]:outline-[color:CanvasText]';
/** The current chip's own fill: before the pill measures, without JavaScript, and in forced colours. */
export const CHIP_CURRENT_FILL_CLASS =
  'aria-[current=true]:border-(--brand-edge) aria-[current=true]:bg-brand-subtle';
/** In pill mode the current chip lets the pill show through. */
export const CHIP_PILL_MODE_CLASS =
  'aria-[current=true]:border-transparent aria-[current=true]:bg-transparent forced-colors:aria-[current=true]:border-[color:Highlight] forced-colors:aria-[current=true]:bg-[color:Highlight]';
/** A chip's words sit above the pill. */
export const CHIP_LABEL_CLASS = 'relative z-[2]';
/**
 * A chip's count: faint, and muted on the current chip, where faint on the brand-subtle fill is
 * 4.27:1 (muted: 5.98:1). In forced colours it follows the current chip's HighlightText.
 */
export const CHIP_COUNT_CLASS =
  'relative z-[2] tabular-nums text-faint [[aria-current=true]_&]:text-muted-foreground forced-colors:[[aria-current=true]_&]:text-[color:HighlightText]';

/**
 * The current-chip pill: one layer the width of the chip row, clipped to the current chip
 * (clip-path inset, set from its measured box), with an inner layer 1px smaller for the brand
 * edge. It slides on clip-path alone: no width, no layout, no box-shadow. Hidden in forced colours,
 * where the chip keeps its own Highlight.
 */
export const PILL_CLASS =
  'pointer-events-none absolute top-0 left-0 z-[1] h-full w-(--pill-track,100%) opacity-0 [background:linear-gradient(var(--brand-edge),var(--brand-edge)),var(--brand-subtle)] [clip-path:inset(var(--pill-t,0)_var(--pill-r,100%)_var(--pill-b,0)_var(--pill-l,0)_round_9999px)] transition-[clip-path] duration-(--motion-spring-in) ease-spring before:absolute before:inset-0 before:bg-brand-subtle before:content-[""] before:[clip-path:inset(calc(var(--pill-t,0px)+1px)_calc(var(--pill-r,100%)+1px)_calc(var(--pill-b,0px)+1px)_calc(var(--pill-l,0px)+1px)_round_9999px)] before:transition-[clip-path] before:duration-(--motion-spring-in) before:ease-spring data-on:opacity-100 data-instant:transition-none data-instant:before:transition-none forced-colors:hidden';

/** The picker's trigger: a chip-shaped button, filled while any of its values is chosen. */
export const PICKER_BUTTON_CLASS =
  'hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-[color,background-color,border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong hover:text-foreground data-active:border-(--brand-edge) data-active:bg-brand-subtle data-active:text-foreground @min-[48rem]/page:inline-flex';
/**
 * The picker's panel. Below 48rem it is laid out inline in the sheet (a closed popover shown as a
 * block); from 48rem a real popover under its button (anchor positioning; centred where the
 * browser has none), closed until opened.
 */
export const PICKER_PANEL_CLASS =
  'static m-0 flex h-auto w-auto max-w-none flex-col gap-3 overflow-visible border-0 bg-transparent p-0 text-foreground @min-[48rem]/page:not-open:hidden @min-[48rem]/page:open:fixed @min-[48rem]/page:open:my-2 @min-[48rem]/page:open:max-h-[min(28rem,calc(100dvh-8rem))] @min-[48rem]/page:open:w-[min(30rem,calc(100vw-2rem))] @min-[48rem]/page:open:overflow-auto @min-[48rem]/page:open:overscroll-contain @min-[48rem]/page:open:rounded-tile @min-[48rem]/page:open:border @min-[48rem]/page:open:border-hairline-strong @min-[48rem]/page:open:bg-surface-1 @min-[48rem]/page:open:p-3.5 @min-[48rem]/page:open:shadow-raised @min-[48rem]/page:open:[position-area:block-end_span-inline-end] @min-[48rem]/page:open:[position-try-fallbacks:flip-inline,flip-block]';
export const PICKER_FIELDSET_CLASS = 'm-0 flex min-w-0 flex-col gap-2.5 border-0 p-0';
export const PICKER_LEGEND_CLASS = 'mb-2 p-0 tile-label text-foreground';
export const PICKER_TOOLS_CLASS = 'flex flex-wrap items-center gap-x-4 gap-y-2';
export const PICKER_FIELD_CLASS =
  'flex h-9 min-w-0 flex-[1_1_12rem] items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 text-faint focus-within:border-hairline-strong focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus';
export const PICKER_SHOWN_CLASS = 'tile-meta text-faint';
export const PICKER_OPTIONS_CLASS = 'flex flex-wrap gap-1.5 p-0.5';
/** A checkbox option, drawn as a chip; checked, it takes the current chip's fill. */
export const OPTION_CLASS =
  'relative inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-[color,background-color,border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong hover:text-foreground has-checked:border-(--brand-edge) has-checked:bg-brand-subtle has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus data-zero:text-faint forced-colors:has-checked:[forced-color-adjust:none] forced-colors:has-checked:bg-[color:Highlight] forced-colors:has-checked:text-[color:HighlightText]';
export const OPTION_INPUT_CLASS = 'absolute size-px opacity-0';
export const OPTION_COUNT_CLASS =
  'tabular-nums text-faint [:checked~&]:text-muted-foreground forced-colors:[:checked~&]:text-[color:HighlightText]';
export const PICKER_FOOT_CLASS = 'flex flex-wrap items-center justify-between gap-2';
export const TEXT_BUTTON_CLASS =
  'rounded-sm tile-meta text-brand-ink underline-offset-4 hover:underline';

/** The results header: the count, the applied tokens and Clear all, outside the sticky bar. */
export const RESULTS_HEAD_CLASS = 'flex min-h-7 min-w-0 flex-wrap items-center gap-x-4 gap-y-2';
export const COUNT_CLASS = 'whitespace-nowrap tile-meta text-muted-foreground';
export const COUNT_NUMBER_CLASS = 'font-semibold text-foreground';
export const APPLIED_CLASS = 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5';
export const APPLIED_LABEL_CLASS = 'tile-meta text-faint';
export const APPLIED_LIST_CLASS = 'flex min-w-0 flex-wrap items-center gap-1.5';
/** A removable token: surface-2, the × faint until hovered. */
export const TOKEN_CLASS =
  'group/token inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 pr-1.5 pl-2.5 tile-meta text-foreground transition-[border-color] duration-(--motion-fast) ease-effect hover:border-hairline-strong';
export const TOKEN_KEY_CLASS = 'text-muted-foreground';
export const TOKEN_X_CLASS =
  'size-3.5 text-faint transition-colors duration-(--motion-fast) ease-effect group-hover/token:text-foreground';
export const CLEAR_CLASS = 'rounded-sm tile-meta text-brand-ink underline-offset-4 hover:underline';

/** An empty list's designed state: nothing at all, or nothing the filters left. */
export const EMPTY_CLASS =
  'flex flex-col items-start gap-2 rounded-tile border border-dashed border-hairline-strong px-5 py-8';
export const EMPTY_TITLE_CLASS = 'tile-title text-foreground';
export const EMPTY_TEXT_CLASS = 'tile-sub text-muted-foreground';
export const EMPTY_CLEAR_CLASS = 'tile-label text-brand-ink underline-offset-4 hover:underline';

/** The results' box, which a discrete change crossfades. */
export const RESULTS_CLASS = 'flex min-w-0 flex-col';

/** A skeleton box: surface-1, still (a pulse under the haze would cost a blur every frame). */
export const SKELETON_BOX_CLASS = 'rounded-full border border-hairline bg-surface-1';
