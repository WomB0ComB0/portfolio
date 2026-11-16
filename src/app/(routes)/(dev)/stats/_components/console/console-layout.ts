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
 * @file Where the /stats tiles sit in their grid at every width. Spans (as data) and class
 * strings only (no directive), so the server tiles and the Discord island both read them.
 *
 * The page sits beside a rail on wide screens and above a bar on narrow ones, so the viewport
 * says little about the width the console gets. Everything is keyed to a container (the `tiles`
 * grid wrapper, the `page` column, a tile) or sized by its content.
 *
 * Two units name the container steps:
 * - rem, where a step only has to hold a layout (a hero beside a tile);
 * - lh, the line height of the container's own text (26px at the default size), where a step
 *   has to hold words or figures. A phone can enlarge text without changing rem (Android's text
 *   scaling in a WebView, text-size-adjust), and a rem step then keeps a layout the text no
 *   longer fits. lh grows with the text in that case and with a larger browser font alike, so
 *   the layout steps back to the one that fits. Where a browser does not read lh in a container
 *   query the rule is dropped whole, which leaves the narrower layout, never a broken one.
 *
 * The shared kit carries the rest of what this page needs, each as an option the page turns on:
 * the header and its strip keyed to the page container (PageShell and StatStrip,
 * `sizing="container"`), the stat figure sized by its tile (StatTile, `size="fit"`), the
 * 12-column tier at 70rem (TileSpan, TileGrid), and a table that wraps and unpins (IndexGroup's
 * `wrapHeading` and `pin`, IndexTitleLink's and IndexColumn's `wrap`). What is left here is the
 * page's own: one grid tier more than the kit has, the rows of the 12-column tier, and a later
 * step for the phone pair than the kit's. Every class is written out whole: Tailwind reads them
 * from source.
 */

import type { TileSpan } from '@/components/console';

/**
 * The tile grid's tiers, by the grid's own width:
 * - a row each for every tile;
 * - from 15lh (390px at the default text size): typing and coding share a row (STAT_PAIR_CLASS),
 *   as equal halves, from 15.75lh as three fifths and two, and from 20.5lh as two thirds and one
 *   (PAIR_SHARE_CLASS);
 * - from the kit's 36rem: 6 columns, a row each for the hero, Discord and LeetCode, and typing
 *   and coding still two thirds and one (PAIR_SHARE_CLASS), their ages on a line of their own
 *   to 25.5lh (TYPING_AGE_LINE_CLASS);
 * - from 31.5lh (819px): the hero, then Discord beside the three stat tiles (LeetCode over typing
 *   and coding, which take the half under it as quarters, and from 34.5lh as three fifths and
 *   two);
 * - from 70rem: the kit's 12 columns, the hero (8) beside Discord (4), with LeetCode under
 *   Discord and typing and coding under the hero (DESKTOP_TIER_CLASS below).
 *
 * The 31.5lh tier is this page's own, and the reason for the three classes below. The Discord
 * tile is the same height whatever its live state (discord-tile.tsx), about twice a stat tile's.
 * So it never shares a row with one stat tile, which would be stretched to twice its content:
 * under the hero it stands over two rows beside all three, and each hugs its figure. That takes
 * 12 columns (halves for Discord and LeetCode, quarters for typing and coding) where the kit has
 * 6. The step is where a quarter holds typing's context in three lines (a quarter of a 31.5lh
 * grid is 196px; 193px is the least that does): from 27lh it took four, which made the pair
 * under LeetCode 192px tall, stretched Discord beside them to 408px and left coding time a hole
 * under its figure. It is in lh so that text a phone enlarges without changing rem puts the
 * stack back. Its unit differs from the kit's rem steps, which leaves their order in the
 * stylesheet open, so its rules carry `!`, each over a range of its own. The tiles' `md` spans
 * are written for the kit's 6 columns and read the same in these 12: 6 of 6 is a row, 6 of 12 a
 * half; 3 of 6 a half, 3 of 12 a quarter.
 *
 * In quarters typing's three facts and age took three lines and coding time's one fact and age
 * one, so coding time stood 180px tall around 136px of content (a 972 to 1155px window). From
 * 34.5lh (897px) the half under LeetCode splits three fifths and two instead: the six columns
 * there are 1.2 and 0.8 of a column on the left, so Discord and LeetCode keep their halves. Both
 * tiles then take two lines, which leaves the pair shorter than Discord, so the two rows beside
 * Discord share its 17px spare and typing is within 1.05 of its content, coding time (whose
 * figure is a little smaller in its narrower tile) within 1.12. Narrower, three fifths do not
 * hold typing's context in two lines (from about 874px of grid they do; the step keeps 7px of
 * that), and two fifths would break coding time's age inside ('updated 30 min / ago', the least
 * that holds it whole is 165px) before 835px, so the first 78px of the tier keep the quarters.
 */
export const TABLET_TIER_CLASS =
  '@min-[31.5lh]/tiles:@max-[34.5lh]/tiles:grid-cols-12! @min-[34.5lh]/tiles:@max-[70rem]/tiles:grid-cols-[repeat(6,minmax(0,1fr))_repeat(3,minmax(0,1.2fr))_repeat(3,minmax(0,0.8fr))]!';

/**
 * The rows of the 12-column tier. Three stat tiles in one row were all as tall as the tallest
 * (LeetCode, with its split and two lines of context), which left typing a quarter empty and
 * coding time, one figure, two fifths. So the tier is two columns that each run their own way:
 * - on the right, Discord over LeetCode, each as tall as what it holds;
 * - on the left, the hero over typing and coding time, which share a row as tall as their one
 *   figure. They are shorter than LeetCode, so the hero ends lower than Discord does, and its
 *   chart takes that height (github-hero.tsx).
 *
 * As grid rows: two for Discord, one for whatever LeetCode is taller than the pair beside it
 * (the `1fr`: nothing sits in that row alone, so it is exactly that, or nothing when LeetCode is
 * no taller), and the pair's row. The hero spans the first three, Discord the first two, LeetCode
 * the last two. The grid places the tiles in the order they are written (the hero, Discord,
 * LeetCode under it, then typing and coding), so the tab order is the order drawn.
 */
export const DESKTOP_TIER_CLASS = '@[70rem]/tiles:grid-rows-[auto_auto_1fr_auto]';

/**
 * The hero: the whole row, whatever the column count, until the 12-column tier; then 8 columns
 * and the three rows beside Discord and the top of LeetCode (see DESKTOP_TIER_CLASS). A TileSpan
 * cannot say this: its `md` counts the kit's 6 columns, and 6 of the tablet tier's 12 is a half.
 * At 70rem the hero's 8 columns hold its whole wide layout (42rem inside: the figure beside the
 * sparkline, and the commit beside the totals), so the step to the hero beside Discord changes
 * the tiles around the hero, never the hero's own shape.
 */
export const HERO_SPAN_CLASS = 'col-span-full @[70rem]/tiles:col-span-8 @[70rem]/tiles:row-span-3';

/**
 * Discord: the whole row on a phone and in the 6-column tier (half the tablet tier's 12, see
 * above), then 4 columns over two rows beside the hero. The tile is the same height in every
 * live state (its activity room, discord-tile.tsx), and the two rows it spans in the 12-column
 * tier are as tall as it is.
 */
export const DISCORD_SPAN = { md: 6, lg: 4, rows: 2 } as const satisfies TileSpan;

/** In the tablet tier Discord stands over two rows, beside the three stat tiles. */
export const DISCORD_TABLET_ROWS_CLASS = '@min-[31.5lh]/tiles:row-span-2';

/**
 * LeetCode: the whole row on a phone and in the 6-column tier; the half beside Discord, over
 * typing and coding, in the tablet tier; under Discord in the 12-column tier, over the tier's
 * last two rows (see DESKTOP_TIER_CLASS).
 */
export const LEETCODE_SPAN = { md: 6, lg: 4, rows: 2 } as const satisfies TileSpan;

/**
 * Typing and coding: a row each, then halves of a row once the grid is 15 lines of its text wide
 * (STAT_PAIR_CLASS), three fifths and two from 15.75 and two thirds and one from 20.5 and through
 * the 6-column tier (PAIR_SHARE_CLASS), quarters of the tablet tier under LeetCode and three fifths
 * and two of it from 34.5lh (TABLET_TIER_CLASS), and the row under the hero in the 12-column tier.
 *
 * Under the hero they split its 8 columns 5 to 3. Typing has three facts in its context line
 * and an age, and in 5 columns they stay on one line; coding time has one. Both are then as tall
 * as their figure and one line of context, and neither is stretched to the other.
 */
export const TYPING_SPAN = { base: 2, md: 3, lg: 5 } as const satisfies TileSpan;
export const CODING_SPAN = { base: 2, md: 3, lg: 3 } as const satisfies TileSpan;

/**
 * Typing and coding share a phone row from a grid 15 lines of its text wide (390px at the default
 * size; a 433px window, 423px on a phone), where half a row holds typing's three facts and its
 * age in three lines (185px is the least that does) and a five-digit figure with its unit on one
 * line ('10,238 hours' at the fit figure's fifth of the tile). The kit's `pair` starts at 13.5lh
 * (351px): from there to here the halves were 170 to 185px, typing's context a list of four
 * lines, and coding time beside it had a 44px hole under its figure, on the 390 to 414px phones
 * most people hold. In lh so that it moves with the text: with text enlarged by a third it is
 * past every phone, and the two tiles take a row each. Until the 6-column tier (`@xl`), whose
 * `md` spans take over.
 */
export const STAT_PAIR_CLASS = '@min-[15lh]/tiles:@max-xl/tiles:col-span-1';

/**
 * Typing's and coding time's shares of the row they share, on the grid's columns, typing first:
 * - the shared phone row's two columns: three fifths and two from a grid 15.75 lines of its text
 *   wide (410px at the default size; a 452px window, 442px on a phone), then two thirds and one
 *   from 20.5lh (533px), until the 6-column tier. Every other tile spans both columns, as it does
 *   in the kit's two;
 * - the 6-column tier's columns, until the tablet tier: the three typing spans weigh two, the
 *   three coding time spans one, so the pair splits two thirds and one there too. The hero,
 *   Discord and LeetCode span all six, so they keep the whole row.
 *
 * In equal halves typing's three facts and age took three lines and coding time's one fact and age
 * one, so coding time was stretched to typing's height with its spare room at its foot (172px
 * against 126 of content at a 480px window, 180 against 136 at 500 to 550). In three fifths and
 * two both take two lines and each is as tall as what it holds: the row is 20 to 22px lower to a
 * 550px window, and no tile is more than 1.07 times its content.
 *
 * It starts where two fifths hold coding time's age on one line beside its padding ('updated 59
 * min ago', 123px of the tile's 157): narrower, the age broke inside ('updated 30 min / ago'), so
 * from 15lh to here the halves stay equal. From about 558px of grid two fifths held coding time's
 * whole context on one line while typing's took two, and in the 6-column tier's halves it always
 * did: coding time stood 158px tall around 136 of content from a 606 to an 883px window. In two
 * thirds and one, typing's line needs the room coding time's does, nearly twice over, and the two
 * go to one line at nearly the same width; TYPING_AGE_LINE_CLASS below makes it the same width. The
 * steps are in lh so that they move with the text, as the pair's own step does. Coding time's
 * figure is sized by its narrower tile (the fit tier, a fifth of it), 25 to 36px beside typing's
 * 36px.
 *
 * The 6-column rule carries `!` and bounds of its own for the reason TABLET_TIER_CLASS gives: it
 * answers to the kit's rem steps and this page's lh ones at once.
 */
export const PAIR_SHARE_CLASS =
  '@min-[15.75lh]/tiles:@max-[20.5lh]/tiles:@max-xl/tiles:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @min-[20.5lh]/tiles:@max-xl/tiles:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @xl/tiles:@max-[31.5lh]/tiles:@max-[70rem]/tiles:grid-cols-[repeat(3,minmax(0,2fr))_repeat(3,minmax(0,1fr))]!';

/**
 * Typing's and coding time's ages on a line of their own in the 6-column tier up to 25.5lh (663px
 * of grid at the default size): the part of the context line that holds the age (its AgeRoom)
 * takes the line's whole width. Both lines then take two lines there, their words and then the
 * age, and from the step both take one.
 *
 * Left to wrap where each fits, typing's line went to one line first (from 621px of grid in an
 * unhinted run, 634px hinted) and coding time's later (637px, 642px hinted), so typing stood 156px
 * tall around 136 of content in between (a 674 to 690px window unhinted, 688 to 694 hinted). The
 * share that makes the two switch together is 1.94 to 1 unhinted and 1.98 to 1 hinted, so no one
 * share closes that seam wherever text is set a little differently. From the step both lines fit
 * on one line with room over: coding time's holds 183px for its 175.5 (hinted). Up to it the pair
 * is one line (about 20px) taller than it needs from coding time's own switch (637 to 642px), and
 * neither tile is ever stretched by the other's line. In lh, so it moves with the text, as the
 * tiers do; where a browser reads neither lh in a container query nor :has, lines wrap as they fit.
 *
 * Stale, typing keeps the rule: its context line sits beside the kit's note ('⏲ Stale ·') and
 * takes its words, then its age, as fresh. Coding time's tile is too narrow for that (the note
 * leaves its line under the 8rem it asks for, stat-tiles.tsx), so a stale coding time's line
 * drops under the note whole and is two lines already; with its age on a line of its own as well
 * it took three, 17 to 22px taller than fresh across the tier. So coding time's rule skips a
 * stale tile.
 */
export const TYPING_AGE_LINE_CLASS =
  '@xl/tiles:@max-[25.5lh]/tiles:[&_[data-context-part]:has([data-age-room])]:basis-full';
/** Coding time's side of TYPING_AGE_LINE_CLASS: the same step, on a tile that is not stale. */
export const CODING_AGE_LINE_CLASS =
  '@xl/tiles:@max-[25.5lh]/tiles:[&:not([data-state=stale])_[data-context-part]:has([data-age-room])]:basis-full';
