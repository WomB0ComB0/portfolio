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
import { handleStatusCheck } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { statusSchemas } from './schema';

/**
 * @class
 * @classdesc
 * Defines the service status monitoring HTTP endpoint for the portfolio project.
 * Provides RESTful API for checking the current system status from Better Stack.
 *
 * @readonly
 * @public
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://elysiajs.com/docs/
 * @version 1.0.0
 *
 * @example
 * import { statusRoute } from './status';
 * app.use(statusRoute);
 */
export const statusRoute = new Elysia({ prefix: '/status' })
  .model(statusSchemas)
  /**
   * Status check endpoint.
   *
   * @route GET /status
   * @async
   * @function
   * @returns {Promise<import('./schema').statusSchemas['status.response']>} Resolves with status check response on 200.
   * @throws {Error} Throws error if the status check cannot be performed.
   * @web
   * @public
   * @author Mike Odnis
   * @see https://betterstack.com/docs/uptime/api/
   * @version 1.0.0
   * @example
   * // Returns:
   * // { success: true, message: 'Status retrieved', data: { state: 'operational', lastUpdated: '...' } }
   */
  .get(
    '/',
    async ({ set }) => {
      try {
        const result = await handleStatusCheck();
        set.headers = cacheHeaders();
        return {
          success: true as const,
          message: 'Status retrieved',
          data: result,
        };
      } catch (error) {
        // Log the error but don't fail completely
        errorHandler(error);

        // If we have a fallback state, return 200 with degraded info
        // This prevents breaking the UI when Better Stack is down
        set.headers = cacheHeaders();
        set.status = StatusMap.OK;

        return {
          success: true as const,
          message: 'Status retrieved with fallback',
          data: {
            state: 'unknown' as const,
            lastUpdated: new Date().toISOString(),
            message: 'Status monitoring temporarily unavailable',
          },
        };
      }
    },
    {
      detail: {
        summary: 'System status check',
        description: 'Returns current system status from Better Stack monitoring',
        tags: ['Status', 'Monitoring'],
      },
      response: {
        200: 'status.response',
        500: 'status.error',
      },
    },
  );
