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
 * @file ChapterOpener: one chapter of a list page (a year, or a word such as 'Featured' or 'Now'),
 * as a <section> that a jump link can land on. Its opener sets the title at display size, a
 * one-line summary in words and a small Byline for the counts, over a strong hairline; then the
 * chapter's lead story and the rest. Server-safe (no directive, no hooks).
 *
 * The chapter system (one on every page): only the first chapter is `lead` (the one big numeral),
 * later ones `step` down to about 6rem, and a one-item chapter is `inline`, a heading on the rule
 * (chapterSize picks). Every size is capped in rem, by the screen's height and by its cell's width
 * over the title's widest word (globals.css folio-numeral*), so enlarged text never lets it eat
 * the screen or break a word.
 *
 * A word chapter ('Featured', 'Now') may be `inline` on purpose, so the work leads and the years
 * keep the numerals. As a page's first chapter it takes className="mt-0" like any first chapter:
 * then nothing sits above its heading, and its one rule is the one under the heading.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { hasContent } from '../has-content';
import { Byline } from './byline';
import { type BylinePart, bylineItems } from './byline-items';
import type { ChapterSize } from './chapter';
import { widestWordUnits } from './word-measure';

/**
 * A #hash lands clear of the pinned FilterBar: html's scroll-padding already clears the top edge
 * haze (77 to 132px), and the bar's own height (--filter-bar-h, set on its island) can be taller
 * than the band leaves. Without a bar it is 1rem of air.
 */
const JUMP_MARGIN_CLASS =
  'scroll-mt-[max(1rem,calc(var(--filter-bar-h,0px)+1.5rem-var(--edge-haze-top,0px)))]';

/** The gap above a chapter: none on the first (the page sets it), a long rest before the others. */
const SECTION_CLASS = {
  lead: '',
  step: 'mt-[clamp(4rem,2.5rem+5vw,7rem)]',
  inline: 'mt-[clamp(3rem,2rem+3vw,4.5rem)]',
} as const satisfies Record<ChapterSize, string>;

/** The opener: on a wide page the title takes 7 of 12 columns and the words sit beside it. */
const HEADER_CLASS = {
  lead: 'grid items-end gap-x-[clamp(1rem,0.5rem+1.2vw,1.75rem)] gap-y-4 border-b border-hairline-strong pb-4 @min-[48rem]/page:grid-cols-12 @min-[48rem]/page:pb-5',
  step: 'grid items-end gap-x-[clamp(1rem,0.5rem+1.2vw,1.75rem)] gap-y-3 border-b border-hairline-strong pb-4 @min-[48rem]/page:grid-cols-12',
  inline:
    '@container flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-hairline-strong pb-3',
} as const satisfies Record<ChapterSize, string>;

/** The title's cell is the container its size reads (cqi). */
const TITLE_CELL_CLASS = '@container min-w-0 @min-[48rem]/page:col-span-7';
const TITLE_CLASS = {
  lead: 'folio-numeral',
  step: 'folio-numeral-step text-foreground',
  inline: 'folio-numeral-inline text-foreground',
} as const satisfies Record<ChapterSize, string>;

const DEK_CLASS = {
  lead: 'min-w-0 @min-[48rem]/page:col-span-5 @min-[48rem]/page:pb-1.5',
  step: 'min-w-0 @min-[48rem]/page:col-span-5 @min-[48rem]/page:pb-1',
  inline: 'flex min-w-0 flex-1 basis-[16rem] flex-wrap items-baseline gap-x-4 gap-y-1',
} as const satisfies Record<ChapterSize, string>;

/** The summary is words, so it leads the dek; <em> lifts a name to the foreground. */
const SUMMARY_BASE =
  'text-muted-foreground [text-wrap:pretty] [&_em]:text-foreground [&_em]:not-italic';
const SUMMARY_CLASS = {
  lead: `text-lg ${SUMMARY_BASE}`,
  step: `text-base ${SUMMARY_BASE}`,
  inline: `text-base ${SUMMARY_BASE}`,
} as const satisfies Record<ChapterSize, string>;

/** The lead story sits under the rule; the rest follows after the same pause. */
const GAP_CLASS = 'mt-[clamp(2rem,1.5rem+1.5vw,3rem)]';

export interface ChapterOpenerProps {
  /** The section's id, the jump links' target: chapterId('2026') is 'y2026'. */
  readonly id: string;
  /** The year or word set large: 2026, 'Featured', 'Now'. */
  readonly title: string | number;
  /** One line in words ('ResQ Developer Platform, synapse and five more.'); <em> lifts a name. */
  readonly summary?: ReactNode;
  /** The counts, in sentence case: ['7 projects', { text: '3 in progress', tone: 'ongoing' }]. */
  readonly byline?: readonly BylinePart[];
  /**
   * 'lead' (first chapter), 'step' (later ones, the default) or 'inline' (one item, or a word
   * chapter set small on purpose: 'Featured', 'Now').
   */
  readonly size?: ChapterSize;
  /** The title's heading level; 2 by default. */
  readonly level?: 2 | 3;
  /** The chapter's one dominant story, set right under the opener's rule. */
  readonly lead?: ReactNode;
  /** The rest of the chapter: briefs, a list, a wall. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * A chapter: its opener, its lead story and the rest.
 *
 * @example
 * <ChapterOpener
 *   id={chapterId(2026)}
 *   title={2026}
 *   size={chapterSize({ index: 1, count: 7 })}
 *   summary={<><em>ResQ Developer Platform</em>, <em>synapse</em> and five more.</>}
 *   byline={['7 projects', { text: '3 in progress', tone: 'ongoing' }]}
 *   lead={<LeadStory project={lead} />}
 * >
 *   <Briefs projects={rest} />
 * </ChapterOpener>
 */
export function ChapterOpener({
  id,
  title,
  summary,
  byline,
  size = 'step',
  level = 2,
  lead,
  children,
  className,
}: ChapterOpenerProps): ReactElement {
  const Heading = `h${level}` as const;
  const headingId = `${id}-title`;
  const fit = { '--folio-fit': String(widestWordUnits(String(title))) } as CSSProperties;
  const hasSummary = hasContent(summary);
  const hasByline = bylineItems(byline ?? []).length > 0;
  const heading = (
    <Heading id={headingId} className={TITLE_CLASS[size]} style={fit}>
      {title}
    </Heading>
  );
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-chapter={size}
      className={cn(JUMP_MARGIN_CLASS, SECTION_CLASS[size], className)}
    >
      <header className={HEADER_CLASS[size]}>
        {size === 'inline' ? heading : <div className={TITLE_CELL_CLASS}>{heading}</div>}
        {hasSummary || hasByline ? (
          <div className={DEK_CLASS[size]}>
            {hasSummary ? <p className={SUMMARY_CLASS[size]}>{summary}</p> : null}
            {hasByline ? (
              <Byline parts={byline ?? []} className={size === 'inline' ? undefined : 'mt-1.5'} />
            ) : null}
          </div>
        ) : null}
      </header>
      {hasContent(lead) ? (
        <div data-chapter-lead="" className={GAP_CLASS}>
          {lead}
        </div>
      ) : null}
      {hasContent(children) ? (
        <div data-chapter-body="" className={GAP_CLASS}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
