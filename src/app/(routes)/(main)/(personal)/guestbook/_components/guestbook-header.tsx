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
 * @file The guestbook's words: the h1, the subline and its count line ("28 notes · since Oct
 * 2025", a Folio Byline where the two big figures were), the words of the empty and error states
 * (the wall's first chapter says them, over the compose tile), and the note above the wall for a
 * stale or capped list. Server-safe (no directive, no hooks).
 */

import type { ReactElement } from 'react';

import { Freshness } from '@/components/console';
import { Byline, type BylinePart, countOf } from '@/components/console/folio';
import type { GuestbookLoad } from '@/lib/guestbook/types';
import type { GuestbookStats } from '../_lib/format';
import type { BoardListState } from './guestbook-board';
import { LIST_NOTE_CLASS } from './guestbook-classes';

export const GUESTBOOK_TITLE = 'Guestbook';
export const GUESTBOOK_DESCRIPTION =
  'Notes from people who stopped by, newest first. Sign in to leave yours.';
/** The notes region's name, for a screen reader (the year headings say the rest). */
export const NOTES_LABEL = 'Notes, newest first';
export const NOTE_NOUN = { one: 'note', many: 'notes' } as const;
const COUNT_UNAVAILABLE = 'Note count unavailable';

/** What the wall's first chapter says when there is no note to show. */
export interface StateWords {
  readonly title: string;
  readonly text?: string;
}

export const EMPTY_STATE: StateWords = {
  title: 'No messages yet',
  text: 'Be the first to sign the guestbook.',
};
export const ERROR_STATE: StateWords = {
  title: "Messages couldn't load",
  text: "The guestbook's database didn't answer. Reload the page in a moment to read them; you can still sign it.",
};
/** A stale list that was empty: the note above the wall says why, so the chapter only names. */
export const STALE_EMPTY_STATE: StateWords = { title: 'Notes' };

/** "28 notes", "500+ notes" (the safety cap cut the list) or "1 note". */
const countWords = (count: number | string): string =>
  typeof count === 'number' ? countOf(count, NOTE_NOUN) : `${count} ${NOTE_NOUN.many}`;

/** The count line's parts: the count, then the month of the first note, when there is one. */
function countLineParts(stats: GuestbookStats, available: boolean): BylinePart[] {
  if (!available) return [COUNT_UNAVAILABLE];
  return [countWords(stats.count), stats.firstMonth ? `since ${stats.firstMonth}` : null];
}

/**
 * The header's count, one quiet line under the subline (inside its paragraph, so a span). The
 * counts sit in a byline, never in stat tiles: the notes lead the page.
 */
export function GuestbookCountLine({
  stats,
  available,
}: {
  readonly stats: GuestbookStats;
  /** False when the list could not load: the count is unavailable. */
  readonly available: boolean;
}): ReactElement | null {
  return <Byline as="span" className="mt-2 block" parts={countLineParts(stats, available)} />;
}

/** Why the list may be out of date, worded for the rows below it, or for none. */
function StaleNote({
  loadedAt,
  empty,
}: {
  readonly loadedAt: number;
  /** The last good list had no messages. */
  readonly empty: boolean;
}): ReactElement {
  if (empty) {
    return (
      <>
        The guestbook's database isn't answering. It had no messages when it last answered,{' '}
        <Freshness at={loadedAt} prefix="" />; newer ones may be missing.{' '}
      </>
    );
  }
  return (
    <>
      The guestbook's database isn't answering, so these are the messages{' '}
      <Freshness at={loadedAt} prefix="loaded" />; newer messages may be missing.{' '}
    </>
  );
}

/**
 * What the wall says above its chapters: why a stale list may be out of date, and when the
 * safety cap cut the list; else nothing. The empty and error states are the first chapter's own
 * words (EMPTY_STATE, ERROR_STATE), so they sit right over the compose tile.
 */
export function ListNotice({
  load,
  listState,
}: {
  readonly load: GuestbookLoad;
  readonly listState: BoardListState;
}): ReactElement | null {
  const stale = listState === 'stale' && load.loadedAt !== null;
  if (!stale && !load.truncated) return null;
  return (
    <p className={LIST_NOTE_CLASS}>
      {stale && <StaleNote loadedAt={load.loadedAt ?? 0} empty={load.messages.length === 0} />}
      {load.truncated && `Showing the newest ${load.messages.length} messages.`}
    </p>
  );
}
