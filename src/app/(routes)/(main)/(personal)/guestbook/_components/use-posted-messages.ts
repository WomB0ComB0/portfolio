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
 * put the text back. The board hides a posted row once the server list includes its id.
 */

import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useRef, useState } from 'react';

import type { GuestbookMessage } from '@/lib/guestbook/types';
import { logger } from '@/utils/logging';
import { type GuestbookDraft, PostFailedError, postGuestbookMessage } from '../_lib/post';

export const POST_FAILED =
  "Your message wasn't posted, so it's back in the box. Try again in a moment.";
export const POST_RATE_LIMITED =
  "Your message wasn't posted: there have been a few from here just now. It's back in the box; try again in a few minutes.";

const HTTP_TOO_MANY_REQUESTS = 429;

/** What the card says for a failed post. */
const failureMessage = (error: unknown): string =>
  error instanceof PostFailedError && error.status === HTTP_TOO_MANY_REQUESTS
    ? POST_RATE_LIMITED
    : POST_FAILED;

/** A message posted from this page; `key` stays the same when the stored message arrives. */
export interface PostedRow {
  readonly key: string;
  readonly message: GuestbookMessage;
  readonly pending: boolean;
}

export type PostOutcome = { readonly ok: true } | { readonly ok: false; readonly error: string };

/** Posts a draft and says how it went; the rows update themselves. */
export type PostMessage = (draft: GuestbookDraft) => Promise<PostOutcome>;

export interface PostedMessages {
  /** Newest first. */
  readonly rows: readonly PostedRow[];
  readonly post: PostMessage;
}

/** The rows posted on this page, and the function that posts one. */
export function usePostedMessages(): PostedMessages {
  const router = useRouter();
  const [rows, setRows] = useState<readonly PostedRow[]>([]);
  const posts = useRef(0);

  const post = useCallback<PostMessage>(
    async (draft) => {
      posts.current += 1;
      const key = `posted-${posts.current}`;
      const createdAt = new Date().toISOString();
      setRows((current) => [
        { key, pending: true, message: { id: key, ...draft, createdAt } },
        ...current,
      ]);
      try {
        const saved = await postGuestbookMessage(draft);
        setRows((current) =>
          current.map((row) => (row.key === key ? { key, pending: false, message: saved } : row)),
        );
        startTransition(() => router.refresh());
        return { ok: true };
      } catch (error) {
        logger.error('Guestbook post failed:', error);
        setRows((current) => current.filter((row) => row.key !== key));
        return { ok: false, error: failureMessage(error) };
      }
    },
    [router],
  );

  return { rows, post };
}
