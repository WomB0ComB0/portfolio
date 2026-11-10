'use client';

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
 * @file The messages posted on this page, shared by the list and the header's count.
 *
 * PostedMessagesProvider runs the page's one usePostedMessages(). The board shows its rows and
 * posts through it, and GuestbookLiveStats adds the stored ones the server list doesn't have yet to
 * the header, so once a post is stored, "27 messages" never sits above 28 rows while a refresh
 * catches up. A post still sending shows in the list, marked as posting, but not in the count. On
 * the server nothing is added: the HTML has the server's figures as they were.
 */

import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';

import { type GuestbookStats, withPosted } from '../_lib/format';
import { GuestbookStatStrip } from './guestbook-header';
import { type PostedMessages, unlisted, usePostedMessages } from './use-posted-messages';

const PostedMessagesContext = createContext<PostedMessages | null>(null);

/** The posts from this page, for everything inside it. Renders no element of its own. */
export function PostedMessagesProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const { rows, post } = usePostedMessages();
  const value = useMemo<PostedMessages>(() => ({ rows, post }), [rows, post]);
  return <PostedMessagesContext.Provider value={value}>{children}</PostedMessagesContext.Provider>;
}

/** The rows posted on this page and the function that posts one; throws outside the Provider. */
export function usePostedMessagesContext(): PostedMessages {
  const value = useContext(PostedMessagesContext);
  if (!value) throw new Error('Guestbook posts are read inside <PostedMessagesProvider>');
  return value;
}

export interface GuestbookLiveStatsProps {
  /** The server list's figures. */
  readonly stats: GuestbookStats;
  /** The ids of the server-rendered rows. */
  readonly knownIds: readonly string[];
  /** False when the list could not load: both figures show as unavailable. */
  readonly available: boolean;
}

/**
 * The header's figures, counting the stored posts the server list doesn't have yet. A post still
 * sending is left out, so one that fails never moves the count.
 */
export function GuestbookLiveStats({
  stats,
  knownIds,
  available,
}: GuestbookLiveStatsProps): ReactElement {
  const { rows } = usePostedMessagesContext();
  const known = useMemo(() => new Set(knownIds), [knownIds]);
  const stored = unlisted(rows, known)
    .filter((row) => !row.pending)
    .map((row) => row.message);
  return <GuestbookStatStrip stats={withPosted(stats, stored)} available={available} />;
}
GuestbookLiveStats.displayName = 'GuestbookLiveStats';
