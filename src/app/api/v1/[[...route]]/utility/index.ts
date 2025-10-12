import { record } from '@elysiajs/opentelemetry';
import Elysia from 'elysia';
import { Stringify } from '@/utils';
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
