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
 * @file The guestbook wall's classes, shared by the server rows and the client island.
 *
 * The wall is built in rows, not CSS columns: each year's notes wrap into rows that read left to
 * right, then down, in the server's newest-first order (the DOM, Tab and screen-reader order
 * too). Each note sits by its own length (noteTreatment), so no two neighbours need look alike:
 * - a sticker (a few words) is large type with no box, as wide as its words at its size;
 * - a tile (a sentence) is a quiet surface tile;
 * - a quote (longer feedback) is calm body text under a hanging quote mark, with no box.
 * Items keep their own height (items-start), so the rows are ragged like a real wall, never a
 * grid of equal boxes; a row's spare room goes mostly to tiles and quotes, and the list's ::after
 * takes the last row's, so the last row is never stretched. No script measures anything: the wall
 * is the same with JavaScript off, and nothing moves once it runs.
 *
 * On a phone a sticker takes at most two fifths of the row and a quote a little over half, so a
 * big word sits beside a paragraph and two short notes share a row: it still reads as a wall.
 * Every width has a rem floor, so enlarged text (browser text 200%) widens the notes and the rows
 * hold fewer. Sizes answer to the shell's `page` container, never the viewport. A sticker's size
 * is the smaller of a rem cap and its width over its widest word (--note-fit, widestWordUnits at
 * 0.6em a unit), so no word breaks inside itself at 320px or at 200% text. Type is the refined
 * set: Geist, sentence case, weights 400 to 600, tabular figures in the signature. Tailwind reads
 * class names from source, so each one is written out whole.
 */

import type { NoteScale, NoteTreatment } from '../_lib/wall';

/** The notes region: the stale or capped note, then the year chapters. */
export const LIST_SECTION_CLASS = 'flex min-w-0 flex-col gap-4';
export const LIST_NOTE_CLASS = 'max-w-[70ch] tile-sub text-muted-foreground';

/** One year's wall: wider gaps than boxes would need, since most notes have no box to hold them. */
export const WALL_CLASS =
  "flex flex-wrap items-start gap-x-3 gap-y-7 @min-[40rem]/page:gap-x-8 @min-[40rem]/page:gap-y-10 after:grow-[1000] after:basis-0 after:content-['']";

/** Every note: its words, then its signature; an inline-size container for the sticker's fit. */
const NOTE_BASE = 'flex min-w-0 flex-col @container';

const TREATMENT_CLASS = {
  sticker: 'gap-2 pt-0.5 @min-[40rem]/page:gap-2.5',
  /** surface-1 always carries a hairline (globals.css). */
  tile: 'gap-3 rounded-tile border border-hairline bg-surface-1 px-3.5 pt-3 pb-3 @min-[40rem]/page:gap-4 @min-[40rem]/page:px-4 @min-[40rem]/page:pt-3.5',
  /**
   * Room on the left for the hanging quote mark (QUOTE_MARK_CLASS). On a page under 20rem (a
   * phone with enlarged text) the mark sits over the text instead, so the text keeps the whole
   * width and a long piece of an address ('contrastchecker/)') breaks inside itself as little
   * as it can.
   */
  quote:
    'relative gap-2.5 pl-6 @max-[20rem]/page:pl-0 @min-[40rem]/page:gap-3 @min-[40rem]/page:pl-8',
} as const satisfies Record<NoteTreatment, string>;

/**
 * A sticker's width: as wide as its words on one line at its type cap (--note-units, set on the
 * note), within a floor that keeps 'Anonymous · Oct 2025' on one line and a ceiling: two fifths of
 * the row on a phone (so it can share the row with a quote) and 16rem from a 40rem page (so a long
 * line wraps in two).
 */
const STICKER_BASIS =
  'basis-[max(8.75rem,min(calc(var(--note-units,4)*var(--note-max)*0.6),40%))] @min-[40rem]/page:basis-[max(9.5rem,min(calc(var(--note-units,4)*var(--note-max)*0.6),16rem))] grow-[3]';

/**
 * Each scale's width (basis and its share of a row's spare room) and, for the stickers, the type's
 * rem cap (--note-max, read by FIT_SIZE). Tiles and quotes on a phone take a share of the row with
 * a rem floor: a sticker and a quote, or two tiles, share a phone's row from 360px; a long note
 * takes the row.
 */
const SCALE_CLASS = {
  word: `[--note-max:2.25rem] @min-[40rem]/page:[--note-max:3rem] ${STICKER_BASIS}`,
  line: `[--note-max:1.375rem] @min-[40rem]/page:[--note-max:1.75rem] ${STICKER_BASIS}`,
  note: 'basis-[max(9rem,44%)] @min-[40rem]/page:basis-[13rem] grow-[13]',
  body: 'basis-[max(10.5rem,53%)] @min-[40rem]/page:basis-[17rem] grow-[17]',
  long: 'basis-full @min-[40rem]/page:basis-[22rem] grow-[22]',
} as const satisfies Record<NoteScale, string>;

export const noteClass = (scale: NoteScale, treatment: NoteTreatment): string =>
  `${NOTE_BASE} ${TREATMENT_CLASS[treatment]} ${SCALE_CLASS[scale]}`;

/**
 * A long word or URL breaks rather than widening the page; typed line breaks are kept. Anything
 * the browser cannot break (a single cluster of 60 joined letters, a long ZWJ emoji chain) is
 * clipped at the note's sides rather than running over the note beside it.
 */
const TEXT_BASE =
  'whitespace-pre-line wrap-break-word overflow-x-clip [text-wrap:pretty] text-foreground [[data-state=loading]_&]:text-muted-foreground';

/**
 * The sticker sizes: the rem cap (--note-max) or the note's width over its widest word. A size
 * fitted to its box opts out of text inflation (an Android text-size-adjust scale doubled it past
 * the box and broke 'impressive' mid-word); it is already large, and a larger root font (browser
 * text 200%) still scales it through the rem cap and the rem floor of its width.
 */
const FIT_SIZE =
  'text-[length:min(var(--note-max),calc(100cqi/(var(--note-fit,4)*0.6)))] [text-size-adjust:100%]';

/** Size follows length: 48 and 28px stickers, an 18px tile sentence, 16px quoted feedback. */
const TEXT_SCALE_CLASS = {
  word: `${FIT_SIZE} font-semibold leading-[1.02] tracking-[-0.045em]`,
  line: `${FIT_SIZE} font-semibold leading-[1.15] tracking-[-0.026em]`,
  note: 'text-base leading-[1.5] @min-[40rem]/page:text-[1.125rem] @min-[40rem]/page:leading-[1.5] @min-[40rem]/page:tracking-[-0.011em]',
  body: 'max-w-[60ch] text-base leading-[1.6]',
  long: 'max-w-[60ch] text-base leading-[1.6]',
} as const satisfies Record<NoteScale, string>;

export const textClass = (scale: NoteScale): string => `${TEXT_BASE} ${TEXT_SCALE_CLASS[scale]}`;

/**
 * A word holding a web address ('(http://linktr.ee/mikeodnis)'), the project page's rule: one
 * inline block, so it moves whole to the next line whenever it fits there, never wider than the
 * note, and wrapping at its dots and slashes only when it is wider than its line (noteParts,
 * _lib/breaks.ts). A piece wider than even that breaks anywhere, so nothing runs past the note.
 */
export const NOTE_ADDRESS_CLASS = 'inline-block max-w-full wrap-anywhere';

/**
 * A piece's last character with the marks that close it ('r/)', 'r.'): kept on one line, so a
 * ')', a dot or a slash never starts a line alone. It is one character and marks about 1.2em wide
 * at most, a few pixels, and an inline span, so the word around it breaks no sooner than before.
 */
export const NOTE_HELD_CLASS = 'whitespace-nowrap';

/**
 * The quote's hanging mark, in the quiet hairline ink: it hangs in the note's own left padding
 * (never past the wall's edge), its top on the first line's cap height. Under a 20rem page it
 * stands over the text on a short line of its own.
 */
export const QUOTE_MARK_CLASS =
  'pointer-events-none absolute top-0 left-0 select-none font-semibold text-[2.25rem] leading-[0.9] text-hairline-strong @max-[20rem]/page:static @max-[20rem]/page:h-[0.5em] @max-[20rem]/page:leading-none @min-[40rem]/page:text-[2.75rem]';

/**
 * The signature: "name · month", the name a step brighter than the date. The dot never starts a
 * line or ends one: when the month wraps under the name, the dot is dropped and the month sits on
 * its own line. No script measures anything; the lines start 0.46em left of the signature's edge
 * (ROW_RUNS_CLASS), the signature clips that strip (overflow-x: clip, so nothing clips
 * vertically), and every run fills it with something that may be cut:
 * - the name, with 0.46em of padding before it, so its words start on the edge;
 * - the month, behind its dot in a 0.46em box: after the name the dot shows as ' · ', and on a
 *   line of its own the box lands in the clipped strip and the month on the edge.
 * 0.46em is the width the dot and a space had before, so the line looks as it did.
 */
export const ROW_META_CLASS = 'tile-meta text-faint wrap-break-word overflow-x-clip';
export const ROW_RUNS_CLASS = 'block ms-[-0.46em]';
/** A box, so a name that wraps keeps its padding on every line; never wider than the note. */
export const ROW_AUTHOR_CLASS =
  'inline-block max-w-full ps-[0.46em] font-medium text-muted-foreground';
/** The dot and the month (or "Posting…") wrap together: '· Oct 2025' is never split. */
export const ROW_WHEN_CLASS = 'inline-block whitespace-nowrap';
/** The dot's box: the dot, then the gap before the month. Decorative, so it is never copied. */
export const ROW_DOT_CLASS = 'inline-block w-[0.46em] select-none';

/**
 * The compose tile's place in the first year's wall: wide enough for the three sign-in choices
 * and the box, so on a phone it takes its own row, as the card did above the list.
 */
export const COMPOSE_TILE_CLASS = 'flex min-w-0 basis-[20rem] grow-[20]';

/**
 * The compose card as the wall's dashed "Your note here" tile: no fill, a dashed strong
 * hairline, and the rim lit at once while keyboard focus is inside it (focus reaches its end state
 * without animating, and nothing but transform and opacity ever moves), so the place you are
 * writing is marked without moving anything.
 */
export const CARD_CLASS =
  'flex min-w-0 flex-1 flex-col gap-3 rounded-tile border border-dashed border-hairline-strong p-4 has-[:focus-visible]:border-brand-ink @min-[40rem]/page:p-5';
/** "Your note here", set as a note's line would be, in the muted tier: it is the empty place. */
export const CARD_TITLE_CLASS =
  'text-[1.1875rem] font-semibold leading-[1.25] tracking-[-0.022em] text-muted-foreground @min-[40rem]/page:text-[1.375rem]';
export const CARD_TEXT_CLASS = 'max-w-[44ch] tile-sub text-muted-foreground';
export const PROVIDERS_CLASS = 'flex flex-wrap gap-2';
/**
 * The card's buttons (Sign in, the three choices, Post message): 44px tall under a finger, the
 * site's touch target, and the button's usual 36px with a mouse. cn merges it after the variant's.
 */
export const TOUCH_BUTTON_CLASS = 'pointer-coarse:h-11';
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
