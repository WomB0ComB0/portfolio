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
 * @file Redis key layout for the ban list, shared by the admin store (banlist.ts,
 * banlist-cidr.ts) and the request guard (api-guard.ts). It has no imports so the guard's hot
 * path does not load the admin client or '@/core'.
 *
 * Each list is a sorted set whose member is a normalized IP or CIDR and whose score is the time
 * the entry expires, in milliseconds since the epoch. An entry is active while its score is
 * greater than the current time; expired entries are ignored on reads and pruned by the store
 * on every admin write, removal and list.
 */

/** Which list an entry belongs to. */
export type BanKind = 'ip' | 'slow' | 'cidr';

/** Redis keys for the ban sorted sets and their per-entry metadata. */
export const BAN_KEYS = {
  /** Banned IP addresses (sorted set: member = IP, score = expiresAt ms). */
  ip: 'bans:ip',
  /** IP addresses held to the slow-mode limit (sorted set: member = IP, score = expiresAt ms). */
  slow: 'bans:slow',
  /** Banned networks in CIDR notation (sorted set: member = CIDR, score = expiresAt ms). */
  cidr: 'bans:cidr',
  /** JSON metadata for one entry (reason, who, when); expires with temporary entries. */
  meta: (kind: BanKind, member: string): string => `bans:meta:${kind}:${member}`,
} as const;

/**
 * Score used for entries without an expiry: the largest valid JavaScript Date (year 275760), in
 * milliseconds. It has to be finite because the Upstash REST API carries arguments as JSON, where
 * Infinity is not representable, and it is below 2^53 so the score round-trips exactly.
 */
export const PERMANENT_BAN_SCORE = 8_640_000_000_000_000;

/** Upper bound on the active CIDR entries the guard reads per request. */
export const MAX_ACTIVE_CIDRS = 256;

/**
 * Score for a new entry: `now + seconds` for a temporary entry, or {@link PERMANENT_BAN_SCORE}.
 *
 * @param {number | undefined} seconds - Lifetime in seconds; omitted or 0 means permanent.
 * @param {number} now - Current time in milliseconds.
 * @returns {number} The expiry score in milliseconds.
 */
export function banExpiresAt(seconds: number | undefined, now: number): number {
  return seconds && seconds > 0 ? now + seconds * 1000 : PERMANENT_BAN_SCORE;
}

/**
 * True while an entry with this score is in force.
 *
 * @param {unknown} score - The sorted-set score as returned by Redis (number, numeric string or null).
 * @param {number} now - Current time in milliseconds.
 * @returns {boolean} Whether the entry exists and has not expired.
 */
export function isActiveScore(score: unknown, now: number): boolean {
  if (score === null || score === undefined) return false;
  const value = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(value) && value > now;
}
