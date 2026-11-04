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

/**
 * @file Admin store for IP bans and slow mode, used by POST /api/admin/ban. Entries live in the
 * `bans:ip` and `bans:slow` sorted sets (see ./ban-keys.ts) and are enforced per request by the
 * API guard (./api-guard.ts). Writes and reads rethrow Redis errors after logging them, so the
 * route can answer 503 instead of reporting an empty list.
 */

import { BaseError } from '@/classes/error';
import { reportError } from '@/lib/observability/report';
import { Logger } from '@/utils';
import type { BanKind } from './ban-keys';
import {
  addBanEntry,
  getBanEntryMetadata,
  listActiveBanEntries,
  removeBanEntry,
} from './ban-store';
import type { BanMetadata } from './banlist.types';
import { isLoopbackIp, normalizeIp } from './ip';

const log = Logger.getLogger('Banlist');

/** Normalized form of `ip`, or a BaseError (answered as 400 by the admin route). */
function requireIp(ip: string, action: string): string {
  const normalized = normalizeIp(ip);
  if (!normalized) {
    throw new BaseError(new Error('A valid IP address is required'), `banlist:${action}`, {
      providedIp: ip,
    });
  }
  return normalized;
}

/** Runs a store operation, logging and reporting Redis failures before rethrowing them. */
async function withStoreErrors<T>(
  message: string,
  context: Record<string, unknown>,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    log.error(message, { ...context, error });
    reportError(error);
    throw error;
  }
}

async function addIpEntry(
  kind: Extract<BanKind, 'ip' | 'slow'>,
  rawIp: string,
  reason: string | undefined,
  seconds: number | undefined,
  bannedBy: string | undefined,
): Promise<void> {
  const ip = requireIp(rawIp, kind === 'ip' ? 'ban' : 'slow');
  if (isLoopbackIp(ip)) {
    log.warn('Ignored a ban-list entry for a loopback address', { ip, kind });
    return;
  }

  const metadata = await withStoreErrors(
    kind === 'ip' ? 'Error banning IP' : 'Error adding IP to slow mode',
    { ip },
    () => addBanEntry(kind, ip, { reason, seconds, bannedBy }),
  );
  log.info(kind === 'ip' ? 'Banned IP' : 'Added IP to slow mode', {
    ip,
    reason,
    bannedBy,
    expiresAt: metadata.expiresAt,
  });
}

/**
 * Bans an IP address, permanently or for `seconds`.
 *
 * @param {string} ip - IP address (normalized before storing; loopback is ignored).
 * @param {string} [reason] - Why the address is banned.
 * @param {number} [seconds] - Lifetime of the ban; omitted means permanent.
 * @param {string} [bannedBy] - Who issued the ban.
 * @returns {Promise<void>}
 * @throws {BaseError} If `ip` is not a valid IP address.
 * @throws {Error} Rethrows Redis errors after logging them.
 * @example await banIp('192.0.2.8', 'Bot activity detected', 3600, 'admin');
 */
export async function banIp(
  ip: string,
  reason?: string,
  seconds?: number,
  bannedBy?: string,
): Promise<void> {
  await addIpEntry('ip', ip, reason, seconds, bannedBy);
}

/**
 * Lifts a ban on an IP address and deletes its metadata.
 *
 * @param {string} ip - IP address.
 * @returns {Promise<void>}
 * @throws {BaseError} If `ip` is not a valid IP address.
 * @throws {Error} Rethrows Redis errors after logging them.
 */
export async function unbanIp(ip: string): Promise<void> {
  const normalized = requireIp(ip, 'unban');
  await withStoreErrors('Error unbanning IP', { ip: normalized }, () =>
    removeBanEntry('ip', normalized),
  );
  log.info('Unbanned IP', { ip: normalized });
}

/**
 * Puts an IP address in slow mode (one request per 30 s), permanently or for `seconds`.
 *
 * @param {string} ip - IP address (normalized before storing; loopback is ignored).
 * @param {string} [reason] - Why the address is slowed.
 * @param {number} [seconds] - Lifetime of the entry; omitted means permanent.
 * @param {string} [bannedBy] - Who added the entry.
 * @returns {Promise<void>}
 * @throws {BaseError} If `ip` is not a valid IP address.
 * @throws {Error} Rethrows Redis errors after logging them.
 * @example await slowIp('198.51.100.10', 'Potential abuse detected', 600);
 */
export async function slowIp(
  ip: string,
  reason?: string,
  seconds?: number,
  bannedBy?: string,
): Promise<void> {
  await addIpEntry('slow', ip, reason, seconds, bannedBy);
}

/**
 * Takes an IP address out of slow mode and deletes its metadata.
 *
 * @param {string} ip - IP address.
 * @returns {Promise<void>}
 * @throws {BaseError} If `ip` is not a valid IP address.
 * @throws {Error} Rethrows Redis errors after logging them.
 */
export async function unslowIp(ip: string): Promise<void> {
  const normalized = requireIp(ip, 'unslow');
  await withStoreErrors('Error removing IP from slow mode', { ip: normalized }, () =>
    removeBanEntry('slow', normalized),
  );
  log.info('Removed IP from slow mode', { ip: normalized });
}

/**
 * Currently banned IP addresses (expired bans are pruned and not returned).
 *
 * @returns {Promise<string[]>} Banned IPs.
 * @throws {Error} Rethrows Redis errors: an empty list would be indistinguishable from "nobody
 * is banned".
 */
export async function getBannedIps(): Promise<string[]> {
  return withStoreErrors('Error fetching banned IPs', {}, () => listActiveBanEntries('ip'));
}

/**
 * IP addresses currently in slow mode (expired entries are pruned and not returned).
 *
 * @returns {Promise<string[]>} Slowed IPs.
 * @throws {Error} Rethrows Redis errors.
 */
export async function getSlowedIps(): Promise<string[]> {
  return withStoreErrors('Error fetching slowed IPs', {}, () => listActiveBanEntries('slow'));
}

/**
 * Metadata recorded with an IP ban.
 *
 * @param {string} ip - IP address.
 * @returns {Promise<BanMetadata | null>} The metadata, or null if the IP has no active ban.
 * @throws {BaseError} If `ip` is not a valid IP address.
 * @throws {Error} Rethrows Redis errors (null already means "no metadata for this IP").
 */
export async function getBanMetadata(ip: string): Promise<BanMetadata | null> {
  const normalized = requireIp(ip, 'get-meta');
  return withStoreErrors('Error fetching ban metadata', { ip: normalized }, () =>
    getBanEntryMetadata('ip', normalized),
  );
}
