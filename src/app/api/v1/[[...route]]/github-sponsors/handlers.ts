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
 * GitHub Sponsors API route handler
 * Fetches sponsor data from GitHub GraphQL API with caching
 */

import { getGitHubSponsors } from '@/lib/api-integrations/github-sponsors';
import { logger } from '@/utils';

/**
 * Handler for /api/v1/github-sponsors
 * Returns all sponsors for the configured GitHub user
 *
 * @example
 * GET /api/v1/github-sponsors
 * Response: { sponsors: [...], totalCount: 10, totalMonthlyIncome: 500 }
 */
export async function getGitHubSponsorsHandler() {
  try {
    const data = await getGitHubSponsors();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    logger.error('[GitHub Sponsors API] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch sponsors',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

/**
 * Handler for /api/v1/github-sponsors/active
 * Returns only active sponsors
 *
 * @example
 * GET /api/v1/github-sponsors/active
 * Response: { sponsors: [...], totalCount: 8, totalMonthlyIncome: 500 }
 */
export async function getActiveSponsorsHandler() {
  try {
    const { getActiveSponsors } = await import('@/lib/api-integrations/github-sponsors');
    const activeSponsors = await getActiveSponsors();

    // Calculate total monthly income from active sponsors
    const totalMonthlyIncome = activeSponsors
      .filter((s) => s.tier)
      .reduce((sum, s) => sum + (s.tier?.monthlyPriceInDollars || 0), 0);

    const data = {
      sponsors: activeSponsors,
      totalCount: activeSponsors.length,
      totalMonthlyIncome,
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    logger.error('[GitHub Sponsors API] Error (active):', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch active sponsors',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
