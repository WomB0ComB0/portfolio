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
 * @file The one server source for the Monkeytype profile, shared by the /stats prefetch and the
 * home page. There is no HTTP route: the /stats card still fetches api.monkeytype.com from the
 * browser (the CSP allows it), and server code calls this module.
 *
 * Answers come from a stale-on-error cache: fresh for an hour, and after a failed reload the last
 * good profile is served (marked stale) rather than nothing.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import { createStaleCache, type StaleCacheResult } from '@/lib/cache/stale-cache';
import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';

export const MONKEYTYPE_PROFILE_URL = 'https://api.monkeytype.com/users/WomB0ComB0/profile';

/** How long a loaded profile is served before Monkeytype is asked again. */
export const MONKEYTYPE_CACHE_TTL_MS = 60 * 60_000;

/** Upstream time budget: one retry of a 3.5 s attempt fits in the deadline, as for LeetCode. */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;

const CACHE_KEY = 'profile';
/** Groups the stale-fallback warnings in Sentry. */
const REPORT_CONTEXT = 'fetch Monkeytype profile';

const PersonalBestSchema = Schema.Struct({ wpm: Schema.Number, acc: Schema.Number });

/**
 * The parts of the profile the site shows. Lenient on purpose: extra keys are ignored, and a
 * profile without a timed best (no `time`, or no `time['60']`) still decodes; callers decide
 * what to show without one.
 */
export const MonkeytypeProfileSchema = Schema.Struct({
  personalBests: Schema.Struct({
    time: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Array(PersonalBestSchema) }),
    ),
  }),
  typingStats: Schema.Struct({ completedTests: Schema.Number }),
});
export type MonkeytypeProfile = Schema.Schema.Type<typeof MonkeytypeProfileSchema>;

/** Monkeytype wraps every answer in `{ data }`. */
const MonkeytypeProfileReplySchema = Schema.Struct({ data: MonkeytypeProfileSchema });

/** The clock is read on every call, so a test's faked Date moves it too. */
const profileCache = createStaleCache<MonkeytypeProfile>({
  ttlMs: MONKEYTYPE_CACHE_TTL_MS,
  now: () => Date.now(),
});

/** Asks Monkeytype for the profile. A reply that does not match the schema fails. */
const fetchProfile = async (): Promise<MonkeytypeProfile> => {
  const reply = await Effect.runPromise(
    pipe(
      get(MONKEYTYPE_PROFILE_URL, {
        schema: MonkeytypeProfileReplySchema,
        retries: 1,
        retryDelay: RETRY_DELAY_MS,
        timeout: ATTEMPT_TIMEOUT_MS,
      }),
      Effect.timeoutFail({
        duration: UPSTREAM_DEADLINE_MS,
        onTimeout: () =>
          new FetcherError(
            `Monkeytype did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
            MONKEYTYPE_PROFILE_URL,
          ),
      }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );
  return reply.data;
};

/**
 * The profile, fresh or stale (the last good one, after a failed reload). Reports nothing, so
 * each caller decides how to surface staleness. Rejects only when nothing is cached.
 */
export function readMonkeytypeProfile(): Promise<StaleCacheResult<MonkeytypeProfile>> {
  return profileCache.get(CACHE_KEY, fetchProfile);
}

/**
 * The profile. A stale one is returned with a warning to Sentry; with nothing cached, rejects
 * with the upstream's error.
 */
export async function getMonkeytypeProfile(): Promise<MonkeytypeProfile> {
  const result = await readMonkeytypeProfile();
  if (result.stale) {
    reportApiFailure(ensureBaseError(result.error, 'monkeytype:profile'), {
      context: REPORT_CONTEXT,
      level: 'warning',
    });
  }
  return result.data;
}

/** Forgets the cached profile. Tests only. */
export function resetMonkeytypeCache(): void {
  profileCache.clear();
}
