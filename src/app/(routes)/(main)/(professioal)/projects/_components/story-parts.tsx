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
 * @file The parts every /projects story shares (the lead story, a feature, a brief): the cover in
 * its frame (the image, or the Folio type cover when a project has none), the title's link (the
 * story's one link to its page, stretched over the whole story), Code and Live above it, and the
 * byline's words. Server-safe (no directive, no hooks), so the filter island can draw them and
 * the HTML reads without JavaScript.
 *
 * The hover is one system: the story is `group/story`; its cover lifts 4px on translate (the
 * house spring), its light (the brand rim and halo, --shadow-lift) fades in on opacity, and the
 * picture eases in 3.5% on scale. Keyboard focus on the title link reaches the same light at once
 * and rings the whole story. Reduced motion keeps the light and drops the movement. Palette only.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { BylinePart } from '@/components/console/folio/byline-items';
import { TypeCover } from '@/components/console/folio/type-cover';
import { widestWordUnits } from '@/components/console/folio/word-measure';
import { NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { LinkPending } from '@/components/data/link-pending';
import { cn } from '@/lib/utils';
import { WIDE_MIN_RATIO } from '../_lib/project-chapters';
import type { ProjectEntry, ProjectImage } from '../_lib/project-index';
import { focusPosition } from '../_lib/project-screens';
import { projectHref } from '../_lib/project-text';
import { monthYear } from '../_lib/project-words';

/**
 * A #story-<id> link (a year's 'Also in Featured') lands clear of the pinned filter bar, as a
 * chapter's own jump does (ChapterOpener).
 */
const ANCHOR_MARGIN_CLASS =
  'scroll-mt-[max(1rem,calc(var(--filter-bar-h,0px)+1.5rem-var(--edge-haze-top,0px)))]';

/**
 * A story: positioned (the stretched link and the light), a hover group and an anchor. A story
 * with no plate (a lead, a feature, a wide brief) takes STORY_RING_CLASS too; a row lights and
 * rings its plate instead, so it never needs a radius of its own.
 */
export const STORY_CLASS = `group/story relative isolate min-w-0 ${ANCHOR_MARGIN_CLASS}`;

/** Keyboard focus on the story's link rings the whole story, its corners rounded. */
export const STORY_RING_CLASS = [
  'rounded-xl',
  'has-[[data-story-link]:focus-visible]:outline-2 has-[[data-story-link]:focus-visible]:outline-offset-4 has-[[data-story-link]:focus-visible]:outline-focus',
].join(' ');

/**
 * The hairline over a row or an entry: drawn by the story's ::after rather than a border, so it
 * stays a straight line whatever radius the story's ring or plate has (a rounded box curls a top
 * border down at its corners, and stacked rows read as card tops).
 */
export const HAIRLINE_CLASS =
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-hairline after:content-['']";

/**
 * A row's plate: surface-1 with the brand rim and halo, inside its column (the row pads its words
 * instead), on opacity only; keyboard focus reaches it at once and rings it. The only radius a
 * row has is this plate's.
 */
export const PLATE_CLASS = [
  'before:pointer-events-none before:absolute before:inset-x-0 before:-z-10 before:rounded-xl before:bg-surface-1 before:shadow-lift before:opacity-0',
  'before:transition-opacity before:duration-(--motion-slow) before:ease-effect',
  'hover:before:opacity-100 hover:before:duration-(--motion-base)',
  'has-[[data-story-link]:focus-visible]:before:opacity-100 has-[[data-story-link]:focus-visible]:before:duration-0',
  'has-[[data-story-link]:focus-visible]:before:outline-2 has-[[data-story-link]:focus-visible]:before:outline-offset-2 has-[[data-story-link]:focus-visible]:before:outline-focus',
].join(' ');

/** A story's anchor on the Stories view, the target of a year's 'Also in Featured' link. */
export const storyAnchor = (id: string): string => `story-${id}`;

/**
 * A brief's or an entry's title as tile-title draws it, its size capped by its column over its
 * widest word (calc(100cqi / (--folio-fit * 0.6)), word-measure's units), so a word never
 * outgrows its line, even at 200% text in a 320px window. Its column must be a size container
 * (@container), and the title takes titleFit's style. Spelled out whole, as Tailwind reads class
 * names from the source.
 */
export const FIT_TITLE_CLASS =
  'font-sans font-semibold leading-[1.375rem] tracking-[-0.011em] text-balance text-[length:min(1rem,calc(100cqi/(var(--folio-fit,8)*0.6)))]';

/** The title's widest word, for FIT_TITLE_CLASS (and the lead's display size). */
export const titleFit = (title: string): CSSProperties =>
  ({ '--folio-fit': String(widestWordUnits(title)) }) as CSSProperties;

/** The cover's lift: translate on the spring; under reduced motion it stays put. */
const LIFT_CLASS = [
  'relative block transition-[translate] duration-(--motion-spring-out) ease-spring',
  'motion-safe:group-hover/story:-translate-y-1 group-hover/story:duration-(--motion-spring-in)',
  // The light: the brand rim and halo on one layer over the frame, on opacity only.
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-[0.625rem] after:shadow-lift after:opacity-0',
  'after:transition-opacity after:duration-(--motion-slow) after:ease-effect',
  'group-hover/story:after:opacity-100 group-hover/story:after:duration-(--motion-base)',
  // Keyboard focus on the story's link: the same light at once.
  'group-has-[[data-story-link]:focus-visible]/story:after:opacity-100 group-has-[[data-story-link]:focus-visible]/story:after:duration-0',
].join(' ');

/** The frame clips the picture to its corners; a hairline sits over its edge. */
const FRAME_CLASS = [
  'relative block overflow-hidden rounded-[0.625rem] bg-surface-2',
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--hairline)]',
].join(' ');

const IMAGE_CLASS = [
  'transition-[scale] duration-(--motion-spring-out) ease-spring',
  'motion-safe:group-hover/story:scale-[1.035] group-hover/story:duration-(--motion-spring-in)',
].join(' ');

/** A square or portrait picture sits whole on the frame's mat rather than being cropped. */
const MAT_CLASS = 'object-contain p-[8%]';

export interface StoryCoverProps {
  readonly title: string;
  readonly image: ProjectImage | undefined;
  /** next/image sizes, for the place the cover is drawn at. */
  readonly sizes: string;
  /** The frame's shape: 'aspect-video', 'aspect-[16/10]'. */
  readonly aspect: string;
  /** Only the page's first lead loads at once; every other cover is lazy. */
  readonly eager?: boolean;
  /** No lift or light of its own (a brief row lights its whole plate instead); it still zooms. */
  readonly still?: boolean;
  readonly className?: string;
}

/** A story's cover in its frame, lifting with its story: the picture, or the type cover. */
export function StoryCover({
  title,
  image,
  sizes,
  aspect,
  eager = false,
  still = false,
  className,
}: StoryCoverProps): ReactElement {
  const wide = image !== undefined && image.ratio >= WIDE_MIN_RATIO;
  return (
    <span className={cn(still ? 'relative block' : LIFT_CLASS, className)} data-story-cover="">
      <span className={cn(FRAME_CLASS, aspect)}>
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes={sizes}
            draggable={false}
            {...(eager ? { preload: true, loading: 'eager', fetchPriority: 'high' } : {})}
            className={cn(IMAGE_CLASS, wide ? 'object-cover' : MAT_CLASS)}
            style={wide ? { objectPosition: focusPosition(image.focus) } : undefined}
          />
        ) : (
          <TypeCover title={title} fill />
        )}
      </span>
    </span>
  );
}

/** The title link: the story's one link to its page, its hit area stretched over the story. */
const STORY_LINK_CLASS = [
  'rounded-sm text-foreground outline-none',
  'after:absolute after:inset-0 after:z-[1] after:content-[""]',
].join(' ');

/** The story's link to its page, around its title. */
export function StoryLink({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Link href={projectHref(id)} prefetch={false} data-story-link="" className={STORY_LINK_CLASS}>
      {children}
      <LinkPending className="ms-2 size-2.5 align-middle" />
    </Link>
  );
}

/**
 * Code and Live: above the stretched link, each its own target, 32px tall under a mouse and 44px
 * under a finger (the site's touch target). The negative margins take back what the target adds,
 * so the byline's line is 24px either way.
 */
const ACTION_CLASS = [
  'relative z-[2] -my-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 tile-meta text-muted-foreground pointer-coarse:-my-2.5 pointer-coarse:min-h-11',
  'underline decoration-hairline-strong underline-offset-4 transition-colors duration-(--motion-fast) ease-effect',
  'hover:text-foreground hover:decoration-current focus-visible:text-foreground focus-visible:decoration-current',
].join(' ');

/** Code and Live for a story, in a new tab, each named for its project. */
export function StoryActions({
  entry,
  className,
}: {
  readonly entry: Pick<ProjectEntry, 'title' | 'liveUrl' | 'githubUrl'>;
  readonly className?: string;
}): ReactElement | null {
  const links = [
    { label: 'Live', href: entry.liveUrl },
    { label: 'Code', href: entry.githubUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
  if (links.length === 0) return null;
  // The links' own padding hangs outside the line, so their words line up with the text's edge
  // whether they sit at the end of the byline's line or wrap under it.
  return (
    <span className={cn('-mx-1.5 flex flex-wrap items-center gap-x-1', className)}>
      {links.map(({ label, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-project-link={label.toLowerCase()}
          className={ACTION_CLASS}
        >
          {label}
          <span aria-hidden="true">↗</span>
          <SrOnlyWords>
            for {entry.title} {NEW_TAB_LABEL}
          </SrOnlyWords>
        </a>
      ))}
    </span>
  );
}

/** The arrow a story's hover slides in; keyboard focus moves it at once. */
export const ARROW_CLASS = [
  'inline-block text-brand-ink transition-[translate] duration-(--motion-spring-out) ease-spring',
  'motion-safe:group-hover/story:translate-x-1 group-hover/story:duration-(--motion-spring-in)',
  'motion-safe:group-has-[[data-story-link]:focus-visible]/story:translate-x-1 group-has-[[data-story-link]:focus-visible]/story:duration-0',
].join(' ');

/** A status part: 'In progress' with the house dot, else nothing. */
const statusPart = (entry: Pick<ProjectEntry, 'ongoing'>): BylinePart =>
  entry.ongoing ? { text: 'In progress', tone: 'ongoing' } : null;

/** A brief's byline: 'CLI Tool · Feb 2026 · In progress'. */
export const briefByline = (
  entry: Pick<ProjectEntry, 'kindLabels' | 'started' | 'ongoing'>,
): BylinePart[] => [
  entry.kindLabels[0],
  entry.started ? monthYear(entry.started) : null,
  statusPart(entry),
];

/** A lead story's byline, with the whole run: 'Public Safety · Apr 2026 – now · In progress'. */
export const leadByline = (
  entry: Pick<ProjectEntry, 'kindLabels' | 'period' | 'ongoing'>,
): BylinePart[] => [entry.kindLabels[0], entry.period, statusPart(entry)];
