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
 * @file A picture-and-caption brief on /projects, at one of three sizes, so a chapter steps down
 * from its lead instead of repeating one tile:
 * - `feature`: one of the unequal pair under a lead: a picture on top, the title at up to 2rem
 *   (sized by its own width, so the wide one is larger), three lines of description.
 * - `wide`: the Featured chapter's odd one out after its pair: the words beside a 5-column
 *   picture on the side the lead's picture is not, so no brief is left alone on a line.
 * - `row`: the rest: a small picture beside the words, two to a line on a wide page.
 * On a phone every size is the compact row (a 5.5rem picture beside the title, two lines, the
 * byline), so the page stays short. The title link is the brief's one link to its page,
 * stretched over it; Code and Live sit above it. Each brief is an anchor (#story-<id>) a year's
 * 'Also in Featured' links to. Server-safe (no directive, no hooks).
 *
 * A title is never wider than its column: its size is the smaller of its own and its column over
 * its widest word (--folio-fit, word-measure units at 0.6em), so text at 200% in a 320px window
 * wraps whole words and never breaks one.
 */

import type { ReactElement } from 'react';

import { Byline } from '@/components/console/folio/byline';
import { cn } from '@/lib/utils';
import type { ProjectEntry } from '../_lib/project-index';
import {
  briefByline,
  FIT_TITLE_CLASS,
  HAIRLINE_CLASS,
  PLATE_CLASS,
  STORY_CLASS,
  STORY_RING_CLASS,
  StoryActions,
  StoryCover,
  StoryLink,
  storyAnchor,
  titleFit,
} from './story-parts';

export type BriefLayout = 'feature' | 'wide' | 'row';

/**
 * The phone's compact row, shared by every size: a straight hairline over it, the picture beside
 * the words. Below a 20rem page, which only enlarged text reaches (a 390px phone at 200%), the
 * picture would squeeze the words to a sliver, so the brief stacks: the picture over the words,
 * each at the full width. Its rows never stretch, so titles side by side share a line.
 */
const ROW_BASE = [
  'grid grid-cols-[5.5rem_minmax(0,1fr)] content-start items-start gap-x-3.5 py-4',
  HAIRLINE_CLASS,
  '@max-[20rem]/page:grid-cols-1 @max-[20rem]/page:gap-y-3',
].join(' ');

/** From a 40rem page a feature or a wide brief drops the row's hairline and padding. */
const OPEN_CLASS = '@min-[40rem]/page:py-0 @min-[40rem]/page:after:hidden';

const ROOT_CLASS = {
  feature: `${ROW_BASE} ${STORY_RING_CLASS} ${OPEN_CLASS} @min-[40rem]/page:grid-cols-1 @min-[40rem]/page:gap-y-4`,
  wide: `${ROW_BASE} ${STORY_RING_CLASS} ${OPEN_CLASS} @min-[40rem]/page:grid-cols-12 @min-[40rem]/page:items-center @min-[40rem]/page:gap-x-[clamp(1.5rem,0.5rem+2.5vw,3rem)]`,
  row: [
    ROW_BASE,
    '@min-[40rem]/page:grid-cols-[8rem_minmax(0,1fr)] @min-[40rem]/page:gap-x-5 @min-[40rem]/page:px-3 @min-[40rem]/page:py-5',
    PLATE_CLASS,
    'before:inset-y-1.5',
  ].join(' '),
} as const satisfies Record<BriefLayout, string>;

/** The wide brief: its picture in the last 5 of 12 columns, its words in the first 6. */
const COVER_CLASS = {
  feature: undefined,
  wide: '@min-[40rem]/page:col-span-5 @min-[40rem]/page:col-start-8 @min-[40rem]/page:row-start-1',
  row: undefined,
} as const satisfies Record<BriefLayout, string | undefined>;
const WORDS_CLASS = {
  feature: '@container min-w-0',
  wide: '@container min-w-0 @min-[40rem]/page:col-span-6 @min-[40rem]/page:col-start-1 @min-[40rem]/page:row-start-1',
  row: '@container min-w-0',
} as const satisfies Record<BriefLayout, string>;

const TITLE_BASE = FIT_TITLE_CLASS;
/** The pair and the wide brief: up to 2rem, by the words' own width. */
const TITLE_LARGE =
  '@min-[40rem]/page:text-[length:min(clamp(1.375rem,0.75rem+3cqi,2rem),calc(100cqi/(var(--folio-fit,8)*0.6)))] @min-[40rem]/page:leading-[1.12] @min-[40rem]/page:tracking-[-0.03em]';
const TITLE_CLASS = {
  feature: `${TITLE_BASE} ${TITLE_LARGE}`,
  wide: `${TITLE_BASE} ${TITLE_LARGE}`,
  // Room for the hover arrow, which only a wide page shows.
  row: `${TITLE_BASE} @min-[40rem]/page:pe-6 @min-[40rem]/page:text-[length:min(1.0625rem,calc(100cqi/(var(--folio-fit,8)*0.6)))]`,
} as const satisfies Record<BriefLayout, string>;

const SUMMARY_BASE = 'mt-1 line-clamp-2 tile-sub text-muted-foreground [text-wrap:pretty]';
const SUMMARY_LARGE =
  '@min-[40rem]/page:mt-2 @min-[40rem]/page:line-clamp-3 @min-[40rem]/page:text-base @min-[40rem]/page:leading-relaxed';
const SUMMARY_CLASS = {
  feature: `${SUMMARY_BASE} ${SUMMARY_LARGE}`,
  wide: `${SUMMARY_BASE} ${SUMMARY_LARGE}`,
  row: SUMMARY_BASE,
} as const satisfies Record<BriefLayout, string>;

/**
 * next/image sizes: the phone row's 88px picture, else the size's own width. The first entry is
 * the stacked brief under a 20rem page: a media query's em follows the browser's text size, as the
 * container's rem does, so a phone at 200% fetches the picture at the full width it is drawn at.
 */
const STACKED_SIZE = '(max-width: 19.99em) 100vw';
const SIZES = {
  feature: `${STACKED_SIZE}, (min-width: 1280px) 680px, (min-width: 768px) 55vw, (min-width: 640px) 45vw, 88px`,
  wide: `${STACKED_SIZE}, (min-width: 1280px) 480px, (min-width: 640px) 40vw, 88px`,
  row: `${STACKED_SIZE}, (min-width: 640px) 128px, 88px`,
} as const satisfies Record<BriefLayout, string>;

const FOOT_CLASS = 'mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1';

/** The row's arrow, top right: in on hover (opacity and translate), at once on focus. */
const ROW_ARROW_CLASS = [
  'pointer-events-none absolute end-3 top-4 hidden tile-label text-brand-ink opacity-0 -translate-x-1.5 @min-[40rem]/page:top-5 @min-[40rem]/page:block',
  'transition-[opacity,translate] duration-(--motion-spring-out) ease-spring',
  'group-hover/story:opacity-100 group-hover/story:translate-x-0 group-hover/story:duration-(--motion-spring-in)',
  'group-has-[[data-story-link]:focus-visible]/story:opacity-100 group-has-[[data-story-link]:focus-visible]/story:translate-x-0 group-has-[[data-story-link]:focus-visible]/story:duration-0',
].join(' ');

export interface ProjectBriefProps {
  readonly entry: ProjectEntry;
  readonly layout: BriefLayout;
  readonly className?: string;
}

/** One project as a brief. */
export function ProjectBrief({ entry, layout, className }: ProjectBriefProps): ReactElement {
  const fit = titleFit(entry.title);
  return (
    <article
      id={storyAnchor(entry.id)}
      data-project-story={layout}
      data-project-id={entry.id}
      className={cn(STORY_CLASS, ROOT_CLASS[layout], className)}
    >
      <StoryCover
        title={entry.title}
        image={entry.images[0]}
        sizes={SIZES[layout]}
        aspect="aspect-video"
        still={layout === 'row'}
        className={COVER_CLASS[layout]}
      />
      <div className={WORDS_CLASS[layout]}>
        <h3 className={TITLE_CLASS[layout]} style={fit}>
          <StoryLink id={entry.id}>{entry.title}</StoryLink>
        </h3>
        <p className={SUMMARY_CLASS[layout]}>{entry.description}</p>
        <div className={FOOT_CLASS}>
          <Byline parts={briefByline(entry)} />
          <StoryActions entry={entry} />
        </div>
      </div>
      {layout === 'row' ? (
        <span aria-hidden="true" className={ROW_ARROW_CLASS}>
          →
        </span>
      ) : null}
    </article>
  );
}
