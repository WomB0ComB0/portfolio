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
    const data = await getActiveSponsors();

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
