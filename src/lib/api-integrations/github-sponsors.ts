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
 * @module api-integrations/github-sponsors
 * @description
 * GitHub Sponsors API Integration for portfolio (by WomB0ComB0)
 *
 * Provides functions for fetching sponsor information from GitHub Sponsors using the GraphQL API.
 * Requires a GitHub access token with `read:org` and `read:user` scopes.
 *
 * @see https://docs.github.com/en/developers/overview/managing-deploy-keys#deploy-keys
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 */

import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { post } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

// Schema for GitHub Sponsors response
const SponsorEntitySchema = Schema.Struct({
  __typename: Schema.String,
  login: Schema.String,
  name: Schema.NullishOr(Schema.String),
  avatarUrl: Schema.String,
  url: Schema.String,
});

/**
 * @readonly
 * @description Effect Schema definition for a GitHub sponsor tier.
 * @private
 */
const SponsorTierSchema = Schema.Struct({
  name: Schema.String,
  monthlyPriceInDollars: Schema.Number,
  monthlyPriceInCents: Schema.Number,
});

/**
 * @readonly
 * @description
 * Effect Schema definition for a GitHub Sponsorship Node—an individual sponsorship of a maintainer.
 * @private
 */
const SponsorshipNodeSchema = Schema.Struct({
  sponsorEntity: SponsorEntitySchema,
  tier: Schema.NullishOr(SponsorTierSchema),
  createdAt: Schema.String,
  isActive: Schema.Boolean,
  privacyLevel: Schema.String,
});

/**
 * @readonly
 * @description Effect Schema definition for the complete GitHub Sponsors GraphQL API response.
 * @private
 */
const GitHubSponsorsResponseSchema = Schema.Struct({
  data: Schema.Struct({
    user: Schema.NullishOr(
      Schema.Struct({
        sponsorshipsAsMaintainer: Schema.Struct({
          totalCount: Schema.Number,
          nodes: Schema.Array(SponsorshipNodeSchema),
          pageInfo: Schema.Struct({
            hasNextPage: Schema.Boolean,
            endCursor: Schema.NullishOr(Schema.String),
          }),
        }),
      }),
    ),
  }),
});

/**
 * Represents a GitHub sponsor of the maintainer (user or organization).
 *
 * @interface
 * @public
 * @see https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/about-github-sponsors
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface Sponsor {
  /** The sponsor's GitHub login. */
  login: string;
  /** The sponsor's name, if available. */
  name: string | null;
  /** The sponsor's GitHub avatar URL. */
  avatarUrl: string;
  /** URL to the sponsor's GitHub profile. */
  url: string;
  /** The tier of sponsorship, or null if not recurring. */
  tier: {
    name: string;
    monthlyPriceInDollars: number;
  } | null;
  /** When the sponsorship started. */
  createdAt: string;
  /** Whether the sponsorship is currently active. */
  isActive: boolean;
  /** The type of the sponsor entity: "User" or "Organization". */
  type: 'User' | 'Organization';
}

/**
 * Data structure containing the fetched sponsors and aggregate information.
 *
 * @interface
 * @public
 * @property {Sponsor[]} sponsors - Array of sponsorships.
 * @property {number} totalCount - Total number of sponsors.
 * @property {number} totalMonthlyIncome - Total active monthly income in USD from sponsors.
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
 * @description Duration (in ms) for which sponsor data is cached in memory.
 */
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * @readonly
 * @private
 * @description In-memory cache for sponsor data to avoid unnecessary API calls.
 */
let cache: { data: GitHubSponsorsData; timestamp: number } | null = null;

/**
 * @readonly
 * @private
 * @description GitHub GraphQL query string for retrieving sponsorship data.
 */
const GITHUB_GRAPHQL_QUERY = `
  query($login: String!, $first: Int!, $after: String) {
    user(login: $login) {
      sponsorshipsAsMaintainer(
        first: $first
        after: $after
        activeOnly: false
        includePrivate: false
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          sponsorEntity {
            __typename
            ... on User {
              login
              name
              avatarUrl
              url
            }
            ... on Organization {
              login
              name
              avatarUrl
              url
            }
          }
          tier {
            name
            monthlyPriceInDollars
            monthlyPriceInCents
          }
          createdAt
          isActive
          privacyLevel
        }
      }
    }
  }
`;

/**
 * Fetches all sponsors from the GitHub Sponsors API for a given user.
 * Handles pagination to collect all sponsor records and caches results in memory for 1 hour.
 * Requires the `GITHUB_TOKEN` environment variable with `read:org` and `read:user` scopes.
 *
 * @function
 * @async
 * @public
 * @param {string} [username='WomB0ComB0'] - The GitHub username whose sponsors will be fetched.
 * @returns {Promise<GitHubSponsorsData>} Promise resolving to sponsor info, totals, and income.
 * @throws {Error} Throws if fetching or decoding sponsor API response fails.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://docs.github.com/en/graphql
 * @example
 * const data = await getGitHubSponsors('WomB0ComB0');
 * console.log(data.sponsors.length);
 */
export async function getGitHubSponsors(
  username: string = 'WomB0ComB0',
): Promise<GitHubSponsorsData> {
  // Return cached data if still valid
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    logger.info('[GitHub Sponsors] Returning cached data');
    return cache.data;
  }

  // Check if GitHub token is available
  if (!env.GITHUB_TOKEN) {
    console.warn('[GitHub Sponsors] No GITHUB_TOKEN found, returning empty sponsor list');
    return {
      sponsors: [],
      totalCount: 0,
      totalMonthlyIncome: 0,
    };
  }

  try {
    logger.info('[GitHub Sponsors] Fetching sponsors for:', { username });

    const allSponsors: Sponsor[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    let totalCount = 0;

    // Fetch all pages of sponsors
    while (hasNextPage) {
      const variables: { login: string; first: number; after: string | null } = {
        login: username,
        first: 100, // Max per page
        after,
      };

      const effect = pipe(
        post(
          'https://api.github.com/graphql',
          {
            query: GITHUB_GRAPHQL_QUERY,
            variables,
          },
          {
            schema: GitHubSponsorsResponseSchema,
            retries: 2,
            timeout: 10_000,
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        ),
        Effect.provide(FetchHttpClient.layer),
      );

      const response: Schema.Schema.Type<typeof GitHubSponsorsResponseSchema> =
        await Effect.runPromise(effect);

      if (!response.data.user) {
        console.warn('[GitHub Sponsors] User not found or no sponsor data');
        break;
      }

      const { nodes, pageInfo, totalCount: count } = response.data.user.sponsorshipsAsMaintainer;

      totalCount = count;
      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor ?? null;

      // Map nodes to Sponsor objects
      const sponsors = nodes.map((node: Schema.Schema.Type<typeof SponsorshipNodeSchema>) => ({
        login: node.sponsorEntity.login,
        name: node.sponsorEntity.name ?? null,
        avatarUrl: node.sponsorEntity.avatarUrl,
        url: node.sponsorEntity.url,
        tier: node.tier
          ? {
              name: node.tier.name,
              monthlyPriceInDollars: node.tier.monthlyPriceInDollars,
            }
          : null,
        createdAt: node.createdAt,
        isActive: node.isActive,
        type: (node.sponsorEntity.__typename === 'Organization' ? 'Organization' : 'User') as
          | 'Organization'
          | 'User',
      }));

      allSponsors.push(...sponsors);

      logger.info(
        `[GitHub Sponsors] Fetched ${sponsors.length} sponsors (page ${allSponsors.length / 100})`,
      );
    }

    // Calculate total monthly income from active sponsors
    const totalMonthlyIncome = allSponsors
      .filter((s) => s.isActive && s.tier)
      .reduce((sum, s) => sum + (s.tier?.monthlyPriceInDollars || 0), 0);

    const data: GitHubSponsorsData = {
      sponsors: allSponsors,
      totalCount,
      totalMonthlyIncome,
    };

    logger.info('[GitHub Sponsors] Successfully fetched:', {
      totalSponsors: allSponsors.length,
      activeSponsors: allSponsors.filter((s) => s.isActive).length,
      totalMonthlyIncome: `$${totalMonthlyIncome}`,
    });

    // Cache the result
    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    logger.error('[GitHub Sponsors] Error fetching sponsors:', error);
    throw ensureBaseError(error, 'github:sponsors', {
      username,
      hasToken: !!env.GITHUB_TOKEN,
    });
  }
}

/**
 * Gets only active GitHub sponsors for a user.
 * Internally calls {@link getGitHubSponsors}.
 *
 * @function
 * @async
 * @public
 * @param {string} [username='WomB0ComB0'] - GitHub username.
 * @returns {Promise<Sponsor[]>} Array of active sponsors.
 * @throws {Error} On API failure or decoding issue.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see getGitHubSponsors
 * @example
 * const active = await getActiveSponsors('WomB0ComB0');
 * console.log(active.length);
 */
export async function getActiveSponsors(username: string = 'WomB0ComB0'): Promise<Sponsor[]> {
  const data = await getGitHubSponsors(username);
  return data.sponsors.filter((sponsor) => sponsor.isActive);
}

/**
 * Gets active sponsors grouped by their tier for a user.
 *
 * @function
 * @async
 * @public
 * @param {string} [username='WomB0ComB0'] - GitHub username.
 * @returns {Promise<Map<string, Sponsor[]>>} Sponsors grouped by tier name.
 * @throws {Error} On API failure or decoding issue.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see getGitHubSponsors
 * @example
 * const byTier = await getSponsorsByTier('WomB0ComB0');
 * for (const [tier, sponsors] of byTier.entries()) {
 *   console.log(tier, sponsors.length);
 * }
 */
export async function getSponsorsByTier(
  username: string = 'WomB0ComB0',
): Promise<Map<string, Sponsor[]>> {
  const data = await getGitHubSponsors(username);
  const tierMap = new Map<string, Sponsor[]>();

  data.sponsors
    .filter((s) => s.isActive)
    .forEach((sponsor) => {
      const tierName = sponsor.tier?.name || 'One-time';
      if (!tierMap.has(tierName)) {
        tierMap.set(tierName, []);
      }
      tierMap.get(tierName)?.push(sponsor);
    });

  return tierMap;
}
