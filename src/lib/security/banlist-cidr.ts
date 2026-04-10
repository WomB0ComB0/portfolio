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

import { Address4, Address6 } from 'ip-address';
import { redis } from '@/classes/redis';
import { onRequestError } from '@/core';
import { Logger } from '@/utils';

const log = Logger.getLogger('BanlistCIDR');

/**
 * @constant
 * @readonly
 * @public
 * @description Redis key for storing banned IP CIDR ranges.
 * @type {string}
 * @version 1.0.0
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 */
export const CIDR_KEY = 'ban:cidrs';

/**
 * Checks if an IP address matches any banned CIDR range from Redis.
 * Supports both IPv4 and IPv6. Iterates through all banned subnets and checks for membership.
 *
 * @async
 * @function
 * @public
 * @web
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @param {string} ip - IP address to check (e.g., "203.0.113.42" or "2001:db8::1").
 * @returns {Promise<boolean>} Returns `true` if IP matches any banned CIDR range, otherwise `false`.
 * @throws {Error} May throw if Redis communication fails or address parsing throws unexpectedly.
 * @example
 * // Add CIDR range first: await redis.sadd('ban:cidrs', '203.0.113.0/24');
 * const isBanned = await isIpInAnyCidr('203.0.113.42'); // true
 * const isNotBanned = await isIpInAnyCidr('198.51.100.1'); // false
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function isIpInAnyCidr(ip: string): Promise<boolean> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return false;
  }

  try {
    const cidrs = await redis.smembers(CIDR_KEY);
    if (!cidrs || cidrs.length === 0) {
      return false;
    }

    let inputAddress: Address4 | Address6;
    try {
      inputAddress = new Address4(ip);
    } catch {
      try {
        inputAddress = new Address6(ip);
      } catch {
        log.warn('Invalid IP address format', { ip });
        return false;
      }
    }

    for (const cidr of cidrs) {
      try {
        const cidrStr = String(cidr);

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

        if (
          (inputAddress instanceof Address4 && networkAddress instanceof Address4) ||
          (inputAddress instanceof Address6 && networkAddress instanceof Address6)
        ) {
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
        onRequestError(error);
      }
    }

    return false;
  } catch (error) {
    log.error('Error checking IP against CIDR ban list', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    onRequestError(error);
    return false;
  }
}

/**
 * Adds a CIDR range to the ban list in Redis with optional metadata.
 *
 * @async
 * @function
 * @public
 * @web
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @param {string} cidr - CIDR notation to ban (e.g., "203.0.113.0/24" or "2001:db8::/32").
 * @param {string} [reason] - Optional reason for banning this range.
 * @returns {Promise<void>} Resolves when operation is complete.
 * @throws {Error} Throws if the CIDR format is invalid or Redis fails.
 * @example
 * await banCidr('203.0.113.0/24', 'Malicious bot network');
 * await banCidr('2001:db8::/32', 'IPv6 spam source');
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function banCidr(cidr: string, reason?: string): Promise<void> {
  try {
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
    onRequestError(error);
    throw error;
  }
}

/**
 * Removes a CIDR range from the ban list and deletes any associated metadata.
 *
 * @async
 * @function
 * @public
 * @web
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @param {string} cidr - CIDR notation to unban (e.g., "203.0.113.0/24").
 * @returns {Promise<void>} Resolves on successful unban.
 * @throws {Error} Throws if unable to remove from Redis.
 * @example
 * await unbanCidr('203.0.113.0/24');
 * @see https://github.com/WomB0ComB0/portfolio
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
    onRequestError(error);
    throw error;
  }
}

/**
 * Retrieves all currently banned CIDR ranges from Redis.
 *
 * @async
 * @function
 * @public
 * @readonly
 * @web
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @returns {Promise<string[]>} Array of CIDR strings (e.g., ["203.0.113.0/24", "2001:db8::/32"]).
 * @throws {Error} May throw if Redis request fails.
 * @example
 * const ranges = await getBannedCidrs(); // ['203.0.113.0/24', ...]
 * @see https://github.com/WomB0ComB0/portfolio
 */
export async function getBannedCidrs(): Promise<string[]> {
  try {
    const cidrs = await redis.smembers(CIDR_KEY);
    return cidrs;
  } catch (error) {
    log.error('Error fetching banned CIDR ranges', { error });
    onRequestError(error);
    return [];
  }
}
