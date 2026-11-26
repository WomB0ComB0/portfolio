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
 * @file src/lib/free-books/threat-intel.ts, each provider client with a stubbed fetcher: DNS
 * blocking, the threat feeds, Safe Browsing, RDAP registration age and the sandbox submission.
 */

import { describe, expect, it } from 'vitest';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '@/lib/free-books/threat-intel';

describe('checkHostnameThreatIntel', () => {
  it('blocks a host that Cloudflare Security DNS answers with a sinkhole', async () => {
    const dohHit = await checkHostnameThreatIntel('malware-test.example', {
      fetcher: async () =>
        new Response(JSON.stringify({ Answer: [{ type: 1, data: '0.0.0.0' }] }), { status: 200 }),
    });
    expect(dohHit.blocked).toBe(true);
    expect(dohHit.provider).toContain('Cloudflare');
  });

  it('blocks a host found in the loaded threat feeds', async () => {
    const urlhaus = await loadUrlhausHostBlocklist({
      fetcher: async () =>
        new Response('# comment\n127.0.0.1\tevil-drop.example\n', { status: 200 }),
    });
    expect(urlhaus.has('evil-drop.example')).toBe(true);
    const urlhausHit = await checkHostnameThreatIntel('evil-drop.example', {
      urlhausHosts: urlhaus,
      fetcher: async () => new Response(JSON.stringify({}), { status: 200 }),
    });
    expect(urlhausHit.blocked).toBe(true);
    expect(urlhausHit.provider).toContain('URLhaus');
  });
});

describe('checkGoogleSafeBrowsing', () => {
  it('maps each flagged URL to its threat type', async () => {
    const gsbHits = await checkGoogleSafeBrowsing(['https://bad.example/kit'], 'test-key', {
      fetcher: async () =>
        new Response(
          JSON.stringify({
            matches: [{ threatType: 'MALWARE', threat: { url: 'https://bad.example/kit' } }],
          }),
          { status: 200 },
        ),
    });
    expect(gsbHits['https://bad.example/kit']).toBe('google_safe_browsing:MALWARE');
  });
});

describe('checkRdapDomainAge', () => {
  it('flags a domain registered less than 90 days ago', async () => {
    const recentRdap = await checkRdapDomainAge('re-registered.example', {
      nowMs: Date.parse('2026-11-25T00:00:00Z'),
      fetcher: async () =>
        new Response(
          JSON.stringify({
            events: [{ eventAction: 'registration', eventDate: '2026-10-20T00:00:00Z' }],
          }),
          { status: 200 },
        ),
    });
    expect(recentRdap.newlyRegistered).toBe(true);
    expect(recentRdap.ageDays).toBe(36);
  });
});

describe('submitDeltaDetonation', () => {
  it('submits to Cloudflare URL Scanner and links its radar report', async () => {
    const detonation = await submitDeltaDetonation('https://drifted.example/book', {
      cloudflareAccountId: 'acct-1',
      cloudflareToken: 'tok-1',
      fetcher: async () => new Response(JSON.stringify({ uuid: 'scan-123' }), { status: 200 }),
    });
    expect(detonation?.provider).toBe('cloudflare-url-scanner');
    expect(detonation?.reportUrl).toBe('https://radar.cloudflare.com/scan/scan-123');
  });
});
