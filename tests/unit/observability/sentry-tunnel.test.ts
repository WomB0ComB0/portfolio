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

/**
 * @file Unit and regression tests for the `/monitoring` and `/sentry-tunnel` envelope tunnel
 * handlers and server tunnel configuration.
 */

import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { buildServerOptions } from '@/lib/observability/sentry-options';
import {
  forwardSentryTunnelRequest,
  MAX_ENVELOPE_HEADER_BYTES,
  parseSentryDsn,
  TUNNEL_MAX_DURATION_SECONDS,
} from '@/lib/observability/sentry-tunnel';

const ALLOWED_DSN = 'https://abc123@o42.ingest.us.sentry.io/7';
const EXPECTED_INGEST_URL =
  'https://o42.ingest.us.sentry.io/api/7/envelope/?sentry_version=7&sentry_key=abc123';

vi.mock('@/env', () => {
  const env = { NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o42.ingest.us.sentry.io/7' };
  return { env, default: env };
});

describe('parseSentryDsn', () => {
  it('parses a standard Sentry DSN into canonical form and envelope ingest URL', () => {
    expect(parseSentryDsn(ALLOWED_DSN)).toEqual({
      canonical: ALLOWED_DSN,
      ingestUrl: EXPECTED_INGEST_URL,
    });
  });

  it('preserves custom ports and path prefixes', () => {
    expect(parseSentryDsn('http://pub@localhost:9000/subpath/42')).toEqual({
      canonical: 'http://pub@localhost:9000/subpath/42',
      ingestUrl: 'http://localhost:9000/subpath/api/42/envelope/?sentry_version=7&sentry_key=pub',
    });
  });

  it('rejects missing, malformed, or non-HTTP(S) DSNs', () => {
    expect(parseSentryDsn(undefined)).toBeUndefined();
    expect(parseSentryDsn('')).toBeUndefined();
    expect(parseSentryDsn('not-a-url')).toBeUndefined();
    expect(parseSentryDsn('ftp://abc@o42.ingest.sentry.io/7')).toBeUndefined();
    expect(parseSentryDsn('https://o42.ingest.sentry.io/7')).toBeUndefined();
    expect(parseSentryDsn('https://abc@o42.ingest.sentry.io/')).toBeUndefined();
    expect(parseSentryDsn('https://abc@o42.ingest.sentry.io/not-a-number')).toBeUndefined();
  });
});

describe('forwardSentryTunnelRequest', () => {
  const validEnvelope = `${JSON.stringify({ dsn: ALLOWED_DSN })}\n${JSON.stringify({ type: 'client_report' })}\n{}`;

  it('forwards a valid envelope with a finite Uint8Array body and safe headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-sentry-rate-limits': '60::organization',
          'set-cookie': 'dropped=1',
        },
      }),
    );

    const request = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'x-vercel-forwarded-for': '203.0.113.9',
        'user-agent': 'TestBrowser/1.0',
        origin: 'https://mikeodnis.dev',
        cookie: 'secret=1',
      },
      body: validEnvelope,
    });

    const response = await forwardSentryTunnelRequest(request, {
      allowedDsns: [ALLOWED_DSN],
      fetchImpl,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{}');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-sentry-rate-limits')).toBe('60::organization');
    expect(response.headers.get('set-cookie')).toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(EXPECTED_INGEST_URL);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe(validEnvelope);
    expect(init?.headers).toEqual({
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Forwarded-For': '203.0.113.9',
      'x-vercel-forwarded-for': '203.0.113.9',
      'user-agent': 'TestBrowser/1.0',
      origin: 'https://mikeodnis.dev',
    });
  });

  it('returns 500 when no allowed DSNs are configured', async () => {
    const request = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      body: validEnvelope,
    });
    const response = await forwardSentryTunnelRequest(request, { allowedDsns: [''] });
    expect(response.status).toBe(500);
  });

  it('returns 411 when Content-Length is zero or invalid', async () => {
    const request = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      headers: { 'content-length': '0' },
      body: '',
    });
    const response = await forwardSentryTunnelRequest(request, { allowedDsns: [ALLOWED_DSN] });
    expect(response.status).toBe(411);
  });

  it('returns 413 when Content-Length or streamed body exceeds maxBytes', async () => {
    const declaredTooLarge = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      headers: { 'content-length': '2048' },
      body: validEnvelope,
    });
    const res1 = await forwardSentryTunnelRequest(declaredTooLarge, {
      allowedDsns: [ALLOWED_DSN],
      maxBytes: 128,
    });
    expect(res1.status).toBe(413);

    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamedTooLarge = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      body: stream,
      // @ts-expect-error Node fetch requires duplex for stream bodies
      duplex: 'half',
    });
    const res2 = await forwardSentryTunnelRequest(streamedTooLarge, {
      allowedDsns: [ALLOWED_DSN],
      maxBytes: 100,
    });
    expect(res2.status).toBe(413);
    expect(cancelled).toBe(true);
  });

  it('aborts a stalled client body stream with 408 instead of hanging for 300s', async () => {
    let cancelCalled = false;
    const stalledStream = new ReadableStream<Uint8Array>({
      pull() {
        // Simulates a browser connection that stalls before closing.
        return new Promise<void>(() => undefined);
      },
      cancel() {
        cancelCalled = true;
        // Even if underlying stream cancellation never resolves, the handler must return immediately.
        return new Promise<void>(() => undefined);
      },
    });

    const request = new Request('https://mikeodnis.dev/monitoring', {
      method: 'POST',
      body: stalledStream,
      // @ts-expect-error Node fetch requires duplex for stream bodies
      duplex: 'half',
    });

    const start = Date.now();
    const response = await forwardSentryTunnelRequest(request, {
      allowedDsns: [ALLOWED_DSN],
      bodyReadTimeoutMs: 40,
    });
    const elapsed = Date.now() - start;

    expect(response.status).toBe(408);
    expect(cancelCalled).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it('rejects malformed envelopes, oversized headers, and unauthorized DSNs', async () => {
    const post = (body: string | Uint8Array) =>
      forwardSentryTunnelRequest(
        new Request('https://mikeodnis.dev/monitoring', {
          method: 'POST',
          body: body as BodyInit,
        }),
        { allowedDsns: [ALLOWED_DSN] },
      );

    expect((await post('not-json\n{}')).status).toBe(400);
    expect((await post('null\n{}')).status).toBe(400);
    expect((await post('{}\n{}')).status).toBe(400);
    expect((await post(`${JSON.stringify({ dsn: 'not-a-dsn' })}\n{}`)).status).toBe(403);
    expect(
      (await post(`${JSON.stringify({ dsn: 'https://other@o99.ingest.sentry.io/1' })}\n{}`)).status,
    ).toBe(403);

    const oversizedHeader = new Uint8Array(MAX_ENVELOPE_HEADER_BYTES + 10).fill(0x61);
    expect((await post(oversizedHeader)).status).toBe(400);
  });

  it('returns 504 on upstream timeout and 502 on upstream network failure', async () => {
    const timeoutFetch = vi.fn<typeof fetch>().mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      }),
    );
    const timeoutRes = await forwardSentryTunnelRequest(
      new Request('https://mikeodnis.dev/monitoring', { method: 'POST', body: validEnvelope }),
      { allowedDsns: [ALLOWED_DSN], fetchImpl: timeoutFetch },
    );
    expect(timeoutRes.status).toBe(504);

    const errorFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('socket hang up'));
    const errorRes = await forwardSentryTunnelRequest(
      new Request('https://mikeodnis.dev/monitoring', { method: 'POST', body: validEnvelope }),
      { allowedDsns: [ALLOWED_DSN], fetchImpl: errorFetch },
    );
    expect(errorRes.status).toBe(502);
  });
});

describe('tunnel route handlers and server interception guard', () => {
  it('exports maxDuration = 15 and POST from both /monitoring and /sentry-tunnel routes', async () => {
    const monitoringRoute = await import('@/app/monitoring/route');
    const sentryTunnelRoute = await import('@/app/sentry-tunnel/route');

    expect(monitoringRoute.maxDuration).toBe(TUNNEL_MAX_DURATION_SECONDS);
    expect(sentryTunnelRoute.maxDuration).toBe(TUNNEL_MAX_DURATION_SECONDS);
    expect(sentryTunnelRoute.POST).toBe(monitoringRoute.POST);
  });

  it('disables http.Server.emit tunnel interception so warm Vercel invocations reach Next.js', async () => {
    const serverOptions = buildServerOptions({ onVercel: true, vercelEnv: 'production' });
    expect(serverOptions._managedTunnel).toEqual({ path: '/monitoring', intercept: false });

    const g = globalThis as Record<string, unknown>;
    const prevTunnelRoute = g._sentryTunnelRoute;
    g._sentryTunnelRoute = '/monitoring';

    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: ALLOWED_DSN,
        ...serverOptions,
      });

      let nextRequestListenerCalled = false;
      const server = http.createServer((_req, res) => {
        nextRequestListenerCalled = true;
        res.writeHead(200, { 'x-handled-by': 'nextjs-route' });
        res.end('ok');
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      try {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Expected TCP server address');
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/monitoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: `${JSON.stringify({ dsn: ALLOWED_DSN })}\n{}`,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('x-handled-by')).toBe('nextjs-route');
        expect(nextRequestListenerCalled).toBe(true);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      g._sentryTunnelRoute = prevTunnelRoute;
    }
  });
});
