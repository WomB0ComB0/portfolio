import { messagesGET } from '@/server/api/routers/messagesGET';
import { messagesPOST } from '@/server/api/routers/messagesPOST';
import { createTRPCRouter } from '@/server/api/trpc';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  messagesPOST: messagesPOST,
  messagesGET: messagesGET,
});

// export type definition of API
export type AppRouter = typeof appRouter;
