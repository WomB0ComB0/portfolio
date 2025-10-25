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

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

export interface SWROptions<T = any> {
  /**
   * Time in ms before data is considered stale
   * @default 3600000 (1 hour)
   */
  ttl?: number;
  /**
   * Time in ms before cache entry expires completely
   * @default 86400000 (24 hours)
   */
  maxAge?: number;
  /**
   * Whether to serve stale data while revalidating
   * @default true
   */
  serveStale?: boolean;
  /**
   * Called when fresh data is successfully fetched
   */
  onSuccess?: (data: T) => void;
  /**
   * Called when background revalidation fails
   */
  onError?: (error: Error) => void;
}
