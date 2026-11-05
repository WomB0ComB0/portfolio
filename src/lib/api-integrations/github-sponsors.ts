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

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import { post } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils';

/**
 * The sponsoring account. The query asks for its fields only `... on User` and
 * `... on Organization`, so an account of any other type arrives with just `__typename`. Such a
 * node is dropped when mapping (see {@link toSponsor}) instead of failing the whole list.
 */
const SponsorEntitySchema = Schema.Struct({
  __typename: Schema.String,
  login: Schema.NullishOr(Schema.String),
  name: Schema.NullishOr(Schema.String),
  avatarUrl: Schema.NullishOr(Schema.String),
  url: Schema.NullishOr(Schema.String),
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
  // Nullable in GitHub's schema: it is null when the account can't be shown, e.g. one that was
  // deleted or suspended. One such node must not fail the decode of every other sponsor.
  sponsorEntity: Schema.NullOr(SponsorEntitySchema),
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

type SponsorshipNode = Schema.Schema.Type<typeof SponsorshipNodeSchema>;

/** One page of `sponsorshipsAsMaintainer`. */
type SponsorshipsPage = NonNullable<
  Schema.Schema.Type<typeof GitHubSponsorsResponseSchema>['data']['user']
>['sponsorshipsAsMaintainer'];

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

/** GitHub's maximum page size for a connection. */
const PAGE_SIZE = 100;

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** The {@link processGlobal} name of this module's cache. */
const CACHE_NAME = 'github-sponsors.cache';

interface CachedSponsors {
  readonly data: GitHubSponsorsData;
  /** `Date.now()` when GitHub answered. */
  readonly fetchedAt: number;
}

/**
 * In-memory state shared by every copy of this module in the process. Next bundles the /sponsor
 * page and /api/v1/github-sponsors separately, so a module-level variable would give each its own
 * cache and its own GitHub calls.
 */
interface SponsorsCacheState {
  /** The last good answer per username. Failures are never stored. */
  readonly results: Map<string, CachedSponsors>;
  /**
   * The load in flight per username. Callers that arrive meanwhile share it, so a slow GitHub
   * sees one request chain per process, however many pages stop waiting at their deadline.
   */
  readonly inflight: Map<string, Promise<GitHubSponsorsData>>;
}

const sponsorsCache = (): SponsorsCacheState =>
  processGlobal<SponsorsCacheState>(CACHE_NAME, () => ({
    results: new Map<string, CachedSponsors>(),
    inflight: new Map<string, Promise<GitHubSponsorsData>>(),
  }));

/**
 * Forgets the cached sponsors and any load in flight, in every copy of this module. Tests only.
 */
export function resetGitHubSponsorsCache(): void {
  resetProcessGlobal(CACHE_NAME);
}

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
 * The node as a Sponsor, or null when GitHub sent no account to show: a null `sponsorEntity`
 * (a deleted or suspended sponsor) or one without a login, avatar or profile URL. Such an entry
 * has nothing to link to or key on.
 */
function toSponsor(node: SponsorshipNode): Sponsor | null {
  const entity = node.sponsorEntity;
  if (!entity?.login || !entity.avatarUrl || !entity.url) return null;
  return {
    login: entity.login,
    name: entity.name ?? null,
    avatarUrl: entity.avatarUrl,
    url: entity.url,
    tier: node.tier
      ? { name: node.tier.name, monthlyPriceInDollars: node.tier.monthlyPriceInDollars }
      : null,
    createdAt: node.createdAt,
    isActive: node.isActive,
    type: entity.__typename === 'Organization' ? 'Organization' : 'User',
  };
}

/** The page's sponsors that can be shown; the rest are logged and left out. */
function listableSponsors(nodes: readonly SponsorshipNode[]): Sponsor[] {
  const sponsors = nodes.flatMap((node) => {
    const sponsor = toSponsor(node);
    return sponsor ? [sponsor] : [];
  });
  const skipped = nodes.length - sponsors.length;
  if (skipped > 0) {
    logger.warn('[GitHub Sponsors] Skipped sponsorships with no account to show', { skipped });
  }
  return sponsors;
}

/** One page of the user's sponsorships, or null when GitHub has no such user. */
async function fetchSponsorshipsPage(
  username: string,
  after: string | null,
  token: string,
): Promise<SponsorshipsPage | null> {
  const effect = pipe(
    post(
      GITHUB_GRAPHQL_URL,
      { query: GITHUB_GRAPHQL_QUERY, variables: { login: username, first: PAGE_SIZE, after } },
      {
        schema: GitHubSponsorsResponseSchema,
        retries: 2,
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    ),
    Effect.provide(FetchHttpClient.layer),
  );
  const response = await Effect.runPromise(effect);
  return response.data.user?.sponsorshipsAsMaintainer ?? null;
}

/** Sum of the monthly tiers of the active sponsors, in USD. */
const monthlyIncome = (sponsors: readonly Sponsor[]): number =>
  sponsors
    .filter((sponsor) => sponsor.isActive)
    .reduce((sum, sponsor) => sum + (sponsor.tier?.monthlyPriceInDollars ?? 0), 0);

/** Every page of the user's sponsorships, straight from GitHub. Throws on any failed page. */
async function fetchAllSponsors(username: string, token: string): Promise<GitHubSponsorsData> {
  let sponsors: readonly Sponsor[] = [];
  let totalCount = 0;
  let after: string | null = null;

  for (let pageNumber = 1; ; pageNumber += 1) {
    const page = await fetchSponsorshipsPage(username, after, token);
    if (!page) {
      logger.warn('[GitHub Sponsors] User not found or no sponsor data', { username });
      break;
    }
    const pageSponsors = listableSponsors(page.nodes);
    sponsors = [...sponsors, ...pageSponsors];
    totalCount = page.totalCount;
    logger.info(`[GitHub Sponsors] Fetched ${pageSponsors.length} sponsors (page ${pageNumber})`);
    // A next page without a cursor would fetch the first page again, forever.
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }

  return { sponsors: [...sponsors], totalCount, totalMonthlyIncome: monthlyIncome(sponsors) };
}

/** Tags and groups the Sentry issue when GitHub can't be read. */
const SPONSORS_REPORT_CONTEXT = 'github sponsors';

/**
 * Fetches from GitHub and stores a success in `cache`, the store that was current when the load
 * started, so a load that outlives a reset never fills the new store. A failure is reported once,
 * here, and never stored. When `cache` still holds an older list, that list is returned instead
 * (reported as a warning): sponsors change rarely, and the last good list beats an error.
 */
async function loadAndCache(
  cache: SponsorsCacheState,
  username: string,
  token: string,
): Promise<GitHubSponsorsData> {
  try {
    logger.info('[GitHub Sponsors] Fetching sponsors for:', { username });
    const data = await fetchAllSponsors(username, token);
    logger.info('[GitHub Sponsors] Successfully fetched:', {
      totalSponsors: data.sponsors.length,
      activeSponsors: data.sponsors.filter((sponsor) => sponsor.isActive).length,
      totalMonthlyIncome: `$${data.totalMonthlyIncome}`,
    });
    cache.results.set(username, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    const failure = ensureBaseError(error, 'github:sponsors', { username, hasToken: true });
    const previous = cache.results.get(username);
    reportApiFailure(failure, {
      context: SPONSORS_REPORT_CONTEXT,
      level: previous ? 'warning' : 'error',
    });
    if (previous) return previous.data;
    throw failure;
  }
}

/** Starts the load for `username` in `cache`, shared by every caller until it settles. */
function startLoad(
  cache: SponsorsCacheState,
  username: string,
  token: string,
): Promise<GitHubSponsorsData> {
  const load = loadAndCache(cache, username, token).finally(() => {
    cache.inflight.delete(username);
  });
  cache.inflight.set(username, load);
  return load;
}

/**
 * Fetches all sponsors from the GitHub Sponsors API for a given user.
 * Handles pagination to collect all sponsor records and caches results in memory for 1 hour,
 * once per server process: the page and the API route share the cache, and callers that arrive
 * while a fetch is in flight share that fetch. A fetch that outlives its caller's deadline still
 * fills the cache for the next one. Once a list has expired it is still returned at once while a
 * refresh runs in the background, and kept if that refresh fails, so a slow or failing GitHub
 * never turns a list already in memory into an error.
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
  const cache = sponsorsCache();
  const cached = cache.results.get(username);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
    logger.info('[GitHub Sponsors] Returning cached data');
    return cached.data;
  }

  const token = env.GITHUB_TOKEN;
  if (!token) {
    logger.warn('[GitHub Sponsors] No GITHUB_TOKEN found, returning empty sponsor list');
    return { sponsors: [], totalCount: 0, totalMonthlyIncome: 0 };
  }

  const load = cache.inflight.get(username) ?? startLoad(cache, username, token);
  if (!cached) return load;

  // Stale while revalidating: the refresh keeps `cached` on failure, so it never rejects here.
  logger.info('[GitHub Sponsors] Returning expired data while refreshing');
  return cached.data;
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
