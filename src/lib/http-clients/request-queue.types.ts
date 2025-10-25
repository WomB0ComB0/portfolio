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
 * Represents a pending request in the queue
 */
export interface PendingRequest<T> {
  /** Promise that resolves when the request completes */
  promise: Promise<T>;
  /** Timestamp when the request was queued */
  timestamp: number;
  /** Number of consumers waiting for this request */
  refCount: number;
}

/**
 * Configuration for rate limiting per endpoint
 */
export interface RateLimitConfig {
  /** Minimum time (ms) between requests to the same endpoint */
  minInterval: number;
  /** Maximum number of requests per time window */
  maxRequests: number;
  /** Time window (ms) for maxRequests */
  windowMs: number;
}

/**
 * Tracks request timing for rate limiting
 */
export interface RequestTiming {
  /** Last request timestamp */
  lastRequest: number;
  /** Request timestamps within current window */
  requests: number[];
}
