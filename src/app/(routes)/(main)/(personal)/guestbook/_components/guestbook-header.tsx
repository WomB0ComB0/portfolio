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
 * @file The guestbook's words and figures: the h1, the subline, the two-figure stat strip
 * (messages, and the month of the first one) and the notes above the list for its empty, error,
 * stale and capped states. Server-safe (no directive, no hooks).
 */

import type { ReactElement } from 'react';

import { Freshness, StatStrip } from '@/components/console';
import type { GuestbookLoad } from '@/lib/guestbook/types';
import type { GuestbookStats } from '../_lib/format';
import type { BoardListState } from './guestbook-board';
import {
  LIST_NOTE_CLASS,
  STATE_BOX_CLASS,
  STATE_TEXT_CLASS,
  STATE_TITLE_CLASS,
} from './guestbook-classes';

export const GUESTBOOK_TITLE = 'Guestbook';
export const GUESTBOOK_DESCRIPTION =
  'Notes from people who stopped by, newest first. Sign in to leave yours.';
const STATS_LABEL = 'Guestbook totals';

/** Two figures, so "Oct 2025" keeps a column of its own from a 320px phone. */
export function GuestbookStatStrip({
  stats,
  available,
}: {
  readonly stats: GuestbookStats;
  /** False when the list could not load: both figures show as unavailable. */
  readonly available: boolean;
}): ReactElement {
  return (
    <StatStrip
      aria-label={STATS_LABEL}
      items={[
        { label: 'messages', value: available ? stats.count : null },
        { label: 'first message', value: available ? stats.firstMonth : null },
      ]}
    />
  );
}

function StateBox({ title, text }: { readonly title: string; readonly text: string }) {
  return (
    <div className={STATE_BOX_CLASS}>
      <p className={STATE_TITLE_CLASS}>{title}</p>
      <p className={STATE_TEXT_CLASS}>{text}</p>
    </div>
  );
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

/** What the list says before its rows, or nothing when it is simply ready. */
export function ListNotice({
  load,
  listState,
}: {
  readonly load: GuestbookLoad;
  readonly listState: BoardListState;
}): ReactElement | null {
  if (listState === 'empty') {
    return <StateBox title="No messages yet" text="Be the first to sign the guestbook." />;
  }
  if (listState === 'error') {
    return (
      <StateBox
        title="Messages couldn't load"
        text="The guestbook's database didn't answer. Reload the page in a moment to read them; you can still sign it."
      />
    );
  }
  const stale = listState === 'stale' && load.loadedAt !== null;
  if (!stale && !load.truncated) return null;
  return (
    <p className={LIST_NOTE_CLASS}>
      {stale && <StaleNote loadedAt={load.loadedAt ?? 0} empty={load.messages.length === 0} />}
      {load.truncated && `Showing the newest ${load.messages.length} messages.`}
    </p>
  );
}
