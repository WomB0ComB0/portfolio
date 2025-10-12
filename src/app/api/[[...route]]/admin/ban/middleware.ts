import { createAdminBearerGuard } from '../../../_elysia/shared';

/**
 * Authentication guard for ban API
 * Uses @elysiajs/bearer plugin for token extraction
 */
export const adminGuard = createAdminBearerGuard('BanAPI');
