/**
 * GitHub Sponsors API Integration
 * 
 * Fetches sponsor information from GitHub Sponsors using GraphQL API.
 * Requires GITHUB_TOKEN with read:org and read:user scopes.
 * 
 * To enable:
 * 1. Generate a GitHub token at: https://github.com/settings/tokens
 * 2. Select scopes: read:org, read:user
 * 3. Add to .env.local: GITHUB_TOKEN=your_token_here
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { post } from '@/lib/http-clients/effect-fetcher';

// Schema for GitHub Sponsors response
const SponsorEntitySchema = Schema.Struct({
  __typename: Schema.String,
  login: Schema.String,
  name: Schema.NullishOr(Schema.String),
  avatarUrl: Schema.String,
  url: Schema.String,
});

const SponsorTierSchema = Schema.Struct({
  name: Schema.String,
  monthlyPriceInDollars: Schema.Number,
  monthlyPriceInCents: Schema.Number,
});

const SponsorshipNodeSchema = Schema.Struct({
  sponsorEntity: SponsorEntitySchema,
  tier: Schema.NullishOr(SponsorTierSchema),
  createdAt: Schema.String,
  isActive: Schema.Boolean,
  privacyLevel: Schema.String,
});

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

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: GitHubSponsorsData; timestamp: number } | null = null;

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
 * Fetches all sponsors from GitHub Sponsors API
 * Handles pagination automatically to get all sponsors
 */
export async function getGitHubSponsors(
  username: string = 'WomB0ComB0',
): Promise<GitHubSponsorsData> {
  // Return cached data if still valid
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log('[GitHub Sponsors] Returning cached data');
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
    console.log('[GitHub Sponsors] Fetching sponsors for:', username);

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
          | 'User'
          | 'Organization',
      }));

      allSponsors.push(...sponsors);

      console.log(
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

    console.log('[GitHub Sponsors] Successfully fetched:', {
      totalSponsors: allSponsors.length,
      activeSponsors: allSponsors.filter((s) => s.isActive).length,
      totalMonthlyIncome: `$${totalMonthlyIncome}`,
    });

    // Cache the result
    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    console.error('[GitHub Sponsors] Error fetching sponsors:', error);
    throw ensureBaseError(error, 'github:sponsors', {
      username,
      hasToken: !!env.GITHUB_TOKEN,
    });
  }
}

/**
 * Get only active sponsors
 */
export async function getActiveSponsors(username: string = 'WomB0ComB0'): Promise<Sponsor[]> {
  const data = await getGitHubSponsors(username);
  return data.sponsors.filter((sponsor) => sponsor.isActive);
}

/**
 * Get sponsors grouped by tier
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
      tierMap.get(tierName)!.push(sponsor);
    });

  return tierMap;
}
