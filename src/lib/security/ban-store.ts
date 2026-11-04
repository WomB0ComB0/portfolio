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
 * @file Sorted-set primitives behind the admin ban store (banlist.ts and banlist-cidr.ts). Every
 * entry is a member of `bans:<kind>` scored by its expiry in ms, with JSON metadata at
 * `bans:meta:<kind>:<member>` that Redis expires together with temporary entries. Members are
 * expected to be normalized already (see ./ip.ts). Errors from Redis propagate to the caller.
 */

import { redis } from '@/classes/redis';
import { BAN_KEYS, type BanKind, banExpiresAt, PERMANENT_BAN_SCORE } from './ban-keys';
import type { BanEntryOptions, BanMetadata } from './banlist.types';

const SORTED_SET: Record<BanKind, string> = {
  ip: BAN_KEYS.ip,
  slow: BAN_KEYS.slow,
  cidr: BAN_KEYS.cidr,
};

const ALL_SORTED_SETS: readonly string[] = Object.values(SORTED_SET);

/**
 * Deletes expired members from every ban list. Sorted-set members cannot expire on their own, so
 * every admin write, removal and list runs this: an expired entry's address is deleted the next
 * time the ban list is changed or viewed. (The guard ignores expired entries in the meantime.)
 *
 * @param {number} now - Current time in ms; members scored at or below it are deleted.
 * @returns {Promise<number[]>} Members deleted per list.
 */
function pruneExpiredEntries(now: number): Promise<number[]> {
  return Promise.all(ALL_SORTED_SETS.map((key) => redis.zremrangebyscore(key, '-inf', now)));
}

/**
 * Adds or replaces an entry and its metadata, and prunes expired entries of every list.
 *
 * @param {BanKind} kind - Which list.
 * @param {string} member - Normalized IP or CIDR.
 * @param {BanEntryOptions} options - Reason, lifetime in seconds and author.
 * @param {number} [now=Date.now()] - Current time in ms.
 * @returns {Promise<BanMetadata>} The metadata written.
 */
export async function addBanEntry(
  kind: BanKind,
  member: string,
  { reason, seconds, bannedBy }: BanEntryOptions,
  now: number = Date.now(),
): Promise<BanMetadata> {
  const key = SORTED_SET[kind];
  const metaKey = BAN_KEYS.meta(kind, member);
  const score = banExpiresAt(seconds, now);
  const temporary = score !== PERMANENT_BAN_SCORE;
  const metadata: BanMetadata = {
    ts: now,
    expiresAt: temporary ? score : null,
    ...(reason ? { reason } : {}),
    ...(bannedBy ? { bannedBy } : {}),
  };

  await Promise.all([
    redis.zadd(key, { score, member }),
    // A plain SET also clears any TTL left from an earlier temporary entry.
    temporary ? redis.set(metaKey, metadata, { pxat: score }) : redis.set(metaKey, metadata),
    // The new entry scores above `now`, so the prune cannot remove it.
    pruneExpiredEntries(now),
  ]);
  return metadata;
}

/**
 * Removes an entry and its metadata, and prunes expired entries of every list.
 *
 * @param {BanKind} kind - Which list.
 * @param {string} member - Normalized IP or CIDR.
 * @param {number} [now=Date.now()] - Current time in ms.
 * @returns {Promise<void>}
 */
export async function removeBanEntry(
  kind: BanKind,
  member: string,
  now: number = Date.now(),
): Promise<void> {
  await Promise.all([
    redis.zrem(SORTED_SET[kind], member),
    redis.del(BAN_KEYS.meta(kind, member)),
    pruneExpiredEntries(now),
  ]);
}

/**
 * Active members of a list. Expired entries of every list are pruned in the same round trip; the
 * read itself only returns scores above `now`, so its result does not depend on the prune.
 *
 * @param {BanKind} kind - Which list.
 * @param {number} [now=Date.now()] - Current time in ms.
 * @returns {Promise<string[]>} Active members.
 */
export async function listActiveBanEntries(
  kind: BanKind,
  now: number = Date.now(),
): Promise<string[]> {
  const key = SORTED_SET[kind];
  const [, members] = await Promise.all([
    pruneExpiredEntries(now),
    redis.zrange<unknown[]>(key, `(${now}` as `(${number}`, '+inf', { byScore: true }),
  ]);
  return members.map(String);
}

/**
 * Metadata of one entry, or null when there is none (never set, removed, or expired).
 *
 * @param {BanKind} kind - Which list.
 * @param {string} member - Normalized IP or CIDR.
 * @returns {Promise<BanMetadata | null>} The metadata, or null.
 */
export async function getBanEntryMetadata(
  kind: BanKind,
  member: string,
): Promise<BanMetadata | null> {
  return redis.get<BanMetadata>(BAN_KEYS.meta(kind, member));
}
