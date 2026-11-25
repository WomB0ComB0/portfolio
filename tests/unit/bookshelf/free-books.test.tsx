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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeBooksExplorer } from '@/app/(routes)/(main)/(personal)/bookshelf/free/_components/free-books-explorer';
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import { BOOKSHELF_COOP_HEADERS, BOOKSHELF_COOP_SOURCES } from '@/config/security-headers';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '@/lib/books/free-books-verifier';
import {
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
  it('renders a sortable data table synced to URL query state via nuqs', async () => {
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs'),
      parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects'),
    );
    const updates: UrlUpdateEvent[] = [];

    render(
      <NuqsTestingAdapter onUrlUpdate={(event) => updates.push(event)}>
        <FreeBooksExplorer catalog={catalog} />
      </NuqsTestingAdapter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Free Programming Books' }),
    ).toBeInTheDocument();

    // Renders as a semantic data table with sortable column headers
    const table = screen.getByRole('table', { name: /Free programming books catalog/i });
    expect(table).toBeInTheDocument();
    const bookHeader = within(table).getByRole('columnheader', { name: /Book/i });
    expect(bookHeader).toHaveAttribute('aria-sort', 'ascending');

    // Clicking Book header flips sort direction to descending
    fireEvent.click(within(bookHeader).getByRole('button'));
    expect(bookHeader).toHaveAttribute('aria-sort', 'descending');

    // Archived book is hidden by default
    expect(screen.queryByText('Asynchronous Programming in Rust')).not.toBeInTheDocument();
    expect(screen.getByText('The Rust Programming Language')).toBeInTheDocument();

    // Unchecking Hide archived reveals the archived book
    fireEvent.click(screen.getByLabelText('Hide archived'));
    expect(screen.getByText('Asynchronous Programming in Rust')).toBeInTheDocument();

    // Search narrows down cleanly
    fireEvent.change(screen.getByRole('searchbox', { name: /Search free programming books/i }), {
      target: { value: 'Basarat' },
    });
    expect(screen.getByText('TypeScript Deep Dive')).toBeInTheDocument();
    expect(screen.queryByText('The Rust Programming Language')).not.toBeInTheDocument();

    // nuqs flushes URL query updates asynchronously on a microtask/throttle tick
    await vi.waitFor(() => {
      const qs = updates.at(-1)?.queryString ?? '';
      expect(qs).toContain('q=Basarat');
      expect(qs).toContain('archived=true');
      expect(qs).toContain('dir=desc');
    });
  });

  it('hydrates filters directly from URL query parameters and paginates large sets', () => {
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

    render(
      <NuqsTestingAdapter searchParams="?perPage=25&page=2&format=PDF">
        <FreeBooksExplorer catalog={catalog} />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByText(/Page/i)).toBeInTheDocument();
    expect(screen.getByText('Rust Book 26')).toBeInTheDocument();
    expect(screen.queryByText('Rust Book 01')).not.toBeInTheDocument();
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
