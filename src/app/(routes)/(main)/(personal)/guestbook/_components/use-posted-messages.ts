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
 * @file The messages a visitor posts on this page, shown before the server list has them.
 *
 * A post adds its row at once (pending), then either swaps in the stored message the API answers
 * with and refreshes the server list (router.refresh(), which re-renders the page's rows and its
 * count without a reload), or removes the row again and reports the failure, so the card can
 * put the text back. A post refused for its sign-in (a 401 even with a refreshed token, or no
 * token to send because the session has ended; the visitor is signed out either way) says to sign
 * in again, and is flagged so the card keeps saying it while the visitor is signed out. Only a refused post (4xx) or one never sent is reported as not posted:
 * after a timeout, a dropped connection, a 5xx or an unreadable answer the message may be stored
 * all the same, so the card says it couldn't be confirmed, and that posting it again as it is
 * won't add it twice: that post keeps its requestId, and the next post of the same text by the
 * same visitor (their uid) is sent with it, so the API answers the message it stored, if it did,
 * instead of storing another. The requestId is kept until a post with it is confirmed or refused
 * as already used (409), through other texts posted meanwhile, through answers that stored nothing
 * (a 429, say) and through other visitors' posts on this page. A post that went without a
 * requestId (no crypto.randomUUID) has nothing to make a repeat safe, so the card says to check
 * the list before posting it again instead. The list is refreshed at once and once more after
 * {@link LIST_RECHECK_MS}: each server instance caches its list for GUESTBOOK_TTL_MS and a post
 * expires it only on the instance that handled it, and after a timeout the write may still be
 * running, so the first refresh can miss a stored message. The board hides a posted row once the
 * server list includes its id.
 */

import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';

import { currentUid } from '@/core/auth';
import { GUESTBOOK_TTL_MS } from '@/lib/guestbook/limits';
import type { GuestbookMessage } from '@/lib/guestbook/types';
import { logger } from '@/utils/logging';
import {
  type GuestbookDraft,
  isOutcomeUnknown,
  needsSignIn,
  newRequestId,
  PostFailedError,
  postGuestbookMessage,
} from '../_lib/post';

export const POST_FAILED =
  "Your message wasn't posted, so it's back in the box. Try again in a moment.";
/** No token to send, or the API refused the sign-in (401): nothing was stored. */
export const POST_SIGNED_OUT =
  "Your message wasn't posted because your sign-in has expired. Sign in again to post it; your message is kept.";
export const POST_RATE_LIMITED =
  "Your message wasn't posted: there have been a few from here just now. It's back in the box; try again in a few minutes.";
/** May be stored, and was sent with a requestId: the same text posted again is stored once. */
export const POST_UNCONFIRMED =
  "We couldn't confirm your message was posted. It's back in the box; posting it again as it is won't add it twice. The list will update in about a minute.";
/** May be stored, and was sent without a requestId: posting it again could store it twice. */
export const POST_UNCONFIRMED_CHECK_LIST =
  "We couldn't confirm your message was posted. It's back in the box. The list will update in about a minute; if your message isn't there then, post it again.";

/** The API has this post's requestId already, for other text or a message since removed. */
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
/** Past the server's list cache, for a write that lands late and a reload that takes a moment. */
const RECHECK_MARGIN_MS = 5_000;
/**
 * When the list is refreshed again after a post that couldn't be confirmed: by then the cached
 * list has expired on every server instance, so the refresh reads Firestore wherever it lands.
 */
export const LIST_RECHECK_MS = GUESTBOOK_TTL_MS + RECHECK_MARGIN_MS;

/**
 * What the card says for a post that failed with `error`. One that may be stored says a repeat is
 * stored once only when it was sent with a requestId.
 */
const failureMessage = (error: unknown, requestId: string | undefined): string => {
  if (needsSignIn(error)) return POST_SIGNED_OUT;
  if (error instanceof PostFailedError && error.status === HTTP_TOO_MANY_REQUESTS) {
    return POST_RATE_LIMITED;
  }
  if (!isOutcomeUnknown(error)) return POST_FAILED;
  return requestId === undefined ? POST_UNCONFIRMED_CHECK_LIST : POST_UNCONFIRMED;
};

/**
 * A post that may have been stored: who sent it (their uid, null when nobody was signed in), its
 * text, and the requestId a post of that text by them reuses.
 */
interface UnconfirmedPost {
  readonly uid: string | null;
  readonly text: string;
  readonly requestId: string | undefined;
}

/**
 * The requestId for `uid` to post `text` with: the unconfirmed post's when it is theirs and has
 * that text, else a new one. Another visitor never gets it, so their post can't clear it.
 */
const requestIdFor = (
  unconfirmed: UnconfirmedPost | null,
  uid: string | null,
  text: string,
): string | undefined =>
  unconfirmed?.uid === uid && unconfirmed.text === text ? unconfirmed.requestId : newRequestId();

/**
 * The unconfirmed post to keep once `sent` failed with `error`: `sent` when it may have been
 * stored; none when the API refused its requestId as already used (409, so the next post gets a
 * new one); else the one kept before, since nothing was stored.
 */
function unconfirmedAfter(
  kept: UnconfirmedPost | null,
  sent: UnconfirmedPost,
  error: unknown,
): UnconfirmedPost | null {
  if (isOutcomeUnknown(error)) return sent;
  const spent = error instanceof PostFailedError && error.status === HTTP_CONFLICT;
  return spent && kept?.requestId === sent.requestId ? null : kept;
}

/** A message posted from this page; `key` stays the same when the stored message arrives. */
export interface PostedRow {
  readonly key: string;
  readonly message: GuestbookMessage;
  readonly pending: boolean;
}

export type PostOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: string;
      /** Nothing was stored and the visitor has to sign in again (no token, or a 401). */
      readonly needsSignIn: boolean;
    };

/** Posts a draft and says how it went; the rows update themselves. */
export type PostMessage = (draft: GuestbookDraft) => Promise<PostOutcome>;

export interface PostedMessages {
  /** Newest first. */
  readonly rows: readonly PostedRow[];
  readonly post: PostMessage;
}

interface ListRefresh {
  /** Refreshes the server list. */
  readonly now: () => void;
  /** Refreshes it now and once more after {@link LIST_RECHECK_MS}; a later call moves that one. */
  readonly nowAndLater: () => void;
}

/** Refreshes the server list; a refresh still to come is dropped when the page goes away. */
function useListRefresh(): ListRefresh {
  const router = useRouter();
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLater = useCallback(() => {
    if (later.current !== null) clearTimeout(later.current);
    later.current = null;
  }, []);

  useEffect(() => cancelLater, [cancelLater]);

  const now = useCallback(() => startTransition(() => router.refresh()), [router]);
  const nowAndLater = useCallback(() => {
    now();
    cancelLater();
    later.current = setTimeout(() => {
      later.current = null;
      now();
    }, LIST_RECHECK_MS);
  }, [now, cancelLater]);

  return { now, nowAndLater };
}

/** The rows posted on this page, and the function that posts one. */
export function usePostedMessages(): PostedMessages {
  const { now: refreshNow, nowAndLater: refreshNowAndLater } = useListRefresh();
  const [rows, setRows] = useState<readonly PostedRow[]>([]);
  const posts = useRef(0);
  /** The last post that may have been stored; posting its text again reuses its requestId. */
  const unconfirmed = useRef<UnconfirmedPost | null>(null);

  const post = useCallback<PostMessage>(
    async (draft) => {
      posts.current += 1;
      const key = `posted-${posts.current}`;
      const createdAt = new Date().toISOString();
      // Read in the same run as the post takes its session and token, so it is the sender's.
      const uid = currentUid();
      const sent: UnconfirmedPost = {
        uid,
        text: draft.message,
        requestId: requestIdFor(unconfirmed.current, uid, draft.message),
      };
      setRows((current) => [
        { key, pending: true, message: { id: key, ...draft, createdAt } },
        ...current,
      ]);
      try {
        const saved = await postGuestbookMessage(draft, sent.requestId);
        if (unconfirmed.current?.requestId === sent.requestId) unconfirmed.current = null;
        setRows((current) =>
          current.map((row) => (row.key === key ? { key, pending: false, message: saved } : row)),
        );
        refreshNow();
        return { ok: true };
      } catch (error) {
        logger.error('Guestbook post failed:', error);
        unconfirmed.current = unconfirmedAfter(unconfirmed.current, sent, error);
        setRows((current) => current.filter((row) => row.key !== key));
        // It may be stored all the same, or be stored a little later: the list shows it if it is.
        if (isOutcomeUnknown(error)) refreshNowAndLater();
        return {
          ok: false,
          error: failureMessage(error, sent.requestId),
          needsSignIn: needsSignIn(error),
        };
      }
    },
    [refreshNow, refreshNowAndLater],
  );

  return { rows, post };
}
