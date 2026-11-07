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
 * @file The pieces every home tile shares: its h2 label, its context line, a figure with its unit,
 * the designed empty and error notes, skeleton bars and links. Server-safe and pure (no directive,
 * no hooks, no I/O), so the server tiles, their skeletons and the error fallbacks all render them.
 *
 * The type is the refined set from globals.css (tile-label, tile-meta, figure-*), each paired with
 * a colour. Tiles hug their content: nothing here pushes itself to a tile's foot.
 *
 * Links here sit above a linked tile's stretched overlay (`relative z-10`), so a note's link stays
 * clickable inside any tile. External links open a new tab and say so to screen readers.
 *
 * The tile state contract, which the browser checks rely on: a tile root that is not showing its
 * reference content (the loaded tile its skeleton and the server's estimates are measured from)
 * says why in `data-state`: 'loading' (a skeleton, also aria-busy), 'error', 'empty' or 'stale'.
 * 'loading' also marks a box reserved for copy still to come, with no aria-busy since its content
 * shows (the hero's tagline before this server has loaded the settings). A tile showing its
 * reference content carries 'ready' or keeps a state of its own that names a designed state of
 * the same size ('idle' for 'Not playing', a status level). A line that says when stale data was
 * read ('as of Nov 5') carries `data-stale`.
 */

import { ArrowUpRight, CircleAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { destinationOf, NEW_TAB_LABEL, numberFormatter, SrOnlyWords } from '@/components/console';
import { cn } from '@/lib/utils';
import { formatClockET, formatDay, type Instant } from '../data/format';

/** The GitHub profile the hero and the GitHub tile link to. */
export const GITHUB_PROFILE_URL = 'https://github.com/WomB0ComB0';

/**
 * Every tile label: the tile's h2, in sentence case as written ('Recently at'). A label that is a
 * new-tab link ends in TileLink's 14px arrow, taller than the label's 13px text: on the baseline
 * it would grow the 16px line by 2px past its skeleton's. Centred on the text, it fits.
 */
const LABEL_CLASS = 'tile-label text-muted-foreground [&_svg]:align-middle';
/** The context line: dates, ages, '60 s best · 93% accuracy'. */
const META_CLASS = 'tile-meta text-muted-foreground';
const NOTE_CLASS = 'flex flex-wrap items-center gap-x-2 gap-y-1 tile-sub text-muted-foreground';
const NOTE_ICON_CLASS = 'size-4 shrink-0 text-down';
/**
 * Forced colours (Windows contrast themes) paint every background as Canvas, so a bar would
 * vanish: an outline (forced to a system colour) keeps it a box, as SegmentBarSkeleton's. An
 * outline takes no space, so the bar's size is the same in every mode.
 */
export const FORCED_COLORS_BOX_CLASS = 'forced-colors:outline';
const SKELETON_CLASS = `block rounded-md bg-surface-3 motion-safe:animate-pulse ${FORCED_COLORS_BOX_CLASS}`;
/**
 * A text placeholder: a bar the size of the text it stands for. That text (data-shape) is drawn as
 * hidden generated content, so the bar takes the loaded text's advance and wraps where it will,
 * and the document holds none of it (without CSS it shows nothing).
 *
 * Hidden by visibility, never by colour: forced colours repaint transparent text in the system
 * text colour, and the '0,000' and '88% accuracy' would read as data. `before:invisible` keeps
 * the text's advance and line breaks, and nothing of it paints in any colour mode.
 */
const SHAPE_PLACEHOLDER_CLASS = `rounded-md bg-surface-3 motion-safe:animate-pulse ${FORCED_COLORS_BOX_CLASS} before:invisible before:content-[attr(data-shape)]`;
/** Every tabular digit is as wide as any other, so a figure's shape is set in this one. */
const SHAPE_DIGIT = '0';
/** A text link inside a tile, above a linked tile's overlay. */
const TEXT_LINK_CLASS =
  'relative z-10 inline-flex items-center gap-0.5 font-medium text-brand-ink underline-offset-4 hover:underline';
const ARROW_CLASS = 'size-3.5 shrink-0';

/**
 * `data-dated` for text the server words from today's date ('yesterday', '6 d ago'), which changes
 * from one day to the next with no new data: screenshots mask just that text.
 */
const datedAttribute = (dated: boolean | undefined) => (dated ? { 'data-dated': '' } : {});

export interface TileLabelProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A tile's name, as the h2 that names its part of the page. Its words never depend on today's
 * date, so screenshots always compare it (only TileMeta can be `dated`).
 */
export function TileLabel({ id, className, children }: TileLabelProps): ReactElement {
  return (
    <h2 id={id} className={cn(LABEL_CLASS, className)}>
      {children}
    </h2>
  );
}

export interface TileMetaProps {
  className?: string;
  /** The words depend on today's date (marked data-dated). */
  dated?: boolean;
  /** The line says when stale data was read (marked data-stale, the tile state contract). */
  stale?: boolean;
  children: ReactNode;
}

/** `data-stale` for a line that says when stale data was read: 'as of Nov 5'. */
export const staleAttribute = (stale: boolean | undefined): { 'data-stale'?: '' } =>
  stale ? { 'data-stale': '' } : {};

/** One line of context, e.g. 'Event · Aug 21'. */
export function TileMeta({ className, dated, stale, children }: TileMetaProps): ReactElement {
  return (
    <p className={cn(META_CLASS, className)} {...datedAttribute(dated)} {...staleAttribute(stale)}>
      {children}
    </p>
  );
}

export interface ExternalAnchorProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * A link that opens a new tab: an arrow for sighted readers, '(opens in a new tab)' for screen
 * readers. Renders its children as text when `href` leads nowhere.
 */
export function ExternalAnchor({ href, className, children }: ExternalAnchorProps): ReactElement {
  const destination = destinationOf(href);
  if (destination === null) return <span className={className}>{children}</span>;
  return (
    <a href={destination} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ArrowUpRight aria-hidden="true" className={ARROW_CLASS} />
      <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
    </a>
  );
}

interface NoteLinkProps {
  href?: string;
  external?: boolean;
  linkLabel?: string;
}

/** The note's way out: nothing without both a destination and words for it. */
function NoteLink({ href, external = false, linkLabel }: NoteLinkProps): ReactElement | null {
  const destination = destinationOf(href);
  if (destination === null || !linkLabel) return null;
  if (external) {
    return (
      <ExternalAnchor href={destination} className={TEXT_LINK_CLASS}>
        {linkLabel}
      </ExternalAnchor>
    );
  }
  return (
    <Link href={destination} prefetch={false} className={TEXT_LINK_CLASS}>
      {linkLabel}
    </Link>
  );
}

export interface TileNoteProps extends NoteLinkProps {
  /** What the visitor sees in place of the data, in words. */
  message: string;
  className?: string;
}

/**
 * The error state: what failed, in words, with an alert glyph and an optional link to the source.
 * It takes no error, so it cannot print one, and it never shows a number.
 */
export function TileUnavailable({ message, className, ...link }: TileNoteProps): ReactElement {
  return (
    <div className={cn(NOTE_CLASS, className)}>
      <CircleAlert aria-hidden="true" className={NOTE_ICON_CLASS} />
      <p>{message}</p>
      <NoteLink {...link} />
    </div>
  );
}

/** The empty state: the source answered with nothing to show. Not an error, so no alert. */
export function TileEmpty({ message, className, ...link }: TileNoteProps): ReactElement {
  return (
    <div className={cn(NOTE_CLASS, className)}>
      <p>{message}</p>
      <NoteLink {...link} />
    </div>
  );
}

/** A placeholder bar for a skeleton; size it with className. Decorative. */
export function SkeletonBar({ className }: { className?: string }): ReactElement {
  return <span aria-hidden="true" className={cn(SKELETON_CLASS, className)} />;
}

export interface SkeletonLineProps {
  /**
   * The type style of the line it stands in for, e.g. 'tile-meta'. The box is one line of that
   * style (1lh), so a skeleton line is as tall as the loaded line by construction.
   */
  type: string;
  /** The bar's own size, e.g. 'h-3 w-32'. */
  bar: string;
  className?: string;
}

/** One line of text while it loads: a box one line of `type` tall, with a bar in it. Decorative. */
export function SkeletonLine({ type, bar, className }: SkeletonLineProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-skeleton-line=""
      className={cn('flex h-[1lh] items-center', type, className)}
    >
      <SkeletonBar className={bar} />
    </span>
  );
}

/** A figure's tier, by its tile's size class and never the viewport: 28, 36 or 48 px. */
export type FigureSize = 'sm' | 'md' | 'lg';

const FIGURE_SIZE_CLASS = {
  sm: 'figure-sm',
  md: 'figure-md',
  lg: 'figure-lg',
} as const satisfies Record<FigureSize, string>;

const UNIT_CLASS = 'figure-unit text-muted-foreground';

export interface FigureRowProps {
  /** The figure, formatted: '1,300'. */
  value: string;
  /** The words after it: 'solved', 'contributions in 12 weeks'. */
  unit: string;
  size: FigureSize;
}

/**
 * A figure and its unit on one baseline (figure-row). In a narrow tile the unit wraps under the
 * figure instead of running past the tile.
 */
export function FigureRow({ value, unit, size }: FigureRowProps): ReactElement {
  return (
    <p className="figure-row">
      <span className={cn(FIGURE_SIZE_CLASS[size], 'text-foreground')}>{value}</span>{' '}
      <span className={UNIT_CLASS}>{unit}</span>
    </p>
  );
}

export interface FigureRowSkeletonProps extends Omit<FigureRowProps, 'value'> {
  /** How many digits the expected figure has: 4 for '1,300'. */
  digits: number;
}

export interface ShapePlaceholderProps {
  /** The text the bar stands for, as wide as the loaded text will be: '0,000', '60 s best · …'. */
  shape: string;
  /** The type it is set in, when the parent's is not the loaded text's: 'figure-lg'. */
  className?: string;
}

/**
 * A bar exactly as big as `shape` set in its type, wrapping where that text would. Decorative:
 * the tile's loading note says what is loading.
 */
export function ShapePlaceholder({ shape, className }: ShapePlaceholderProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-shape={shape}
      className={cn(className, SHAPE_PLACEHOLDER_CLASS)}
    />
  );
}

/**
 * The shape of a figure of `digits` digits, in zeros and grouped as the figure will be: 4 gives
 * '0,000', exactly as wide as '1,300' in tabular figures. Only ever drawn by a ShapePlaceholder,
 * never as text, so it never reads as a number. (Figure spaces were 13 px too wide for four digits
 * at 48 px: Geist has no U+2007, so they came from the fallback font, and the GitHub skeleton
 * wrapped its unit where the figure did not.)
 */
export const figureShape = (digits: number): string =>
  numberFormatter()
    .format(10 ** Math.max(0, digits - 1))
    .replace(/\d/gu, SHAPE_DIGIT);

export interface FigurePlaceholderProps {
  /** How many digits the expected figure has: 4 for '1,300'. */
  digits: number;
  /** The figure's type: figure-lg, figure-md or figure-sm. */
  className: string;
}

/** A bar exactly as big as a figure of `digits` digits in the given type. Decorative. */
export function FigurePlaceholder({ digits, className }: FigurePlaceholderProps): ReactElement {
  return <ShapePlaceholder shape={figureShape(digits)} className={className} />;
}

/**
 * A FigureRow while its figure loads: the real unit beside a placeholder set in the figure's own
 * type and as wide as the expected figure. So it has the loaded row's height and wraps the unit
 * where the loaded row does. Decorative; the tile's loading note says what is loading.
 */
export function FigureRowSkeleton({ digits, unit, size }: FigureRowSkeletonProps): ReactElement {
  return (
    <p aria-hidden="true" className="figure-row">
      <FigurePlaceholder digits={digits} className={FIGURE_SIZE_CLASS[size]} />{' '}
      <span className={UNIT_CLASS}>{unit}</span>
    </p>
  );
}

/**
 * The context line of data served past its deadline: a clock, then when it was read ('as of Nov 5
 * 11:02 AM ET'). Nothing without words. Dated: the day gains its year once the year turns. Marked
 * data-stale.
 */
export function StaleNote({ children }: { children: string }): ReactElement | null {
  if (!children) return null;
  return (
    <TileMeta dated stale className="flex items-center gap-1.5">
      <Clock aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </TileMeta>
  );
}

/** What a skeleton says to screen readers while its tile loads, e.g. 'Loading GitHub activity'. */
export function LoadingNote({ children }: { children: string }): ReactElement {
  return <span className="sr-only">{children}</span>;
}

/**
 * 'as of Nov 5 11:02 AM ET': when stale data was loaded, as an absolute New York time. '' when
 * `iso` is not a date.
 */
export function asOfText(iso: string, now: Instant): string {
  const day = formatDay(iso, now);
  const clock = formatClockET(Date.parse(iso));
  return day && clock ? `as of ${day} ${clock}` : '';
}

/**
 * Between the parts of a context line. The no-break space keeps the dot on the line before it
 * when the line wraps, so no line starts with '·'.
 */
export const META_SEPARATOR = ' · ';

/** The parts of a context line that have words, joined by {@link META_SEPARATOR}. */
export const joinMeta = (parts: readonly (string | null | undefined)[]): string =>
  parts.filter((part): part is string => Boolean(part)).join(META_SEPARATOR);
