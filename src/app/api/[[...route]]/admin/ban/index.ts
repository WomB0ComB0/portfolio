import { bearer } from '@elysiajs/bearer';
import { Elysia, StatusMap } from 'elysia';
import { Logger } from '@/utils';
import { actionHandlers, type BanRequestBody } from './handlers';
import { adminGuard } from './middleware';
import { banActions, banSchemas } from './schema';

const log = Logger.getLogger('BanAPI');

/**
 * Admin API for managing IP bans, slow mode, CIDR bans, and ban metadata
 *
 * Authentication: Bearer token via Authorization header
 * Required env var: ADMIN_API_TOKEN
 *
 * Endpoints:
 * - POST /api/admin/ban - Manage ban operations
 *   Actions: ban, unban, slow, unslow, ban-cidr, unban-cidr, list, list-cidr, get-meta
 *
 * @example
 * ```bash
 * # Ban an IP permanently
 * curl -X POST http://localhost:3000/api/admin/ban \
 *   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"action":"ban","ip":"203.0.113.1","reason":"Spam"}'
 *
 * # Ban an IP for 3600 seconds (1 hour)
 * curl -X POST http://localhost:3000/api/admin/ban \
 *   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"action":"ban","ip":"203.0.113.1","reason":"Rate limit abuse","seconds":3600}'
 *
 * # Ban a CIDR range
 * curl -X POST http://localhost:3000/api/admin/ban \
 *   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"action":"ban-cidr","cidr":"192.168.1.0/24","reason":"Malicious network"}'
 *
 * # List all bans
 * curl -X POST http://localhost:3000/api/admin/ban \
 *   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"action":"list"}'
 * ```
 */
export const banRoute = new Elysia({ prefix: '/api/admin/ban' })
  .use(bearer())
  .model(banSchemas)
  .post(
    '/',
    async ({ body, set }) => {
      const { action } = body as BanRequestBody;

      try {
        // Get the handler for this action
        const handler = actionHandlers[action];

        if (!handler) {
          set.status = StatusMap['Bad Request'];
          return {
            success: false,
            error: `Unknown action: ${action}. Valid actions: ${banActions.join(', ')}`,
          };
        }

        // Execute the handler
        const result = await handler(body as BanRequestBody);

        return {
          success: true,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        log.error('Error processing ban API request', {
          action,
          error: error instanceof Error ? error.message : String(error),
        });

        // Check if it's a validation error (from handlers)
        if (error instanceof Error && error.message.includes('required')) {
          set.status = StatusMap['Bad Request'];
          return {
            success: false,
            error: error.message,
          };
        }

        set.status = StatusMap['Internal Server Error'];
        return {
          success: false,
          error: 'Failed to process ban operation',
        };
      }
    },
    {
      beforeHandle: adminGuard,
      body: 'ban.request',
      response: {
        200: 'ban.success',
        400: 'ban.error',
        401: 'ban.error',
        500: 'ban.error',
      },
    },
  );
