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
 * @file src/lib/free-books/pinned-fetch.ts on injected DNS answers and an injected transport (no
 * real DNS or sockets): every request resolves its host once, refuses private, loopback,
 * link-local, unique-local, mapped and metadata addresses, and connects only to the address it
 * vetted, so a name cannot rebind between the check and the connection. Then the real transport
 * (with node:https stubbed) under inspectFinalTarget: a body compressed although identity was
 * asked for is decoded before it is inspected, and one it cannot decode is refused by name.
 */

import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinnedFetch, UnsafeTargetError } from '@/lib/free-books/pinned-fetch';
import { inspectFinalTarget } from '@/lib/free-books/target-inspection';
import {
  type PinnedGetRequest,
  type PinnedResponse,
  requestPinnedResponse,
} from '@/lib/link-health/transport';

const native = vi.hoisted(() => ({ https: vi.fn() }));
vi.mock('node:https', async (original) => ({
  ...(await original<typeof import('node:https')>()),
  request: native.https,
}));

afterEach(() => {
  native.https.mockReset();
});

const PUBLIC = '93.184.216.34';
const GET = { method: 'GET', redirect: 'manual' } as const satisfies RequestInit;

/** A pinned fetch whose DNS answers come from `answers`, and whose transport answers 200. */
function harness(answers: Readonly<Record<string, readonly string[]>> = {}) {
  const resolve = vi.fn<(host: string, signal: AbortSignal) => Promise<readonly string[]>>(
    async (host) => answers[host] ?? [],
  );
  const request = vi.fn<(target: PinnedGetRequest) => Promise<PinnedResponse>>(async () => ({
    status: 200,
    headers: { contentType: 'text/html; charset=utf-8' },
    body: new Blob(['<html>A free book</html>']).stream(),
  }));
  return { resolve, request, fetch: createPinnedFetch({ resolve, request }) };
}

describe('createPinnedFetch', () => {
  it.each([
    { host: '169.254.169.254.nip.io', answers: ['169.254.169.254'] },
    { host: 'loopback.example', answers: ['127.0.0.1'] },
    { host: 'v6-loopback.example', answers: ['::1'] },
    { host: 'unique-local.example', answers: ['fd00::1'] },
    { host: 'unique-local-ec2.example', answers: ['fd00:ec2::254'] },
    { host: 'mapped.example', answers: ['::ffff:10.0.0.1'] },
    { host: 'mapped-hex.example', answers: ['::ffff:a00:1'] },
    { host: 'link-local.example', answers: ['fe80::1'] },
    { host: 'private.example', answers: ['192.168.1.10'] },
    { host: 'wireserver.example', answers: ['168.63.129.16'] },
    { host: 'mixed.example', answers: [PUBLIC, '10.0.0.1'] },
  ])('refuses $host, which resolves to $answers, and never connects', async ({ host, answers }) => {
    const h = harness({ [host]: answers });

    const attempt = h.fetch(`https://${host}/latest/meta-data/`, GET);

    await expect(attempt).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(attempt).rejects.toMatchObject({ hostname: host });
    expect(h.resolve).toHaveBeenCalledExactlyOnceWith(host, expect.any(AbortSignal));
    expect(h.request).not.toHaveBeenCalled();
  });

  it("resolves once and connects to the vetted address, keeping the URL's host for TLS and Host", async () => {
    const h = harness({ 'books.example': ['2606:4700:4700::1111', PUBLIC] });

    const response = await h.fetch('https://books.example/guide?x=1#part', {
      ...GET,
      headers: { 'User-Agent': 'test-agent/1.0', Range: 'bytes=0-1023' },
    });

    expect(response.status).toBe(200);
    expect(h.resolve).toHaveBeenCalledOnce();
    expect(h.request).toHaveBeenCalledOnce();
    const target = h.request.mock.calls[0]?.[0];
    expect(target?.url.href).toBe('https://books.example/guide?x=1');
    expect(target?.address).toEqual({ address: PUBLIC, family: 4 });
    expect(target?.userAgent).toBe('test-agent/1.0');
    expect(target?.range).toBe('bytes=0-1023');
  });

  it('connects over IPv6 when that is the only public answer', async () => {
    const h = harness({ 'books.example': ['2606:4700:4700::1111'] });

    await h.fetch('https://books.example/', GET);

    expect(h.request.mock.calls[0]?.[0].address).toEqual({
      address: '2606:4700:4700::1111',
      family: 6,
    });
  });

  it('checks every hop afresh, so a name that rebinds to a private address is refused', async () => {
    const h = harness();
    h.resolve.mockResolvedValueOnce([PUBLIC]).mockResolvedValueOnce(['127.0.0.1']);

    await h.fetch('https://books.example/a', GET);
    const second = h.fetch('https://books.example/b', GET);

    await expect(second).rejects.toBeInstanceOf(UnsafeTargetError);
    expect(h.resolve).toHaveBeenCalledTimes(2);
    expect(h.request).toHaveBeenCalledOnce();
  });

  it.each([
    'http://10.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://intranet/',
    'https://user:pass@books.example/',
    'https://books.example:8443/',
    'file:///etc/passwd',
  ])('refuses %s without resolving it', async (url) => {
    const h = harness();

    await expect(h.fetch(url, GET)).rejects.toBeInstanceOf(UnsafeTargetError);
    expect(h.resolve).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
  });

  it('hands back a redirect without following it', async () => {
    const h = harness({ 'books.example': [PUBLIC] });
    h.request.mockResolvedValueOnce({
      status: 302,
      headers: { location: 'http://169.254.169.254.nip.io/' },
      body: new Blob([]).stream(),
    });

    const response = await h.fetch('https://books.example/', GET);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://169.254.169.254.nip.io/');
    expect(h.request).toHaveBeenCalledOnce();
  });

  it('streams the body and passes the content headers through', async () => {
    const h = harness({ 'books.example': [PUBLIC] });
    h.request.mockResolvedValueOnce({
      status: 206,
      headers: { contentType: 'application/pdf', contentDisposition: 'inline' },
      body: new Blob(['%PDF-1.7']).stream(),
    });

    const response = await h.fetch('https://books.example/notes.pdf', GET);

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(await response.text()).toBe('%PDF-1.7');
  });

  it('treats a name that does not resolve as a network failure, not an unsafe target', async () => {
    const h = harness();

    const attempt = h.fetch('https://gone.example/', GET);

    await expect(attempt).rejects.toThrow();
    await expect(attempt).rejects.not.toBeInstanceOf(UnsafeTargetError);
    expect(h.request).not.toHaveBeenCalled();
  });

  it.each<RequestInit>([
    { method: 'POST', redirect: 'manual' },
    { method: 'GET', redirect: 'follow' },
    { method: 'GET' },
    { method: 'GET', redirect: 'manual', body: 'x' },
  ])('refuses a request that is not one manual GET without a body: %o', async (init) => {
    const h = harness({ 'books.example': [PUBLIC] });

    await expect(h.fetch('https://books.example/', init)).rejects.toBeInstanceOf(TypeError);
    expect(h.resolve).not.toHaveBeenCalled();
  });

  it('stops before DNS when the signal has already fired', async () => {
    const h = harness({ 'books.example': [PUBLIC] });
    const controller = new AbortController();
    controller.abort();

    await expect(
      h.fetch('https://books.example/', { ...GET, signal: controller.signal }),
    ).rejects.toThrow();
    expect(h.resolve).not.toHaveBeenCalled();
  });

  it('refuses an informational status, which no fetch response can carry', async () => {
    const h = harness({ 'books.example': [PUBLIC] });
    h.request.mockResolvedValueOnce({ status: 101, headers: {}, body: new Blob([]).stream() });

    await expect(h.fetch('https://books.example/', GET)).rejects.toThrow(/101/);
  });

  it('passes on an encoding the transport could not decode, for the inspection to refuse', async () => {
    const h = harness({ 'books.example': [PUBLIC] });
    h.request.mockResolvedValueOnce({
      status: 200,
      headers: { contentType: 'application/pdf', contentEncoding: 'zstd' },
      body: new Blob(['(zstd frame)']).stream(),
    });

    const response = await h.fetch('https://books.example/notes.pdf', GET);

    expect(response.headers.get('content-encoding')).toBe('zstd');
  });
});

describe('inspecting a compressed body over the real pinned transport', () => {
  const ACTIVE_PDF = '%PDF-1.7\n1 0 obj << /OpenAction << /S /JS >> >> endobj';

  /** node:https answers 200 with `headers` and `body`; DNS answers PUBLIC for every host. */
  function serve(headers: IncomingMessage['headers'], body: Buffer) {
    native.https.mockImplementation(
      (_options: RequestOptions, callback: (response: IncomingMessage) => void) => {
        const request = new EventEmitter() as ClientRequest;
        request.end = vi.fn(() => {
          callback(Object.assign(Readable.from([body]), { statusCode: 200, headers }) as never);
          return request;
        });
        return request;
      },
    );
    return createPinnedFetch({ resolve: async () => [PUBLIC], request: requestPinnedResponse });
  }

  it('finds the active content in a gzipped PDF', async () => {
    const fetcher = serve(
      { 'content-type': 'application/pdf', 'content-encoding': 'gzip' },
      gzipSync(Buffer.from(ACTIVE_PDF)),
    );

    const result = await inspectFinalTarget(
      'https://books.example/notes.pdf',
      'books.example',
      fetcher,
    );

    expect(result.danger).toMatch(/^pdf_active_object:/);
  });

  it('refuses a zstd body with an explicit reason rather than reading it as the page', async () => {
    const fetcher = serve(
      { 'content-type': 'application/pdf', 'content-encoding': 'zstd' },
      Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x00]),
    );

    const result = await inspectFinalTarget(
      'https://books.example/notes.pdf',
      'books.example',
      fetcher,
    );

    expect(result).toEqual({
      danger: 'undecodable_content_encoding:zstd',
      finalHost: 'books.example',
      contentType: 'application/pdf',
      complete: true,
    });
  });
});
