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
 * instead of storing another. Each such requestId (the latest {@link UNCONFIRMED_KEPT}, one per
 * visitor and text) is kept until a post with it is confirmed or refused as already used (409),
 * through other texts posted meanwhile (unconfirmed ones too), through answers that stored nothing
 * and through other visitors' posts on this page. A rate-limited repeat (429) stored nothing, but
 * the post before it may be stored, so the card says it couldn't be confirmed, not that it wasn't
 * posted. A post that went without a requestId (no crypto.randomUUID) has nothing to make a repeat
 * safe, so the card says to check the list before posting it again instead. Whenever a failed post
 * may be stored, the list is refreshed at once and once more after {@link LIST_RECHECK_MS}: each
 * server instance caches its list for GUESTBOOK_TTL_MS and a post expires it only on the instance
 * that handled it, and after a timeout the write may still be running, so the first refresh can
 * miss a stored message. A confirmed post refreshes the list once: the board hides a posted row
 * only once the server list includes its id ({@link unlisted}), and the header counts the stored
 * ones until then, so a refresh that lands on an instance whose cached list predates the post
 * leaves the count right.
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
/** A repeat was rate limited (stored nothing), but the post before it may be stored. */
export const POST_RATE_LIMITED_UNCONFIRMED =
  "We couldn't confirm your message was posted, and there have been a few from here just now. It's back in the box. The list will update in about a minute; if your message isn't there then, try again in a few minutes.";

/** The API has this post's requestId already, for other text or a message since removed. */
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
/** How many posts that may have been stored are remembered; past that, the oldest is forgotten. */
const UNCONFIRMED_KEPT = 5;
/** Past the server's list cache, for a write that lands late and a reload that takes a moment. */
const RECHECK_MARGIN_MS = 5_000;
/**
 * When the list is refreshed again after a post that couldn't be confirmed: by then the cached
 * list has expired on every server instance, so the refresh reads Firestore wherever it lands.
 */
export const LIST_RECHECK_MS = GUESTBOOK_TTL_MS + RECHECK_MARGIN_MS;

/**
 * What the card says for a post that failed with `error`; `mayBeStored` when this post, or an
 * earlier one of the same text by the same visitor, may have been stored. One that may be stored
 * says a repeat is stored once only when it was sent with a requestId; a rate-limited repeat of one
 * says it couldn't be confirmed, not that it wasn't posted.
 */
const failureMessage = (
  error: unknown,
  requestId: string | undefined,
  mayBeStored: boolean,
): string => {
  if (needsSignIn(error)) return POST_SIGNED_OUT;
  if (error instanceof PostFailedError && error.status === HTTP_TOO_MANY_REQUESTS) {
    return mayBeStored ? POST_RATE_LIMITED_UNCONFIRMED : POST_RATE_LIMITED;
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

/** Whether `a` and `b` are the same visitor's post of the same text. */
const samePost = (a: UnconfirmedPost, b: UnconfirmedPost): boolean =>
  a.uid === b.uid && a.text === b.text;

/**
 * The requestId for `uid` to post `text` with: the one their unconfirmed post of that text was
 * sent with, else a new one. Another visitor never gets it, so their post can't clear it.
 */
function requestIdFor(
  unconfirmed: readonly UnconfirmedPost[],
  uid: string | null,
  text: string,
): string | undefined {
  const earlier = unconfirmed.find((post) => post.uid === uid && post.text === text);
  return earlier ? earlier.requestId : newRequestId();
}

/**
 * The unconfirmed posts to keep once `sent` failed with `error`: with `sent` first when it may
 * have been stored (at most {@link UNCONFIRMED_KEPT}); without its text when the API refused its
 * requestId as already used (409, so the next post gets a new one); else as they were, since
 * nothing was stored.
 */
function unconfirmedAfter(
  kept: readonly UnconfirmedPost[],
  sent: UnconfirmedPost,
  error: unknown,
): readonly UnconfirmedPost[] {
  const others = kept.filter((post) => !samePost(post, sent));
  if (isOutcomeUnknown(error)) return [sent, ...others].slice(0, UNCONFIRMED_KEPT);
  const spent = error instanceof PostFailedError && error.status === HTTP_CONFLICT;
  return spent ? others : kept;
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

/** The posted rows the server list (`known`, its ids) doesn't have yet, newest first. */
export const unlisted = (
  rows: readonly PostedRow[],
  known: ReadonlySet<string>,
): readonly PostedRow[] => rows.filter((row) => !known.has(row.message.id));

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
  /** Posts that may have been stored, newest first; posting one's text again reuses its requestId. */
  const unconfirmed = useRef<readonly UnconfirmedPost[]>([]);

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
        unconfirmed.current = unconfirmed.current.filter((kept) => !samePost(kept, sent));
        setRows((current) =>
          current.map((row) => (row.key === key ? { key, pending: false, message: saved } : row)),
        );
        // Once: a refresh that misses the post leaves its row shown and counted (see unlisted).
        refreshNow();
        return { ok: true };
      } catch (error) {
        logger.error('Guestbook post failed:', error);
        unconfirmed.current = unconfirmedAfter(unconfirmed.current, sent, error);
        // This post, or an earlier one of this text by this visitor, may be stored.
        const mayBeStored = unconfirmed.current.some((kept) => samePost(kept, sent));
        setRows((current) => current.filter((row) => row.key !== key));
        // It may be stored all the same, or be stored a little later: the list shows it if it is.
        if (mayBeStored) refreshNowAndLater();
        return {
          ok: false,
          error: failureMessage(error, sent.requestId, mayBeStored),
          needsSignIn: needsSignIn(error),
        };
      }
    },
    [refreshNow, refreshNowAndLater],
  );

  return { rows, post };
}
