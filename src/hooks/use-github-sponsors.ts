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

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';

/**
 * @interface Sponsor
 * @description
 * Represents an individual GitHub sponsor with associated metadata, including account, tier, and sponsorship details.
 * Returned as elements of {@link GitHubSponsorsData.sponsors}.
 * @property {string} login - Sponsor's GitHub login/username.
 * @property {string | null} name - Display name of the sponsor or null.
 * @property {string} avatarUrl - URL to the sponsor's avatar image.
 * @property {string} url - Profile URL of the sponsor on GitHub.
 * @property {{name: string; monthlyPriceInDollars: number} | null} tier - Sponsorship tier info or null if not available.
 * @property {string} createdAt - ISO timestamp when sponsorship began.
 * @property {boolean} isActive - Whether the sponsor's support is currently active.
 * @property {'User' | 'Organization'} type - Account type; either 'User' or 'Organization'.
 * @public
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface Sponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  tier: {
    name: string;
    monthlyPriceInDollars: number;
  } | null;
  createdAt: string;
  isActive: boolean;
  type: 'User' | 'Organization';
}

/**
 * @interface GitHubSponsorsData
 * @description
 * Structure of the response containing sponsors and related metadata, returned by GitHub Sponsors API integrations.
 * @property {Sponsor[]} sponsors - Array of {@link Sponsor} objects.
 * @property {number} totalCount - Total number of sponsors (active and inactive).
 * @property {number} totalMonthlyIncome - Aggregated monthly income from all sponsors in US dollars.
 * @public
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface GitHubSponsorsData {
  sponsors: Sponsor[];
  totalCount: number;
  totalMonthlyIncome: number;
}

/**
 * @readonly
 * @private
 * @const
 * GitHub Sponsors response validation schema (for type-safe API integration).
 * @type {Schema.Struct}
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/sponsors
 */
const GitHubSponsorsSchema = Schema.Struct({
  sponsors: Schema.Array(
    Schema.Struct({
      login: Schema.String,
      name: Schema.NullishOr(Schema.String),
      avatarUrl: Schema.String,
      url: Schema.String,
      tier: Schema.NullishOr(
        Schema.Struct({
          name: Schema.String,
          monthlyPriceInDollars: Schema.Number,
        }),
      ),
      createdAt: Schema.String,
      isActive: Schema.Boolean,
      type: Schema.Union(Schema.Literal('User'), Schema.Literal('Organization')),
    }),
  ),
  totalCount: Schema.Number,
  totalMonthlyIncome: Schema.Number,
});

/**
 * Custom React Query hook to fetch all GitHub sponsors—both active and inactive—using the portfolio API endpoint.
 * Uses Effect, schema validation, and retries.
 *
 * @function useGitHubSponsors
 * @returns {import('@tanstack/react-query').UseQueryResult<GitHubSponsorsData, unknown>}
 *   React Query result containing the sponsors data and query state.
 * @throws {Error} Throws if the request fails or response cannot be parsed/validated.
 * @async
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://docs.github.com/en/sponsors/receiving-sponsorships/about-github-sponsors
 * @example
 * const { data, isLoading, error } = useGitHubSponsors();
 * if (data) {
 *   data.sponsors.forEach(sponsor => {
 *     console.log(sponsor.login, sponsor.tier?.name);
 *   });
 * }
 */
export function useGitHubSponsors() {
  return useQuery<GitHubSponsorsData>({
    queryKey: ['github-sponsors'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/v1/github-sponsors', {
          schema: GitHubSponsorsSchema,
          retries: 2,
          timeout: 10_000,
        }),
        Effect.provide(FetchHttpClient.layer),
      );

      const result = await Effect.runPromise(effect);
      return result as GitHubSponsorsData;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });
}

/**
 * Custom React Query hook to fetch only active GitHub sponsors using the portfolio API endpoint.
 * Uses Effect, schema validation, and retries.
 *
 * @function useActiveSponsors
 * @returns {import('@tanstack/react-query').UseQueryResult<GitHubSponsorsData, unknown>}
 *   React Query result with filtered (active-only) sponsors and query state.
 * @throws {Error} Throws if the request fails or response cannot be parsed/validated.
 * @async
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see useGitHubSponsors
 * @example
 * const { data } = useActiveSponsors();
 * if (data?.totalCount) {
 *   console.log('Active sponsors:', data.totalCount);
 * }
 */
export function useActiveSponsors() {
  return useQuery<GitHubSponsorsData>({
    queryKey: ['github-sponsors', 'active'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/v1/github-sponsors/active', {
          schema: GitHubSponsorsSchema,
          retries: 2,
          timeout: 10_000,
        }),
        Effect.provide(FetchHttpClient.layer),
      );

      const result = await Effect.runPromise(effect);
      return result as GitHubSponsorsData;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });
}
