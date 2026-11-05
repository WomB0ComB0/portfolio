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
 * @file The /stats numeric cards' queries: keys, browser fetchers, freshness and the client
 * schemas their data is decoded with. Isomorphic on purpose (no directive, no server imports):
 * the cards' `useQuery` and the server prefetch (stats-prefetch.ts) both import from here, so a
 * prefetched query always lands under the exact key its card reads.
 */

import { FetchHttpClient } from '@effect/platform';
import { queryOptions } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';

/** A card's fetch gives up after this; TanStack Query is its only retry layer. */
const CARD_FETCH_TIMEOUT_MS = 10_000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The browser asks Monkeytype directly (the CSP allows it); the server reads the same URL. */
export const MONKEYTYPE_PROFILE_URL = 'https://api.monkeytype.com/users/WomB0ComB0/profile';

export const GitHubStatsSchema = Schema.Struct({
  user: Schema.Struct({
    repos: Schema.Number,
    followers: Schema.Number,
    avatar_url: Schema.String,
  }),
  stats: Schema.Struct({
    totalStars: Schema.Number,
    topLanguages: Schema.Array(Schema.String),
  }),
  topRepos: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.Union(Schema.String, Schema.Null),
      stars: Schema.Number,
      language: Schema.Union(Schema.String, Schema.Null),
      url: Schema.String,
    }),
  ),
});
export type GitHubStatsData = Schema.Schema.Type<typeof GitHubStatsSchema>;

export const LeetCodeStatsSchema = Schema.Struct({
  totalSolved: Schema.Number,
  easySolved: Schema.Number,
  mediumSolved: Schema.Number,
  hardSolved: Schema.Number,
  acceptanceRate: Schema.Number,
  ranking: Schema.Number,
});
export type LeetCodeStatsData = Schema.Schema.Type<typeof LeetCodeStatsSchema>;

export const GoogleResponseSchema = Schema.Struct({
  total_pageviews: Schema.optional(Schema.Number),
});
export type GoogleResponse = Schema.Schema.Type<typeof GoogleResponseSchema>;

export const WakaTimeResponseSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});
export type WakaTimeResponse = Schema.Schema.Type<typeof WakaTimeResponseSchema>;

export const MonkeytypeDataSchema = Schema.Struct({
  personalBests: Schema.Struct({
    time: Schema.Struct({
      '60': Schema.Array(Schema.Struct({ wpm: Schema.Number, acc: Schema.Number })),
    }),
  }),
  typingStats: Schema.Struct({ completedTests: Schema.Number }),
});
export const MonkeytypeResponseSchema = Schema.Struct({ data: MonkeytypeDataSchema });
export type MonkeytypeData = Schema.Schema.Type<typeof MonkeytypeDataSchema>;

/**
 * GETs `url` once and decodes the body with `schema`. A non-2xx or malformed response rejects,
 * so the query errors instead of rendering bad data. No fetch retries: TanStack Query's
 * shouldRetryQuery is the only retry layer.
 */
const fetchDecoded = <A, I>(url: string, schema: Schema.Schema<A, I, never>): Promise<A> =>
  Effect.runPromise(
    pipe(
      get(url, { retries: 0, timeout: CARD_FETCH_TIMEOUT_MS, schema }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );

export const githubStatsQuery = queryOptions({
  queryKey: ['github-stats'] as const,
  queryFn: () => fetchDecoded('/api/v1/github-stats', GitHubStatsSchema),
  staleTime: HOUR_MS,
});

export const leetcodeStatsQuery = queryOptions({
  queryKey: ['leetcode-stats'] as const,
  queryFn: () => fetchDecoded('/api/v1/leetcode', LeetCodeStatsSchema),
  staleTime: 6 * HOUR_MS,
});

/** Google Analytics page views (last 30 days), on the Dev Stats card. */
export const pageViewsQuery = queryOptions({
  queryKey: ['google'] as const,
  queryFn: () => fetchDecoded('/api/v1/google', GoogleResponseSchema),
  staleTime: 5 * MINUTE_MS,
});

/** All-time coding time, on the Dev Stats card. */
export const wakatimeQuery = queryOptions({
  queryKey: ['wakatime'] as const,
  queryFn: () => fetchDecoded('/api/v1/wakatime', WakaTimeResponseSchema),
  staleTime: HOUR_MS,
});

/** The profile's `data`, without Monkeytype's `{ data }` envelope. */
export const monkeytypeQuery = queryOptions({
  queryKey: ['monkeytype-stats'] as const,
  queryFn: async (): Promise<MonkeytypeData> =>
    (await fetchDecoded(MONKEYTYPE_PROFILE_URL, MonkeytypeResponseSchema)).data,
  staleTime: HOUR_MS,
});
