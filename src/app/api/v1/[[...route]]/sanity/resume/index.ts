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
 * Sanity Resume API Route
 * Fetches the active resume document from Sanity CMS
 */

import { Elysia } from 'elysia';
import { getResume } from '@/lib/sanity/api';
import { logger } from '@/utils';

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
