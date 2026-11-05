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
 * @fileoverview In-flight request sharing for browser fetches.
 *
 * In the browser, concurrent identical calls (same method, URL, body, Authorization and
 * Content-Type) share one request until it settles. Nothing is kept after that: TanStack Query
 * stays the only response cache.
 *
 * On the server the queue steps aside and runs every request directly. One server instance
 * renders pages for many visitors at once, so any state here would make one visitor wait on, or
 * receive, another visitor's request. (It did: a per-instance cap of 5 /api/v1/sanity calls a
 * minute held SSR streams open for up to a minute after a small burst of traffic.)
 *
 * There is no rate limit in the browser either. The old per-minute caps counted per tab and per
 * URL, so they protected nothing upstream: Sanity, GitHub and Spotify are called by our API,
 * which has its own guard and CDN caching. All they did was stall a visitor who returned to a
 * page within a minute behind the full-screen loader, for up to a minute. A 429 from our API
 * still reaches the caller as an error.
 */

import { logger } from '@/utils';
import type { EnqueueOptions, PendingRequest } from './request-queue.types';

/** A shared request older than this is treated as hung, and new callers get a fresh one. */
export const REQUEST_QUEUE_STALE_MS = 5 * 60_000;

/** Headers whose value changes the response, so calls that differ in them are never shared. */
const RESPONSE_HEADERS = ['authorization', 'content-type'] as const;

/** True during SSR and in route handlers, where `window` is undefined. */
const isServer = (): boolean => globalThis.window === undefined;

/** The value of header `name` (lower case), matched case-insensitively. */
const headerValue = (
  headers: EnqueueOptions['headers'],
  name: (typeof RESPONSE_HEADERS)[number],
): string | undefined => {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
};

/** Identifies calls that may share one request. */
const requestKey = (url: string, method: string, options?: EnqueueOptions): string =>
  JSON.stringify([
    method.toUpperCase(),
    url,
    options?.body ?? null,
    ...RESPONSE_HEADERS.map((name) => headerValue(options?.headers, name) ?? null),
  ]);

/** Runs `executor`, turning a synchronous throw into a rejected promise. */
const start = <T>(executor: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve) => {
    resolve(executor());
  });

class RequestQueueManager {
  /** Requests in flight in this browser tab, by request key. Always empty on the server. */
  private readonly inFlight = new Map<string, PendingRequest<unknown>>();

  /**
   * Runs `executor`, or, in the browser, joins an identical call already in flight.
   *
   * @param url Request URL; part of the sharing key.
   * @param method HTTP method; part of the sharing key.
   * @param executor Performs the request. Called at most once per shared request.
   * @param options Body and headers for the key, or `bypassDeduplication` to always run alone.
   */
  public enqueue<T>(
    url: string,
    method: string,
    executor: () => Promise<T>,
    options?: EnqueueOptions,
  ): Promise<T> {
    if (isServer() || options?.bypassDeduplication) return start(executor);

    const key = requestKey(url, method, options);
    const shared = this.liveRequest(key, url);
    if (shared) {
      logger.debug(`[RequestQueue] Sharing the in-flight request to ${url}`);
      return shared.promise as Promise<T>;
    }
    return this.track(key, start(executor));
  }

  /** The in-flight request for `key`, unless it is missing or stale. */
  private liveRequest(key: string, url: string): PendingRequest<unknown> | undefined {
    const pending = this.inFlight.get(key);
    if (!pending) return undefined;
    if (Date.now() - pending.startedAt < REQUEST_QUEUE_STALE_MS) return pending;

    this.inFlight.delete(key);
    logger.warn(`[RequestQueue] Stopped sharing a request that never settled: ${url}`);
    return undefined;
  }

  /** Shares `request` under `key` until it settles. */
  private track<T>(key: string, request: Promise<T>): Promise<T> {
    const promise = request.finally(() => {
      // A stale request settling late must not remove the fresh one that replaced it.
      if (this.inFlight.get(key)?.promise === promise) this.inFlight.delete(key);
    });
    this.inFlight.set(key, { promise, startedAt: Date.now() });
    return promise;
  }
}

/** The page-wide queue. Use `enqueue`; it runs every request directly on the server. */
export const requestQueue = new RequestQueueManager();
