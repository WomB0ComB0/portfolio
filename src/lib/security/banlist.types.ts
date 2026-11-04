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
 * @interface BanMetadata
 * @public
 * @version 1.1.0
 * @description Structure for storing metadata about a ban-list entry (an IP, a slowed IP or a
 * CIDR range).
 *   - `reason`: Optional string describing the reason for the ban.
 *   - `ts`: Unix timestamp (ms) of when the ban was imposed.
 *   - `bannedBy`: Optional string for the user or system who issued the ban.
 *   - `expiresAt`: Unix timestamp (ms) when the entry lapses, or null for a permanent entry.
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface BanMetadata {
  reason?: string;
  ts: number;
  bannedBy?: string;
  expiresAt?: number | null;
}

/** Optional details recorded with a new ban-list entry. */
export interface BanEntryOptions {
  reason?: string;
  /** Lifetime in seconds; omitted means permanent. */
  seconds?: number;
  bannedBy?: string;
}
