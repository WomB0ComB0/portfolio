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
 * @interface ApiTestResult
 * @description Represents the structured result of an API endpoint test,
 * including status, success, response data, and response time.
 * @author Mike Odnis
 * @since 1.0.0
 * @version 1.0.0
 */
export interface ApiTestResult {
  /**
   * @readonly
   * @type {string}
   * The API endpoint that was tested.
   */
  readonly endpoint: string;
  /**
   * @readonly
   * @type {number}
   * The HTTP status code of the response. Will be 0 if a network error occurred.
   */
  readonly status: number;
  /**
   * @readonly
   * @type {boolean}
   * Indicates if the request was successful (HTTP status 2xx).
   */
  readonly success: boolean;
  /**
   * @readonly
   * @type {unknown}
   * The parsed response data (JSON or text). Undefined if an error occurred before parsing.
   */
  readonly data?: unknown;
  /**
   * @readonly
   * @type {string}
   * An error message if the fetch operation failed (e.g., network error).
   */
  readonly error?: string;
  /**
   * @readonly
   * @type {number}
   * The time taken for the API call to complete in milliseconds.
   */
  readonly responseTime: number;
}
