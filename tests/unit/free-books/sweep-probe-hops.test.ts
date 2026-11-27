// @vitest-environment node

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
 * @file src/lib/free-books/sweep.ts's reachability probe on redirect hops, week by week on an
 * in-memory Redis, with the real link-health probe (createLinkProbe) over stubbed DNS and
 * transport: a catalog link whose HEAD redirects to a target the run will not fetch (a Safe
 * Browsing hit, an owner's pinned link or host, even one the URL screen refuses, a host blocked
 * this run, a held-back link) is quarantined as `unsafe_redirect_hop:flagged_target`, and neither
 * the probe nor the content inspection ever requests that target. The page's GET serves a clean
 * page, as a cloaking site would, so the quarantine can only come from the probe.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SweepDependencies, SweepOptions } from '@/lib/free-books/sweep';
import type { FreeBooksSecurityManifest } from '@/lib/free-books/types';
import { createLinkProbe } from '@/lib/link-health/probe';
import type { ProbeHeaders, ProbeRequest } from '@/lib/link-health/transport';
import {
  cleanHost,
  EMPTY_MANIFEST,
  INDIE_GUIDE,
  inMemoryRedis,
  OLD_NOTES,
  pageResponse,
  runWeeks,
} from './sweep-fixture';

const EVIL = 'https://evil.example/kit';
const UNSAFE_HOP = 'unsafe_redirect_hop:flagged_target';
const MALWARE_HIT: Partial<SweepDependencies> = {
  checkSafeBrowsing: async () => ({
    matches: { [OLD_NOTES]: 'google_safe_browsing:MALWARE' },
    uncheckedUrls: [],
  }),
};

/** A committed manifest with `pins` in it. */
const committed = (pins: Partial<FreeBooksSecurityManifest>) => () =>
  JSON.stringify({ ...EMPTY_MANIFEST, ...pins });

/**
 * The real reachability probe on one public DNS answer and a stubbed transport: INDIE_GUIDE
 * answers each of `indie` in turn (then 200), every other URL answers 200.
 */
function stubbedProbe(indie: readonly ProbeHeaders[]) {
  const answers = [...indie];
  const request = vi.fn(
    async ({ url }: ProbeRequest): Promise<ProbeHeaders> =>
      url.href === INDIE_GUIDE ? (answers.shift() ?? { status: 200 }) : { status: 200 },
  );
  const probe = createLinkProbe({ resolve: async () => ['93.184.216.34'], request });
  return { request, probe, requested: () => request.mock.calls.map(([r]) => r.url.href) };
}

/** An inspection fetch that serves every link a clean page. */
const cleanFetch = () => vi.fn<SweepDependencies['fetch']>(async () => pageResponse());
const fetched = (fetch: ReturnType<typeof cleanFetch>) =>
  fetch.mock.calls.map(([input]) => String(input));

describe('runSweep on a link whose HEAD redirects to a target the run will not fetch', () => {
  it.each<{
    readonly name: string;
    readonly target: string;
    readonly run: { options?: Partial<SweepOptions>; deps: Partial<SweepDependencies> };
  }>([
    {
      name: 'a Safe Browsing hit this run',
      target: OLD_NOTES,
      run: { options: { safeBrowsingApiKey: 'gsb-key' }, deps: MALWARE_HIT },
    },
    {
      name: 'a link the owner pinned',
      target: EVIL,
      run: { deps: { readManifest: committed({ quarantinedUrls: { [EVIL]: 'Manual' } }) } },
    },
    {
      name: 'a host the owner pinned',
      target: EVIL,
      run: { deps: { readManifest: committed({ blockedHosts: { 'evil.example': 'Manual' } }) } },
    },
    {
      name: 'a host the owner pinned that the URL screen refuses',
      target: 'https://evil.tk/kit',
      run: { deps: { readManifest: committed({ blockedHosts: { 'evil.tk': 'Manual' } }) } },
    },
    {
      name: 'a host blocked this run',
      target: 'https://old.example/elsewhere',
      run: {
        deps: {
          checkHost: async (hostname) =>
            hostname === 'old.example'
              ? { ...cleanHost(hostname), blocked: true, provider: 'Quad9', reason: 'blocked' }
              : cleanHost(hostname),
        },
      },
    },
  ])(
    'quarantines it when it redirects to $name, and never requests that',
    async ({ target, run }) => {
      const redis = inMemoryRedis();
      const h = stubbedProbe([{ status: 301, location: target }]);
      const fetch = cleanFetch();

      await runWeeks(
        redis,
        [{ ...run, deps: { ...run.deps, probe: h.probe, fetch } }],
        'quarantinedUrls',
      );

      const live = await redis.clients.loadLiveManifest();
      expect(live?.quarantinedUrls[INDIE_GUIDE]).toBe(UNSAFE_HOP);
      expect(h.requested()).toContain(INDIE_GUIDE);
      expect(h.requested()).not.toContain(target);
      expect(fetched(fetch)).not.toContain(target);
    },
  );

  it('treats a Safe Browsing quarantine the run could not ask about again as a target it will not request', async () => {
    const redis = inMemoryRedis();
    const h = stubbedProbe([{ status: 302, location: OLD_NOTES }]);
    const fetch = cleanFetch();

    await runWeeks(
      redis,
      [
        { options: { safeBrowsingApiKey: 'gsb-key' }, deps: MALWARE_HIT },
        { deps: { probe: h.probe, fetch } },
      ],
      'quarantinedUrls',
    );

    const live = await redis.clients.loadLiveManifest();
    expect(live?.quarantinedUrls[OLD_NOTES]).toBe('google_safe_browsing:MALWARE');
    expect(live?.quarantinedUrls[INDIE_GUIDE]).toBe(UNSAFE_HOP);
    expect(h.requested()).not.toContain(OLD_NOTES);
    expect(fetched(fetch)).not.toContain(OLD_NOTES);
  });

  it('quarantines a link missing on the first probe whose second probe redirects to such a target', async () => {
    const redis = inMemoryRedis();
    const h = stubbedProbe([{ status: 404 }, { status: 404 }, { status: 301, location: EVIL }]);
    const pinnedEvil = committed({ quarantinedUrls: { [EVIL]: 'Manual' } });

    await runWeeks(
      redis,
      [{ deps: { readManifest: pinnedEvil, probe: h.probe } }],
      'quarantinedUrls',
    );

    const live = await redis.clients.loadLiveManifest();
    expect(live?.quarantinedUrls[INDIE_GUIDE]).toBe(UNSAFE_HOP);
    expect(Object.keys(live?.unavailableUrls ?? {})).not.toContain(INDIE_GUIDE);
    expect(h.requested()).not.toContain(EVIL);
  });
});
