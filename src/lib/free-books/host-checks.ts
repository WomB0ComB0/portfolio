/**
 * Copyright 2026 Mike Odnis
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
 * @file The three checks that can block a host in the weekly sweep (the threat feeds, Cloudflare
 * 1.1.1.2 and Quad9), the provider name each one writes at the start of a block's reason, and
 * what one run's results mean for a standing block. A run with no hit for a host counts as clean
 * only when the check that raised its block completed (every check, for a reason that names no
 * provider below); otherwise it is unchecked and earns no credit toward lifting the block. A hit
 * is always flagged, whatever else failed. Pure: threat-intel.ts writes the provider names, and
 * sweep.ts settles the blocks with observeHost. Guarded by tests/unit/free-books/host-checks.test.ts.
 */

import type { FlagObservation } from './flag-policy';

/** The checks behind a host block. */
export const HOST_CHECKS = ['threat_feeds', 'cloudflare', 'quad9'] as const;
export type HostCheck = (typeof HOST_CHECKS)[number];

/** The provider each check names in a block's reason, stored as "provider: reason". */
export const HOST_CHECK_PROVIDERS: Readonly<Record<HostCheck, string>> = {
  threat_feeds: 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus)',
  cloudflare: 'Cloudflare Security DNS (1.1.1.2)',
  quad9: 'Quad9 Threat Intelligence (9.9.9.9)',
};

/**
 * The checks that must complete before a host whose block reads `reason` can count as clean: the
 * check whose provider wrote it, or every check when the reason names none of them.
 */
export function checksBehindBlock(reason: string): readonly HostCheck[] {
  const raisedBy = HOST_CHECKS.find((check) =>
    reason.startsWith(`${HOST_CHECK_PROVIDERS[check]}:`),
  );
  return raisedBy ? [raisedBy] : HOST_CHECKS;
}

/**
 * What this run saw for a host: flagged on a hit; clean when there is no standing block, or when
 * every check behind it completed; unchecked otherwise.
 */
export function observeHost(
  hit: boolean,
  standingReason: string | undefined,
  completed: ReadonlySet<HostCheck>,
): FlagObservation {
  if (hit) return 'flagged';
  if (standingReason === undefined) return 'clean';
  return checksBehindBlock(standingReason).every((check) => completed.has(check))
    ? 'clean'
    : 'unchecked';
}
