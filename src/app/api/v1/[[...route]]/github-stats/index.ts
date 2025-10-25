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

import { Elysia, StatusMap } from 'elysia';
import { getGitHubStats } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { githubStatsSchema } from './schema';

export const githubStatsRoute = new Elysia({ prefix: '/github-stats' })
  .model(githubStatsSchema)
  .get(
    '/',
    async ({ set }) => {
      try {
        // Since the data shape is dynamic, we cast to any here and let schema validation handle it later (I was lazy)
        const data = (await getGitHubStats()) as any;
        set.headers = cacheHeaders();
        return data;
      } catch (error) {
        const errorResponse = errorHandler(error);
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      response: {
        200: 'github-stats.response',
        500: 'github-stats.error',
      },
    },
  );
