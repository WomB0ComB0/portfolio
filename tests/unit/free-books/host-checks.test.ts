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
 * @file src/lib/free-books/host-checks.ts as a table: what one run's host checks mean for a
 * standing block, by the provider its stored reason names. The weekly behaviour end to end is in
 * sweep-checks.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { type HostCheck, observeHost } from '@/lib/free-books/host-checks';

const FEED = 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus): threat_intel_feed_blocked_host';
const CLOUDFLARE = 'Cloudflare Security DNS (1.1.1.2): dnsbl_sinkhole';
const QUAD9 = 'Quad9 Threat Intelligence (9.9.9.9): quad9_threat_blocked';
const UNKNOWN = 'An older blocklist: listed';
const ALL: readonly HostCheck[] = ['threat_feeds', 'cloudflare', 'quad9'];

describe('observeHost', () => {
  it.each<{
    readonly name: string;
    readonly hit?: boolean;
    readonly reason?: string;
    readonly completed: readonly HostCheck[];
    readonly expected: 'flagged' | 'clean' | 'unchecked';
  }>([
    { name: 'a hit, with every other check failed', hit: true, completed: [], expected: 'flagged' },
    { name: 'no hit and no standing block', completed: [], expected: 'clean' },
    { name: 'a feed block, every check done', reason: FEED, completed: ALL, expected: 'clean' },
    {
      name: 'a feed block, the feeds incomplete',
      reason: FEED,
      completed: ['cloudflare', 'quad9'],
      expected: 'unchecked',
    },
    {
      name: 'a feed block, only the DNS checks failed',
      reason: FEED,
      completed: ['threat_feeds'],
      expected: 'clean',
    },
    {
      name: 'a Cloudflare block, Cloudflare failed',
      reason: CLOUDFLARE,
      completed: ['threat_feeds', 'quad9'],
      expected: 'unchecked',
    },
    {
      name: 'a Cloudflare block, Cloudflare answered',
      reason: CLOUDFLARE,
      completed: ['cloudflare'],
      expected: 'clean',
    },
    {
      name: 'a Quad9 block, Quad9 not asked',
      reason: QUAD9,
      completed: ['threat_feeds', 'cloudflare'],
      expected: 'unchecked',
    },
    {
      name: 'a block from a provider it does not know, one check missing',
      reason: UNKNOWN,
      completed: ['threat_feeds', 'cloudflare'],
      expected: 'unchecked',
    },
    {
      name: 'a block from a provider it does not know, every check done',
      reason: UNKNOWN,
      completed: ALL,
      expected: 'clean',
    },
  ])('$name is $expected', ({ hit = false, reason, completed, expected }) => {
    expect(observeHost(hit, reason, new Set(completed))).toBe(expected);
  });
});
