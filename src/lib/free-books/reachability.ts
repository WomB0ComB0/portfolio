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
 * @file The verify sweep's reachability check of one catalog link, and the run's exclusions on
 * the redirect hops it would follow. excludedHopCheck answers whether a hop leads to a target the
 * run will not fetch; both the reachability probe (as its shouldFollowRedirect) and the content
 * inspection ask it before they request a hop, so such a target is never requested.
 * observeReachability probes a link (twice when the first probe finds it missing) and answers
 * one verdict for probeUrls in sweep.ts: `excluded_hop` (a probe refused a redirect to such a
 * target, which quarantines the link), `unavailable`, `reachable` (it goes on to the content
 * inspection) or `unchecked` (no clean run). Guarded by tests/unit/free-books/sweep.test.ts and
 * sweep-probe-hops.test.ts.
 */

import type { LinkProbe, ProbeOptions } from '@/lib/link-health/probe';
import { screenExternalBookUrl } from './url-screen';

/** What probeUrls never fetches, as a catalog link or as a redirect hop. */
export interface ProbeExclusions {
  /** The blocks that stand after this run's host checks, the owner's pinned hosts among them. */
  readonly blockedHosts: Readonly<Record<string, string>>;
  /**
   * Whether a link is held back this run (isHeldBack): an owner's pin, or a Safe Browsing
   * quarantine the run could not ask about again.
   */
  readonly isHeldBack: (url: string) => boolean;
}

/** The host of `url`, lowercased and without trailing dots; '' when it does not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return '';
  }
}

/**
 * Whether a redirect hop leads to a target this run will not fetch: a Safe Browsing hit, a link
 * held back (an owner's pin, or a Safe Browsing quarantine the run could not ask about again), or
 * a link on a blocked host. A hop the URL screen refuses is matched as it is against the blocks
 * and held-back links (an owner's pin need not pass the screen); the content inspection's
 * redirect-chain audit refuses such a hop before it asks, but the reachability probe has none.
 */
export function excludedHopCheck(
  exclusions: ProbeExclusions,
  safeBrowsingHits: ReadonlySet<string>,
): (hopUrl: string) => boolean {
  return (hopUrl) => {
    const { normalizedUrl, hostname } = screenExternalBookUrl(hopUrl);
    if (!normalizedUrl || !hostname) {
      return (
        Object.hasOwn(exclusions.blockedHosts, hostOf(hopUrl)) || exclusions.isHeldBack(hopUrl)
      );
    }
    return (
      safeBrowsingHits.has(normalizedUrl) ||
      exclusions.isHeldBack(normalizedUrl) ||
      Object.hasOwn(exclusions.blockedHosts, hostname)
    );
  };
}

/** What probeUrls does with a link after its reachability probes. */
export type ReachabilityVerdict = 'excluded_hop' | 'unavailable' | 'reachable' | 'unchecked';

/**
 * Probes `url` with `options`, and once more when the first probe finds it missing. A redirect
 * refused on either probe is `excluded_hop`; missing on both is `unavailable`; reachable on the
 * first is `reachable`. Anything else, a link missing and then not, among them, is `unchecked`.
 */
export async function observeReachability(
  url: string,
  probe: LinkProbe,
  options: ProbeOptions,
): Promise<ReachabilityVerdict> {
  const first = await probe(url, options);
  const last = first.kind === 'missing' ? await probe(url, options) : first;
  if (last.refusedRedirect) return 'excluded_hop';
  if (first.kind === 'missing') return last.kind === 'missing' ? 'unavailable' : 'unchecked';
  return first.kind === 'reachable' ? 'reachable' : 'unchecked';
}
