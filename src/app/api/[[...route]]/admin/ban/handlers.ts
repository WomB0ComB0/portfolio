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
 * Request body for ban operations
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
 * Handle ban action
 */
export async function handleBan(body: BanRequestBody) {
  const { ip, reason, seconds, bannedBy } = body;

  if (!ip) {
    throw new Error('IP address is required for ban action');
  }

  await banIp(ip, reason, seconds, bannedBy);
  log.info('IP banned via API', { ip, reason, seconds, bannedBy });

  return {
    message: `IP ${ip} has been banned${seconds ? ` for ${seconds} seconds` : ' permanently'}`,
    data: { ip, reason, seconds, bannedBy },
  };
}

/**
 * Handle unban action
 */
export async function handleUnban(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new Error('IP address is required for unban action');
  }

  await unbanIp(ip);
  log.info('IP unbanned via API', { ip });

  return {
    message: `IP ${ip} has been unbanned`,
    data: { ip },
  };
}

/**
 * Handle slow action
 */
export async function handleSlow(body: BanRequestBody) {
  const { ip, reason } = body;

  if (!ip) {
    throw new Error('IP address is required for slow action');
  }

  await slowIp(ip, reason);
  log.info('IP slowed via API', { ip, reason });

  return {
    message: `IP ${ip} has been added to slow mode`,
    data: { ip, reason },
  };
}

/**
 * Handle unslow action
 */
export async function handleUnslow(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new Error('IP address is required for unslow action');
  }

  await unslowIp(ip);
  log.info('IP unslowed via API', { ip });

  return {
    message: `IP ${ip} has been removed from slow mode`,
    data: { ip },
  };
}

/**
 * Handle ban-cidr action
 */
export async function handleBanCidr(body: BanRequestBody) {
  const { cidr, reason, bannedBy } = body;

  if (!cidr) {
    throw new Error('CIDR is required for ban-cidr action');
  }

  await banCidr(cidr, reason);
  log.info('CIDR banned via API', { cidr, reason, bannedBy });

  return {
    message: `CIDR ${cidr} has been banned`,
    data: { cidr, reason, bannedBy },
  };
}

/**
 * Handle unban-cidr action
 */
export async function handleUnbanCidr(body: BanRequestBody) {
  const { cidr } = body;

  if (!cidr) {
    throw new Error('CIDR is required for unban-cidr action');
  }

  await unbanCidr(cidr);
  log.info('CIDR unbanned via API', { cidr });

  return {
    message: `CIDR ${cidr} has been unbanned`,
    data: { cidr },
  };
}

/**
 * Handle list-cidr action
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
 * Handle list action
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
 * Handle get-meta action
 */
export async function handleGetMeta(body: BanRequestBody) {
  const { ip } = body;

  if (!ip) {
    throw new Error('IP address is required for get-meta action');
  }

  const metadata = await getBanMetadata(ip);

  return {
    message: `Retrieved metadata for IP ${ip}`,
    data: metadata,
  };
}

/**
 * Action handler map
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
