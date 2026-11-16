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
 * @file Folio: the editorial primitives the owner picked on 2026-11-15, shared by /projects,
 * the project page, /certifications, /experience and the guestbook Wall, so the routes read as a
 * portfolio rather than a data dashboard. Every one is server-safe (no directive, no hooks), so a
 * server page or a client island (a FilterBar's results) can draw it, and the HTML reads without
 * JavaScript. The CSS they need is in globals.css (folio-numeral*, type-cover*, quiet-stage,
 * --folio-grain).
 *
 * The guide
 *
 * - ChapterOpener: one chapter (a year, or 'Featured' / 'Now') as a <section id> a jump link
 *   lands on. Props: id (chapterId), title, summary (one line in words; <em> lifts a name),
 *   byline (the counts), size, level, lead (the one dominant story, under the rule), children
 *   (the rest), className. Sizes follow one system, picked by chapterSize({ index, count }):
 *   `lead` for the page's first chapter (the one display numeral), `step` for the rest (about
 *   6rem), `inline` for a one-item chapter (a heading on the rule, never a full opener). Every
 *   size is capped in rem, by the screen's height and by its cell's width over the title's widest
 *   word, so 200% text never lets it eat the screen or break mid-word. A page's first chapter
 *   takes className="mt-0" whatever its size (only `lead` has no top margin of its own).
 *   A word chapter may sit small while the years keep their numerals: pass size="inline" for
 *   'Featured', 'Now' or 'Also now' (a 2.25rem heading on the rule, its summary and byline beside
 *   it, then its lead story), and let chapterSize({ index, count }) size the years after it, so
 *   they step at about 6rem; pass index - 1 instead if the first year should take the one display
 *   numeral. As a page's first chapter, size="inline" with className="mt-0" leaves no gap above
 *   it and draws one rule only, its own, under the heading.
 * - Byline: the small meta line under a title. Props: parts (strings, numbers, and statuses as
 *   { text, tone } with a house StatusDot), as, className. Blanks and repeats are dropped and
 *   parts are joined with ' · ' (bylineText gives the same line as plain text). Only the dots are
 *   hidden from screen readers, which hear 'CLI Tool, Feb 2026, In progress'; textContent keeps
 *   the dots. countOf(7, { one: 'project', many: 'projects' }) writes '7 projects'.
 * - ChapterJumps: the 'In this issue' row of #anchor links with counts. Props: chapters
 *   ({ id, label, count }; a count of 0 is left out), label, noun (so a screen reader hears
 *   '2026, 7 projects'), className. Links are 36px tall under a mouse and 44px under a finger,
 *   and wrap; no sideways scroll.
 * - ViewSwitch: a page's views as links, the current one aria-current="page", styled like Places |
 *   Photos. Props: views ({ value, label, href }), current, label (the nav's name), className.
 *   Links are 36px tall under a mouse and 44px under a finger.
 *   Build the hrefs with viewLinks(href, views, { defaultView, param = 'view' }): the default view
 *   has no parameter and every filter is carried. Read the view with parseView. Inside a
 *   FilterBar, build them in a small client island from the bar's live state (as PlacesViewNav).
 * - TypeCover: the cover of a project with no image: its name in at most two words large on
 *   surface-2 with a brand wash and grain ('Brain Tumor', 'Data Pipeline', 'Web Scraper'), the
 *   rest of the short name under it. Props: title, others (the page's other titles, so no two
 *   covers share a large line; optional), ratio (16/10 by default) or fill (inside a positioned
 *   frame), className. Decorative (aria-hidden): the title is always in the heading beside it.
 *   coverName(title, others) gives the large line as text.
 * - QuietStage: the project page's backdrop for its head and cover, in place of the washed blur.
 *   Pure CSS: surface-1 fading to the canvas, the violet spotlight from above, fine grain, and a
 *   bottom that fades out (no seam). Props: as, hang (the unlit bottom share, '34%', so a cover
 *   hangs onto the canvas), aria-labelledby, className.
 *
 * Type and words
 *
 * - Sentence case everywhere: 'In progress', '7 projects', 'Built with'. Never tracked upper-case
 *   mono kickers. Kinds keep their own spelling ('AI/ML', 'CLI Tool'); nothing is upper-cased.
 * - Geist sans for labels and figures, with tabular figures (tile-label, tile-meta); weights 400,
 *   500 and 600 only. Geist Mono (mono-token) only for small machine details: a repo slug, an ID.
 * - The work and the person lead; counts sit in bylines, never in stat tiles. One dominant
 *   element per view: the lead story or the numeral, then a steep drop in size.
 * - Palette only: house tokens and their translucent forms. Status colour only on a dot beside its
 *   word. No per-kind or per-issuer colours.
 * - Motion is transform or opacity on the house spring, focus-visible reaches the hover's end
 *   state, and the global reduced-motion rule stills it all.
 */

export { Byline, type BylineProps } from './byline';
export {
  BYLINE_SEPARATOR,
  type BylineItem,
  type BylinePart,
  type BylineStatus,
  bylineItems,
  bylineText,
  countOf,
  formatCount,
} from './byline-items';
export {
  type ChapterJump,
  type ChapterJumpLink,
  type ChapterPlace,
  type ChapterSize,
  chapterId,
  chapterJumps,
  chapterSize,
} from './chapter';
export { ChapterJumps, type ChapterJumpsProps } from './chapter-jumps';
export { ChapterOpener, type ChapterOpenerProps } from './chapter-opener';
export { QuietStage, type QuietStageProps, type StageHang } from './quiet-stage';
export { TypeCover, type TypeCoverProps } from './type-cover';
export {
  type CoverRatio,
  coverName,
  coverRatio,
  shortName,
  type TypeCoverWords,
  typeCoverWords,
} from './type-cover-words';
export {
  parseView,
  type SearchParamsRecord,
  toSearch,
  type ViewParamOptions,
  type ViewSwitchItem,
  viewHref,
  viewLinks,
} from './view-href';
export { ViewSwitch, type ViewSwitchProps } from './view-switch';
export {
  EM_PER_UNIT,
  letterUnits,
  phraseUnits,
  twoLineUnits,
  widestWordUnits,
  wordUnits,
} from './word-measure';
