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
 * @file How every /api/v1/sanity route answers. Each route reads its collection through the
 * stale-on-error cache it shares with the pages in the same server process
 * ('@/lib/sanity/loaders'), and only maps the result to HTTP. A Sanity failure never looks like
 * real content:
 * - Sanity answers: 200 with the CDN cache headers. Real empty lists are cached like any answer.
 * - Sanity fails, and the collection has an earlier answer in memory: 200 with that answer, a
 *   short CDN cache, and a Sentry warning. For STALE_RETRY_BACKOFF_MS (30 s) after that failure
 *   the route keeps serving the earlier answer without asking Sanity; each such answer is
 *   reported again, and reportApiFailure's cooldown throttles those reports.
 * - Sanity fails with nothing in memory: 503 with `Cache-Control: no-store`, a JSON error body,
 *   and a Sentry error.
 * - A single document that does not exist (no active resume): 404, also `no-store`. Only a fresh
 *   answer can say that: when Sanity fails and the earlier answer in memory is that 404, the
 *   route answers 503 as if nothing were cached, so an outage never looks like a deleted document.
 */

import { type Context, StatusMap } from 'elysia';
import { createErrorHandler } from '@/app/api/_elysia/shared/middleware';
import { ensureBaseError } from '@/classes/error';
import type { StaleCacheResult } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils';
import { sanityCacheHeaders, sanityNoStoreHeaders, sanityStaleCacheHeaders } from './middleware';

/** How long an answer is served from memory before Sanity is asked again. Matches s-maxage. */
export { SANITY_CACHE_TTL_MS } from '@/lib/sanity/loaders';

const DEFAULT_NOT_FOUND_MESSAGE = 'Not found';

/** The body of a 404 or 503 answer, the same shape as the API's other error bodies. */
export interface SanityErrorBody {
  readonly error: string;
  readonly status: number;
}

export interface SanityRouteConfig<T> {
  /** The collection's cache key, e.g. 'projects'. Names the route's stale warnings. */
  readonly key: string;
  /**
   * The error-handler context, e.g. 'fetch projects from Sanity'. It names the 503 message and
   * groups the route's warnings and errors in Sentry.
   */
  readonly context: string;
  /**
   * Reads the collection through its shared stale-on-error cache (a reader from
   * '@/lib/sanity/loaders'). It rejects only when Sanity fails with nothing cached, and its data
   * is null for a missing document.
   */
  readonly read: () => Promise<StaleCacheResult<T>>;
  /** The 404 message when `read`'s data is null. */
  readonly notFoundMessage?: string;
}

type ResponseSet = Context['set'];

/** Sanity failed but an earlier answer exists: the route keeps working, so this is a warning. */
function reportStale(key: string, context: string, error: unknown): void {
  const failure = ensureBaseError(error, `sanity:${key}`);
  logger.warn(`[Sanity] Serving the last good ${key}: ${failure.message}`);
  reportApiFailure(failure, { context, level: 'warning' });
}

/** A load that found no document (null), as opposed to one that failed. */
const isMissing = (data: unknown): boolean => data === null || data === undefined;

function answerData<T>(
  set: ResponseSet,
  result: StaleCacheResult<T>,
  notFoundMessage: string,
): NonNullable<T> | SanityErrorBody {
  const { data } = result;
  if (data === null || data === undefined) {
    Object.assign(set.headers, sanityNoStoreHeaders());
    set.status = StatusMap['Not Found'];
    return { error: notFoundMessage, status: StatusMap['Not Found'] };
  }
  Object.assign(set.headers, result.stale ? sanityStaleCacheHeaders() : sanityCacheHeaders());
  return data;
}

function answerUnavailable(set: ResponseSet, body: { readonly error: string }): SanityErrorBody {
  Object.assign(set.headers, sanityNoStoreHeaders());
  set.status = StatusMap['Service Unavailable'];
  return { error: body.error, status: StatusMap['Service Unavailable'] };
}

/**
 * Builds a route handler that serves `read`'s answer, raw, and maps it to HTTP. The cache is the
 * collection's, so the route and the pages share one Sanity request per TTL per server process
 * (separate serverless instances cannot share it, so each asks on its own).
 * Use it as `.get(path, ({ set }) => handler(set))`.
 */
export function sanityRoute<T>({
  key,
  context,
  read,
  notFoundMessage = DEFAULT_NOT_FOUND_MESSAGE,
}: SanityRouteConfig<T>): (set: ResponseSet) => Promise<NonNullable<T> | SanityErrorBody> {
  // Logs, and reports at error level: nothing is left to serve.
  const handleUnavailable = createErrorHandler({ context, includeErrorDetails: false });

  return async (set) => {
    let result: StaleCacheResult<T>;
    try {
      result = await read();
    } catch (error) {
      return answerUnavailable(set, handleUnavailable(error));
    }
    // A stale "missing" is an old answer served only because Sanity just failed, so it says
    // nothing about the document now: answer the outage, not a 404 the page would not retry.
    if (result.stale && isMissing(result.data)) {
      return answerUnavailable(set, handleUnavailable(result.error));
    }
    if (result.stale) reportStale(key, context, result.error);
    return answerData(set, result, notFoundMessage);
  };
}
