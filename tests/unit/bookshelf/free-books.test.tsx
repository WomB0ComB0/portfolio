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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeBooksExplorer } from '@/app/(routes)/(main)/(personal)/bookshelf/free/_components/free-books-explorer';
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import { BOOKSHELF_COOP_HEADERS, BOOKSHELF_COOP_SOURCES } from '@/config/security-headers';
import {
  loadLiveSecurityManifestFromRedis,
  mergeSecurityManifests,
  publishSecurityManifestToRedis,
  REDIS_RUNTIME_MANIFEST_KEY,
} from '@/lib/books/free-books-manifest-store';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '@/lib/books/free-books-verifier';
import {
  buildFreeBooksPageResponse,
  buildFreeProgrammingBooksCatalog,
  filterFreeProgrammingBooks,
  parseFreeProgrammingBooksMarkdown,
  parseFreeProgrammingBooksWithStats,
  resetFreeProgrammingBooksCache,
} from '@/lib/books/free-programming-books';
import {
  classifyHostTrustTier,
  inspectHtmlSnippet,
  inspectPdfBytes,
  isDangerousResponseHeaders,
  isSuspiciousRedirectChain,
  screenExternalBookUrl,
} from '@/lib/books/url-security';

const SAMPLE_LANGS_MD = `
### Index

* [Rust](#rust)
* [TypeScript](#typescript)

### Rust

* [The Rust Programming Language](https://doc.rust-lang.org/book/) - Steve Klabnik, Carol Nichols (HTML, PDF) (MIT)
* [Rust By Example](https://doc.rust-lang.org/rust-by-example/) - Rust Team ( :construction: *in process*)
* [Unsafe Link](javascript:alert(1)) - Should Be Ignored

#### Async

* [Asynchronous Programming in Rust](https://rust-lang.github.io/async-book/) - Rust Async WG (HTML) ( :card_file_box: archived)

### <a id="cpp"></a>C++

* [Learn C++](https://www.learncpp.com/) - Alex Allain (HTML)

### TypeScript

* [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - Basarat Ali Syed (HTML, PDF, EPUB) (CC BY-NC-SA)
`;

const SAMPLE_SUBJECTS_MD = `
### Index

* [Algorithms & Data Structures](#algorithms--data-structures)

### Algorithms & Data Structures

* [A Common-Sense Guide to Data Structures & Algorithms](https://example.com/guide.pdf) - Jay Wengrow (PDF)
* [Designing Distributed Systems](https://example.com/dist) - Brendan Burns (email address *requested*)
`;

describe('EbookFoundation free-programming-books parser & filters', () => {
  beforeEach(() => {
    resetFreeProgrammingBooksCache();
  });

  it('skips ### Index, parses ### / #### hierarchy, authors, formats, licenses, and fpb-lint flags', () => {
    const langs = parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs');
    const subjects = parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects');

    // Unsafe javascript: link and Index anchors are ignored; inline HTML anchors in headings are stripped.
    expect(langs).toHaveLength(5);
    expect(subjects).toHaveLength(2);
    expect(langs[3]).toMatchObject({
      title: 'Learn C++',
      category: 'C++',
    });

    expect(langs[0]).toMatchObject({
      title: 'The Rust Programming Language',
      url: 'https://doc.rust-lang.org/book/',
      authors: 'Steve Klabnik, Carol Nichols',
      source: 'langs',
      category: 'Rust',
      subcategory: null,
      formats: ['PDF', 'HTML'],
      license: 'MIT',
      archived: false,
      inProcess: false,
    });

    expect(langs[1]).toMatchObject({
      title: 'Rust By Example',
      inProcess: true,
      archived: false,
    });

    expect(langs[2]).toMatchObject({
      title: 'Asynchronous Programming in Rust',
      category: 'Rust',
      subcategory: 'Async',
      formats: ['HTML'],
      archived: true,
    });

    expect(langs[4]).toMatchObject({
      title: 'TypeScript Deep Dive',
      category: 'TypeScript',
      formats: ['PDF', 'HTML', 'EPUB'],
      license: 'CC BY-NC-SA',
    });

    expect(subjects[1]).toMatchObject({
      title: 'Designing Distributed Systems',
      requiresAccount: true,
    });
  });

  it('filters by source, category, format, query, and archived/inProcess flags', () => {
    const langs = parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs');
    const subjects = parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects');
    const catalog = buildFreeProgrammingBooksCatalog(langs, subjects);

    expect(catalog.totalBooks).toBe(7);
    expect(catalog.languageCategoriesCount).toBe(3);
    expect(catalog.subjectCategoriesCount).toBe(1);

    expect(
      filterFreeProgrammingBooks(catalog.books, {
        source: 'langs',
        format: 'EPUB',
      }).map((b) => b.title),
    ).toEqual(['TypeScript Deep Dive']);

    expect(
      filterFreeProgrammingBooks(catalog.books, {
        category: 'Rust',
        hideArchived: true,
        hideInProcess: true,
      }).map((b) => b.title),
    ).toEqual(['The Rust Programming Language']);

    expect(filterFreeProgrammingBooks(catalog.books, { q: 'wengrow' }).map((b) => b.title)).toEqual(
      ['A Common-Sense Guide to Data Structures & Algorithms'],
    );

    // Multi-token AND matching + XSS/bidi sanitization
    expect(
      filterFreeProgrammingBooks(catalog.books, {
        q: '  <script></script>rust\u202E   async  ',
      }).map((b) => b.title),
    ).toEqual(['Asynchronous Programming in Rust']);
  });

  it('serves paginated filtered results from GET /api/v1/books/free', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy
        .mockResolvedValueOnce(new Response(SAMPLE_LANGS_MD, { status: 200 }))
        .mockResolvedValueOnce(new Response(SAMPLE_SUBJECTS_MD, { status: 200 }));

      const res = await booksRoute.handle(
        new Request('http://localhost/books/free?source=langs&format=PDF&hideArchived=true'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        totalCatalogBooks: number;
        totalMatched: number;
        items: Array<{ title: string }>;
      };
      expect(body.totalCatalogBooks).toBe(7);
      expect(body.totalMatched).toBe(2);
      expect(body.items.map((item) => item.title)).toEqual([
        'The Rust Programming Language',
        'TypeScript Deep Dive',
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('FreeBooksExplorer UI', () => {
  it('hydrates SSR page 1 with zero initial fetch, then fetches incrementally via TanStack Query + nuqs', async () => {
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs'),
      parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects'),
    );
    const initialPage = buildFreeBooksPageResponse(catalog, {
      hideArchived: true,
      hideUnavailable: true,
      sort: 'title',
      dir: 'asc',
      limit: 50,
      offset: 0,
    });
    const updates: UrlUpdateEvent[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const parsed = new URL(rawUrl, 'https://mikeodnis.dev');
      const sp = parsed.searchParams;
      const payload = buildFreeBooksPageResponse(catalog, {
        source: (sp.get('source') as 'all' | 'langs' | 'subjects' | null) ?? 'all',
        category: sp.get('category') ?? 'all',
        format: (sp.get('format') as 'all' | 'PDF' | null) ?? 'all',
        q: sp.get('q') ?? '',
        sort: (sp.get('sort') as 'title' | 'category' | 'host' | null) ?? 'title',
        dir: (sp.get('dir') as 'asc' | 'desc' | null) ?? 'asc',
        hideArchived: sp.get('hideArchived') === 'true',
        hideUnavailable: sp.get('hideUnavailable') === 'true',
        hideInProcess: sp.get('hideInProcess') === 'true',
        httpsOnly: sp.get('httpsOnly') === 'true',
        verifiedHostsOnly: sp.get('verifiedHostsOnly') === 'true',
        limit: Number.parseInt(sp.get('limit') ?? '50', 10),
        offset: Number.parseInt(sp.get('offset') ?? '0', 10),
      });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <NuqsTestingAdapter hasMemory onUrlUpdate={(event) => updates.push(event)}>
            <FreeBooksExplorer initialPage={initialPage} />
          </NuqsTestingAdapter>
        </QueryClientProvider>,
      );

      expect(
        screen.getByRole('heading', { level: 1, name: 'Free Programming Books' }),
      ).toBeInTheDocument();
      // SSR initialData prevents redundant initial client fetch
      expect(fetchSpy).not.toHaveBeenCalled();

      // Renders as a semantic data table with sortable column headers
      const table = screen.getByRole('table', { name: /Free programming books catalog/i });
      const bookHeader = within(table).getByRole('columnheader', { name: /Book/i });
      expect(bookHeader).toHaveAttribute('aria-sort', 'ascending');

      // Clicking Book header flips sort direction and triggers incremental API fetch
      fireEvent.click(within(bookHeader).getByRole('button'));
      expect(bookHeader).toHaveAttribute('aria-sort', 'descending');

      // Archived book is hidden by default
      expect(screen.queryByText('Asynchronous Programming in Rust')).not.toBeInTheDocument();
      expect(screen.getByText('The Rust Programming Language')).toBeInTheDocument();

      // Unchecking Hide archived incrementally fetches including archived entries
      fireEvent.click(screen.getByLabelText('Hide archived'));
      expect(await screen.findByText('Asynchronous Programming in Rust')).toBeInTheDocument();

      // Search incrementally fetches matching books
      fireEvent.change(screen.getByRole('searchbox', { name: /Search free programming books/i }), {
        target: { value: 'Basarat' },
      });
      expect(await screen.findByText('TypeScript Deep Dive')).toBeInTheDocument();
      await vi.waitFor(() => {
        expect(screen.queryByText('The Rust Programming Language')).not.toBeInTheDocument();
      });

      // nuqs flushes URL query updates cleanly
      await vi.waitFor(() => {
        const qs = updates.at(-1)?.queryString ?? '';
        expect(qs).toContain('q=Basarat');
        expect(qs).toContain('archived=true');
        expect(qs).toContain('dir=desc');
      });
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });

  it('hydrates non-default URL pagination directly via incremental /api/v1/books/free fetch', async () => {
    const manyLines = [
      '### Rust',
      ...Array.from(
        { length: 30 },
        (_, i) =>
          `* [Rust Book ${String(i + 1).padStart(2, '0')}](https://doc.rust-lang.org/book-${i + 1}/) - Author ${i + 1} (PDF)`,
      ),
    ].join('\n');
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(manyLines, 'langs'),
      [],
    );
    const initialPage = buildFreeBooksPageResponse(catalog, { limit: 50, offset: 0 });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const parsed = new URL(rawUrl, 'https://mikeodnis.dev');
      const sp = parsed.searchParams;
      const payload = buildFreeBooksPageResponse(catalog, {
        format: (sp.get('format') as 'all' | 'PDF' | null) ?? 'all',
        limit: Number.parseInt(sp.get('limit') ?? '50', 10),
        offset: Number.parseInt(sp.get('offset') ?? '0', 10),
      });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <NuqsTestingAdapter hasMemory searchParams="?perPage=25&page=2&format=PDF">
            <FreeBooksExplorer initialPage={initialPage} />
          </NuqsTestingAdapter>
        </QueryClientProvider>,
      );

      expect(await screen.findByText('Rust Book 26')).toBeInTheDocument();
      expect(screen.queryByText('Rust Book 01')).not.toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/books/free?'),
        expect.anything(),
      );
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });

  it('debounces rapid typing into a single sanitized incremental API fetch', async () => {
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs'),
      parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects'),
    );
    const initialPage = buildFreeBooksPageResponse(catalog, {
      hideArchived: true,
      hideUnavailable: true,
      limit: 50,
      offset: 0,
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const parsed = new URL(rawUrl, 'https://mikeodnis.dev');
      const sp = parsed.searchParams;
      const payload = buildFreeBooksPageResponse(catalog, {
        q: sp.get('q') ?? '',
        hideArchived: sp.get('hideArchived') === 'true',
        hideUnavailable: sp.get('hideUnavailable') === 'true',
        limit: Number.parseInt(sp.get('limit') ?? '50', 10),
        offset: Number.parseInt(sp.get('offset') ?? '0', 10),
      });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <NuqsTestingAdapter hasMemory>
            <FreeBooksExplorer initialPage={initialPage} />
          </NuqsTestingAdapter>
        </QueryClientProvider>,
      );

      const input = screen.getByRole('searchbox', { name: /Search free programming books/i });
      fireEvent.change(input, { target: { value: 'B' } });
      fireEvent.change(input, { target: { value: 'Ba' } });
      fireEvent.change(input, { target: { value: 'Bas' } });
      fireEvent.change(input, { target: { value: '<img src=x onerror=alert(1)>Basarat\u200B' } });

      // Debounce prevents firing before 250ms
      expect(fetchSpy).not.toHaveBeenCalled();

      // After debounce settles, exactly one sanitized request fires
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('q=Basarat');
      expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain('onerror');
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });
});

describe('Live Upstash Redis Security Manifest Overlay', () => {
  it('publishes, loads, and merges live Redis manifests over bundled baseline without regressing blocks', async () => {
    const store = new Map<string, string>();
    const mockFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (init?.method === 'POST') {
        const [, key, value] = JSON.parse(String(init.body)) as [string, string, string];
        store.set(key, value);
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }
      const key = decodeURIComponent(url.split('/get/')[1] ?? '');
      return new Response(JSON.stringify({ result: store.get(key) ?? null }), { status: 200 });
    };

    const credentials = { url: 'https://redis.example.upstash.io', token: 'test-token' };
    const liveManifest = {
      generatedAt: '2026-11-26T00:00:00.000Z',
      checkedHosts: 1312,
      checkedUrls: 2506,
      blockedHosts: { 'newly-bad.example': 'Cloudflare: dnsbl_sinkhole' },
      quarantinedUrls: { 'https://parked.example/book': 'parked_domain' },
      unavailableUrls: { 'https://dead.example/404': '2026-11-26T00:00:00.000Z' },
      urlFingerprints: {
        'https://doc.rust-lang.org/book/': {
          finalHost: 'doc.rust-lang.org',
          contentType: 'text/html',
          checkedAt: '2026-11-26T00:00:00.000Z',
        },
      },
    };

    const pub = await publishSecurityManifestToRedis(liveManifest, {
      credentials,
      fetcher: mockFetch,
    });
    expect(pub).toEqual({ runtimePublished: true, fingerprintsPublished: true });
    expect(store.has(REDIS_RUNTIME_MANIFEST_KEY)).toBe(true);

    const loaded = await loadLiveSecurityManifestFromRedis({ credentials, fetcher: mockFetch });
    expect(loaded?.blockedHosts['newly-bad.example']).toContain('dnsbl_sinkhole');

    const bundled = {
      generatedAt: '2026-11-25T00:00:00.000Z',
      checkedHosts: 1312,
      checkedUrls: 0,
      blockedHosts: { 'git-blocked.example': 'Manual block' },
      quarantinedUrls: {},
      unavailableUrls: {},
    };
    const merged = mergeSecurityManifests(bundled, loaded);
    expect(merged.source).toBe('redis');
    expect(merged.manifest.blockedHosts).toEqual({
      'git-blocked.example': 'Manual block',
      'newly-bad.example': 'Cloudflare: dnsbl_sinkhole',
    });
    expect(merged.manifest.quarantinedUrls['https://parked.example/book']).toBe('parked_domain');
  });
});

describe('Free Books Security Gate & Threat Intel Verifier', () => {
  it('blocks unsafe URLs (SSRF/IP, credentials, executables, double extensions, punycode, abuse TLDs)', () => {
    expect(screenExternalBookUrl('https://doc.rust-lang.org/book/')).toMatchObject({
      safe: true,
      insecureTransport: false,
      blockReason: null,
    });
    expect(screenExternalBookUrl('http://example.com/book.pdf')).toMatchObject({
      safe: true,
      insecureTransport: true,
    });

    expect(screenExternalBookUrl('https://user:pass@example.com/book.pdf').blockReason).toBe(
      'embedded_credentials',
    );
    expect(screenExternalBookUrl('https://example.com:8443/book.pdf').blockReason).toBe(
      'non_default_port',
    );
    expect(screenExternalBookUrl('http://127.0.0.1/admin').blockReason).toBe(
      'private_or_literal_ip',
    );
    expect(screenExternalBookUrl('http://169.254.169.254/latest/meta-data').blockReason).toBe(
      'private_or_literal_ip',
    );
    expect(screenExternalBookUrl('https://example.com/manual.pdf.exe').blockReason).toBe(
      'double_extension_spoof',
    );
    expect(screenExternalBookUrl('https://example.com/installer.dmg').blockReason).toBe(
      'executable_payload',
    );
    expect(screenExternalBookUrl('https://xn--pple-43d.com/book').blockReason).toBe(
      'punycode_homograph',
    );
    expect(screenExternalBookUrl('https://freebooks.tk/rust').blockReason).toBe('high_abuse_tld');
  });

  it('flags drive-by executable MIME/Content-Disposition headers and parked/cloaked HTML', () => {
    expect(isDangerousResponseHeaders('application/x-msdownload', null)).toContain(
      'dangerous_mime',
    );
    expect(
      isDangerousResponseHeaders('application/octet-stream', 'attachment; filename="book.pdf.exe"'),
    ).toBe('dangerous_disposition_double_ext');
    expect(
      isDangerousResponseHeaders('application/pdf', 'inline; filename="guide.pdf"'),
    ).toBeNull();

    expect(
      inspectHtmlSnippet('<html><body>This domain is for sale at Sedo</body></html>', 'oldbook.org')
        .parked,
    ).toBe(true);
    expect(
      inspectHtmlSnippet(
        '<html><head><meta http-equiv="refresh" content="0;url=https://evil.example/drop"></head></html>',
        'oldbook.org',
      ).metaRefreshCrossOrigin,
    ).toBe('https://evil.example/drop');
  });

  it('quarantines DNSBL-blocked hosts and flags unavailable entries from the security manifest', async () => {
    const dohHit = await checkHostnameThreatIntel('malware-test.example', {
      fetcher: async () =>
        new Response(JSON.stringify({ Answer: [{ type: 1, data: '0.0.0.0' }] }), { status: 200 }),
    });
    expect(dohHit.blocked).toBe(true);
    expect(dohHit.provider).toContain('Cloudflare');

    const md = `
### Rust
* [Safe Book](https://doc.rust-lang.org/book/) - Team
* [Hijacked Book](https://hijacked.example/book) - Old Author
* [Dead Book](https://dead.example/404) - Gone Author
* [Dropper](https://example.com/guide.pdf.exe) - Bad
`;
    const manifest = {
      generatedAt: '2026-11-25T00:00:00.000Z',
      checkedHosts: 3,
      checkedUrls: 3,
      blockedHosts: { 'hijacked.example': 'Cloudflare Security DNS (1.1.1.2): dnsbl_sinkhole' },
      quarantinedUrls: {},
      unavailableUrls: { 'https://dead.example/404': '2026-11-25T00:00:00.000Z' },
    };

    const parsed = parseFreeProgrammingBooksWithStats(md, 'langs', manifest);
    expect(parsed.quarantinedCount).toBe(2);
    expect(parsed.entries.map((e) => ({ title: e.title, unavailable: e.unavailable }))).toEqual([
      { title: 'Safe Book', unavailable: false },
      { title: 'Dead Book', unavailable: true },
    ]);
  });

  it('detects weaponized PDFs, ClickFix lures, obfuscated JS, hidden iframes, and TDS redirect chains', () => {
    const enc = new TextEncoder();
    expect(
      inspectPdfBytes(
        enc.encode(
          '%PDF-1.7\n1 0 obj << /Type /Catalog /OpenAction [3 0 R /Fit] >> endobj\nstream\nrandom /JS /AA binary bytes\nendstream\n%%EOF\n',
        ),
      ),
    ).toBeNull();
    expect(
      inspectPdfBytes(enc.encode('%PDF-1.7\n1 0 obj << /OpenAction << /S /JS >> >> endobj')),
    ).toContain('pdf_active_object');
    expect(
      inspectPdfBytes(enc.encode('%PDF-1.7\n1 0 obj << /J#61vaScript (alert(1)) >> endobj')),
    ).toContain('pdf_obfuscated_active_object');
    expect(inspectPdfBytes(enc.encode('%PDF-1.7\n<html><script>alert(1)</script></html>'))).toBe(
      'pdf_html_script_polyglot',
    );

    const clickFix = inspectHtmlSnippet(
      `<script>navigator.clipboard.writeText("powershell -w hidden -enc AAA");</script>`,
      'compromised-blog.org',
    );
    expect(clickFix.clickFixLure).toBe(true);

    const obf = inspectHtmlSnippet(
      `<script>eval(atob("YWxlcnQoMSk="));</script>`,
      'compromised-blog.org',
    );
    expect(obf.obfuscatedScript).toBe(true);

    const hiddenFrame = inspectHtmlSnippet(
      `<html><body><iframe src="https://c2-drop.example/kit" width="0" height="0"></iframe></body></html>`,
      'compromised-blog.org',
    );
    expect(hiddenFrame.hiddenCrossOriginIframe).toBe(true);

    const gtmFrame = inspectHtmlSnippet(
      `<html><body><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-123" height="0" width="0" style="display:none;visibility:hidden"></iframe></body></html>`,
      'syncfusion.com',
    );
    expect(gtmFrame.hiddenCrossOriginIframe).toBe(false);

    expect(
      isSuspiciousRedirectChain([
        'https://www.gitbook.com/book/x',
        'https://legacy.gitbook.com/book/x',
        'https://docs.gitbook.com/book/x',
      ]),
    ).toBeNull();
    expect(
      isSuspiciousRedirectChain([
        'https://hop1.example/a',
        'https://hop2.example/b',
        'https://hop3.example/c',
      ]),
    ).toContain('tds_redirect_chain');
  });

  it('supports URLhaus, Safe Browsing, RDAP domain-age drift, delta detonation, trust tiers, and strict COOP', async () => {
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

    const detonation = await submitDeltaDetonation('https://drifted.example/book', {
      cloudflareAccountId: 'acct-1',
      cloudflareToken: 'tok-1',
      fetcher: async () => new Response(JSON.stringify({ uuid: 'scan-123' }), { status: 200 }),
    });
    expect(detonation?.provider).toBe('cloudflare-url-scanner');
    expect(detonation?.reportUrl).toBe('https://radar.cloudflare.com/scan/scan-123');

    expect(classifyHostTrustTier('github.com')).toBe('verified');
    expect(classifyHostTrustTier('cdn.mikeodnis.dev')).toBe('verified');
    expect(classifyHostTrustTier('ocw.mit.edu')).toBe('verified');
    expect(classifyHostTrustTier('random-independent-blog.org')).toBe('external');

    expect(BOOKSHELF_COOP_SOURCES).toContain('/bookshelf/:path*');
    expect(BOOKSHELF_COOP_HEADERS).toEqual([
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ]);

    const mixed = parseFreeProgrammingBooksMarkdown(
      `### Rust\n* [GitHub Book](https://github.com/rust-lang/book)\n* [Blog Book](https://indie-blog.example/rust)`,
      'langs',
    );
    expect(filterFreeProgrammingBooks(mixed, { verifiedHostsOnly: true })).toHaveLength(1);
    expect(filterFreeProgrammingBooks(mixed, { verifiedHostsOnly: true })[0]?.host).toBe(
      'github.com',
    );
  });
});
