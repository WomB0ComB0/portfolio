import { Elysia } from 'elysia';
import { adminRoutes } from './admin';
import { healthRoute } from './health';

/**
 * Main API route composition
 * Includes all admin and health routes
 * @type {Elysia}
 */
export const app = new Elysia().use(adminRoutes).use(healthRoute);
