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

/** Per-request timeout for every server-side Sanity client. */
export const SERVER_SANITY_TIMEOUT_MS = 4_000;

/** One retry keeps the worst case (two attempts) near 8 s. */
export const SERVER_SANITY_MAX_RETRIES = 1;

/**
 * Request limits for the server's Sanity client. A hanging Sanity must fail fast enough for the
 * API's stale-or-503 path to answer before the browser gives up (10 s); the client's own default
 * is a long timeout with 5 retries.
 */
export const SERVER_SANITY_REQUEST_LIMITS = {
  timeout: SERVER_SANITY_TIMEOUT_MS,
  maxRetries: SERVER_SANITY_MAX_RETRIES,
} as const;

/** Request limits for one Sanity client: the server's, or none (the client's own defaults). */
export type SanityRequestLimits = Partial<typeof SERVER_SANITY_REQUEST_LIMITS>;

/**
 * The request limits for a Sanity client created in this context. Every server-side client gets
 * {@link SERVER_SANITY_REQUEST_LIMITS}, with or without SANITY_API_TOKEN; the browser's client keeps
 * the defaults, since the browser never answers for the API's stale-or-503 path.
 *
 * @param inBrowser - Whether the client is created in a browser.
 */
export const sanityRequestLimits = (inBrowser: boolean): SanityRequestLimits =>
  inBrowser ? {} : SERVER_SANITY_REQUEST_LIMITS;
