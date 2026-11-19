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
 * @file What a set of promises has settled to within a short wait, for a page that streams. Such a
 * page renders in place whatever has answered by then and streams the rest, each part behind its
 * own Suspense skeleton:
 * - in place, a part is in the first HTML where it belongs, so it reads without JavaScript. React
 *   sends a part from a Suspense boundary after its skeleton, in a hidden element its inline script
 *   moves in, whenever the part is over 500 bytes and the page already sent 12.8 KB (its default
 *   progressiveChunkSize, which Next keeps), however early the part was ready;
 * - streamed, a slow source holds back only its own part, and the first byte waits at most the
 *   wait, not the slowest source's deadline.
 * Isomorphic (no directive), like deadline.ts.
 */

/**
 * How long a streamed page waits for its sources before it sends its frame. Sources that have
 * answered by then (any warm cache answers in a few milliseconds) are rendered in place; the rest
 * stream in. Half a second keeps the first byte inside web.dev's 0.8 s "good" time to first byte
 * with room for the network, even when every source is cold.
 */
export const FIRST_FLUSH_WAIT_MS = 500;

type Promises = Readonly<Record<string, Promise<unknown>>>;

/** What each promise had settled to when the wait ended; a key is missing while it was pending. */
export type SettledWithin<T extends Promises> = {
  readonly [K in keyof T]?: PromiseSettledResult<Awaited<T[K]>>;
};

/** The values among `settled` that were fulfilled; rejected and pending keys are left out. */
export type FulfilledWithin<T extends Promises> = {
  readonly [K in keyof T]?: Awaited<T[K]>;
};

/**
 * Waits until every promise in `promises` has settled or `ms` have passed, whichever is first,
 * and says what each had settled to by then. Never rejects: a rejection is reported as such. The
 * timer is cleared once everything settles, and nothing is cancelled: a promise still pending
 * keeps running for whoever awaits it next (the part that streams it).
 *
 * @example
 * const settled = await settledWithin({ feed: loadFeed() }, FIRST_FLUSH_WAIT_MS);
 * if (settled.feed?.status === 'fulfilled') render(settled.feed.value);
 */
export async function settledWithin<T extends Promises>(
  promises: T,
  ms: number,
): Promise<SettledWithin<T>> {
  const settled: Record<string, PromiseSettledResult<unknown>> = {};
  const all = Promise.all(
    Object.entries(promises).map(([key, promise]) =>
      promise.then(
        (value) => {
          settled[key] = { status: 'fulfilled', value };
        },
        (reason: unknown) => {
          settled[key] = { status: 'rejected', reason };
        },
      ),
    ),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wait = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([all, wait]);
  } finally {
    clearTimeout(timer);
  }
  // A copy: what settles after the wait does not change what the caller was told. Each key holds
  // what its own promise settled to, so the record is the mapped type.
  return { ...settled } as SettledWithin<T>;
}

/** The fulfilled values of `settled`, by key. */
export function fulfilledWithin<T extends Promises>(settled: SettledWithin<T>): FulfilledWithin<T> {
  return Object.fromEntries(
    Object.entries(settled).flatMap(([key, result]) =>
      result?.status === 'fulfilled' ? [[key, result.value]] : [],
    ),
  ) as FulfilledWithin<T>;
}
