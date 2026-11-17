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

/** Shared browser-safe JSON transport. No retry layer or server-only dependencies. */

/** How long one poll may take, body included, before it is aborted. */
const LIVE_FETCH_TIMEOUT_MS = 5_000;

/** The endpoint answered with a status outside 200-299. */
export class FetchStatusError extends Error {
  override readonly name = 'FetchStatusError';

  constructor(readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

/** The endpoint did not answer (body included) within the timeout. */
export class FetchTimeoutError extends Error {
  override readonly name = 'FetchTimeoutError';

  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
  }
}

interface JsonResponse {
  readonly json: unknown;
  readonly headers: Headers;
}

export interface FetchJsonOptions {
  /** TanStack Query's signal: aborting it (a cancelled query) aborts the request. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Lets go of a body nobody will read. Left alone, the browser keeps the response stream open:
 * the page never reaches network idle and, on HTTP/1.1, every failed poll holds one of the
 * origin's six connections. A cancel that fails changes nothing for the caller, whose error is
 * the status, so its rejection is dropped here on purpose.
 */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already locked or errored: there is nothing left to release.
  }
}

/**
 * GETs `url` and resolves its JSON body.
 *
 * @throws {FetchStatusError} For a non-2xx answer, carrying its status (its body is cancelled).
 * @throws {FetchTimeoutError} When the answer or its body takes longer than `timeoutMs`.
 * @throws The caller's abort reason when `signal` aborts, and a SyntaxError for a non-JSON body.
 */
export async function fetchJsonResponse(
  url: string,
  { signal, timeoutMs = LIVE_FETCH_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<JsonResponse> {
  const controller = new AbortController();
  const abortWithCaller = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) abortWithCaller();
  signal?.addEventListener('abort', abortWithCaller, { once: true });
  const timer = setTimeout(() => controller.abort(new FetchTimeoutError(timeoutMs)), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      await discardBody(response);
      throw new FetchStatusError(response.status);
    }
    const json: unknown = await response.json();
    return { json, headers: response.headers };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortWithCaller);
  }
}
