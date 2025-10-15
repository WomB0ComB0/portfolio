import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/classes/redis';
import { Logger } from '@/utils';
import { isIdentifierBanned, isIdentifierSlowed } from './banlist';

export type RateLimitHelper = {
  rateLimitingType?: 'default' | 'forcedSlowMode' | 'auth' | 'api' | 'ai';
  identifier: string;
};

const limiter = {
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 s'),
    analytics: true,
    prefix: 'ratelimit:default',
  }),
  forcedSlowMode: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, '30 s'),
    analytics: true,
    prefix: 'ratelimit:slowmode',
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 s'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'ratelimit:ai',
  }),
} as const satisfies Record<string, Ratelimit>;

export const rateLimiter = (rateLimitingType: RateLimitHelper['rateLimitingType'] = 'default') => {
  const log = Logger.getLogger(`RateLimit:${rateLimitingType}`);

  return async function rateLimit({ identifier }: RateLimitHelper) {
    // Check if identifier is permanently banned (returns 403-equivalent)
    if (await isIdentifierBanned(identifier)) {
      log.info('Hard-banned identifier blocked', { identifier });
      // Return a rate limit response that will be rejected
      return {
        success: false,
        remaining: 0,
        limit: 0,
        reset: Math.floor(Date.now() / 1_000),
        pending: Promise.resolve(),
      };
    }

    // Check if identifier should be rate-limited more aggressively
    if (await isIdentifierSlowed(identifier)) {
      log.info('Slow-mode identifier detected', { identifier });
      return limiter.forcedSlowMode.limit(identifier);
    }

    log.info('Rate limiting', { identifier });
    return limiter[rateLimitingType].limit(identifier);
  };
};

export const getRateLimitReset = (result: number) => new Date(result * 1000).toLocaleString();
