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

import { Stringify } from '@/utils';
import { record } from '@elysiajs/opentelemetry';
import Elysia from 'elysia';
import { IS_VERCEL, version } from '../../../_elysia/constants';
import { timingMiddleware } from '../middleware';

/**
 * Utility routes for status, version, info, and health endpoints.
 * Includes:
 *   - Root welcome endpoint
 *   - Status (uptime, memory, version, environment)
 *   - Version
 *   - Info (contact, documentation)
 *   - Health check
 * @type {Elysia}
 */
export const utilityRoutes = new Elysia()
  .use(timingMiddleware)
  .get(
    '/',
    () =>
      record('root.get', () => {
        return Stringify({
          message: `Welcome to the API. Don't be naughty >:(`,
          status: 200,
        });
      }),
    {
      detail: {
        summary: 'Root endpoint',
        description: 'Welcome message for the API',
        tags: ['Utility'],
      },
    },
  )
  .get(
    '/status',
    async () =>
      record('status.get', async () => {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        const appVersion = version;
        return Stringify({
          message: 'Application status',
          status: 200,
          data: {
            uptime: `${uptime.toFixed(2)} seconds`,
            memory: {
              rss: `${(memoryUsage.rss / 1_024 / 1_024).toFixed(2)} MB`,
              heapTotal: `${(memoryUsage.heapTotal / 1_024 / 1_024).toFixed(2)} MB`,
              heapUsed: `${(memoryUsage.heapUsed / 1_024 / 1_024).toFixed(2)} MB`,
              external: `${(memoryUsage.external / 1_024 / 1_024).toFixed(2)} MB`,
            },
            version: appVersion,
            environment: process.env.NODE_ENV || 'development',
            runtime: IS_VERCEL ? 'vercel' : 'local',
          },
        });
      }),
    {
      detail: {
        summary: 'Get application status',
        description: 'Returns uptime, memory usage, version, and environment',
        tags: ['Utility'],
      },
    },
  )
  .get(
    '/version',
    async () =>
      record('version.get', async () => {
        const appVersion = version;
        return Stringify({
          version: appVersion,
          status: 200,
        });
      }),
    {
      detail: {
        summary: 'Get API version',
        description: 'Returns the current API version',
        tags: ['Info'],
      },
    },
  )
  .get(
    '/info',
    () =>
      record('info.get', () => {
        return Stringify({
          message: 'Information about the API',
          status: 200,
          data: {
            contact: 'example@example.com',
            documentationUrl: 'https://docs.your-api.com',
          },
        });
      }),
    {
      detail: {
        summary: 'Get API info',
        description: 'Returns information about the API',
        tags: ['Info'],
      },
    },
  )
  .get(
    '/health',
    async () =>
      record('health.get', () => {
        return Stringify({ message: 'ok', status: 200 });
      }),
    {
      detail: {
        summary: 'Health check',
        description: 'Returns ok if the API is healthy',
        tags: ['Health'],
      },
    },
  );
