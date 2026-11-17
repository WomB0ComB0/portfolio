import 'server-only';
import { randomUUID } from 'node:crypto';
import { Redis, type RedisConfigNodejs } from '@upstash/redis';
import type { LinkHealthStore } from './service';

const PREFIX = 'portfolio:link-health:v1';
const SAVE_IF_OWNER = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

export function linkHealthRedisConfig(url: string, token: string): RedisConfigNodejs {
  return {
    url,
    token,
    signal: () => AbortSignal.timeout(500),
    retry: { retries: 0 },
    readYourWrites: true,
    enableTelemetry: false,
    keepAlive: true,
  };
}

/** A separate namespace and client; no changes to bans, rate limits, or content records. */
export function createRedisLinkHealthStore(redis: Redis): LinkHealthStore {
  return {
    read: (scope) => redis.get(`${PREFIX}:${scope}`),
    acquire: async () => {
      const token = randomUUID();
      return (await redis.set(`${PREFIX}:lease`, token, { ex: 30, nx: true })) === 'OK'
        ? token
        : null;
    },
    write: async (scope, records, lease) => {
      await redis.eval(
        SAVE_IF_OWNER,
        [`${PREFIX}:lease`, `${PREFIX}:${scope}`],
        [lease, JSON.stringify(records), 30 * 24 * 60 * 60],
      );
    },
  };
}

export function connectLinkHealthStore(url?: string, token?: string): LinkHealthStore | null {
  return url && token
    ? createRedisLinkHealthStore(new Redis(linkHealthRedisConfig(url, token)))
    : null;
}
