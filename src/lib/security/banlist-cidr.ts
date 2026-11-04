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
 * @file Admin store for CIDR range bans, used by POST /api/admin/ban. Ranges live in the
 * `bans:cidr` sorted set (see ./ban-keys.ts) in normalized form and are matched per request by
 * the API guard (./api-guard.ts). Redis errors are logged and rethrown.
 */

import { BaseError } from '@/classes/error';
import { reportError } from '@/lib/observability/report';
import { Logger } from '@/utils';
import { MAX_ACTIVE_CIDRS } from './ban-keys';
import { addBanEntry, listActiveBanEntries, removeBanEntry } from './ban-store';
import { normalizeCidr } from './ip';

const log = Logger.getLogger('BanlistCIDR');

/** Normalized form of `cidr`, or a BaseError (answered as 400 by the admin route). */
function requireCidr(cidr: string, action: string): string {
  const normalized = normalizeCidr(cidr);
  if (!normalized) {
    throw new BaseError(new Error('A valid CIDR range is required'), `banlist-cidr:${action}`, {
      providedCidr: cidr,
    });
  }
  return normalized;
}

function reportStoreError(message: string, cidr: string | undefined, error: unknown): void {
  log.error(message, {
    ...(cidr ? { cidr } : {}),
    error: error instanceof Error ? error.message : String(error),
  });
  reportError(error);
}

/**
 * Bans a CIDR range, permanently or for `seconds`. The range is stored with its host bits
 * cleared, so 203.0.113.77/24 is stored (and later unbanned) as 203.0.113.0/24.
 *
 * @param {string} cidr - Range in CIDR notation, e.g. "203.0.113.0/24" or "2001:db8::/32".
 * @param {string} [reason] - Why the range is banned.
 * @param {number} [seconds] - Lifetime of the ban; omitted means permanent.
 * @param {string} [bannedBy] - Who issued the ban.
 * @returns {Promise<void>}
 * @throws {BaseError} If `cidr` is not a valid range.
 * @throws {Error} Rethrows Redis errors after logging them.
 * @example await banCidr('203.0.113.0/24', 'Malicious bot network', 86400, 'admin');
 */
export async function banCidr(
  cidr: string,
  reason?: string,
  seconds?: number,
  bannedBy?: string,
): Promise<void> {
  const normalized = requireCidr(cidr, 'ban-cidr');
  try {
    // The API guard reads at most MAX_ACTIVE_CIDRS active ranges, so refuse one it would not enforce.
    const active = await listActiveBanEntries('cidr');
    if (active.length >= MAX_ACTIVE_CIDRS && !active.includes(normalized)) {
      throw new BaseError(
        new Error(`The CIDR ban list is full (${MAX_ACTIVE_CIDRS} active ranges); lift one first`),
        'banlist-cidr:ban-cidr',
        { cidr: normalized },
      );
    }
    const metadata = await addBanEntry('cidr', normalized, { reason, seconds, bannedBy });
    log.info('CIDR range banned', {
      cidr: normalized,
      reason,
      bannedBy,
      expiresAt: metadata.expiresAt,
    });
  } catch (error) {
    if (error instanceof BaseError) throw error;
    reportStoreError('Error banning CIDR range', normalized, error);
    throw error;
  }
}

/**
 * Lifts a ban on a CIDR range (given in any form that normalizes to the stored range).
 *
 * @param {string} cidr - Range in CIDR notation.
 * @returns {Promise<void>}
 * @throws {BaseError} If `cidr` is not a valid range.
 * @throws {Error} Rethrows Redis errors after logging them.
 */
export async function unbanCidr(cidr: string): Promise<void> {
  const normalized = requireCidr(cidr, 'unban-cidr');
  try {
    await removeBanEntry('cidr', normalized);
    log.info('CIDR range unbanned', { cidr: normalized });
  } catch (error) {
    reportStoreError('Error unbanning CIDR range', normalized, error);
    throw error;
  }
}

/**
 * Currently banned CIDR ranges (expired bans are pruned and not returned).
 *
 * @returns {Promise<string[]>} Ranges, e.g. ["203.0.113.0/24", "2001:db8::/32"].
 * @throws {Error} Rethrows Redis errors: an empty list would be indistinguishable from "no CIDR
 * bans".
 */
export async function getBannedCidrs(): Promise<string[]> {
  try {
    return await listActiveBanEntries('cidr');
  } catch (error) {
    reportStoreError('Error fetching banned CIDR ranges', undefined, error);
    throw error;
  }
}
