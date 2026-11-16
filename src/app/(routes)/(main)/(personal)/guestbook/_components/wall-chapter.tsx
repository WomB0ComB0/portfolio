'use client';

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
 * @file One year of the guestbook wall: the year with its count beside it on the rule ('2026
 * 1 note', as in the Wall mock), then the wall of notes.
 *
 * It is the Folio chapter system (chapterSize and the folio-numeral utilities, so a one-note year
 * is a heading on the rule and a fuller first year the numeral) with one change from the shared
 * ChapterOpener: the count sits on the numeral's baseline right after it, not alone in a far
 * column, because a guestbook year has no summary sentence to fill that column. The section keeps
 * the opener's contract (an id, aria-labelledby, data-chapter, the byline), so the page's specs
 * read it the same way.
 */

import { type CSSProperties, type ReactElement, type ReactNode, useState } from 'react';

import {
  Byline,
  type BylinePart,
  type ChapterSize,
  chapterId,
  chapterSize,
  countOf,
  widestWordUnits,
} from '@/components/console/folio';
import { cn } from '@/lib/utils';
import { type ChapterPlan, type OpenedSize, steadySize } from '../_lib/wall';
import { COMPOSE_TILE_CLASS, WALL_CLASS } from './guestbook-classes';
import { NOTE_NOUN, STALE_EMPTY_STATE, type StateWords } from './guestbook-header';
import { MessageRow } from './message-row';
import type { PostedRow } from './use-posted-messages';

/**
 * The pause above a year; the first chapter has none. Tighter than the shared opener's (up to
 * 7rem): the years are one wall, so a year sits a little further from the notes above it than the
 * wall's own rows do (40px apart at 1440), not a screen's gap below a short year.
 */
const YEAR_PAUSE = 'mt-[clamp(2.25rem,1.5rem+2vw,3.5rem)]';
const SECTION_CLASS = {
  lead: '',
  step: YEAR_PAUSE,
  inline: YEAR_PAUSE,
} as const satisfies Record<ChapterSize, string>;

/**
 * The year, then its count on the same baseline, over the strong hairline. The header is the
 * inline-size container the numeral sizes read (cqi), so the year fits the column at any width.
 */
const HEADER_CLASS =
  '@container flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline-strong pb-3 @min-[40rem]/page:gap-x-4';
const TITLE_CLASS = {
  lead: 'folio-numeral',
  step: 'folio-numeral-step text-foreground',
  inline: 'folio-numeral-inline text-foreground',
} as const satisfies Record<ChapterSize, string>;
/** The empty and error states' sentence, after their words on the rule. */
const SUMMARY_CLASS = 'min-w-0 grow basis-[16rem] text-base text-muted-foreground';
/** The wall sits under the rule after the shared opener's pause. */
const BODY_CLASS = 'mt-[clamp(2rem,1.5rem+1.5vw,3rem)]';

interface ChapterHeadProps {
  readonly id: string;
  readonly title: string | number;
  readonly size: ChapterSize;
  readonly summary?: string;
  readonly byline?: readonly BylinePart[];
}

/** The chapter's heading line: the year (or the state's words), then its count or sentence. */
function ChapterHead({ id, title, size, summary, byline }: ChapterHeadProps): ReactElement {
  const fit = { '--folio-fit': String(widestWordUnits(String(title))) } as CSSProperties;
  return (
    <header className={HEADER_CLASS}>
      <h2 id={`${id}-title`} className={TITLE_CLASS[size]} style={fit}>
        {title}
      </h2>
      {summary ? <p className={SUMMARY_CLASS}>{summary}</p> : null}
      {byline ? <Byline parts={byline} /> : null}
    </header>
  );
}

export interface WallChapterProps {
  readonly plan: ChapterPlan;
  readonly index: number;
  /** How many notes the server lists in this year. */
  readonly serverCount: number;
  /** Their server-rendered rows (MessageRow), newest first. */
  readonly serverRows?: ReactNode;
  /** The first chapter's words when there is no note to show. */
  readonly state: StateWords | null;
  /** The notes posted on this page (first chapter only). */
  readonly posted: readonly PostedRow[];
  /** The compose card (first chapter only). */
  readonly compose: ReactNode;
}

/** One year's chapter: its year and count on the rule, then its wall. */
export function WallChapter({
  plan,
  index,
  serverCount,
  serverRows,
  state,
  posted,
  compose,
}: WallChapterProps): ReactElement {
  const ruled = chapterSize({ index, count: serverCount });
  const [opened] = useState<OpenedSize>(() => ({ year: plan.year, size: ruled }));
  const notes = serverCount + posted.filter((row) => !row.pending).length;
  const title = state?.title ?? plan.year ?? STALE_EMPTY_STATE.title;
  const size = state ? 'inline' : steadySize(opened, plan.year, ruled);
  const id = chapterId(title);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-chapter={size}
      className={cn('scroll-mt-4', index === 0 ? 'mt-0' : SECTION_CLASS[size])}
    >
      <ChapterHead
        id={id}
        title={title}
        size={size}
        summary={state?.text}
        byline={state || notes === 0 ? undefined : [countOf(notes, NOTE_NOUN)]}
      />
      <div data-chapter-body="" className={BODY_CLASS}>
        <ol className={WALL_CLASS}>
          {compose ? (
            <li key="compose" data-compose-tile="" className={COMPOSE_TILE_CLASS}>
              {compose}
            </li>
          ) : null}
          {posted.map((row) => (
            <MessageRow key={row.key} message={row.message} pending={row.pending} />
          ))}
          {serverRows}
        </ol>
      </div>
    </section>
  );
}
WallChapter.displayName = 'WallChapter';
