import type { BanMetadata } from './banlist.types';

/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { redis } from '@/classes/redis';
import { onRequestError } from '@/core';
import { Logger } from '@/utils';
import type { NextApiRequest } from 'next';
import { getClientIP } from './get-ip';

const log = Logger.getLogger('Banlist');

/**
 * @constant
 * @readonly
 * @public
 * @version 1.0.0
 * @description
 * Redis keys and resolvers used for managing ban and slow mode state.
 * - `BAN_IPS`: Set of permanently banned IP addresses
 * - `BAN_CIDRS`: Set of banned IP CIDR ranges
 * - `SLOW_IPS`: Set of IPs under aggressive (slowmode) rate limiting
 * - `BAN_META`: Function to generate a key for ban metadata by IP
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 */
export const REDIS_KEYS = {
  BAN_IPS: 'ban:ips',
  BAN_CIDRS: 'ban:cidrs',
  SLOW_IPS: 'ban:slow',
  BAN_META: (ip: string) => `ban:meta:${ip}`,
} as const;

/**
 * Checks if a given request's origin IP is permanently banned.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {Request | NextApiRequest} req - HTTP request object (Fetch API's Request or NextApiRequest)
 * @returns {Promise<boolean>} `true` if IP is banned, `false` otherwise or on error.
 * @throws {Error} Logs and emits in case of Redis communication failure, but returns false ("fail open").
 * @example
 *   const forbidden = await isIpBanned(req);
 *   if(forbidden) { return res.status(403).end(); }
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function isIpBanned(req: Request | NextApiRequest): Promise<boolean> {
  const ip = getClientIP(req);
  if (!ip || ip === '127.0.0.1') return false;

  try {
    const isBanned = await redis.sismember(REDIS_KEYS.BAN_IPS, ip);
    if (isBanned) {
      log.warn('Blocked banned IP', { ip });
    }
    return !!isBanned;
  } catch (error) {
    log.error('Error checking IP ban status', { ip, error });
    onRequestError(error);
    return false;
  }
}

/**
 * Checks if a given request's origin IP is in forced slowmode (aggressively throttled).
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {Request | NextApiRequest} req - HTTP request object (Fetch API's Request or NextApiRequest)
 * @returns {Promise<boolean>} `true` if IP is in slow mode, `false` otherwise or on error.
 * @throws {Error} Logs and emits in case of Redis communication failure, but returns false ("fail open").
 * @example
 *   if (await isIpSlowed(req)) { // Apply throttle middleware }
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function isIpSlowed(req: Request | NextApiRequest): Promise<boolean> {
  const ip = getClientIP(req);
  if (!ip || ip === '127.0.0.1') return false;

  try {
    const isSlowed = await redis.sismember(REDIS_KEYS.SLOW_IPS, ip);
    if (isSlowed) {
      log.info('IP is in slow mode', { ip });
    }
    return !!isSlowed;
  } catch (error) {
    log.error('Error checking IP slow mode status', { ip, error });
    onRequestError(error);
    return false;
  }
}

/**
 * Checks if an arbitrary identifier (IP or user ID) is permanently banned.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} identifier - IP address or user identifier to check
 * @returns {Promise<boolean>} `true` if identifier is banned, `false` otherwise or on error.
 * @throws {Error} Logs and emits in case of Redis communication failure, but returns false.
 * @example
 *   if(await isIdentifierBanned('203.0.113.99')) { ... }
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function isIdentifierBanned(identifier: string): Promise<boolean> {
  if (!identifier || identifier === '127.0.0.1') return false;

  try {
    const isBanned = await redis.sismember(REDIS_KEYS.BAN_IPS, identifier);
    if (isBanned) {
      log.warn('Blocked banned identifier', { identifier });
    }
    return !!isBanned;
  } catch (error) {
    log.error('Error checking identifier ban status', { identifier, error });
    onRequestError(error);
    return false;
  }
}

/**
 * Checks if an arbitrary identifier (IP or user ID) is in slowmode.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} identifier - IP address or user identifier to check
 * @returns {Promise<boolean>} `true` if identifier is slowed, `false` otherwise or on error.
 * @throws {Error} Logs and emits in case of Redis communication failure, but returns false.
 * @example
 *   if(await isIdentifierSlowed('userId123')) { ... }
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function isIdentifierSlowed(identifier: string): Promise<boolean> {
  if (!identifier || identifier === '127.0.0.1') return false;

  try {
    const isSlowed = await redis.sismember(REDIS_KEYS.SLOW_IPS, identifier);
    if (isSlowed) {
      log.info('Identifier is in slow mode', { identifier });
    }
    return !!isSlowed;
  } catch (error) {
    log.error('Error checking identifier slow mode status', { identifier, error });
    onRequestError(error);
    return false;
  }
}

/**
 * Adds an IP address to the ban list with optional metadata and time-to-live.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} ip - IP address to ban
 * @param {string} [reason] - Optional reason for the ban
 * @param {number} [seconds] - Optional time to live (ban expires after this many seconds)
 * @param {string} [bannedBy] - Optional user ID or descriptor of banning authority
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to apply the ban.
 * @example
 *   await banIp('192.0.2.8', 'Bot activity detected', 3600, 'adminUser');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function banIp(
  ip: string,
  reason?: string,
  seconds?: number,
  bannedBy?: string,
): Promise<void> {
  if (!ip || ip === '127.0.0.1') {
    log.warn('Attempted to ban localhost or invalid IP', { ip });
    return;
  }

  try {
    await redis.sadd(REDIS_KEYS.BAN_IPS, ip);

    if (reason || bannedBy || seconds) {
      const metadata: BanMetadata = {
        reason,
        ts: Date.now(),
        bannedBy,
      };

      if (seconds) {
        await redis.set(REDIS_KEYS.BAN_META(ip), metadata, { ex: seconds });
      } else {
        await redis.set(REDIS_KEYS.BAN_META(ip), metadata);
      }
    }

    if (seconds) {
      log.info('Temporarily banned IP', { ip, reason, seconds, bannedBy });
    } else {
      log.info('Permanently banned IP', { ip, reason, bannedBy });
    }
  } catch (error) {
    log.error('Error banning IP', { ip, error });
    onRequestError(error);
    throw error;
  }
}

/**
 * Removes an IP address from the ban list and deletes associated metadata.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} ip - IP address to unban
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to unban.
 * @example
 *   await unbanIp('203.0.113.52');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function unbanIp(ip: string): Promise<void> {
  if (!ip) return;

  try {
    await Promise.all([redis.srem(REDIS_KEYS.BAN_IPS, ip), redis.del(REDIS_KEYS.BAN_META(ip))]);
    log.info('Unbanned IP', { ip });
  } catch (error) {
    log.error('Error unbanning IP', { ip, error });
    onRequestError(error);
    throw error;
  }
}

/**
 * Adds an IP address to slowmode list, applying more aggressive rate limiting.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} ip - IP address to place in slowmode
 * @param {string} [reason] - Optional reason for slow mode
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to update slowmode status.
 * @example
 *   await slowIp('198.51.100.10', 'Potential abuse detected');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function slowIp(ip: string, reason?: string): Promise<void> {
  if (!ip || ip === '127.0.0.1') {
    log.warn('Attempted to slow localhost or invalid IP', { ip });
    return;
  }

  try {
    await redis.sadd(REDIS_KEYS.SLOW_IPS, ip);
    if (reason) {
      await redis.set(`slow:meta:${ip}`, { reason, ts: Date.now() });
    }
    log.info('Added IP to slow mode', { ip, reason });
  } catch (error) {
    log.error('Error adding IP to slow mode', { ip, error });
    onRequestError(error);
    throw error;
  }
}

/**
 * Removes an IP address from slowmode and deletes its slowmode metadata.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} ip - IP address to remove from slowmode
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to update slowmode status.
 * @example
 *   await unslowIp('203.0.113.98');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function unslowIp(ip: string): Promise<void> {
  if (!ip) return;

  try {
    await Promise.all([redis.srem(REDIS_KEYS.SLOW_IPS, ip), redis.del(`slow:meta:${ip}`)]);
    log.info('Removed IP from slow mode', { ip });
  } catch (error) {
    log.error('Error removing IP from slow mode', { ip, error });
    onRequestError(error);
    throw error;
  }
}

/**
 * Retrieves all permanently banned IP addresses.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @returns {Promise<string[]>} Array of IP addresses
 * @throws {Error} Logs and emits in case of Redis error, returns empty array on failure.
 * @example
 *   const bannedIps = await getBannedIps();
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function getBannedIps(): Promise<string[]> {
  try {
    const ips = await redis.smembers(REDIS_KEYS.BAN_IPS);
    return ips as string[];
  } catch (error) {
    log.error('Error fetching banned IPs', { error });
    onRequestError(error);
    return [];
  }
}

/**
 * Retrieves all IP addresses currently in slowmode.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @returns {Promise<string[]>} Array of IP addresses
 * @throws {Error} Logs and emits in case of Redis error, returns empty array on failure.
 * @example
 *   const slowedIps = await getSlowedIps();
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function getSlowedIps(): Promise<string[]> {
  try {
    const ips = await redis.smembers(REDIS_KEYS.SLOW_IPS);
    return ips;
  } catch (error) {
    log.error('Error fetching slowed IPs', { error });
    onRequestError(error);
    return [];
  }
}

/**
 * Retrieves ban metadata for the provided IP, if present.
 * @async
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.1.0
 * @param {string} ip - IP address to query
 * @returns {Promise<BanMetadata | null>} Metadata object or null if not set or expired.
 * @throws {Error} Logs and emits in case of error, returns null on failure.
 * @example
 *   const meta = await getBanMetadata('203.0.113.55');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function getBanMetadata(ip: string): Promise<BanMetadata | null> {
  try {
    const metadata = await redis.get<BanMetadata>(REDIS_KEYS.BAN_META(ip));
    return metadata;
  } catch (error) {
    log.error('Error fetching ban metadata', { ip, error });
    onRequestError(error);
    return null;
  }
}

/**
 * @deprecated since 1.1.0 - Use {@link isIdentifierBanned} instead.
 * @readonly
 * @public
 * @author Mike Odnis
 * @see isIdentifierBanned
 */
export const isIpInBanListString = isIdentifierBanned;
