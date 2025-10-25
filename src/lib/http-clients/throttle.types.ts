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
 * @fileoverview Throttle and debounce utilities for rate limiting
 *
 * Provides functions to limit the rate at which functions can be called.
 * Useful for preventing excessive API calls and managing request frequency.
 */
/**
 * Throttle options
 */
export interface ThrottleOptions {
  /** Whether to call the function on the leading edge */
  leading?: boolean;
  /** Whether to call the function on the trailing edge */
  trailing?: boolean;
}

/**
 * Debounce options
 */
export interface DebounceOptions {
  /** Whether to call the function on the leading edge */
  leading?: boolean;
  /** Maximum time to wait before forcing execution */
  maxWait?: number;
}
