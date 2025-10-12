import { Address4, Address6 } from 'ip-address';
import { redis } from '@/classes/redis';
import { Logger } from '@/utils';

const log = Logger.getLogger('BanlistCIDR');

/**
 * Redis key for CIDR ranges
 */
export const CIDR_KEY = 'ban:cidrs';

/**
 * Check if an IP address matches any banned CIDR range
 * Supports both IPv4 and IPv6 addresses
 *
 * @param ip - IP address to check (e.g., "203.0.113.42" or "2001:db8::1")
 * @returns true if IP matches any banned CIDR range
 *
 * @example
 * ```ts
 * // Add CIDR range to ban list:
 * // await redis.sadd('ban:cidrs', '203.0.113.0/24');
 *
 * const isBanned = await isIpInAnyCidr('203.0.113.42'); // true
 * const isNotBanned = await isIpInAnyCidr('198.51.100.1'); // false
 * ```
 */
export async function isIpInAnyCidr(ip: string): Promise<boolean> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return false;
  }

  try {
    // Fetch all CIDR ranges from Redis
    const cidrs = await redis.smembers(CIDR_KEY);
    if (!cidrs || cidrs.length === 0) {
      return false;
    }

    // Parse the input IP
    let inputAddress: Address4 | Address6;
    try {
      // Try IPv4 first
      inputAddress = new Address4(ip);
    } catch {
      // Fall back to IPv6
      try {
        inputAddress = new Address6(ip);
      } catch {
        log.warn('Invalid IP address format', { ip });
        return false;
      }
    }

    // Check each CIDR range
    for (const cidr of cidrs) {
      try {
        const cidrStr = String(cidr);

        // Determine if CIDR is IPv4 or IPv6
        let networkAddress: Address4 | Address6;
        try {
          networkAddress = new Address4(cidrStr);
        } catch {
          try {
            networkAddress = new Address6(cidrStr);
          } catch {
            log.warn('Invalid CIDR format in ban list', { cidr: cidrStr });
            continue;
          }
        }

        // Type check: only compare same IP versions
        if (
          (inputAddress instanceof Address4 && networkAddress instanceof Address4) ||
          (inputAddress instanceof Address6 && networkAddress instanceof Address6)
        ) {
          // Check if IP is in this CIDR range
          if (inputAddress.isInSubnet(networkAddress)) {
            log.info('IP matched banned CIDR range', { ip, cidr: cidrStr });
            return true;
          }
        }
      } catch (error) {
        log.error('Error checking CIDR match', {
          ip,
          cidr,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return false;
  } catch (error) {
    log.error('Error checking IP against CIDR ban list', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Add a CIDR range to the ban list
 *
 * @param cidr - CIDR notation (e.g., "203.0.113.0/24" or "2001:db8::/32")
 * @param reason - Optional reason for banning this range
 *
 * @example
 * ```ts
 * await banCidr('203.0.113.0/24', 'Malicious bot network');
 * await banCidr('2001:db8::/32', 'IPv6 spam source');
 * ```
 */
export async function banCidr(cidr: string, reason?: string): Promise<void> {
  try {
    // Validate CIDR format before adding
    try {
      new Address4(cidr);
    } catch {
      try {
        new Address6(cidr);
      } catch {
        throw new Error(`Invalid CIDR format: ${cidr}`);
      }
    }

    await redis.sadd(CIDR_KEY, cidr);

    if (reason) {
      await redis.set(`cidr:meta:${cidr}`, { reason, ts: Date.now() });
    }

    log.info('CIDR range banned', { cidr, reason });
  } catch (error) {
    log.error('Error banning CIDR range', {
      cidr,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Remove a CIDR range from the ban list
 *
 * @param cidr - CIDR notation to unban
 */
export async function unbanCidr(cidr: string): Promise<void> {
  try {
    await Promise.all([redis.srem(CIDR_KEY, cidr), redis.del(`cidr:meta:${cidr}`)]);
    log.info('CIDR range unbanned', { cidr });
  } catch (error) {
    log.error('Error unbanning CIDR range', {
      cidr,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all banned CIDR ranges
 *
 * @returns Array of CIDR ranges
 */
export async function getBannedCidrs(): Promise<string[]> {
  try {
    const cidrs = await redis.smembers(CIDR_KEY);
    return cidrs as string[];
  } catch (error) {
    log.error('Error fetching banned CIDR ranges', { error });
    return [];
  }
}
