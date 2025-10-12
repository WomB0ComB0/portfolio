import { Elysia } from 'elysia';
import { banRoute } from './ban';

/**
 * Admin API routes composition
 * Includes:
 *   - /ban - Ban/unban IPs and CIDR ranges, slow mode management
 * @type {Elysia}
 */
export const adminRoutes = new Elysia().use(banRoute);

export { banRoute };
