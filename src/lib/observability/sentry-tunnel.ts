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
 * @file Bounded Sentry envelope tunnel handler for `/monitoring` (and `/sentry-tunnel`).
 *
 * Why this exists instead of `@sentry/nextjs`'s default `serveTunnelIntegration` /
 * `@sentry/nextjs/tunnel` handler:
 * 1. In `@sentry/nextjs` 11.13+, `Sentry.init()` on the Node.js server installs an
 *    `http.Server.prototype.emit` hook (`handleServedNodeTunnelRequest`) that intercepts
 *    `POST /monitoring` and returns `true` without invoking Next.js's request listener. On warm
 *    Vercel Serverless Function invocations, bypassing Next.js's request listener leaves the
 *    serverless invocation lifecycle pending until `maxDuration` (300s) expires with
 *    `Vercel Runtime Timeout Error: Task timed out after 300 seconds`.
 * 2. `@sentry/core`'s `forwardEnvelope` reads the incoming request stream via
 *    `readEnvelopeHeaderLine(reader)` without a timeout and forwards a streaming `ReadableStream`
 *    (`prependToStream`) whose `cancel()` drains `request[Symbol.asyncIterator]()` in an unbounded
 *    loop, hanging if a browser tab closes or drops mid-upload.
 *
 * Setting `_managedTunnel: { path: '/monitoring', intercept: false }` in `buildServerOptions`
 * disables the `http.Server.emit` hijack (while keeping tunnel requests out of Sentry spans and
 * sessions), and this route handler buffers the finite envelope with strict read and upstream
 * timeouts before forwarding to Sentry.
 */

import { suppressTracing } from '@sentry/nextjs';

/** Public path where the browser SDK sends Sentry envelopes. */
export const SENTRY_TUNNEL_PATH = '/monitoring';

/** Vercel function execution ceiling (seconds) for the tunnel route handlers. */
export const TUNNEL_MAX_DURATION_SECONDS = 15;

/** Maximum envelope payload size accepted by the tunnel (5 MiB covers session replays). */
export const MAX_ENVELOPE_BYTES = 5 * 1024 * 1024;

/** Maximum byte length of the JSON envelope header line (first line before `\n`). */
export const MAX_ENVELOPE_HEADER_BYTES = 64 * 1024;

/** Maximum time allowed to read the full request body from the client. */
export const BODY_READ_TIMEOUT_MS = 5_000;

/** Maximum time allowed for the upstream `fetch` to Sentry's ingest API. */
export const FORWARD_TIMEOUT_MS = 10_000;

const FORWARDED_CLIENT_IP_HEADERS = [
  'cf-connecting-ip',
  'x-vercel-forwarded-for',
  'x-forwarded-for',
] as const;

const FORWARDED_CLIENT_HEADERS = [
  'user-agent',
  'sec-ch-ua',
  'sec-ch-ua-model',
  'sec-ch-ua-platform',
  'sec-ch-ua-platform-version',
  'origin',
  'referer',
] as const;

const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'x-sentry-rate-limits'] as const;

export interface ParsedSentryDsn {
  /** Canonical DSN string (`<protocol>//<publicKey>@<host>/<path>/<projectId>`). */
  canonical: string;
  /** Sentry envelope ingestion endpoint with URL-encoded auth query parameters. */
  ingestUrl: string;
}

/**
 * Parses a Sentry DSN into its canonical form and envelope ingestion URL.
 * Returns `undefined` when the DSN is missing, malformed, or not HTTP(S).
 */
export function parseSentryDsn(dsn: string | undefined): ParsedSentryDsn | undefined {
  if (!dsn || typeof dsn !== 'string') return undefined;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!url.username || !url.hostname) return undefined;

    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!projectId || !/^\d+$/.test(projectId)) return undefined;

    const prefix = segments.length > 0 ? `/${segments.join('/')}` : '';
    const auth = url.password
      ? `${encodeURIComponent(url.username)}:${encodeURIComponent(url.password)}`
      : encodeURIComponent(url.username);
    const canonical = `${url.protocol}//${auth}@${url.host}${prefix}/${projectId}`;

    const endpoint = new URL(`${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`);
    endpoint.searchParams.set('sentry_version', '7');
    endpoint.searchParams.set('sentry_key', url.username);

    return {
      canonical,
      ingestUrl: endpoint.toString(),
    };
  } catch {
    return undefined;
  }
}

export interface SentryTunnelOptions {
  /** Allowed DSN strings (defaults to `[process.env.NEXT_PUBLIC_SENTRY_DSN]`). */
  allowedDsns?: ReadonlyArray<string | undefined>;
  /** Maximum request body size in bytes (defaults to `MAX_ENVELOPE_BYTES`). */
  maxBytes?: number;
  /** Client body read timeout in milliseconds (defaults to `BODY_READ_TIMEOUT_MS`). */
  bodyReadTimeoutMs?: number;
  /** Upstream Sentry ingest timeout in milliseconds (defaults to `FORWARD_TIMEOUT_MS`). */
  forwardTimeoutMs?: number;
  /** Custom `fetch` implementation for testing. */
  fetchImpl?: typeof fetch;
}

type BodyReadResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; response: Response };

/**
 * Reads the request body into a single `Uint8Array` with an explicit byte limit and timeout.
 * Never drains an aborted or stalled stream on cancellation.
 */
async function readBoundedEnvelopeBody(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<BodyReadResult> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
      return { ok: false, response: new Response('Length required', { status: 411 }) };
    }
    if (declaredLength > maxBytes) {
      return { ok: false, response: new Response('Payload too large', { status: 413 }) };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, response: new Response('Invalid envelope', { status: 400 }) };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const step = await Promise.race([
        reader.read().then((res) => ({ timedOut: false as const, res })),
        timeoutPromise,
      ]);

      if (step.timedOut) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, response: new Response('Request body timeout', { status: 408 }) };
      }

      const { done, value } = step.res;
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, response: new Response('Payload too large', { status: 413 }) };
      }

      chunks.push(value);
    }
  } catch {
    void reader.cancel().catch(() => undefined);
    return { ok: false, response: new Response('Invalid envelope', { status: 400 }) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (totalBytes === 0) {
    return { ok: false, response: new Response('Invalid envelope', { status: 400 }) };
  }

  const merged = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes: merged };
}

/**
 * Extracts and validates the envelope header line (first line before `\n`) and resolves the
 * authorized Sentry ingest URL.
 */
function resolveEnvelopeIngestUrl(
  body: Uint8Array,
  allowedMap: ReadonlyMap<string, string>,
): { ok: true; ingestUrl: string } | { ok: false; response: Response } {
  const searchLimit = Math.min(body.byteLength, MAX_ENVELOPE_HEADER_BYTES + 1);
  let newlineIndex = -1;
  for (let i = 0; i < searchLimit; i += 1) {
    if (body[i] === 0x0a) {
      newlineIndex = i;
      break;
    }
  }

  const headerEnd = newlineIndex === -1 ? body.byteLength : newlineIndex;
  if (headerEnd === 0 || headerEnd > MAX_ENVELOPE_HEADER_BYTES) {
    return { ok: false, response: new Response('Invalid envelope', { status: 400 }) };
  }

  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(body.subarray(0, headerEnd)));
  } catch {
    return { ok: false, response: new Response('Invalid envelope', { status: 400 }) };
  }

  if (!header || typeof header !== 'object') {
    return {
      ok: false,
      response: new Response('Invalid envelope: missing header', { status: 400 }),
    };
  }

  const dsn = (header as { dsn?: unknown }).dsn;
  if (!dsn || typeof dsn !== 'string') {
    return {
      ok: false,
      response: new Response('Invalid envelope: missing DSN', { status: 400 }),
    };
  }

  const parsedDsn = parseSentryDsn(dsn);
  if (!parsedDsn) {
    return { ok: false, response: new Response('Invalid DSN', { status: 403 }) };
  }

  const ingestUrl = allowedMap.get(parsedDsn.canonical);
  if (!ingestUrl) {
    return { ok: false, response: new Response('DSN not allowed', { status: 403 }) };
  }

  return { ok: true, ingestUrl };
}

function buildForwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-sentry-envelope',
  };

  const clientIp = FORWARDED_CLIENT_IP_HEADERS.map((name) => request.headers.get(name)).find(
    (value): value is string => Boolean(value),
  );
  if (clientIp) {
    headers['X-Sentry-Forwarded-For'] = clientIp;
  }

  for (const name of [...FORWARDED_CLIENT_IP_HEADERS, ...FORWARDED_CLIENT_HEADERS]) {
    const value = request.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }

  return headers;
}

function pickUpstreamResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

/**
 * Validates and forwards a Sentry envelope POST request to Sentry's ingestion API with strict
 * client-read and upstream timeouts.
 */
export async function forwardSentryTunnelRequest(
  request: Request,
  options: SentryTunnelOptions = {},
): Promise<Response> {
  const rawAllowedDsns = options.allowedDsns ?? [process.env.NEXT_PUBLIC_SENTRY_DSN];
  const allowedMap = new Map<string, string>();
  for (const candidate of rawAllowedDsns) {
    const parsed = parseSentryDsn(candidate);
    if (parsed) {
      allowedMap.set(parsed.canonical, parsed.ingestUrl);
    }
  }

  if (allowedMap.size === 0) {
    return new Response('Tunnel not configured', { status: 500 });
  }

  const maxBytes = options.maxBytes ?? MAX_ENVELOPE_BYTES;
  const bodyReadTimeoutMs = options.bodyReadTimeoutMs ?? BODY_READ_TIMEOUT_MS;
  const forwardTimeoutMs = options.forwardTimeoutMs ?? FORWARD_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  const bodyResult = await readBoundedEnvelopeBody(request, maxBytes, bodyReadTimeoutMs);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const targetResult = resolveEnvelopeIngestUrl(bodyResult.bytes, allowedMap);
  if (!targetResult.ok) {
    return targetResult.response;
  }

  try {
    const upstream = await suppressTracing(() =>
      fetchImpl(targetResult.ingestUrl, {
        method: 'POST',
        headers: buildForwardHeaders(request),
        body: bodyResult.bytes,
        signal: AbortSignal.timeout(forwardTimeoutMs),
      }),
    );

    const responseBody = await upstream.arrayBuffer().catch(() => new ArrayBuffer(0));
    return new Response(responseBody, {
      status: upstream.status,
      headers: pickUpstreamResponseHeaders(upstream),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return new Response(
      isTimeout ? 'Sentry ingest timeout' : 'Failed to forward envelope to Sentry',
      { status: isTimeout ? 504 : 502 },
    );
  }
}
