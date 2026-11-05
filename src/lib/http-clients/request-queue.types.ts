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
 * A request in flight that concurrent identical calls share.
 */
export interface PendingRequest<T> {
  /** Settles when the request does; every sharing caller gets this same promise. */
  readonly promise: Promise<T>;
  /** When the request started (ms since epoch), to stop sharing one that never settles. */
  readonly startedAt: number;
}

/**
 * Options for `requestQueue.enqueue`.
 */
export interface EnqueueOptions {
  /** Request body; calls with different bodies are never shared. */
  readonly body?: unknown;
  /** Request headers; calls whose Authorization or Content-Type differ are never shared. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Always run this call on its own, even when an identical one is in flight. */
  readonly bypassDeduplication?: boolean;
}
