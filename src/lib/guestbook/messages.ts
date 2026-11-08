import 'server-only';

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
 * @file The guestbook's messages on the server, shared by the /guestbook page and the
 * /api/v1/messages GET route.
 *
 * - Source: the Firestore collection the guestbook has always used, read with the Firebase JS
 *   SDK's public read (no credentials), newest first.
 * - Every message is listed, up to a safety cap of {@link GUESTBOOK_MESSAGE_CAP}. The query asks
 *   for one more than the cap, so the page can say when it shows only the newest 500 instead of
 *   silently dropping the rest (at about 500 bytes of HTML a row, 500 rows are ~250 kB before
 *   compression; raise it, with paging on the server, if the guestbook ever gets near it).
 * - Cache: one stale-on-error cache per server process (processGlobal), so the page and the API
 *   make one Firestore read per {@link GUESTBOOK_TTL_MS} on each instance. When a reload fails,
 *   the last good list is served, marked stale.
 * - Deadline: a caller waits {@link GUESTBOOK_DEADLINE_MS} for the read, then gets the last good
 *   list (stale) or, with nothing loaded yet, the error. The deadline sits outside the cache, as
 *   in the home loaders, so a slow read keeps running and still fills the cache for the next
 *   request. A read that never answers is given up after {@link GUESTBOOK_LOAD_TIMEOUT_MS}, so the
 *   cache can try again.
 * - `loadGuestbook` (the page) never throws: a first load that fails is the page's error state.
 *   `readGuestbookMessages` (the API) rejects then, and the route answers 500.
 * - A message posted through the API expires the cached list (expireGuestbookMessages): the next
 *   render on that instance reads Firestore again, and if that read fails the previous list is
 *   still served, marked stale. A read that started before the post is never cached as fresh.
 * - Text: every message, and every record the API stored as plain text (`plainText: true`), is
 *   shown exactly as stored. An author name stored before that marker may hold the entities the
 *   old client's escaping produced (it escaped names, never messages), so those are decoded here
 *   (./entities.ts), at read time; nothing stored is changed. Both are clipped to the limits in
 *   ./limits.ts, so no stored record, however it got there, can make a row huge.
 */

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { cache } from 'react';

import { config } from '@/config';
import { firestore } from '@/core/firebase';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import { createStaleCache, type StaleCache, type StaleCacheResult } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import { decodeBasicEntities } from './entities';
import {
  ANONYMOUS_AUTHOR,
  AUTHOR_MAX_LENGTH,
  GUESTBOOK_TTL_MS,
  MESSAGE_MAX_LENGTH,
} from './limits';
import type { GuestbookLoad, GuestbookMessage, GuestbookMessages } from './types';

// Defined in ./limits.ts, which the page's client reads too (it waits the cache out).
export { GUESTBOOK_TTL_MS };

/** The most messages the page lists; past it, it shows the newest and says so. */
export const GUESTBOOK_MESSAGE_CAP = 500;
/** How long the page waits for Firestore before it shows the last good list, or its error state. */
export const GUESTBOOK_DEADLINE_MS = 5_000;
/**
 * How long one Firestore read may run before it counts as failed. Longer than the deadline, so a
 * slow read still fills the cache for the next request; finite, so a read that never answers
 * does not hold the cache's only load forever.
 */
export const GUESTBOOK_LOAD_TIMEOUT_MS = 20_000;

/** Where the guestbook's messages live (reads here; the API writes there with the Admin SDK). */
export const MESSAGES_COLLECTION_PATH = `artifacts/${config.firebase.appId}/public/data/message`;

const CACHE_NAME = 'guestbook.messages';
const CACHE_KEY = 'all';
const REPORT_CONTEXT = 'load guestbook messages';
const DEADLINE_LABEL = 'guestbook messages';
const LOAD_TIMEOUT_LABEL = 'guestbook messages read';

const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asStored = (text: string): string => text;

/** A stored record as a message, or null when it has no text or no date to show. */
export function toGuestbookMessage(
  id: string,
  data: Readonly<Record<string, unknown>>,
): GuestbookMessage | null {
  const stored = textOf(data.message);
  const createdAt = textOf(data.createdAt);
  if (!stored?.trim() || !createdAt) return null;
  // A message is shown as stored: no client ever escaped one. Only an author name stored before
  // plain text may hold the entities the old client's escapeHtml produced.
  const message = stored.slice(0, MESSAGE_MAX_LENGTH);
  const showAuthor = data.plainText === true ? asStored : decodeBasicEntities;
  const author = showAuthor(textOf(data.authorName) ?? '').trim();
  const authorName = author.slice(0, AUTHOR_MAX_LENGTH).trim() || ANONYMOUS_AUTHOR;
  return { id, authorName, message, createdAt };
}

async function fetchFromFirestore(): Promise<GuestbookMessages> {
  const snapshot = await getDocs(
    query(
      collection(firestore, MESSAGES_COLLECTION_PATH),
      orderBy('createdAt', 'desc'),
      limit(GUESTBOOK_MESSAGE_CAP + 1),
    ),
  );
  const messages = snapshot.docs
    .map((doc) => toGuestbookMessage(doc.id, doc.data()))
    .filter((message): message is GuestbookMessage => message !== null);
  return {
    messages: messages.slice(0, GUESTBOOK_MESSAGE_CAP),
    truncated: snapshot.docs.length > GUESTBOOK_MESSAGE_CAP,
  };
}

/** The process's cache; every copy of this module (pages, route handlers) finds the same one. */
const sharedCache = (): StaleCache<GuestbookMessages> =>
  processGlobal(CACHE_NAME, () =>
    createStaleCache<GuestbookMessages>({ ttlMs: GUESTBOOK_TTL_MS, now: () => Date.now() }),
  );

/** One Firestore read, given up after {@link GUESTBOOK_LOAD_TIMEOUT_MS}. */
const loadFromFirestore = (): Promise<GuestbookMessages> =>
  withDeadline(fetchFromFirestore(), GUESTBOOK_LOAD_TIMEOUT_MS, LOAD_TIMEOUT_LABEL);

/**
 * Every message, fresh or the last good list (after a failed reload, or past the deadline while
 * a reload keeps running). Rejects only when nothing was ever loaded.
 */
export async function readGuestbookMessages(): Promise<StaleCacheResult<GuestbookMessages>> {
  try {
    return await withDeadline(
      sharedCache().get(CACHE_KEY, loadFromFirestore),
      GUESTBOOK_DEADLINE_MS,
      DEADLINE_LABEL,
    );
  } catch (error) {
    const missedDeadline = error instanceof DeadlineError && error.label === DEADLINE_LABEL;
    const cached = missedDeadline ? sharedCache().peek(CACHE_KEY) : undefined;
    if (!cached) throw error;
    return { stale: true, data: cached.data, error, loadedAt: cached.loadedAt };
  }
}

/**
 * Marks the cached list out of date after a message is stored: the next read asks Firestore,
 * and the previous list stays as its stale-on-error fallback.
 */
export function expireGuestbookMessages(): void {
  sharedCache().expire(CACHE_KEY);
}

/** Drops the cache itself. Tests only. */
export function resetGuestbookCache(): void {
  resetProcessGlobal(CACHE_NAME);
}

const ERROR_LOAD: GuestbookLoad = {
  state: 'error',
  messages: [],
  truncated: false,
  loadedAt: null,
};

/**
 * The page's list: ready, stale (the last good list after a failed reload, with when it was
 * loaded), or the error state when nothing could be loaded. Never throws. React-cache()d, so a
 * render and its metadata share one read.
 */
export const loadGuestbook = cache(async (): Promise<GuestbookLoad> => {
  try {
    const result = await readGuestbookMessages();
    if (!result.stale) return { state: 'ready', ...result.data, loadedAt: null };
    reportApiFailure(result.error, { context: REPORT_CONTEXT, level: 'warning' });
    return { state: 'stale', ...result.data, loadedAt: result.loadedAt };
  } catch (error) {
    reportApiFailure(error, { context: REPORT_CONTEXT });
    return ERROR_LOAD;
  }
});
