
import { env } from '@/env';
import { Redis } from '@upstash/redis';

/**
 * A singleton instance of the Upstash Redis client, configured for use with Upstash REST API.
 *
 * This client enables type-safe, asynchronous interaction with Redis data, adhering to the Upstash REST protocol.
 * Connection parameters (`url`, `token`) are sourced from environment variables for secure deployment.
 *
 * - The `keepAlive` option ensures persistent connections where possible.
 * - `readYourWrites` guarantees subsequent reads will reflect preceding writes from the same client instance.
 *
 * @const
 * @readonly
 * @public
 * @type {Redis}
 * @author Mike Odnis (GitHub: WomB0ComB0)
 * @version 1.0.0
 * @see {@link https://upstash.com/docs/redis/using-rest Upstash Redis REST Documentation}
 * @see portfolio environment config at `/src/env`
 *
 * @example
 * import { redis } from '@/classes/redis';
 * const value = await redis.get('my-key');
 */
export const redis = new Redis({
  url: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
  token: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
  keepAlive: true,
  readYourWrites: true,
});

