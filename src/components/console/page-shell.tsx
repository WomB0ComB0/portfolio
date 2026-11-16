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
 * @file The Live Console page frame: a left-aligned header (eyebrow, the page's one h1, a short
 * description, actions and a stat strip) above the page's content. Server-safe (no directive).
 *
 * It replaces the centred PageHeader as pages migrate. It renders no <main>: the shell's
 * PageMain is the landmark. Inside the shell, PageMain has no horizontal padding, so PageShell
 * applies the page gutter itself unless `gutter` is false.
 *
 * The type is the refined set (globals.css): the h1 is page-title (Geist 600, sized by the page
 * container), the eyebrow a sentence-case tile-label, never the chrome's upper-case mono caption.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { hasContent } from '@/components/console/has-content';
import { cn } from '@/lib/utils';

/**
 * What the header's one step answers to:
 * - `viewport` (the default): the md viewport, as /projects and /certifications shipped.
 * - `container`: the page container, once it is 29 lines of its own text wide (754px at the
 *   default size, so a 768px window with a classic scrollbar, whose page is 758px, steps where
 *   the viewport header does). A page beside the rail is 64px narrower than its
 *   window, and a phone can enlarge text without changing rem: lh follows both, so the stats are
 *   never squeezed beside the title. Where a browser does not read lh in a container query the
 *   rule is dropped whole, which leaves the stacked header. On a short screen (a phone on its
 *   side) the gaps also tighten, so the content starts on the first screen.
 */
export type PageShellSizing = 'viewport' | 'container';

const ROOT_CLASS = {
  viewport: 'flex flex-col gap-5 md:gap-6',
  container: 'flex flex-col gap-5 @min-[29lh]/page:gap-6 [@media(max-height:30rem)]:gap-2',
} as const satisfies Record<PageShellSizing, string>;
const GUTTER_CLASS = 'px-(--page-gutter)';
const HEADER_CLASS = {
  viewport:
    'grid gap-4 border-b border-hairline pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6 md:pb-5',
  container:
    'grid gap-4 border-b border-hairline pb-4 @min-[29lh]/page:grid-cols-[minmax(0,1fr)_auto] @min-[29lh]/page:items-end @min-[29lh]/page:gap-6 @min-[29lh]/page:pb-5 [@media(max-height:30rem)]:gap-y-2 [@media(max-height:30rem)]:pb-2',
} as const satisfies Record<PageShellSizing, string>;
/**
 * With text enlarged on a narrow page (under 18rem: a phone at 150% and up), one long word was
 * wider than the line ('Experienc|e' at 175% in a 320px window, 'Informatio|n' at 200% in a 390px
 * one) and broke mid-word. There the title steps down to the line (the page less its two
 * gutters) over its longest word's width (titleWordWidth, at 0.62em a letter), between the body
 * text's 1rem and its own 2rem: a short title keeps its size, a long one gives only what its word
 * needs. A title that is not plain text counts as 14 letters. The page is never under 18rem at
 * the browser's own text size, so nothing changes there. A word still wider than the line at
 * 1rem breaks anywhere, as the last resort.
 */
const TITLE_CLASS =
  'page-title text-foreground [overflow-wrap:anywhere] @max-[18rem]/page:text-[length:clamp(1rem,calc((100cqi_-_2_*_var(--page-gutter))_/_(var(--page-title-word,14)_*_0.62)),2rem)]';

/** Letters about half as wide as most in Geist 600 ('i' 0.22em, 't' 0.36em against 'e' 0.55em). */
const NARROW_LETTER = /[fijlrtI.,:;'’()!|-]/u;
/** Letters about half as wide again ('m' 0.84em, 'W' 0.96em). */
const WIDE_LETTER = /[mwMW]/u;
/** Other capitals and figures, about a fifth wider than most letters. */
const BROAD_LETTER = /[\p{Lu}\p{Nd}]/u;

const letterWidth = (letter: string): number => {
  if (NARROW_LETTER.test(letter)) return 0.5;
  if (WIDE_LETTER.test(letter)) return 1.5;
  return BROAD_LETTER.test(letter) ? 1.2 : 1;
};

/**
 * How wide the title's longest word is, in letters of the usual width (a narrow 'i' counts half,
 * a wide 'm' one and a half), when the title is plain text: the narrow-page size above divides
 * the line by it. At 0.62em a letter it is a little over every title word measured in Geist 600
 * at 24px to 64px (the widest, 'Undergraduate', is 0.595em a letter at 24px). A line may break
 * at a space or after a hyphen.
 */
function titleWordWidth(title: ReactNode): number | undefined {
  if (typeof title !== 'string' && typeof title !== 'number') return undefined;
  const widths = String(title)
    .split(/\s+|(?<=-)/u)
    .map((word) => Array.from(word).reduce((sum, letter) => sum + letterWidth(letter), 0));
  const widest = Math.max(0, ...widths);
  return widest > 0 ? Math.round(widest * 10) / 10 : undefined;
}

const EYEBROW_CLASS = 'tile-label text-muted-foreground';
const DESCRIPTION_CLASS = 'max-w-[60ch] text-body text-muted-foreground';
/** With actions beside the title, the stats take a row of their own under both. */
const STATS_UNDER_CLASS = {
  viewport: 'md:col-span-2',
  container: '@min-[29lh]/page:col-span-2',
} as const satisfies Record<PageShellSizing, string>;

export interface PageShellProps {
  /** The page's one h1. */
  title: ReactNode;
  /** A short sentence-case line above the title, e.g. 'Work'. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /**
   * Usually a StatStrip. On wide screens it sits beside the title, or, when there are actions
   * there, in a row of its own under both; on a phone it comes under the title.
   */
  stats?: ReactNode;
  /** Buttons or links beside the title on wide screens, under it on narrow ones. */
  actions?: ReactNode;
  /** Pads the sides with --page-gutter. Turn it off when a parent already pads. */
  gutter?: boolean;
  /**
   * What the header's step answers to: the md `viewport` (default), or the page `container` in
   * lines of its own text, with tighter gaps on a short screen (see PageShellSizing). Pair
   * `container` with a StatStrip of the same sizing, which steps at the same width.
   */
  sizing?: PageShellSizing;
  className?: string;
  children?: ReactNode;
}

/**
 * A page's header and content.
 *
 * @example
 * <PageShell eyebrow="Work" title="Projects" description="Things I built." stats={<StatStrip items={counts} />}>
 *   <TileGrid>...</TileGrid>
 * </PageShell>
 */
export function PageShell({
  title,
  eyebrow,
  description,
  stats,
  actions,
  gutter = true,
  sizing = 'viewport',
  className,
  children,
}: PageShellProps): ReactElement {
  const titleWord = titleWordWidth(title);
  const titleStyle =
    titleWord === undefined
      ? undefined
      : ({ '--page-title-word': String(titleWord) } as CSSProperties);
  return (
    <div className={cn(ROOT_CLASS[sizing], gutter && GUTTER_CLASS, className)}>
      <header className={HEADER_CLASS[sizing]}>
        <div className="min-w-0 space-y-2">
          {hasContent(eyebrow) && <p className={EYEBROW_CLASS}>{eyebrow}</p>}
          <h1 className={TITLE_CLASS} style={titleStyle}>
            {title}
          </h1>
          {hasContent(description) && <p className={DESCRIPTION_CLASS}>{description}</p>}
        </div>
        {hasContent(actions) && <div className="flex flex-wrap gap-2">{actions}</div>}
        {hasContent(stats) && (
          <div className={cn('min-w-0', hasContent(actions) && STATS_UNDER_CLASS[sizing])}>
            {stats}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
