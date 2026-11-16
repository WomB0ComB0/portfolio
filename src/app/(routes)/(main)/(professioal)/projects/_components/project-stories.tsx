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
 * @file The Stories view of /projects (the default): each chapter (Featured, then each year) as a
 * Folio ChapterOpener, with its one lead story, then an unequal pair of features, then the rest
 * as briefs, so every chapter steps down in size and nothing repeats one tile. The work leads:
 * Featured opens the page as a small heading on the rule (for screen readers only on a phone),
 * so the work under it is the loudest thing on the first screen, and the years keep their
 * numerals (a one-project year is a heading on the rule). Featured ends in a wide brief and
 * rows, never a row of three like cards. A year names the Featured projects that started in it
 * ('Also in Featured: ResQ Viz and grepo.', each a link to its story); a year whose projects are
 * all Featured has no chapter, so a search that keeps only Featured ones ends at Featured. Every
 * project the filters keep is here, each one link to its page. Server-safe (no directive, no
 * hooks): the filter island draws it from the projects it keeps, so the server HTML of a shared
 * link is already laid out.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { type BylinePart, countOf } from '@/components/console/folio/byline-items';
import { type ChapterSize, chapterSize } from '@/components/console/folio/chapter';
import { ChapterOpener } from '@/components/console/folio/chapter-opener';
import { cn } from '@/lib/utils';
import {
  type ArrangedChapter,
  arrangeChapter,
  type ChapterSummary,
  chapterSummary,
  featuredBriefs,
  ongoingCount,
  type StoryChapter,
  storyChapters,
} from '../_lib/project-chapters';
import type { ProjectEntry } from '../_lib/project-index';
import { FEATURED_GROUP } from '../_lib/project-order';
import { PROJECT_NOUN } from '../_lib/project-text';
import { LeadStory } from './lead-story';
import { ProjectBrief } from './project-brief';
import { storyAnchor } from './story-parts';

/**
 * The unequal pair: side by side from a 40rem page; from 48rem the first takes 7 of 12 columns and
 * the second 5, dropped lower, so the two never read as twin tiles.
 */
const PAIR_CLASS =
  'grid @min-[40rem]/page:grid-cols-2 @min-[40rem]/page:items-start @min-[40rem]/page:gap-x-6 @min-[48rem]/page:grid-cols-12 @min-[48rem]/page:gap-x-[clamp(1.5rem,0.5rem+2.5vw,3rem)]';
const PAIR_WIDE_CLASS = '@min-[48rem]/page:col-span-7';
const PAIR_NARROW_CLASS =
  '@min-[48rem]/page:col-span-5 @min-[48rem]/page:mt-[clamp(2.5rem,1rem+5vw,6rem)]';

/** Briefs as rows, in two columns from a 56rem page; titles side by side share a line. */
const ROWS_CLASS =
  'grid items-start @min-[56rem]/page:grid-cols-2 @min-[56rem]/page:gap-x-[clamp(1.5rem,1rem+2vw,3.5rem)]';
/** The wide brief opens under a straight rule (a plain border: no radius to curl it). */
const WIDE_CLASS =
  '@min-[40rem]/page:border-t @min-[40rem]/page:border-hairline @min-[40rem]/page:pt-8';
/** The pause between the pair and the briefs on a wide page (phone rows simply continue). */
const AFTER_PAIR_CLASS = '@min-[40rem]/page:mt-[clamp(3rem,2rem+3vw,5rem)]';
/** The pause between the wide brief and the rows under it. */
const AFTER_WIDE_CLASS = '@min-[40rem]/page:mt-[clamp(2rem,1.5rem+2vw,3.5rem)]';

/** 'Also in Featured': a small line under the dek; each name a link to its story above. */
const ALSO_CLASS = 'mt-1.5 block tile-meta text-muted-foreground';
const ALSO_LINK_CLASS = [
  'rounded-sm text-foreground underline decoration-hairline-strong underline-offset-4',
  'transition-colors duration-(--motion-fast) ease-effect hover:decoration-current focus-visible:decoration-current',
].join(' ');

/** Names as a sentence, each drawn by `draw`: 'A', 'A and B', 'A, B and C'. */
function NameList<T>({
  items,
  draw,
  more = '',
}: {
  readonly items: readonly T[];
  readonly draw: (item: T) => ReactNode;
  /** Words after the last name (' and four more'), which then joins with a comma. */
  readonly more?: string;
}): ReactElement {
  return (
    <>
      {items.map((item, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two projects may share a title; the order is fixed.
        <Fragment key={at}>
          {at > 0 ? (at === items.length - 1 && more === '' ? ' and ' : ', ') : null}
          {draw(item)}
        </Fragment>
      ))}
      {more}
    </>
  );
}

/** The dek in words: '<em>A</em>, <em>B</em>, <em>C</em> and four more.' */
function SummaryWords({ summary }: { readonly summary: ChapterSummary }): ReactElement | null {
  const { names, more } = summary;
  if (names.length === 0) return null;
  return (
    <>
      <NameList items={names} draw={(name) => <em>{name}</em>} more={more} />.
    </>
  );
}

/** 'Also in Featured: ResQ Viz and grepo.' */
function AlsoFeatured({ entries }: { readonly entries: readonly ProjectEntry[] }): ReactElement {
  return (
    <span className={ALSO_CLASS} data-also-featured="">
      {'Also in Featured: '}
      <NameList
        items={entries}
        draw={(entry) => (
          <a href={`#${storyAnchor(entry.id)}`} className={ALSO_LINK_CLASS}>
            {entry.title}
          </a>
        )}
      />
      .
    </span>
  );
}

/** The chapter's pair and briefs, under its lead. */
function ChapterBody({
  arranged,
  group,
}: {
  readonly arranged: ArrangedChapter<ProjectEntry>;
  readonly group: string;
}): ReactElement | null {
  const { features, briefs } = arranged;
  if (features.length === 0 && briefs.length === 0) return null;
  const [wide, narrow] = features;
  const end = group === FEATURED_GROUP ? featuredBriefs(briefs) : { wide: null, rows: briefs };
  return (
    <>
      {wide && narrow ? (
        <div className={PAIR_CLASS} data-chapter-pair="">
          <ProjectBrief entry={wide} layout="feature" className={PAIR_WIDE_CLASS} />
          <ProjectBrief entry={narrow} layout="feature" className={PAIR_NARROW_CLASS} />
        </div>
      ) : null}
      {end.wide ? (
        <div className={cn(WIDE_CLASS, features.length > 0 && AFTER_PAIR_CLASS)}>
          <ProjectBrief entry={end.wide} layout="wide" />
        </div>
      ) : null}
      {end.rows.length > 0 ? (
        <div
          className={cn(
            ROWS_CLASS,
            end.wide ? AFTER_WIDE_CLASS : features.length > 0 && AFTER_PAIR_CLASS,
          )}
          data-chapter-briefs=""
        >
          {end.rows.map((entry) => (
            <ProjectBrief key={entry.id} entry={entry} layout="row" />
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * The chapter's size: Featured is always a heading on the rule, so the work leads the page;
 * a year steps down as the kit says (a year with one project is inline).
 */
const sizeOf = (chapter: StoryChapter<ProjectEntry>, index: number): ChapterSize =>
  chapter.key === FEATURED_GROUP ? 'inline' : chapterSize({ index, count: chapter.items.length });

/**
 * The counts under a year's title. Featured has none: its count is the first jump link right
 * above it, and each of its stories says when it is still in progress.
 */
function bylineOf(chapter: StoryChapter<ProjectEntry>): BylinePart[] {
  if (chapter.key === FEATURED_GROUP) return [];
  const ongoing = ongoingCount(chapter.items);
  return [
    countOf(chapter.items.length, PROJECT_NOUN),
    ongoing > 0 ? { text: `${ongoing} in progress`, tone: 'ongoing' } : null,
  ];
}

/**
 * Featured's heading on a phone is for screen readers only (as in the chosen mock): the jump
 * links right above it start with 'Featured', and the first screen is the work's. From a 40rem
 * page it is a small heading on the rule.
 */
const FEATURED_CLASS = '@max-[40rem]/page:[&>header]:sr-only';

/** The section's own classes: the first opens the page; Featured hides its heading on a phone. */
const sectionClass = (chapter: StoryChapter<ProjectEntry>, index: number): string | undefined =>
  cn(index === 0 && 'mt-0', chapter.key === FEATURED_GROUP && FEATURED_CLASS) || undefined;

interface StoryChapterProps {
  readonly chapter: StoryChapter<ProjectEntry>;
  /** Its place on the page, from 0. */
  readonly index: number;
}

/** One chapter: its opener, its lead story, then its pair and briefs. */
function StoryChapterView({ chapter, index }: StoryChapterProps): ReactElement {
  const arranged = arrangeChapter(chapter.items, chapter.key);
  // Featured's names are the stories right under it: it has no dek of its own.
  const dek =
    chapter.key === FEATURED_GROUP ? null : <SummaryWords summary={chapterSummary(arranged)} />;
  return (
    <ChapterOpener
      id={chapter.id}
      title={chapter.label}
      size={sizeOf(chapter, index)}
      className={sectionClass(chapter, index)}
      summary={
        dek || chapter.alsoFeatured.length > 0 ? (
          <>
            {dek}
            {chapter.alsoFeatured.length > 0 ? (
              <AlsoFeatured entries={chapter.alsoFeatured} />
            ) : null}
          </>
        ) : undefined
      }
      byline={bylineOf(chapter)}
      lead={
        arranged.lead ? (
          <LeadStory entry={arranged.lead} flip={index % 2 === 1} eager={index === 0} />
        ) : undefined
      }
    >
      {arranged.features.length + arranged.briefs.length > 0 ? (
        <ChapterBody arranged={arranged} group={chapter.key} />
      ) : null}
    </ChapterOpener>
  );
}

export interface ProjectStoriesProps {
  /** The projects the filters keep, in page order. */
  readonly entries: readonly ProjectEntry[];
}

/** Every chapter of the Stories view. */
export function ProjectStories({ entries }: ProjectStoriesProps): ReactElement {
  return (
    <div data-projects-view="stories" className="min-w-0">
      {storyChapters(entries).map((chapter, index) => (
        <StoryChapterView key={chapter.key} chapter={chapter} index={index} />
      ))}
    </div>
  );
}
