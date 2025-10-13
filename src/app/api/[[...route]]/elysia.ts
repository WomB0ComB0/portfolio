import Elysia from 'elysia';
import { adminRoutes } from './admin';
import { healthRoute } from './health';

export const apiRoutes = new Elysia().use(adminRoutes).use(healthRoute);
