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
 * @file A time budget for a promise. Isomorphic on purpose: no 'use server', 'use client' or
 * 'server-only', so server loaders and client islands share it.
 */

/** Raised by {@link withDeadline} when the promise is still pending once its budget runs out. */
export class DeadlineError extends Error {
  readonly name = 'DeadlineError';

  constructor(
    /** What timed out, e.g. 'github activity'. */
    readonly label: string,
    /** The budget that ran out, in milliseconds. */
    readonly ms: number,
  ) {
    super(`${label} timed out after ${ms} ms`);
  }
}

/**
 * Settles like `promise`, or rejects with a {@link DeadlineError} once `ms` pass first.
 *
 * - The timer is cleared as soon as either side wins, so nothing is left scheduled.
 * - `promise` always has a rejection handler attached, so a rejection that arrives after the
 *   deadline already won is never reported as an unhandled rejection.
 * - The work is not cancelled: a late success still fills whatever cache `promise` writes to, so
 *   the next request can use it.
 *
 * @example
 * const activity = await withDeadline(loadActivity(), 1_500, 'github activity');
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  // Handled up front, before the race: if the deadline wins, nothing else ever awaits `promise`.
  promise.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
