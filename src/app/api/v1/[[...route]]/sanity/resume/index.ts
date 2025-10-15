/**
 * Sanity Resume API Route
 * Fetches the active resume document from Sanity CMS
 */

import { Elysia } from 'elysia';
import { logger } from '@/utils';
import { getResume } from '@/lib/sanity/api';

export const resumeRoute = new Elysia({ prefix: '/resume' }).get('/', async () => {
  try {
    const result = await getResume();

    if (!result) {
      logger.warn('No active resume found in Sanity');
      return new Response(
        JSON.stringify({
          error: 'No active resume found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        },
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    logger.error('Error fetching resume from Sanity', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch resume',
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
});
