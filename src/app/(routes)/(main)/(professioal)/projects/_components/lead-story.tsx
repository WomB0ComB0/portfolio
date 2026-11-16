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
 * @file A chapter's lead story on /projects: the one dominant element under the chapter's opener.
 * A large cover (its Studio alt text as the caption), the title at headline size, the description
 * in full, a byline (kind, the whole run, status), what it was built with in one sentence, and the
 * links. On a wide page the cover takes 7 of 12 columns and the words sit beside it, alternating
 * sides from chapter to chapter; on a phone the words come under the cover. The title link is the
 * story's one link to its page, stretched over it; 'Read the story' is its visible cue, not a
 * second link. The story is an anchor (#story-<id>) a year's 'Also in Featured' links to.
 * Server-safe (no directive, no hooks).
 *
 * The title's size is the smallest of a rem clamp, a share of its column and its column over its
 * widest word (--folio-fit, word-measure units at 0.6em), so text at 200% never breaks a word or
 * runs the title past its column.
 */

import type { ReactElement } from 'react';

import { Byline } from '@/components/console/folio/byline';
import { cn } from '@/lib/utils';
import type { ProjectEntry } from '../_lib/project-index';
import { builtWithText } from '../_lib/project-words';
import {
  ARROW_CLASS,
  leadByline,
  STORY_CLASS,
  STORY_RING_CLASS,
  StoryActions,
  StoryCover,
  StoryLink,
  storyAnchor,
  titleFit,
} from './story-parts';

/** About 7 of 12 columns of the 75rem page on a wide window; the whole width on a phone. */
const LEAD_SIZES = '(min-width: 1280px) 700px, (min-width: 768px) 58vw, 100vw';

const GRID_CLASS =
  'grid gap-5 @min-[48rem]/page:grid-cols-12 @min-[48rem]/page:items-end @min-[48rem]/page:gap-x-[clamp(1.5rem,0.5rem+2.5vw,3rem)]';
const FIGURE_CLASS = 'min-w-0 @min-[48rem]/page:col-span-7';
const FIGURE_FLIP_CLASS = '@min-[48rem]/page:col-start-6 @min-[48rem]/page:row-start-1';
const COPY_CLASS =
  '@container flex min-w-0 flex-col gap-3 @min-[48rem]/page:col-span-5 @min-[48rem]/page:pb-9';
const COPY_FLIP_CLASS = '@min-[48rem]/page:col-start-1 @min-[48rem]/page:row-start-1';
const CAPTION_CLASS = 'mt-2.5 tile-meta text-faint [text-wrap:pretty]';
const TITLE_CLASS = [
  'font-semibold leading-[1.04] tracking-[-0.035em] text-balance [overflow-wrap:break-word]',
  'text-[length:min(clamp(1.75rem,0.5rem+9cqi,3.5rem),calc(100cqi/(var(--folio-fit,8)*0.6)))]',
].join(' ');
const DEK_CLASS =
  'text-base leading-relaxed text-muted-foreground [text-wrap:pretty] @min-[40rem]/page:text-lg';
const BUILT_CLASS = 'tile-meta text-faint [text-wrap:pretty]';
const FOOT_CLASS = 'flex flex-wrap items-center gap-x-4 gap-y-1 pt-1';
const READ_CLASS = 'tile-label text-brand-ink';

export interface LeadStoryProps {
  readonly entry: ProjectEntry;
  /** The cover on the right on a wide page (every other chapter). */
  readonly flip?: boolean;
  /** The page's first lead: its cover loads at once. */
  readonly eager?: boolean;
}

/** One chapter's lead story. */
export function LeadStory({ entry, flip = false, eager = false }: LeadStoryProps): ReactElement {
  const cover = entry.images[0];
  const fit = titleFit(entry.title);
  return (
    <article
      id={storyAnchor(entry.id)}
      data-project-story="lead"
      data-project-id={entry.id}
      className={cn(STORY_CLASS, STORY_RING_CLASS, GRID_CLASS)}
    >
      <figure className={cn(FIGURE_CLASS, flip && FIGURE_FLIP_CLASS)}>
        <StoryCover
          title={entry.title}
          image={cover}
          sizes={LEAD_SIZES}
          aspect="aspect-video"
          eager={eager}
        />
        {cover?.alt ? <figcaption className={CAPTION_CLASS}>{cover.alt}</figcaption> : null}
      </figure>
      <div className={cn(COPY_CLASS, flip && COPY_FLIP_CLASS)}>
        <h3 className={TITLE_CLASS} style={fit}>
          <StoryLink id={entry.id}>{entry.title}</StoryLink>
        </h3>
        <p className={DEK_CLASS}>{entry.description}</p>
        <Byline parts={leadByline(entry)} />
        {entry.techLabels.length > 0 ? (
          <p className={BUILT_CLASS}>
            Built with{' '}
            <span className="text-muted-foreground">{builtWithText(entry.techLabels)}</span>
          </p>
        ) : null}
        <div className={FOOT_CLASS}>
          <span aria-hidden="true" className={READ_CLASS}>
            Read the story <span className={ARROW_CLASS}>→</span>
          </span>
          <StoryActions entry={entry} />
        </div>
      </div>
    </article>
  );
}
