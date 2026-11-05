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
 * @file How every /api/v1/sanity route answers. A Sanity failure never looks like real content:
 * - Sanity answers: 200 with the CDN cache headers. Real empty lists are cached like any answer.
 * - Sanity fails, and the route has an earlier answer in memory: 200 with that answer, a short
 *   CDN cache, and a Sentry warning. For STALE_RETRY_BACKOFF_MS (30 s) after that failure the
 *   route keeps serving the earlier answer without asking Sanity; each such answer is reported
 *   again, and reportApiFailure's cooldown throttles those reports.
 * - Sanity fails with nothing in memory: 503 with `Cache-Control: no-store`, a JSON error body,
 *   and a Sentry error.
 * - A single document that does not exist (no active resume): 404, also `no-store`.
 */

import { type Context, StatusMap } from 'elysia';
import { createErrorHandler } from '@/app/api/_elysia/shared/middleware';
import { ensureBaseError } from '@/classes/error';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils';
import { createStaleCache, type StaleCacheResult } from '../shared/stale-cache';
import { sanityCacheHeaders, sanityNoStoreHeaders, sanityStaleCacheHeaders } from './middleware';

/** How long an answer is served from memory before Sanity is asked again. Matches s-maxage. */
export const SANITY_CACHE_TTL_MS = 5 * 60 * 1_000;

const DEFAULT_NOT_FOUND_MESSAGE = 'Not found';

/** The body of a 404 or 503 answer, the same shape as the API's other error bodies. */
export interface SanityErrorBody {
  readonly error: string;
  readonly status: number;
}

export interface SanityRouteConfig<T> {
  /** The route's cache key, e.g. 'projects'. */
  readonly key: string;
  /**
   * The error-handler context, e.g. 'fetch projects from Sanity'. It names the 503 message and
   * groups the route's warnings and errors in Sentry.
   */
  readonly context: string;
  /** Loads the answer. It throws when Sanity fails, and answers null for a missing document. */
  readonly load: () => Promise<T>;
  /** The 404 message when `load` answers null. */
  readonly notFoundMessage?: string;
}

type ResponseSet = Context['set'];

/** Sanity failed but an earlier answer exists: the route keeps working, so this is a warning. */
function reportStale(key: string, context: string, error: unknown): void {
  const failure = ensureBaseError(error, `sanity:${key}`);
  logger.warn(`[Sanity] Serving the last good ${key}: ${failure.message}`);
  reportApiFailure(failure, { context, level: 'warning' });
}

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
 * Builds a route handler that serves `load`'s answer through a stale-on-error cache of its own.
 * Use it as `.get(path, ({ set }) => handler(set))`.
 */
export function sanityRoute<T>({
  key,
  context,
  load,
  notFoundMessage = DEFAULT_NOT_FOUND_MESSAGE,
}: SanityRouteConfig<T>): (set: ResponseSet) => Promise<NonNullable<T> | SanityErrorBody> {
  const cache = createStaleCache<T>({ ttlMs: SANITY_CACHE_TTL_MS });
  // Logs, and reports at error level: nothing is left to serve.
  const handleUnavailable = createErrorHandler({ context, includeErrorDetails: false });

  return async (set) => {
    let result: StaleCacheResult<T>;
    try {
      result = await cache.get(key, load);
    } catch (error) {
      return answerUnavailable(set, handleUnavailable(error));
    }
    if (result.stale) reportStale(key, context, result.error);
    return answerData(set, result, notFoundMessage);
  };
}
