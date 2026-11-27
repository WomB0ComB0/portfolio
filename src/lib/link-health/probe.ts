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

import 'server-only';

import { type PublicAddress, probeHostname, publicAddress, publicHostname } from './ip-policy';
import { canWarnForLink } from './public-warning';
import { resolveHostAddresses } from './resolve';
import { type ProbeHeaders, type ProbeRequest, requestPinned } from './transport';
import type { LinkObservation } from './types';
import { normalizeLinkUrl } from './url';

const DEADLINE_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_DNS_ANSWERS = 16;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const missing = (status: number): boolean => status === 404 || status === 410;

export interface ProbeDependencies {
  readonly resolve: (hostname: string, signal: AbortSignal) => Promise<readonly string[]>;
  readonly request: (target: ProbeRequest) => Promise<ProbeHeaders>;
}

/** What one probe's caller can ask of it. */
export interface ProbeOptions {
  /**
   * Asked about each redirect target (its canonical URL) before it is requested. When it answers
   * false the probe stops there without requesting it, and its observation reports the refused
   * redirect. Left out, every safe redirect is followed.
   */
  readonly shouldFollowRedirect?: (targetUrl: string) => boolean;
}

/** A probe's observation; `refusedRedirect` is set only when shouldFollowRedirect refused a hop. */
export interface ProbeObservation extends LinkObservation {
  readonly refusedRedirect?: true;
}

/** A link probe: one observation of `input`, under the caller's options. */
export type LinkProbe = (input: string, options?: ProbeOptions) => Promise<ProbeObservation>;

/**
 * Resolves `hostname` once and vets every answer: a public literal passes as is; otherwise at most
 * 16 answers, all public (ip-policy.ts), IPv4 preferred. Null when any answer is not public (or
 * there are too many); throws when DNS has no answer. The caller connects only to the result.
 */
export async function resolvePublicAddress(
  hostname: string,
  deps: Pick<ProbeDependencies, 'resolve'>,
  signal: AbortSignal,
): Promise<PublicAddress | null> {
  const literal = publicAddress(hostname);
  if (literal) return literal;
  const answers = await deps.resolve(hostname, signal);
  signal.throwIfAborted();
  if (answers.length === 0) throw new Error('No link check address');
  if (answers.length > MAX_DNS_ANSWERS) return null;
  const addresses = answers.map(publicAddress);
  if (addresses.some((address) => address === null)) return null;
  return addresses.find((address) => address?.family === 4) ?? addresses[0] ?? null;
}

function redirectTo(location: string | undefined, current: URL): URL | null {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: a redirect must not smuggle parser-stripped controls or backslashes.
  if (!location || location.length > 2048 || /[\u0000-\u001f\u007f\\]/u.test(location)) return null;
  try {
    const canonical = normalizeLinkUrl(new URL(location, current).href);
    if (!canonical) return null;
    const next = new URL(canonical);
    return current.protocol === 'https:' && next.protocol !== 'https:' ? null : next;
  } catch {
    return null;
  }
}

function classify(status: number): LinkObservation {
  if (!Number.isInteger(status) || status < 100 || status > 599) return { kind: 'unknown' };
  const kind =
    status >= 200 && status < 300
      ? 'reachable'
      : missing(status)
        ? 'missing'
        : status === 408 || status >= 500
          ? 'temporary'
          : 'unknown';
  return { kind, httpStatus: status };
}

async function observe(
  initial: URL,
  deps: ProbeDependencies,
  signal: AbortSignal,
  assertActive: () => void,
  shouldFollowRedirect: (targetUrl: string) => boolean,
): Promise<ProbeObservation> {
  let url = initial;
  let method: ProbeRequest['method'] = 'HEAD';
  let redirects = 0;
  let missingIsConclusive = canWarnForLink(initial.href);
  const visited = new Set<string>();
  for (;;) {
    assertActive();
    const key = `${method} ${url.href}`;
    if (visited.has(key)) return { kind: 'unknown' };
    visited.add(key);
    const hostname = probeHostname(url);
    if (!publicHostname(hostname)) return { kind: 'unknown' };
    const address = await resolvePublicAddress(hostname, deps, signal);
    assertActive();
    if (!address) return { kind: 'unknown' };
    const response = await deps.request({ url, address, method, signal });
    assertActive();
    if (REDIRECTS.has(response.status)) {
      const next = redirectTo(response.location, url);
      if (!next) return { kind: 'unknown' };
      // The caller's refusal is known without a request, so it is asked before the redirect cap.
      if (!shouldFollowRedirect(next.href)) return { kind: 'unknown', refusedRedirect: true };
      if (redirects >= MAX_REDIRECTS) return { kind: 'unknown' };
      redirects++;
      url = next;
      missingIsConclusive = missingIsConclusive && canWarnForLink(next.href);
      continue;
    }
    // A broken HEAD implementation must not label a working GET destination unavailable.
    if (
      method === 'HEAD' &&
      (missing(response.status) || response.status === 405 || response.status >= 500)
    ) {
      method = 'GET';
      continue;
    }
    if (missing(response.status) && !missingIsConclusive)
      return { kind: 'unknown', httpStatus: response.status };
    return classify(response.status);
  }
}

/**
 * One deadline covers DNS, all redirects and HEAD→GET. Late DNS cannot start a late request. A
 * redirect target the caller's shouldFollowRedirect refuses is never requested.
 */
export function createLinkProbe(deps: ProbeDependencies): LinkProbe {
  return async (input, options = {}) => {
    const canonical = normalizeLinkUrl(input);
    if (!canonical) return { kind: 'unknown' };
    const controller = new AbortController();
    const deadlineAt = performance.now() + DEADLINE_MS;
    // A paused event loop may resume an I/O callback before processing the expired timer.
    const assertActive = (): void => {
      if (performance.now() >= deadlineAt) controller.abort();
      controller.signal.throwIfAborted();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<LinkObservation>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ kind: 'temporary' });
      }, DEADLINE_MS);
    });
    try {
      return await Promise.race([
        observe(
          new URL(canonical),
          deps,
          controller.signal,
          assertActive,
          options.shouldFollowRedirect ?? (() => true),
        ),
        deadline,
      ]);
    } catch {
      return { kind: 'temporary' };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
}

export const probeLink = createLinkProbe({
  resolve: resolveHostAddresses,
  request: requestPinned,
});
