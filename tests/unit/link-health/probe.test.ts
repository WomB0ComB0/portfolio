// @vitest-environment node

/**
 * Copyright 2025 Mike Odnis
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

import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { DetailedPeerCertificate } from 'node:tls';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicAddress } from '@/lib/link-health/ip-policy';
import { createLinkProbe } from '@/lib/link-health/probe';
import { resolveHostAddresses } from '@/lib/link-health/resolve';
import { type ProbeHeaders, type ProbeRequest, requestPinned } from '@/lib/link-health/transport';

const native = vi.hoisted(() => ({ http: vi.fn(), https: vi.fn() }));
const dns = vi.hoisted(() => ({ v4: vi.fn(), v6: vi.fn(), cancel: vi.fn(), created: vi.fn() }));
vi.mock('node:dns/promises', async (original) => ({
  ...(await original<typeof import('node:dns/promises')>()),
  Resolver: class {
    constructor(options: unknown) {
      dns.created(options);
    }
    resolve4 = dns.v4;
    resolve6 = dns.v6;
    cancel = dns.cancel;
  },
}));
vi.mock('node:http', async (original) => ({
  ...(await original<typeof import('node:http')>()),
  request: native.http,
}));
vi.mock('node:https', async (original) => ({
  ...(await original<typeof import('node:https')>()),
  request: native.https,
}));

const URL = 'https://content.example.com/article';
const PUBLIC = '93.184.216.34';

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

function harness() {
  const resolve = vi
    .fn<(host: string, signal: AbortSignal) => Promise<readonly string[]>>()
    .mockResolvedValue([PUBLIC]);
  const request = vi
    .fn<(target: ProbeRequest) => Promise<ProbeHeaders>>()
    .mockResolvedValue({ status: 200 });
  return { resolve, request, probe: createLinkProbe({ resolve, request }) };
}

describe('public-address policy', () => {
  it.each(['1.1.1.1', '8.8.8.8', PUBLIC, '2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'permits ordinary public unicast %s',
    (address) => {
      expect(publicAddress(address)?.address).toBe(address);
    },
  );

  it('normalizes mapped IPv4 before applying the policy', () => {
    expect(publicAddress('::ffff:8.8.8.8')).toEqual({ address: '8.8.8.8', family: 4 });
    expect(publicAddress('::ffff:127.0.0.1')).toBeNull();
  });

  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '100.100.100.200',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.1',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '168.63.129.16',
    '::',
    '::1',
    'fc00::1',
    'fd00:ec2::254',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2001::1',
    '2001:2::1',
    '2002:7f00:1::',
    '64:ff9b::7f00:1',
    '64:ff9b:1::1',
    '3ffe::1',
    '3fff::1',
    '5f00::1',
    'fe80::1%eth0',
    '1.1.1.1/24',
    'not-an-address',
    '',
  ])('rejects private, reserved, transition or malformed address %s', (address) => {
    expect(publicAddress(address)).toBeNull();
  });
});

describe('bounded link observations', () => {
  it('passes only a validated pinned address to the request transport', async () => {
    const h = harness();
    h.resolve.mockResolvedValue(['2606:4700:4700::1111', PUBLIC]);
    expect(await h.probe(`${URL}#fragment`)).toEqual({ kind: 'reachable', httpStatus: 200 });
    expect(h.resolve).toHaveBeenCalledExactlyOnceWith(
      'content.example.com',
      expect.any(AbortSignal),
    );
    expect(h.request).toHaveBeenCalledOnce();
    const target = h.request.mock.calls[0]?.[0];
    expect(target?.url.href).toBe(URL);
    expect(target?.address).toEqual({ address: PUBLIC, family: 4 });
    expect(target?.method).toBe('HEAD');
    expect(target?.signal.aborted).toBe(true);
  });

  it.each([
    'http://127.1/',
    'http://0177.0.0.1/',
    'http://0x7f000001/',
    'http://2130706433/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::1]/',
    'http://169.254.169.254/',
    'http://168.63.129.16/',
    'http://localhost./',
    'http://x.localhost/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://intranet/',
    'https://user:pass@content.example.com/',
    'https://content.example.com:8443/',
  ])('never resolves or requests unsafe URL %s', async (url) => {
    const h = harness();
    expect(await h.probe(url)).toEqual({ kind: 'unknown' });
    expect(h.resolve).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
  });

  it.each([
    { addresses: [PUBLIC, '10.0.0.1'] },
    { addresses: ['not-an-ip'] },
    { addresses: Array<string>(17).fill(PUBLIC) },
  ])('rejects an unsafe or excessive DNS answer set: $addresses', async ({ addresses }) => {
    const h = harness();
    h.resolve.mockResolvedValue(addresses);
    expect(await h.probe(URL)).toEqual({ kind: 'unknown' });
    expect(h.request).not.toHaveBeenCalled();
  });

  it('revalidates DNS after redirects, including rebinding on the same hostname', async () => {
    const h = harness();
    h.resolve.mockResolvedValueOnce([PUBLIC]).mockResolvedValueOnce(['127.0.0.1']);
    h.request.mockResolvedValueOnce({ status: 302, location: '/next' });
    expect(await h.probe(URL)).toEqual({ kind: 'unknown' });
    expect(h.resolve).toHaveBeenCalledTimes(2);
    expect(h.request).toHaveBeenCalledOnce();
  });

  it.each([
    'https://127.0.0.1/private',
    'http://content.example.com/plaintext',
    'file:///etc/passwd',
    'https://user:pass@elsewhere.example.com/',
    'https://elsewhere.example.com:8080/',
    'https://exa\nmple.com/',
  ])('does not request an unsafe redirect %s', async (location) => {
    const h = harness();
    h.request.mockResolvedValueOnce({ status: 302, location });
    expect(await h.probe(URL)).toEqual({ kind: 'unknown' });
    expect(h.request).toHaveBeenCalledOnce();
  });

  it('follows a safe relative redirect and checks the destination', async () => {
    const h = harness();
    h.request.mockResolvedValueOnce({ status: 301, location: '/new?q=1#part' });
    expect(await h.probe(URL)).toEqual({ kind: 'reachable', httpStatus: 200 });
    expect(h.request.mock.calls[1]?.[0].url.href).toBe('https://content.example.com/new?q=1');
  });

  it.each([404, 410, 405, 500, 501, 503])(
    'corroborates HEAD%d with a header-only GET',
    async (status) => {
      const h = harness();
      h.request.mockResolvedValueOnce({ status }).mockResolvedValueOnce({ status: 200 });
      expect(await h.probe(URL)).toEqual({ kind: 'reachable', httpStatus: 200 });
      expect(h.request.mock.calls.map(([r]) => r.method)).toEqual(['HEAD', 'GET']);
      expect(h.resolve).toHaveBeenCalledTimes(2);
    },
  );

  it.each([404, 410])('reports missing only when GET also returns%d', async (status) => {
    const h = harness();
    h.request.mockResolvedValue({ status });
    expect(await h.probe(URL)).toEqual({ kind: 'missing', httpStatus: status });
    expect(h.request.mock.calls.map(([r]) => r.method)).toEqual(['HEAD', 'GET']);
  });

  it.each([
    [204, 'reachable'],
    [206, 'reachable'],
    [304, 'unknown'],
    [400, 'unknown'],
    [401, 'unknown'],
    [403, 'unknown'],
    [408, 'temporary'],
    [429, 'unknown'],
    [451, 'unknown'],
    [500, 'temporary'],
    [503, 'temporary'],
  ] as const)('classifies HTTP%d as%s', async (status, kind) => {
    const h = harness();
    h.request.mockResolvedValue({ status });
    expect(await h.probe(URL)).toEqual({ kind, httpStatus: status });
  });

  it('a blocked GET never confirms a missing HEAD', async () => {
    const h = harness();
    h.request.mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 403 });
    expect(await h.probe(URL)).toEqual({ kind: 'unknown', httpStatus: 403 });
  });

  it('permits three redirects but never requests the fourth destination', async () => {
    const h = harness();
    for (const path of ['/b', '/c', '/d'])
      h.request.mockResolvedValueOnce({ status: 302, location: path });
    expect(await h.probe(URL)).toEqual({ kind: 'reachable', httpStatus: 200 });
    expect(h.request).toHaveBeenCalledTimes(4);
    const bounded = harness();
    bounded.request.mockImplementation(async ({ url }) => ({
      status: 302,
      location: `${url.pathname}/next`,
    }));
    expect(await bounded.probe(URL)).toEqual({ kind: 'unknown' });
    expect(bounded.request).toHaveBeenCalledTimes(4);
  });

  it('shares its redirect allowance with GET fallback at the final HEAD destination', async () => {
    const h = harness();
    for (const path of ['/b', '/c', '/d'])
      h.request.mockResolvedValueOnce({ status: 302, location: path });
    h.request
      .mockResolvedValueOnce({ status: 405 })
      .mockResolvedValueOnce({ status: 302, location: '/e' });
    expect(await h.probe(URL)).toEqual({ kind: 'unknown' });
    expect(h.request).toHaveBeenCalledTimes(5);
    expect(h.request.mock.calls[4]?.[0].url.pathname).toBe('/d');
    expect(h.request.mock.calls[4]?.[0].method).toBe('GET');
  });

  it('stops redirect loops without consuming the whole deadline', async () => {
    const h = harness();
    h.request.mockResolvedValue({ status: 302, location: URL });
    expect(await h.probe(URL)).toEqual({ kind: 'unknown' });
    expect(h.request).toHaveBeenCalledOnce();
  });

  it('treats failed or empty DNS answers as temporary, never missing', async () => {
    const h = harness();
    h.resolve.mockRejectedValueOnce(new Error('DNS failure')).mockResolvedValueOnce([]);
    expect(await h.probe(URL)).toEqual({ kind: 'temporary' });
    expect(await h.probe(URL)).toEqual({ kind: 'temporary' });
    expect(h.request).not.toHaveBeenCalled();
  });

  it('bounds hanging DNS and never opens a connection when DNS finishes late', async () => {
    vi.useFakeTimers();
    const h = harness();
    let resolveDns: (addresses: readonly string[]) => void = () => undefined;
    h.resolve.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDns = resolve;
        }),
    );
    const pending = h.probe(URL);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ kind: 'temporary' });
    resolveDns([PUBLIC]);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.request).not.toHaveBeenCalled();
  });

  it('does not open a late connection after an event-loop pause before the timer callback', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    const h = harness();
    h.resolve.mockImplementation(async () => {
      clock.mockReturnValue(5101);
      return [PUBLIC];
    });
    try {
      expect(await h.probe(URL)).toEqual({ kind: 'temporary' });
      expect(h.request).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it('aborts hanging headers within five seconds', async () => {
    vi.useFakeTimers();
    const h = harness();
    h.request.mockImplementation(() => new Promise(() => undefined));
    const pending = h.probe(URL);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ kind: 'temporary' });
    expect(h.request.mock.calls[0]?.[0].signal.aborted).toBe(true);
  });

  it('does not reset the deadline for redirects or GET fallback', async () => {
    vi.useFakeTimers();
    const h = harness();
    let calls = 0;
    h.request.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return ++calls === 1 ? { status: 302, location: '/next' } : { status: 405 };
    });
    const pending = h.probe(URL);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ kind: 'temporary' });
    expect(h.request).toHaveBeenCalledTimes(3);
    expect(h.request.mock.calls[2]?.[0].signal.aborted).toBe(true);
  });
});

describe('actual pinned Node transport configuration', () => {
  function install(status = 200, headers: IncomingMessage['headers'] = {}) {
    const response = new EventEmitter() as IncomingMessage;
    response.statusCode = status;
    response.headers = headers;
    response.destroy = vi.fn(() => response);
    const listen = vi.spyOn(response, 'on');
    const request = new EventEmitter() as ClientRequest;
    request.end = vi.fn(() => request);
    const factory = (_options: RequestOptions, callback: (response: IncomingMessage) => void) => {
      request.end = vi.fn(() => {
        callback(response);
        return request;
      });
      return request;
    };
    native.http.mockImplementation(factory);
    native.https.mockImplementation(factory);
    return { request, response, listen };
  }

  const target = (): ProbeRequest => ({
    url: new globalThis.URL(URL),
    address: { address: PUBLIC, family: 4 },
    method: 'GET',
    signal: new AbortController().signal,
  });

  it('connects to the pinned IP while preserving Host, SNI and original TLS identity', async () => {
    const h = install(200);
    vi.stubEnv('HTTPS_PROXY', 'http://proxy.invalid:8080');
    expect(await requestPinned(target())).toEqual({ status: 200 });
    const options = native.https.mock.calls[0]?.[0] as RequestOptions;
    expect(options.hostname).toBe(PUBLIC);
    expect(options.family).toBe(4);
    expect(options.port).toBe(443);
    expect(options.servername).toBe('content.example.com');
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.agent).toBe(false);
    expect(options.lookup).toBeUndefined();
    expect(options.auth).toBeUndefined();
    expect(options.headers).toEqual({
      Host: 'content.example.com',
      Accept: '*/*',
      'User-Agent': 'Portfolio-Link-Check/1.0',
    });
    const correct = { subjectaltname: 'DNS:content.example.com' } as DetailedPeerCertificate;
    const wrong = { subjectaltname: 'DNS:other.example.com' } as DetailedPeerCertificate;
    expect(options.checkServerIdentity?.(PUBLIC, correct)).toBeUndefined();
    expect(options.checkServerIdentity?.(PUBLIC, wrong)).toBeInstanceOf(Error);
    expect(h.response.destroy).toHaveBeenCalledOnce();
    expect(h.listen.mock.calls.map(([event]) => event)).not.toContain('data');
    expect(h.request.end).toHaveBeenCalledExactlyOnceWith();
    expect(options.maxHeaderSize).toBe(8192);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses plain HTTP only for an explicitly HTTP URL and keeps the original request path', async () => {
    install(302, { location: '/next' });
    const input = {
      ...target(),
      url: new globalThis.URL('http://content.example.com/path?q=a%20b'),
    };
    expect(await requestPinned(input)).toEqual({ status: 302, location: '/next' });
    const options = native.http.mock.calls[0]?.[0] as RequestOptions;
    expect(options.hostname).toBe(PUBLIC);
    expect(options.port).toBe(80);
    expect(options.path).toBe('/path?q=a%20b');
    expect(native.https).not.toHaveBeenCalled();
  });

  it('rejects unsafe direct transport input before any socket is opened', async () => {
    const input = { ...target(), address: { address: '127.0.0.1', family: 4 as const } };
    await expect(requestPinned(input)).rejects.toThrow();
    expect(native.http).not.toHaveBeenCalled();
    expect(native.https).not.toHaveBeenCalled();
  });

  it('does not open a socket for an already aborted check', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestPinned({ ...target(), signal: controller.signal })).rejects.toThrow();
    expect(native.https).not.toHaveBeenCalled();
  });

  it('destroys an unsolicited upgraded connection rather than keeping its socket alive', async () => {
    const response = new EventEmitter() as IncomingMessage;
    response.statusCode = 101;
    response.headers = {};
    response.destroy = vi.fn(() => response);
    const socket = { destroy: vi.fn() };
    const request = new EventEmitter() as ClientRequest;
    request.end = vi.fn(() => {
      request.emit('upgrade', response, socket);
      return request;
    });
    native.https.mockReturnValue(request);
    expect(await requestPinned(target())).toEqual({ status: 101 });
    expect(response.destroy).toHaveBeenCalledOnce();
    expect(socket.destroy).toHaveBeenCalledOnce();
  });
});

describe('cancellable DNS resolution', () => {
  it('collects A and AAAA answers, preserving them all for the public-address policy', async () => {
    dns.v4.mockResolvedValue([PUBLIC]);
    dns.v6.mockResolvedValue(['2606:4700:4700::1111']);
    const signal = new AbortController().signal;
    expect(await resolveHostAddresses('content.example.com', signal)).toEqual([
      PUBLIC,
      '2606:4700:4700::1111',
    ]);
    expect(dns.created).toHaveBeenCalledWith({ timeout: 5000, tries: 1 });
    expect(dns.v4).toHaveBeenCalledWith('content.example.com');
    expect(dns.v6).toHaveBeenCalledWith('content.example.com');
    expect(dns.cancel).toHaveBeenCalled();
  });

  it('allows an absent address family while keeping the other answers', async () => {
    dns.v4.mockResolvedValue([PUBLIC]);
    dns.v6.mockRejectedValue(new Error('ENODATA'));
    expect(await resolveHostAddresses('content.example.com', new AbortController().signal)).toEqual(
      [PUBLIC],
    );
  });

  it('cancels the actual resolver work when the shared deadline aborts', async () => {
    let reject4: (error: Error) => void = () => undefined;
    let reject6: (error: Error) => void = () => undefined;
    dns.v4.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          reject4 = reject;
        }),
    );
    dns.v6.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          reject6 = reject;
        }),
    );
    dns.cancel.mockImplementation(() => {
      reject4(new Error('ECANCELLED'));
      reject6(new Error('ECANCELLED'));
    });
    const controller = new AbortController();
    const pending = resolveHostAddresses('content.example.com', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(dns.cancel).toHaveBeenCalled();
  });

  it('does not start DNS after an already expired deadline', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(resolveHostAddresses('content.example.com', controller.signal)).rejects.toThrow();
    expect(dns.created).not.toHaveBeenCalled();
  });
});
