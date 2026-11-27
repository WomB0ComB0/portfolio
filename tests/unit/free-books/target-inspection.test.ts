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
 * @file src/lib/free-books/target-inspection.ts on stubbed fetches, and over the real DNS-pinned
 * fetch with injected DNS answers: the request it sends and the redirect-chain audit, dangerous
 * headers, active PDF content, a body in an encoding it cannot read, a request that fails, and a
 * hop that resolves to a private address, which quarantines its link and is never connected to.
 */

import { describe, expect, it, vi } from 'vitest';
import { createPinnedFetch } from '@/lib/free-books/pinned-fetch';
import { inspectFinalTarget } from '@/lib/free-books/target-inspection';
import type { FetchLike } from '@/lib/free-books/types';
import type { PinnedGetRequest, PinnedResponse } from '@/lib/link-health/transport';
import { INDIE_GUIDE, OLD_NOTES, pageResponse, redirectTo } from './sweep-fixture';

describe('inspectFinalTarget', () => {
  it('asks for at most 1 MiB without following redirects, and flags a chain through three external domains', async () => {
    const fetcher = vi.fn<FetchLike>(async (input) => {
      const url = String(input);
      if (url === 'https://hop1.example/a') return redirectTo('https://hop2.example/b');
      if (url === 'https://hop2.example/b') return redirectTo('https://hop3.example/c');
      return pageResponse();
    });

    const result = await inspectFinalTarget('https://hop1.example/a', 'hop1.example', fetcher);

    expect(result).toEqual({
      danger: 'tds_redirect_chain:3_external_domains',
      finalHost: 'hop2.example',
      contentType: '',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://hop1.example/a',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)',
          Range: 'bytes=0-1048575',
        },
      }),
    );
  });

  it('flags an executable download by its headers', async () => {
    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () =>
      pageResponse('MZ', 'application/x-msdownload'),
    );

    expect(result).toEqual({
      danger: 'dangerous_mime:application/x-msdownload',
      finalHost: 'indie.example',
      contentType: 'application/x-msdownload',
    });
  });

  it('flags active content in real PDF bytes, but not an HTML page behind a .pdf link', async () => {
    const activePdf = await inspectFinalTarget(OLD_NOTES, 'old.example', async () =>
      pageResponse('%PDF-1.7\n1 0 obj << /OpenAction << /S /JS >> >> endobj', 'application/pdf'),
    );
    const landingPage = await inspectFinalTarget(OLD_NOTES, 'old.example', async () =>
      pageResponse(),
    );

    expect(activePdf.danger).toContain('pdf_active_object');
    expect(activePdf.contentType).toBe('application/pdf');
    expect(landingPage).toEqual({
      danger: null,
      finalHost: 'old.example',
      contentType: 'text/html',
    });
  });

  describe('over the DNS-pinned fetch', () => {
    const METADATA_HOP = 'http://169.254.169.254.nip.io/latest/meta-data/';

    /** createPinnedFetch on injected DNS `answers` and a transport that always redirects there. */
    function pinned(answers: Readonly<Record<string, readonly string[]>>) {
      const resolve = vi.fn(async (host: string, _signal: AbortSignal) => answers[host] ?? []);
      const request = vi.fn(
        async (_target: PinnedGetRequest): Promise<PinnedResponse> => ({
          status: 302,
          headers: { location: METADATA_HOP },
          body: new Blob([]).stream(),
        }),
      );
      return { resolve, request, fetcher: createPinnedFetch({ resolve, request }) };
    }

    it('quarantines a link whose redirect resolves to a private address, and never connects there', async () => {
      const h = pinned({
        'indie.example': ['93.184.216.34'],
        '169.254.169.254.nip.io': ['169.254.169.254'],
      });

      const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', h.fetcher);

      expect(result).toEqual({
        danger: 'unsafe_address:169.254.169.254.nip.io',
        finalHost: '169.254.169.254.nip.io',
        contentType: '',
      });
      expect(h.resolve.mock.calls.map(([host]) => host)).toEqual([
        'indie.example',
        '169.254.169.254.nip.io',
      ]);
      expect(h.request).toHaveBeenCalledOnce();
      expect(h.request.mock.calls[0]?.[0].url.href).toBe(INDIE_GUIDE);
    });

    it('quarantines a link whose own name now resolves to a private address (rebound after the probe)', async () => {
      const h = pinned({ 'indie.example': ['127.0.0.1'] });

      const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', h.fetcher);

      expect(result.danger).toBe('unsafe_address:indie.example');
      expect(h.request).not.toHaveBeenCalled();
    });
  });

  it('refuses a reachable body in an encoding it cannot read, naming the encoding', async () => {
    const zstdPage = new Response('(zstd frame)', {
      status: 200,
      headers: { 'content-type': 'text/html', 'content-encoding': 'zstd' },
    });

    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () => zstdPage);

    expect(result).toEqual({
      danger: 'undecodable_content_encoding:zstd',
      finalHost: 'indie.example',
      contentType: 'text/html',
    });
  });

  it('finds nothing when the request fails', async () => {
    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () => {
      throw new TypeError('fetch failed');
    });

    expect(result).toEqual({ danger: null, finalHost: 'indie.example', contentType: '' });
  });
});
