/**
 * React Query hook for fetching GitHub Sponsors data
 */

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';

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

export interface GitHubSponsorsData {
  sponsors: Sponsor[];
  totalCount: number;
  totalMonthlyIncome: number;
}

// Schema for GitHub Sponsors response
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
 * Fetches all GitHub sponsors (active and inactive)
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
 * Fetches only active GitHub sponsors
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
