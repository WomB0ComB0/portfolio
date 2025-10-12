import type { NextApiRequest } from 'next';
import { redis } from '@/classes/redis';
import { Logger } from '@/utils';
import { getClientIP } from './get-ip';

const log = Logger.getLogger('Banlist');

/**
 * Redis keys for ban management
 */
export const REDIS_KEYS = {
  BAN_IPS: 'ban:ips', // Set of permanently banned IPs
  BAN_CIDRS: 'ban:cidrs', // Set of banned CIDR ranges (optional)
  SLOW_IPS: 'ban:slow', // Set of IPs in forced slow mode
  BAN_META: (ip: string) => `ban:meta:${ip}`, // Metadata for bans (reason, timestamp)
} as const;

/**
 * Metadata stored for each ban
 */
export interface BanMetadata {
  reason?: string;
  ts: number;
  bannedBy?: string;
}

/**
 * Check if an IP is permanently banned
 * @param req - Request object (Request or NextApiRequest)
 * @returns true if IP is in the ban list
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
    return false; // Fail open to avoid blocking legitimate traffic on Redis errors
  }
}

/**
 * Check if an IP is in slow mode (rate limited more aggressively)
 * @param req - Request object (Request or NextApiRequest)
 * @returns true if IP is in the slow mode list
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
    return false;
  }
}

/**
 * Check if a specific identifier (IP or user ID) is banned
 * @param identifier - IP address or user identifier
 * @returns true if identifier is in the ban list
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
    return false;
  }
}

/**
 * Check if a specific identifier is in slow mode
 * @param identifier - IP address or user identifier
 * @returns true if identifier is in the slow mode list
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
    return false;
  }
}

/**
 * Ban an IP address with optional reason and TTL
 * @param ip - IP address to ban
 * @param reason - Optional reason for the ban
 * @param seconds - Optional TTL in seconds for temporary bans
 * @param bannedBy - Optional identifier of who issued the ban
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
    // Add to ban set
    await redis.sadd(REDIS_KEYS.BAN_IPS, ip);

    // Store metadata if provided
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

    // If temporary ban, schedule removal from set
    if (seconds) {
      // Note: We rely on the metadata expiring. For auto-cleanup of the set member,
      // you'd need a cron job or use Redis Streams. For now, metadata expiry is sufficient.
      log.info('Temporarily banned IP', { ip, reason, seconds, bannedBy });
    } else {
      log.info('Permanently banned IP', { ip, reason, bannedBy });
    }
  } catch (error) {
    log.error('Error banning IP', { ip, error });
    throw error;
  }
}

/**
 * Unban an IP address
 * @param ip - IP address to unban
 */
export async function unbanIp(ip: string): Promise<void> {
  if (!ip) return;

  try {
    await Promise.all([redis.srem(REDIS_KEYS.BAN_IPS, ip), redis.del(REDIS_KEYS.BAN_META(ip))]);
    log.info('Unbanned IP', { ip });
  } catch (error) {
    log.error('Error unbanning IP', { ip, error });
    throw error;
  }
}

/**
 * Add an IP to slow mode
 * @param ip - IP address to slow
 * @param reason - Optional reason for slow mode
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
    throw error;
  }
}

/**
 * Remove an IP from slow mode
 * @param ip - IP address to remove from slow mode
 */
export async function unslowIp(ip: string): Promise<void> {
  if (!ip) return;

  try {
    await Promise.all([redis.srem(REDIS_KEYS.SLOW_IPS, ip), redis.del(`slow:meta:${ip}`)]);
    log.info('Removed IP from slow mode', { ip });
  } catch (error) {
    log.error('Error removing IP from slow mode', { ip, error });
    throw error;
  }
}

/**
 * Get all banned IPs
 * @returns Array of banned IP addresses
 */
export async function getBannedIps(): Promise<string[]> {
  try {
    const ips = await redis.smembers(REDIS_KEYS.BAN_IPS);
    return ips as string[];
  } catch (error) {
    log.error('Error fetching banned IPs', { error });
    return [];
  }
}

/**
 * Get all slowed IPs
 * @returns Array of slowed IP addresses
 */
export async function getSlowedIps(): Promise<string[]> {
  try {
    const ips = await redis.smembers(REDIS_KEYS.SLOW_IPS);
    return ips as string[];
  } catch (error) {
    log.error('Error fetching slowed IPs', { error });
    return [];
  }
}

/**
 * Get metadata for a banned IP
 * @param ip - IP address
 * @returns Ban metadata or null if not found
 */
export async function getBanMetadata(ip: string): Promise<BanMetadata | null> {
  try {
    const metadata = await redis.get<BanMetadata>(REDIS_KEYS.BAN_META(ip));
    return metadata;
  } catch (error) {
    log.error('Error fetching ban metadata', { ip, error });
    return null;
  }
}

/**
 * Backwards compatibility: Check if identifier is in ban list (string-based)
 * @deprecated Use isIdentifierBanned instead
 */
export const isIpInBanListString = isIdentifierBanned;
