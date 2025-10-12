import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/classes/redis';
import { logger } from '@/utils';
import { isIpInBanListString } from './get-ip';

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
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'ratelimit:ai',
  }),
} as const;

export const rateLimiter = (rateLimitingType: RateLimitHelper['rateLimitingType'] = 'default') => {
  const log = logger.getSubLogger({ prefix: ['RateLimit', rateLimitingType] });
  return async function rateLimit({ identifier }: RateLimitHelper) {
    if (isIpInBanListString(identifier)) {
      log.info('IP is in ban list', { identifier });
      return limiter.forcedSlowMode.limit(identifier);
    }
    log.info('Rate limiting', { identifier });
    return limiter[rateLimitingType].limit(identifier);
  };
};

export const getRateLimitReset = (result: number) => new Date(result * 1000).toLocaleString();
