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
 * @file The Folio record's own layout: the big credentials of a thin year, and a busy year's
 * issuer groups with months in the margin. No boxes, no rules between items: hairlines only
 * between groups, scale and space for the rest. Server-safe (no directive).
 *
 * Every size answers to the shell's `page` container or the item's own (cqi). Display sizes are
 * the smallest of a rem clamp, a share of the screen's height and the box's width over its widest
 * word (--folio-fit, set from word-measure.ts), so text at 200% never eats the screen or breaks a
 * word. Hover and focus reach one end state: the ink turns brand, an underline shows and the
 * arrow steps up and out on the house spring (a grouped title's arrow fades in as it does, and
 * its margin lifts from faint to muted). Opacity, colour and translate only, so nothing moves;
 * the global reduced-motion rule stills it.
 */

/** The island's root: the bar, the results head, then the chapters. */
export const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-5';
/**
 * The year jumps open the results. With no filter they follow the bar at the island's gap (the
 * header's byline holds the one count); once a filter shows the count above them they read with
 * it: the island's gap taken back, the links' own 36px height left as the pause.
 */
export const JUMPS_UNDER_COUNT_CLASS = '-mt-4 @min-[48rem]/page:-mt-5';
/** A pause between the year jumps and the first chapter's title. */
export const RECORD_CLASS = 'mt-[clamp(1rem,0.5rem+1.5vw,2.25rem)]';

/** A focused link or button lands clear of the pinned filter bar (WCAG 2.4.11). */
const CLEAR_BAR_CLASS =
  'scroll-mt-[max(0px,calc(var(--filter-bar-h,0px)+1rem-var(--edge-haze-top,0px)))]';

/** The new-tab arrow steps up and out with the hover, and back on the slower spring. */
const ARROW_CLASS = [
  '[&_[data-new-tab-arrow]_svg]:transition-transform [&_[data-new-tab-arrow]_svg]:duration-(--motion-spring-out) [&_[data-new-tab-arrow]_svg]:ease-spring',
  'hover:[&_[data-new-tab-arrow]_svg]:translate-x-0.5 hover:[&_[data-new-tab-arrow]_svg]:-translate-y-0.5 hover:[&_[data-new-tab-arrow]_svg]:duration-(--motion-spring-in)',
  'focus-visible:[&_[data-new-tab-arrow]_svg]:translate-x-0.5 focus-visible:[&_[data-new-tab-arrow]_svg]:-translate-y-0.5',
].join(' ');

/** An underline that shows with the hover: its colour fades in, nothing moves. */
const UNDERLINE_CLASS =
  'underline decoration-transparent decoration-1 underline-offset-[0.28em] hover:decoration-current focus-visible:decoration-current';

/** Thin years and Featured: one column on a phone, two from a 48rem page. */
export const BIG_LIST_CLASS =
  'grid min-w-0 gap-x-[clamp(1.5rem,1rem+2.5vw,3.5rem)] gap-y-[clamp(2.25rem,1.75rem+1.5vw,3.25rem)] @min-[48rem]/page:grid-cols-2';
/** A big credential: its own container, so its title fits its column. */
export const BIG_ITEM_CLASS = '@container flex min-w-0 flex-col items-start';
/** Headline size, capped by rem, by the screen's height and by the column over the widest word. */
export const BIG_TITLE_CLASS =
  'max-w-[22ch] font-sans font-semibold leading-[1.1] tracking-[-0.03em] text-foreground [text-wrap:balance] text-[length:min(clamp(1.5rem,0.75rem+4cqi,2.375rem),6.5svh,calc(100cqi/(var(--folio-fit,8)*0.6)))]';
export const BIG_BYLINE_CLASS = 'mt-2';
/** The skills a credential lists: meta size, faint, a word too wide for its line breaks last. */
export const SKILLS_CLASS = 'tile-meta text-faint [overflow-wrap:break-word] [text-wrap:pretty]';
/**
 * One skill (with its dot, or the last one's '+5'), and one part of a margin note ('Verify on
 * VirtualBadge'): a box of its own, so a line wraps only between them and each stays whole. A box
 * wider than its whole line (200% text in a 320px window) still wraps inside, at its spaces,
 * where nowrap would push the page sideways.
 */
const WHOLE_ITEM_CLASS = 'inline-block max-w-full';
export const SKILLS_ITEM_CLASS = WHOLE_ITEM_CLASS;
/** The dot between two skills, as quiet as a byline's. */
export const SKILLS_SEPARATOR_CLASS = 'text-hairline-strong';
/** '+5': the skills not shown, glued to the last one shown. */
export const SKILLS_MORE_CLASS = 'whitespace-nowrap';
/** Under a big credential's byline. */
export const BIG_SKILLS_CLASS = 'mt-1 max-w-[52ch]';
/**
 * Copy ID's tap area on a touch screen: 44px square, its button still drawn 28px tall on the
 * title's line. The overlay (a link's or a button's ::after is read as its hit area) reaches 2px
 * up, 14px down and 8px to the right: level with the title link's beside it, never over the row
 * above or below.
 */
const COPY_HIT_CLASS = [
  "pointer-coarse:[&_button]:after:absolute pointer-coarse:[&_button]:after:content-['']",
  'pointer-coarse:[&_button]:after:-top-0.5 pointer-coarse:[&_button]:after:-bottom-3.5 pointer-coarse:[&_button]:after:left-0 pointer-coarse:[&_button]:after:-right-2',
].join(' ');
/** Verify and Copy ID, on one line when they fit. */
export const VERIFY_ROW_CLASS = `mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 ${COPY_HIT_CLASS}`;
/** 'Verify on Credly ↗': body size, brand ink, 36px tall under a mouse and 44px under a finger. */
export const VERIFY_LINK_CLASS = [
  'inline-flex min-h-9 items-center text-base font-medium text-brand-ink pointer-coarse:min-h-11',
  'transition-[text-decoration-color] duration-(--motion-base) ease-effect hover:duration-(--motion-instant)',
  UNDERLINE_CLASS,
  ARROW_CLASS,
  CLEAR_BAR_CLASS,
].join(' ');
export const NO_LINK_CLASS = 'inline-flex min-h-9 items-center text-base text-faint';

/** A busy year's groups, a hairline between each. */
export const GROUPS_CLASS = 'flex min-w-0 flex-col';
/**
 * A phone's groups sit a little closer (24px, the name 12px over its list) than a desktop's
 * (about 40px at 1280), so the skills under the titles cost the phone page less.
 */
export const GROUP_CLASS =
  'grid min-w-0 gap-x-[clamp(1rem,0.5rem+1.2vw,1.75rem)] gap-y-3 border-t border-hairline py-[clamp(1.5rem,0.75rem+2.25vw,2.75rem)] first:border-t-0 first:pt-0 last:pb-0 @min-[48rem]/page:grid-cols-12 @min-[48rem]/page:gap-y-4';
/**
 * The issuer's name and its byline: above the list on a phone; from a 48rem page in the left
 * columns, pinned under the filter bar (above the edge haze) while its group scrolls past.
 */
export const GROUP_HEAD_CLASS =
  '@container min-w-0 @min-[48rem]/page:sticky @min-[48rem]/page:top-[calc(env(safe-area-inset-top,0px)+var(--filter-bar-h,0px)+1.25rem)] @min-[48rem]/page:z-[25] @min-[48rem]/page:col-span-4 @min-[48rem]/page:self-start @min-[64rem]/page:col-span-3';
const GROUP_NAME_BASE = 'font-sans font-semibold text-foreground [overflow-wrap:break-word]';
/**
 * The year's biggest issuer is the group's visual; the rest step down. Every term stays under the
 * year it belongs to (folio-numeral-step: min(clamp(3rem, 0.5rem + 12cqi, 6rem), 14svh, fit)).
 * Under a 48rem page the name spans the page, so its cqi is the page's: there it tops out at the
 * year's floor (3rem) and grows at 9.5cqi against the year's 12, at half the year's share of the
 * screen's height, so 'Google' (36px at 390) sits well under '2024' (49px). From 48rem it has the
 * left columns, a quarter or a third of the page, and keeps its larger sizes (53px against 86px).
 */
export const GROUP_NAME_CLASS = {
  top: `${GROUP_NAME_BASE} leading-[1.02] tracking-[-0.045em] text-[length:min(clamp(2rem,0.25rem+9.5cqi,3rem),7svh,calc(100cqi/(var(--folio-fit,6)*0.6)))] @min-[48rem]/page:text-[length:min(clamp(2.25rem,1rem+14cqi,3.5rem),9svh,calc(100cqi/(var(--folio-fit,6)*0.6)))]`,
  rest: `${GROUP_NAME_BASE} leading-[1.08] tracking-[-0.035em] text-[length:min(clamp(1.375rem,0.5rem+5cqi,2rem),5svh,calc(100cqi/(var(--folio-fit,6)*0.6)))] @min-[48rem]/page:text-[length:min(clamp(1.5rem,0.75rem+6cqi,2.125rem),6svh,calc(100cqi/(var(--folio-fit,6)*0.6)))]`,
} as const;
export const GROUP_BYLINE_CLASS = 'mt-1.5';
/** The month stacks: the rest of the row from a 48rem page. */
export const STACKS_CLASS =
  'flex min-w-0 flex-col gap-[clamp(0.875rem,0.7rem+0.5vw,1.25rem)] @min-[48rem]/page:col-span-8 @min-[64rem]/page:col-span-9';
/**
 * A month in the margin, then its certificates. Where the page is under 11 lines of its own text
 * wide (text at 150% and up in a phone's width: lh follows the browser's text size and a phone's
 * text-size-adjust), the margin would leave the titles about ten letters a line and break their
 * words, so the month sits on a line of its own above them. At the default size even a 320px page
 * is 13 lines wide, so nothing changes there.
 */
export const STACK_CLASS =
  'grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2.5 @max-[11lh]/page:grid-cols-1 @min-[48rem]/page:grid-cols-[3.5rem_minmax(0,1fr)] @min-[48rem]/page:gap-x-3';
/** The month, on the first title's line. */
export const MONTH_CLASS = 'font-sans text-[0.8125rem] leading-6 tabular-nums text-faint';
/** A month's certificates: the container the margin column answers to. */
export const STACK_ITEMS_CLASS = '@container/items flex min-w-0 flex-col gap-2';

/**
 * A certificate in a group: its title line, then its margin (the note, then the skills). Under
 * the title on a phone; where its list is 40rem wide (a wide desktop) the margin is a column of
 * its own on the right, its first line on the title's baseline, so the busy years read as an
 * index with notes in the margin rather than a column of links beside an empty third. A
 * certificate with nothing in the margin lets its title take the whole row.
 */
/**
 * The margin column is 276px on a wide page (a 778px list), as wide as its longer one-line notes
 * ('Stanford Online · Verify on Stanford · Teaching') while every title with a note keeps one
 * line beside it.
 */
export const BRIEF_ITEM_CLASS =
  'group/cert grid min-w-0 grid-cols-[minmax(0,1fr)] gap-y-0.5 @min-[40rem]/items:grid-cols-[minmax(0,1fr)_clamp(12rem,35.5cqi,17.25rem)] @min-[40rem]/items:items-baseline @min-[40rem]/items:gap-x-[clamp(1.25rem,2.5cqi,2.5rem)]';
export const BRIEF_LINE_CLASS = 'flex min-w-0 items-start gap-x-1';
/** The title line of a certificate with nothing in the margin: the whole row. */
export const BRIEF_LINE_FULL_CLASS = '@min-[40rem]/items:col-span-2';
/**
 * The margin: under the title, the note over the skills. In the wide margin column the two run
 * on as one line ('Microsoft · No public link · Python'), so most notes take one line and the
 * titles keep one even step; a long one wraps between its parts. On a touch screen, where the
 * title carries 12px under its last line (BRIEF_TITLE_BASE), a margin under the title sits back
 * up over those 12px, as close as under a mouse, and lets a tap through to the title's link.
 */
export const BRIEF_MARGIN_CLASS = [
  'flex min-w-0 flex-col gap-0.5',
  'pointer-coarse:@max-[40rem]/items:pointer-events-none pointer-coarse:@max-[40rem]/items:-mt-3',
  '@min-[40rem]/items:block @min-[40rem]/items:tile-meta @min-[40rem]/items:[&>p]:inline',
].join(' ');
/** The dot between the note and the skills where they run on as one line; else not drawn. */
export const MARGIN_JOIN_CLASS = 'hidden text-hairline-strong @min-[40rem]/items:inline';
/**
 * The margin's words lift from faint to muted while its title is hovered or focused, so the row
 * reads as one; a hover only where the pointer hovers, so a tap leaves nothing lit.
 */
export const MARGIN_TEXT_CLASS =
  'transition-colors duration-(--motion-base) ease-effect [@media(hover:hover)]:group-has-[a:hover]/cert:text-muted-foreground group-has-[a:focus-visible]/cert:text-muted-foreground';
/** A margin note (Byline): each part ('Hashtag University ·', 'Verify on VirtualBadge') whole. */
export const MARGIN_NOTE_CLASS = `${MARGIN_TEXT_CLASS} [&>span]:inline-block [&>span]:max-w-full`;
/**
 * Body size on a phone, a touch larger from a 40rem page. A word wider than its whole line (200%
 * text in a 320px window) breaks, as the last resort. On a touch screen a title carries 12px
 * under its last line (where a margin under it sits) and its link's overlay reaches 4px past
 * each end, so every title is a 44px target and a title alone steps 44px; under a mouse the rows
 * keep their 32px step.
 */
const BRIEF_TITLE_BASE =
  'min-w-0 text-base leading-6 font-medium text-foreground [overflow-wrap:break-word] [text-wrap:pretty] @min-[40rem]/page:text-[1.0625rem] pointer-coarse:pb-3';
/** The title link's tap area on a touch screen: its box (with the 12px) and 4px above and below. */
const BRIEF_HIT_CLASS =
  "relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1 pointer-coarse:after:content-['']";
/**
 * A grouped title's new-tab arrow: not drawn at rest, so a busy year reads as titles rather than
 * a column of arrows (the group's byline says where its titles lead, and screen readers hear
 * '(opens in a new tab)'). With the hover or keyboard focus it fades in as it steps up and out on
 * the house spring, and back on the slower one. Opacity and translate only: it keeps its place.
 */
const REVEAL_ARROW_CLASS = [
  '[&_[data-new-tab-arrow]_svg]:opacity-0 [&_[data-new-tab-arrow]_svg]:-translate-x-0.5 [&_[data-new-tab-arrow]_svg]:translate-y-0.5',
  '[&_[data-new-tab-arrow]_svg]:transition-[opacity,translate] [&_[data-new-tab-arrow]_svg]:duration-(--motion-spring-out) [&_[data-new-tab-arrow]_svg]:ease-spring',
  'hover:[&_[data-new-tab-arrow]_svg]:opacity-100 hover:[&_[data-new-tab-arrow]_svg]:translate-x-0.5 hover:[&_[data-new-tab-arrow]_svg]:-translate-y-0.5 hover:[&_[data-new-tab-arrow]_svg]:duration-(--motion-spring-in)',
  'focus-visible:[&_[data-new-tab-arrow]_svg]:opacity-100 focus-visible:[&_[data-new-tab-arrow]_svg]:translate-x-0.5 focus-visible:[&_[data-new-tab-arrow]_svg]:-translate-y-0.5',
].join(' ');

/**
 * The title is the credential's link: a target as tall as its lines. Hover and keyboard focus
 * reach one end state: brand ink, the underline, the arrow out, the margin lifted.
 */
export const BRIEF_LINK_CLASS = [
  BRIEF_TITLE_BASE,
  BRIEF_HIT_CLASS,
  'transition-[color,text-decoration-color] duration-(--motion-base) ease-effect hover:text-brand-ink hover:duration-(--motion-instant) focus-visible:text-brand-ink',
  UNDERLINE_CLASS,
  REVEAL_ARROW_CLASS,
  CLEAR_BAR_CLASS,
].join(' ');
export const BRIEF_TEXT_CLASS = BRIEF_TITLE_BASE;
/**
 * Copy ID right after the title, from a 40rem page (a phone's titles keep the width, as the
 * ledger's phone rows did): shown with the hover or keyboard focus where there is a pointer that
 * hovers. On touch it is always there, a quiet 'ID' that follows each title where it ends rather
 * than lining up at the row's end, so the list never reads as a column of buttons; its tap area
 * is 44px (COPY_HIT_CLASS). Opacity only, so nothing moves; its 28px button sits on the 24px line.
 */
export const COPY_SLOT_CLASS = [
  '-my-0.5 hidden flex-none transition-opacity duration-(--motion-base) ease-effect @min-[40rem]/page:block',
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/cert:opacity-100 [@media(hover:hover)]:group-focus-within/cert:opacity-100',
  COPY_HIT_CLASS,
].join(' ');
