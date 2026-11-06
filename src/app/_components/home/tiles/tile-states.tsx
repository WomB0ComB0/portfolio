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
 * @file The pieces every home tile shares: its h2 label, the context line at its foot, the
 * designed empty and error notes, skeleton bars and links. Server-safe and pure (no directive, no
 * hooks, no I/O), so the server tiles, their skeletons and the error fallbacks all render them.
 *
 * Links here sit above a linked tile's stretched overlay (`relative z-10`), so a note's link stays
 * clickable inside any tile. External links open a new tab and say so to screen readers.
 */

import { ArrowUpRight, CircleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { destinationOf, NEW_TAB_LABEL, SrOnlyWords } from '@/components/console';
import { cn } from '@/lib/utils';
import { formatClockET, formatDay, type Instant } from '../data/format';

/** The GitHub profile the hero and the GitHub tile link to. */
export const GITHUB_PROFILE_URL = 'https://github.com/WomB0ComB0';

/** Every tile label: the tile's h2. */
const LABEL_CLASS = 'label-mono text-muted-foreground';
/** The context line, pushed to the tile's foot (tiles are flex columns). */
const META_CLASS = 'mt-auto font-mono text-meta text-muted-foreground';
const NOTE_CLASS = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground';
const NOTE_ICON_CLASS = 'size-4 shrink-0 text-down';
const SKELETON_CLASS = 'block rounded-md bg-surface-3 motion-safe:animate-pulse';
/** A text link inside a tile, above a linked tile's overlay. */
const TEXT_LINK_CLASS =
  'relative z-10 inline-flex items-center gap-0.5 font-medium text-brand-ink underline-offset-4 hover:underline';
const ARROW_CLASS = 'size-3.5 shrink-0';

/**
 * `data-dated` for text the server words from today's date ('Here now', '6 d ago'), which changes
 * from one day to the next with no new data: screenshots mask just that text.
 */
const datedAttribute = (dated: boolean | undefined) => (dated ? { 'data-dated': '' } : {});

export interface TileLabelProps {
  id?: string;
  className?: string;
  /** The words depend on today's date (marked data-dated). */
  dated?: boolean;
  children: ReactNode;
}

/** A tile's name, as the h2 that names its part of the page. */
export function TileLabel({ id, className, dated, children }: TileLabelProps): ReactElement {
  return (
    <h2 id={id} className={cn(LABEL_CLASS, className)} {...datedAttribute(dated)}>
      {children}
    </h2>
  );
}

export interface TileMetaProps {
  className?: string;
  /** The words depend on today's date (marked data-dated). */
  dated?: boolean;
  children: ReactNode;
}

/** One line of context at the tile's foot, e.g. 'updated 5 min ago'. */
export function TileMeta({ className, dated, children }: TileMetaProps): ReactElement {
  return (
    <p className={cn(META_CLASS, className)} {...datedAttribute(dated)}>
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

/** The parts of a context line that have words, joined by ' · '. */
export const joinMeta = (parts: readonly (string | null | undefined)[]): string =>
  parts.filter((part): part is string => Boolean(part)).join(' · ');
