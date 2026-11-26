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

import 'server-only';

/**
 * @file The DNS-pinned fetch the verify sweep inspects pages with (inspectFinalTarget in sweep.ts),
 * built on link-health's probe pieces rather than a second HTTP stack. Each call is one hop: it
 * resolves the host once, refuses the request when any answer is private, loopback, link-local,
 * unique-local, CGNAT, multicast, IPv4-mapped private or a cloud metadata address (ip-policy.ts),
 * and connects only to the address it vetted (transport.ts requestPinnedResponse), so a name
 * cannot rebind between the check and the connection. It never follows a redirect: the caller
 * vets the next hop and calls again. A refused target throws UnsafeTargetError. Guarded by
 * tests/unit/free-books/pinned-fetch.test.ts.
 */

import { probeHostname, publicHostname } from '@/lib/link-health/ip-policy';
import { type ProbeDependencies, resolvePublicAddress } from '@/lib/link-health/probe';
import { resolveHostAddresses } from '@/lib/link-health/resolve';
import {
  type PinnedGetRequest,
  type PinnedResponse,
  requestPinnedResponse,
} from '@/lib/link-health/transport';
import { normalizeLinkUrl } from '@/lib/link-health/url';
import type { FetchLike } from './types';

/** A request with no signal of its own gives up after this long. */
const DEFAULT_TIMEOUT_MS = 10_000;
/** Statuses a fetch Response carries with no body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** A request refused because its host is, or resolves to, an address that is not public. */
export class UnsafeTargetError extends Error {
  readonly hostname: string;

  constructor(hostname: string) {
    super(`refused to connect to ${hostname}: it is not a public address`);
    this.name = 'UnsafeTargetError';
    this.hostname = hostname;
  }
}

/** DNS and the transport, injected so tests never touch real DNS or sockets. */
export interface PinnedFetchDependencies {
  readonly resolve: ProbeDependencies['resolve'];
  readonly request: (target: PinnedGetRequest) => Promise<PinnedResponse>;
}

/** The host of a URL that failed the canonical check, for the error; never used to connect. */
function hostForError(raw: string): string {
  try {
    return new URL(raw).hostname || raw;
  } catch {
    return raw;
  }
}

/** Refuses anything but one GET with no body that leaves redirects to the caller. */
function assertSingleManualGet(input: string | URL | Request, init: RequestInit): string {
  if (typeof input !== 'string' && !(input instanceof URL)) {
    throw new TypeError('pinnedFetch takes a URL, not a Request');
  }
  if ((init.method ?? 'GET').toUpperCase() !== 'GET' || init.body != null) {
    throw new TypeError('pinnedFetch only sends a GET with no body');
  }
  if (init.redirect !== 'manual') {
    throw new TypeError('pinnedFetch never follows redirects; pass redirect: "manual"');
  }
  return typeof input === 'string' ? input : input.href;
}

/** The transport's answer as a fetch Response; a status no Response can carry is refused. */
function toResponse({ status, headers, body }: PinnedResponse): Response {
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    void body.cancel().catch(() => undefined);
    throw new Error(`unexpected HTTP status ${status}`);
  }
  const responseHeaders = new Headers();
  if (headers.contentType) responseHeaders.set('content-type', headers.contentType);
  if (headers.contentDisposition) {
    responseHeaders.set('content-disposition', headers.contentDisposition);
  }
  if (headers.location) responseHeaders.set('location', headers.location);
  if (NULL_BODY_STATUSES.has(status)) {
    void body.cancel().catch(() => undefined);
    return new Response(null, { status, headers: responseHeaders });
  }
  return new Response(body, { status, headers: responseHeaders });
}

/**
 * A FetchLike that makes one DNS-pinned GET per call. A host that is, or resolves to, anything
 * but public unicast throws UnsafeTargetError before any connection; a name with no answer
 * throws a plain error (a network failure, not an unsafe target).
 */
export function createPinnedFetch(deps: PinnedFetchDependencies): FetchLike {
  return async (input, init = {}) => {
    const raw = assertSingleManualGet(input, init);
    const canonical = normalizeLinkUrl(raw);
    if (!canonical) throw new UnsafeTargetError(hostForError(raw));
    const url = new URL(canonical);
    const hostname = probeHostname(url);
    if (!publicHostname(hostname)) throw new UnsafeTargetError(hostname);

    const signal = init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    signal.throwIfAborted();
    const address = await resolvePublicAddress(hostname, deps, signal);
    if (!address) throw new UnsafeTargetError(hostname);

    const headers = new Headers(init.headers);
    const range = headers.get('range');
    const userAgent = headers.get('user-agent');
    const response = await deps.request({
      url,
      address,
      signal,
      ...(range === null ? {} : { range }),
      ...(userAgent === null ? {} : { userAgent }),
    });
    return toResponse(response);
  };
}

/** The pinned fetch on real DNS (link-health's cancellable resolver) and the real transport. */
export const pinnedFetch: FetchLike = createPinnedFetch({
  resolve: resolveHostAddresses,
  request: requestPinnedResponse,
});
