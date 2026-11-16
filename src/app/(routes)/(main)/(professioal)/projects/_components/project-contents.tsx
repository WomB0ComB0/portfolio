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
 * @file The Index view of /projects (?view=index): a contents page in words, for a fast scan.
 * Every project the filters keep sits under the year it started (Featured ones too), newest year
 * first, as its title over a byline ('CLI Tool · Feb 2026 · In progress'), one, two or three
 * across as the page widens. Each year is a Folio chapter at its `inline` size (a heading on the
 * rule), so the list stays compact. Each title is its entry's one link, stretched over it.
 * Server-safe (no directive, no hooks).
 */

import type { ReactElement } from 'react';

import { Byline } from '@/components/console/folio/byline';
import { countOf } from '@/components/console/folio/byline-items';
import { ChapterOpener } from '@/components/console/folio/chapter-opener';
import { cn } from '@/lib/utils';
import { ongoingCount, yearChapters } from '../_lib/project-chapters';
import type { ProjectEntry } from '../_lib/project-index';
import { PROJECT_NOUN } from '../_lib/project-text';
import {
  briefByline,
  FIT_TITLE_CLASS,
  HAIRLINE_CLASS,
  PLATE_CLASS,
  STORY_CLASS,
  StoryLink,
  titleFit,
} from './story-parts';

const LIST_CLASS =
  'grid gap-x-[clamp(1rem,0.5rem+1.5vw,2rem)] @min-[40rem]/page:grid-cols-2 @min-[64rem]/page:grid-cols-3';
/**
 * An entry: a straight hairline above it, and on hover or focus the house plate behind it, inside
 * its column (the entry pads its words instead), so it never runs past the page's edge. The plate
 * is the only thing with a radius, and keyboard focus rings it. The first row has no hairline:
 * the year's rule is right above it, and a second line under it read as a doubled rule.
 */
const ITEM_CLASS = [
  'px-2.5 py-3.5',
  HAIRLINE_CLASS,
  'first:after:hidden @min-[40rem]/page:nth-2:after:hidden @min-[64rem]/page:nth-3:after:hidden',
  PLATE_CLASS,
  'before:inset-y-1',
].join(' ');
/** The words are the title's size container, so a long word shrinks rather than breaks. */
const WORDS_CLASS = '@container min-w-0';

export interface ProjectContentsProps {
  /** The projects the filters keep, in any order (they are sorted by year here). */
  readonly entries: readonly ProjectEntry[];
}

/** Every project by year, in words. */
export function ProjectContents({ entries }: ProjectContentsProps): ReactElement {
  return (
    <div data-projects-view="index" className="min-w-0">
      {yearChapters(entries).map((chapter, index) => {
        const ongoing = ongoingCount(chapter.items);
        return (
          <ChapterOpener
            key={chapter.key}
            id={chapter.id}
            title={chapter.label}
            size="inline"
            className={index === 0 ? 'mt-0' : undefined}
            byline={[
              countOf(chapter.items.length, PROJECT_NOUN),
              ongoing > 0 ? { text: `${ongoing} in progress`, tone: 'ongoing' } : null,
            ]}
          >
            <ol className={LIST_CLASS}>
              {chapter.items.map((entry) => (
                <li
                  key={entry.id}
                  data-project-entry=""
                  data-project-id={entry.id}
                  className={cn(STORY_CLASS, ITEM_CLASS)}
                >
                  <div className={WORDS_CLASS}>
                    <p className={FIT_TITLE_CLASS} style={titleFit(entry.title)}>
                      <StoryLink id={entry.id}>{entry.title}</StoryLink>
                    </p>
                    <Byline parts={briefByline(entry)} className="mt-1" />
                  </div>
                </li>
              ))}
            </ol>
          </ChapterOpener>
        );
      })}
    </div>
  );
}
