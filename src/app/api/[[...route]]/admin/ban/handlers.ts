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

import { BaseError } from '@/classes/error';
import {
  banIp,
  getBanMetadata,
  getBannedIps,
  getSlowedIps,
  slowIp,
  unbanIp,
  unslowIp,
} from '@/lib/security/banlist';
import { banCidr, getBannedCidrs, unbanCidr } from '@/lib/security/banlist-cidr';
import { Logger } from '@/utils';
import type { BanAction } from './schema';

const log = Logger.getLogger('BanAPI');

/**
 * @interface BanRequestBody
 * @description
 * Represents the structure of a request body for various IP and CIDR ban control operations in the API.
 * Used in administrative endpoints to specify the action and relevant attributes.
 * @property {BanAction} action The banlist administrative action to perform. **@readonly
 * @property {string} [ip] The target IP address for the ban operation.
 * @property {string} [cidr] The target CIDR range for CIDR-based ban operation.
 * @property {string} [reason] The descriptive reason for the ban (if applicable).
 * @property {number} [seconds] The ban duration in seconds, for temporary bans.
 * @property {string} [bannedBy] Name or identifier of the admin invoking the ban operation.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface BanRequestBody {
  action: BanAction;
  ip?: string;
  cidr?: string;
  reason?: string;
  seconds?: number;
  bannedBy?: string;
}

/**
 * Handles the banning of an IP address, allowing for an optional temporary duration and reason.
 *
 * @async
 * @function handleBan
 * @param {BanRequestBody} body - The ban request body containing IP, reason, seconds, and bannedBy info.
 * @returns {Promise<{message: string, data: {ip: string, reason?: string, seconds?: number, bannedBy?: string}}>} Summary of the operation and details.
 * @throws {BaseError} If the IP address is not provided in the request body.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleBan({ action: 'ban', ip: '1.2.3.4', reason: 'spam', seconds: 3600, bannedBy: 'admin' });
 */
export async function handleBan(body: BanRequestBody) {
  const { ip, reason, seconds, bannedBy } = body;

  if (!ip) {
    throw new BaseError(new Error('IP address is required for ban action'), 'admin:ban', {
      action: 'ban',
      providedIp: ip,
      reason,
      seconds,
      bannedBy,
    });
  }

  await banIp(ip, reason, seconds, bannedBy);
  log.info('IP banned via API', { ip, reason, seconds, bannedBy });

  const duration = seconds ? ` for ${seconds} seconds` : ' permanently';

  return {
    message: `IP ${ip} has been banned${duration}`,
    data: { ip, reason, seconds, bannedBy },
  };
}

/**
 * Handles the removal of a ban from a specified IP address.
 *
 * @async
 * @function handleUnban
 * @param {BanRequestBody} body - The unban request body containing the target IP.
 * @returns {Promise<{message: string, data: {ip: string}}>} Confirmation of the unbanning action and IP.
 * @throws {BaseError} If the IP address is not provided in the request body.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleUnban({ action: 'unban', ip: '1.2.3.4' });
 */
export async function handleUnban(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new BaseError(new Error('IP address is required for unban action'), 'admin:unban', {
      action: 'unban',
      providedIp: ip,
    });
  }

  await unbanIp(ip);
  log.info('IP unbanned via API', { ip });

  return {
    message: `IP ${ip} has been unbanned`,
    data: { ip },
  };
}

/**
 * Handles slowing down requests from a specific IP address.
 *
 * @async
 * @function handleSlow
 * @param {BanRequestBody} body - The slow request body with target IP and reason.
 * @returns {Promise<{message: string, data: {ip: string, reason?: string}}>} Confirmation and details about the slow action.
 * @throws {BaseError} If the IP address is not provided in the request body.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleSlow({ action: 'slow', ip: '1.2.3.4', reason: 'abuse' });
 */
export async function handleSlow(body: BanRequestBody) {
  const { ip, reason } = body;

  if (!ip) {
    throw new BaseError(new Error('IP address is required for slow action'), 'admin:slow', {
      action: 'slow',
      providedIp: ip,
      reason,
    });
  }

  await slowIp(ip, reason);
  log.info('IP slowed via API', { ip, reason });

  return {
    message: `IP ${ip} has been added to slow mode`,
    data: { ip, reason },
  };
}

/**
 * Handles removing request slow-down for a specific IP address.
 *
 * @async
 * @function handleUnslow
 * @param {BanRequestBody} body - The unslow request body with target IP.
 * @returns {Promise<{message: string, data: {ip: string}}>} Confirmation of the unslow action and IP.
 * @throws {BaseError} If the IP address is not provided in the request body.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleUnslow({ action: 'unslow', ip: '1.2.3.4' });
 */
export async function handleUnslow(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new BaseError(new Error('IP address is required for unslow action'), 'admin:unslow', {
      action: 'unslow',
      providedIp: ip,
    });
  }

  await unslowIp(ip);
  log.info('IP unslowed via API', { ip });

  return {
    message: `IP ${ip} has been removed from slow mode`,
    data: { ip },
  };
}

/**
 * Handles banning an entire CIDR range, optionally specifying a reason and the admin who initiated the ban.
 *
 * @async
 * @function handleBanCidr
 * @param {BanRequestBody} body - The request body with CIDR, reason, and bannedBy.
 * @returns {Promise<{message: string, data: {cidr: string, reason?: string, bannedBy?: string}}>} Confirmation and details about the banned CIDR.
 * @throws {BaseError} If the CIDR value is not provided in the request.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleBanCidr({ action: 'ban-cidr', cidr: '1.2.3.0/24', reason: 'spam', bannedBy: 'admin' });
 */
export async function handleBanCidr(body: BanRequestBody) {
  const { cidr, reason, bannedBy } = body;

  if (!cidr) {
    throw new BaseError(new Error('CIDR is required for ban-cidr action'), 'admin:ban-cidr', {
      action: 'ban-cidr',
      providedCidr: cidr,
      reason,
      bannedBy,
    });
  }

  await banCidr(cidr, reason);
  log.info('CIDR banned via API', { cidr, reason, bannedBy });

  return {
    message: `CIDR ${cidr} has been banned`,
    data: { cidr, reason, bannedBy },
  };
}

/**
 * Handles removal of ban from a specified CIDR range.
 *
 * @async
 * @function handleUnbanCidr
 * @param {BanRequestBody} body - The request body with the target CIDR.
 * @returns {Promise<{message: string, data: {cidr: string}}>} Confirmation and details about unbanned CIDR.
 * @throws {BaseError} If the CIDR value is not provided in the request.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleUnbanCidr({ action: 'unban-cidr', cidr: '1.2.3.0/24' });
 */
export async function handleUnbanCidr(body: BanRequestBody) {
  const { cidr } = body;

  if (!cidr) {
    throw new BaseError(new Error('CIDR is required for unban-cidr action'), 'admin:unban-cidr', {
      action: 'unban-cidr',
      providedCidr: cidr,
    });
  }

  await unbanCidr(cidr);
  log.info('CIDR unbanned via API', { cidr });

  return {
    message: `CIDR ${cidr} has been unbanned`,
    data: { cidr },
  };
}

/**
 * Retrieves the current list of all banned CIDR ranges.
 *
 * @async
 * @function handleListCidr
 * @returns {Promise<{message: string, data: {bannedCidrs: string[], count: number}}>} Summary message and detailed data of the CIDR banlist.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleListCidr();
 */
export async function handleListCidr() {
  const bannedCidrs = await getBannedCidrs();
  log.info('CIDR ban list retrieved via API', {
    bannedCount: bannedCidrs.length,
  });

  return {
    message: `Retrieved ${bannedCidrs.length} banned CIDR range(s)`,
    data: {
      bannedCidrs,
      count: bannedCidrs.length,
    },
  };
}

/**
 * Retrieves the list of all banned and slowed IP addresses.
 *
 * @async
 * @function handleList
 * @returns {Promise<{
 *   message: string,
 *   data: {
 *     banned: string[],
 *     slowed: string[],
 *     counts: { banned: number, slowed: number }
 *   }
 * }>} Message and data breakdown of banned and slowed IPs.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleList();
 */
export async function handleList() {
  const [bannedIps, slowedIps] = await Promise.all([getBannedIps(), getSlowedIps()]);
  log.info('Ban list retrieved via API', {
    bannedCount: bannedIps.length,
    slowedCount: slowedIps.length,
  });

  return {
    message: `Retrieved ${bannedIps.length} banned IP(s) and ${slowedIps.length} slowed IP(s)`,
    data: {
      banned: bannedIps,
      slowed: slowedIps,
      counts: {
        banned: bannedIps.length,
        slowed: slowedIps.length,
      },
    },
  };
}

/**
 * Retrieves ban metadata for a specific IP address.
 *
 * @async
 * @function handleGetMeta
 * @param {BanRequestBody} body - The request body including the target IP address.
 * @returns {Promise<{message: string, data: unknown}>} Message and metadata from the banlist regarding the IP.
 * @throws {BaseError} If the IP address is not provided in the request body.
 * @author Mike Odnis
 * @web
 * @public
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * await handleGetMeta({ action: 'get-meta', ip: '1.2.3.4' });
 */
export async function handleGetMeta(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new BaseError(new Error('IP address is required for get-meta action'), 'admin:get-meta', {
      action: 'get-meta',
      providedIp: ip,
    });
  }

  const metadata = await getBanMetadata(ip);

  return {
    message: `Retrieved metadata for IP ${ip}`,
    data: metadata,
  };
}

/**
 * Immutable mapping of supported admin ban action types to their respective handler functions.
 *
 * @readonly
 * @public
 * @const
 * @type {{
 *   ban: typeof handleBan,
 *   unban: typeof handleUnban,
 *   slow: typeof handleSlow,
 *   unslow: typeof handleUnslow,
 *   'ban-cidr': typeof handleBanCidr,
 *   'unban-cidr': typeof handleUnbanCidr,
 *   'list-cidr': typeof handleListCidr,
 *   list: typeof handleList,
 *   'get-meta': typeof handleGetMeta,
 * }}
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 */
export const actionHandlers = {
  ban: handleBan,
  unban: handleUnban,
  slow: handleSlow,
  unslow: handleUnslow,
  'ban-cidr': handleBanCidr,
  'unban-cidr': handleUnbanCidr,
  'list-cidr': handleListCidr,
  list: handleList,
  'get-meta': handleGetMeta,
} as const;
