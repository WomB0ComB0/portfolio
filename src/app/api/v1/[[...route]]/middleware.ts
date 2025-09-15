import { Elysia } from "elysia";

/**
 * Middleware for timing and logging the duration of each request.
 * Adds a `start` timestamp to the store before handling,
 * and logs the duration after handling.
 * @type {Elysia}
 */
export const timingMiddleware = new Elysia()
  .state({ start: 0 })
  .onBeforeHandle(({ store }) => (store.start = Date.now()))
  .onAfterHandle(({ path, store: { start } }) => {
    const duration = Date.now() - start;
    logger.info(`[Elysia] ${path} took ${duration}ms to execute`, { path, duration });
  });
