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
 * @file src/lib/free-books/threat-intel.ts, each provider client with a stubbed fetcher and a
 * stubbed Quad9 resolver (no real network or DNS): DNS blocking and which DNS checks answered,
 * the threat feeds, the entry formats they are read in and whether they all loaded (a page that
 * is not a feed, such as an HTML maintenance page, is not), Safe Browsing and the URLs it could
 * not check, RDAP registration age and the sandbox submission.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '@/lib/free-books/threat-intel';
import type { FetchLike } from '@/lib/free-books/types';

const quad9 = vi.hoisted(() => ({ resolve4: vi.fn<(host: string) => Promise<string[]>>() }));
vi.mock('node:dns/promises', async (original) => {
  const actual = await original<typeof import('node:dns/promises')>();
  class Resolver {
    setServers(): void {}
    resolve4 = quad9.resolve4;
  }
  return { ...actual, Resolver, default: { ...actual, Resolver } };
});

afterEach(() => {
  vi.resetAllMocks();
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const dnsError = (code: string): Error => Object.assign(new Error(`queryA ${code}`), { code });
/** Cloudflare's DoH JSON replies: NOERROR with no block, and NXDOMAIN. */
const NOERROR = { Status: 0 };
const NXDOMAIN = { Status: 3 };

describe('checkHostnameThreatIntel', () => {
  it('blocks a host that Cloudflare Security DNS answers with a sinkhole', async () => {
    const dohHit = await checkHostnameThreatIntel('malware-test.example', {
      fetcher: async () => json({ Answer: [{ type: 1, data: '0.0.0.0' }] }),
    });
    expect(dohHit.blocked).toBe(true);
    expect(dohHit.provider).toContain('Cloudflare');
  });

  it('blocks a host found in the loaded threat feeds', async () => {
    const feeds = await loadUrlhausHostBlocklist({
      fetcher: async () =>
        new Response('# comment\n127.0.0.1\tevil-drop.example\n', { status: 200 }),
    });
    expect(feeds).toEqual({ hosts: new Set(['evil-drop.example']), complete: true });
    const urlhausHit = await checkHostnameThreatIntel('evil-drop.example', {
      urlhausHosts: feeds.hosts,
      fetcher: async () => json(NOERROR),
    });
    expect(urlhausHit.blocked).toBe(true);
    expect(urlhausHit.provider).toContain('URLhaus');
  });

  it.each<{
    readonly name: string;
    readonly doh: FetchLike;
    readonly quad9: () => Promise<string[]>;
    readonly completedChecks: readonly string[];
  }>([
    {
      name: 'both answered',
      doh: async () => json({ ...NOERROR, Answer: [{ type: 1, data: '93.184.216.34' }] }),
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['cloudflare', 'quad9'],
    },
    {
      name: 'Cloudflare answered an error status',
      doh: async () => json({}, 503),
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['quad9'],
    },
    {
      name: 'Cloudflare answered SERVFAIL',
      doh: async () => json({ Status: 2 }),
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['quad9'],
    },
    {
      name: 'Cloudflare answered REFUSED',
      doh: async () => json({ Status: 5 }),
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['quad9'],
    },
    {
      name: 'Cloudflare answered JSON with no DNS status',
      doh: async () => json({}),
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['quad9'],
    },
    {
      name: 'Cloudflare timed out',
      doh: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
      quad9: async () => ['93.184.216.34'],
      completedChecks: ['quad9'],
    },
    {
      name: 'Quad9 timed out',
      doh: async () => json(NOERROR),
      quad9: async () => {
        throw dnsError('ETIMEOUT');
      },
      completedChecks: ['cloudflare'],
    },
    {
      name: 'Quad9 answered with no address',
      doh: async () => json(NOERROR),
      quad9: async () => {
        throw dnsError('ENODATA');
      },
      completedChecks: ['cloudflare', 'quad9'],
    },
  ])('reports no block, and which DNS checks answered, when $name', async (row) => {
    quad9.resolve4.mockImplementation(row.quad9);

    const verdict = await checkHostnameThreatIntel('books.example', {
      domainResolvedNormally: true,
      fetcher: row.doh,
    });

    expect(verdict).toEqual({
      hostname: 'books.example',
      blocked: false,
      provider: null,
      reason: null,
      completedChecks: row.completedChecks,
    });
  });

  it('blocks a host that resolves normally but Quad9 answers NXDOMAIN', async () => {
    quad9.resolve4.mockRejectedValue(dnsError('ENOTFOUND'));

    const verdict = await checkHostnameThreatIntel('books.example', {
      domainResolvedNormally: true,
      fetcher: async () => json(NOERROR),
    });

    expect(verdict).toEqual({
      hostname: 'books.example',
      blocked: true,
      provider: 'Quad9 Threat Intelligence (9.9.9.9)',
      reason: 'quad9_threat_blocked',
      completedChecks: ['cloudflare', 'quad9'],
    });
  });

  it('does not ask Quad9 about a host that does not resolve normally, so it is not complete', async () => {
    const verdict = await checkHostnameThreatIntel('books.example', {
      domainResolvedNormally: false,
      fetcher: async () => json(NXDOMAIN),
    });

    expect(verdict.completedChecks).toEqual(['cloudflare']);
    expect(quad9.resolve4).not.toHaveBeenCalled();
  });
});

describe('loadUrlhausHostBlocklist', () => {
  const FEED = 'evil-drop.example\nphish.example\n';

  it.each<{ readonly name: string; readonly second: () => Promise<Response> }>([
    { name: 'answers an error status', second: async () => new Response('', { status: 503 }) },
    {
      name: 'times out',
      second: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
    },
    { name: 'parses to no hosts', second: async () => new Response('# Moved\n') },
    {
      name: 'answers a 200 HTML maintenance page',
      second: async () => new Response('<a href="https://status.example.com">Service status</a>'),
    },
  ])('keeps the hosts it loaded but is incomplete when a feed $name', async ({ second }) => {
    const fetcher = vi
      .fn<FetchLike>()
      .mockImplementationOnce(async () => new Response(FEED))
      .mockImplementationOnce(second);

    const feeds = await loadUrlhausHostBlocklist({ fetcher });

    expect(feeds).toEqual({
      hosts: new Set(['evil-drop.example', 'phish.example']),
      complete: false,
    });
  });

  it.each<{ readonly name: string; readonly body: string; readonly hosts: readonly string[] }>([
    {
      name: 'plain domains under comment lines (HaGeZi)',
      body: '# Title: HaGeZi TIF mini\n# Version: 2026.1126\n\nevil-drop.example\nPhish.Example.\n',
      hosts: ['evil-drop.example', 'phish.example'],
    },
    {
      name: 'URLs, taking each host, an IPv4 address among them (OpenPhish)',
      body: 'https://login.bad.example/verify?id=1\nhttp://198.51.100.7/paypal/\n',
      hosts: ['login.bad.example', '198.51.100.7'],
    },
    {
      name: 'hostfile lines, with tabs, spaces and a trailing comment (URLhaus)',
      body: '# URLhaus hostfile\n127.0.0.1\tmalware.example\n0.0.0.0 drop.example # added\n',
      hosts: ['malware.example', 'drop.example'],
    },
    {
      name: 'underscored and punycode labels, with Windows line ends',
      body: 'cdn_assets.bad.example\r\nxn--80ak6aa92e.example\r\n',
      hosts: ['cdn_assets.bad.example', 'xn--80ak6aa92e.example'],
    },
  ])('loads $name', async ({ body, hosts }) => {
    const feeds = await loadUrlhausHostBlocklist({ fetcher: async () => new Response(body) });

    expect(feeds).toEqual({ hosts: new Set(hosts), complete: true });
  });

  it.each<{ readonly name: string; readonly body: string }>([
    { name: 'a markup snippet', body: '<a href="https://status.example.com">Service status</a>' },
    {
      name: 'an HTML page with a host name on a line of its own',
      body: '<!DOCTYPE html>\n<html><body>\nDown for maintenance, see\nstatus.example.com\n</body></html>',
    },
    { name: 'text before the markup', body: 'Maintenance\n<html>\nstatus.example.com\n</html>\n' },
    { name: 'a sentence naming a host', body: 'Visit status.example.com for updates\n' },
    { name: 'a JSON error', body: '{"error":"maintenance","status":"status.example.com"}\n' },
    { name: 'a hostfile-like line that starts with no address', body: 'Service evil.example\n' },
    {
      name: 'tokens that are not host names',
      body: 'localhost\nnot_a_domain\n1.2.3\n999.1.1.1\nexample.123\n-bad.example\n*.wild.example\n',
    },
  ])(
    'counts a feed that answers $name as not loaded, and takes no host from it',
    async ({ body }) => {
      const fetcher = vi
        .fn<FetchLike>()
        .mockImplementationOnce(async () => new Response(FEED))
        .mockImplementationOnce(async () => new Response(body));

      const feeds = await loadUrlhausHostBlocklist({ fetcher });

      expect(feeds).toEqual({
        hosts: new Set(['evil-drop.example', 'phish.example']),
        complete: false,
      });
    },
  );

  it('asks URLhaus only with a key, and is complete when every feed it asked loaded', async () => {
    const fetcher = vi.fn<FetchLike>(async () => new Response(FEED));

    const keyless = await loadUrlhausHostBlocklist({ fetcher });
    const keyed = await loadUrlhausHostBlocklist({ fetcher, authKey: 'auth-key' });

    expect(keyless.complete).toBe(true);
    expect(keyed.complete).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

describe('checkGoogleSafeBrowsing', () => {
  it('maps each flagged URL to its threat type', async () => {
    const gsb = await checkGoogleSafeBrowsing(['https://bad.example/kit'], 'test-key', {
      fetcher: async () =>
        json({ matches: [{ threatType: 'MALWARE', threat: { url: 'https://bad.example/kit' } }] }),
    });
    expect(gsb).toEqual({
      matches: { 'https://bad.example/kit': 'google_safe_browsing:MALWARE' },
      uncheckedUrls: [],
    });
  });

  it('lists the URLs of a batch that failed as unchecked, apart from a batch that found nothing', async () => {
    const urls = Array.from({ length: 501 }, (_, i) => `https://book-${i}.example/`);
    const fetcher = vi
      .fn<FetchLike>()
      .mockImplementationOnce(async () => json({}))
      .mockImplementationOnce(async () => json({ error: { code: 503 } }, 503));

    const gsb = await checkGoogleSafeBrowsing(urls, 'test-key', { fetcher });

    expect(gsb).toEqual({ matches: {}, uncheckedUrls: ['https://book-500.example/'] });
  });

  it.each<{ readonly name: string; readonly fetcher: FetchLike }>([
    {
      name: 'a timeout',
      fetcher: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
    },
    { name: 'a body that is not JSON', fetcher: async () => new Response('<html>') },
  ])('lists every URL as unchecked after $name', async ({ fetcher }) => {
    const gsb = await checkGoogleSafeBrowsing(['https://a.example/', 'https://b.example/'], 'k', {
      fetcher,
    });

    expect(gsb).toEqual({
      matches: {},
      uncheckedUrls: ['https://a.example/', 'https://b.example/'],
    });
  });
});

describe('checkRdapDomainAge', () => {
  it('flags a domain registered less than 90 days ago', async () => {
    const recentRdap = await checkRdapDomainAge('re-registered.example', {
      nowMs: Date.parse('2026-11-25T00:00:00Z'),
      fetcher: async () =>
        json({ events: [{ eventAction: 'registration', eventDate: '2026-10-20T00:00:00Z' }] }),
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
      fetcher: async () => json({ uuid: 'scan-123' }),
    });
    expect(detonation?.provider).toBe('cloudflare-url-scanner');
    expect(detonation?.reportUrl).toBe('https://radar.cloudflare.com/scan/scan-123');
  });
});
