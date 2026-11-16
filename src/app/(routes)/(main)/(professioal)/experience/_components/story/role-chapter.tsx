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
 * @file One chapter of the /experience story: the folio opener (the shared chapter system: only
 * the first chapter's title is the display word, later years step down, a one-role year is an
 * inline heading), then its roles hung off the rail. Server-safe (no directive, no hooks).
 *
 * The rail is one hairline at the same x in every chapter, so the page reads as one line broken
 * only by the years. Under Now it starts in brand and fades to the hairline: what runs now leads
 * into the path behind it. It fades out under the chapter's last role.
 */

import type { ReactElement, ReactNode } from 'react';

import { type BylinePart, ChapterOpener, countOf } from '@/components/console/folio';
import type { Noun } from '@/lib/filters/types';
import { cn } from '@/lib/utils';
import { chapterNamesOf, numberWord, type StoryChapter } from '../../_lib/role-story';
import { RoleStop } from './role-stop';

export const ROLE_NOUN: Noun = { one: 'role', many: 'roles' };
export const STILL_GOING = 'Still going';

/**
 * The rail's x (--rail-x): the middle of the stops' rail column (role-stop.tsx), 0.625rem on a
 * phone, 0.375rem in a narrow column (20rem or less), 4.5rem + 1rem + 0.75rem from a 40rem page.
 * It starts at the first node's middle.
 */
const RAIL_BASE = [
  'relative flex min-w-0 flex-col [--rail-x:0.625rem] @max-[20rem]/page:[--rail-x:0.375rem] @min-[40rem]/page:[--rail-x:6.25rem]',
  "before:pointer-events-none before:absolute before:top-2 before:bottom-0 before:left-(--rail-x) before:w-px before:-translate-x-1/2 before:content-['']",
  'forced-colors:before:bg-[CanvasText]',
].join(' ');
const RAIL_LINE: Readonly<Record<StoryChapter['kind'], string>> = {
  now: 'before:bg-[linear-gradient(to_bottom,var(--brand-rim),var(--brand-edge)_45%,var(--hairline-strong)_80%,transparent)]',
  year: 'before:bg-[linear-gradient(to_bottom,var(--hairline-strong),var(--hairline)_75%,transparent)]',
  undated: 'before:bg-[linear-gradient(to_bottom,var(--hairline),var(--hairline)_75%,transparent)]',
};

/** 'ResQ Systems, Handshake and three more.' with each name lifted to the foreground. */
function ChapterSummary({ chapter }: { readonly chapter: StoryChapter }): ReactNode {
  const { names, more } = chapterNamesOf(chapter);
  if (names.length === 0) return null;
  const last = names.length - 1;
  return (
    <>
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 && (index === last && more === 0 ? ' and ' : ', ')}
          <em>{name}</em>
        </span>
      ))}
      {more > 0 ? ` and ${numberWord(more)} more.` : '.'}
    </>
  );
}

/**
 * A year's count of roles; under Now only that they still run, since the page's opening sentence
 * already says how many do ('five of them still going'), and a count is said once.
 */
function bylineOf(chapter: StoryChapter): BylinePart[] {
  if (chapter.kind === 'now') return [{ text: STILL_GOING, tone: 'ongoing' }];
  return [countOf(chapter.stops.length, ROLE_NOUN)];
}

export interface RoleChapterProps {
  readonly chapter: StoryChapter;
  readonly className?: string;
}

/** One chapter: its opener, then its roles on the rail. */
export function RoleChapter({ chapter, className }: RoleChapterProps): ReactElement {
  return (
    <ChapterOpener
      id={chapter.id}
      title={chapter.title}
      size={chapter.size}
      summary={chapter.size === 'inline' ? undefined : <ChapterSummary chapter={chapter} />}
      byline={bylineOf(chapter)}
      className={className}
    >
      <ol data-story-rail={chapter.kind} className={cn(RAIL_BASE, RAIL_LINE[chapter.kind])}>
        {chapter.stops.map((stop) => (
          <RoleStop key={stop.row.id} stop={stop} />
        ))}
      </ol>
    </ChapterOpener>
  );
}
