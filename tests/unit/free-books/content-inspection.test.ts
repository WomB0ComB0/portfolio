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
 * @file src/lib/free-books/content-inspection.ts, the verify sweep's checks of a link's response:
 * executable headers, active PDF content, cloaked or weaponised HTML, and redirect chains.
 */

import { describe, expect, it } from 'vitest';
import {
  inspectHtmlSnippet,
  inspectPdfBytes,
  isDangerousResponseHeaders,
  isSuspiciousRedirectChain,
} from '@/lib/free-books/content-inspection';

describe('isDangerousResponseHeaders', () => {
  it('flags drive-by executable MIME types and Content-Disposition file names', () => {
    expect(isDangerousResponseHeaders('application/x-msdownload', null)).toContain(
      'dangerous_mime',
    );
    expect(
      isDangerousResponseHeaders('application/octet-stream', 'attachment; filename="book.pdf.exe"'),
    ).toBe('dangerous_disposition_double_ext');
    expect(
      isDangerousResponseHeaders('application/pdf', 'inline; filename="guide.pdf"'),
    ).toBeNull();
  });
});

describe('inspectHtmlSnippet', () => {
  it('flags a parked domain and a cross-origin meta refresh', () => {
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

  it('flags ClickFix lures, obfuscated loaders and hidden cross-origin iframes, not a tag manager', () => {
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
  });
});

describe('inspectPdfBytes', () => {
  it('flags active objects, hex-obfuscated names and HTML polyglots, but not stream contents', () => {
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
  });
});

describe('isSuspiciousRedirectChain', () => {
  it('passes hops within one domain and flags a chain through three external domains', () => {
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
});
