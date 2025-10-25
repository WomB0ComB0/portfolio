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
 * Represents the detailed result of an API endpoint test.
 * @interface TestResult
 * @property {string} endpoint - The path of the API endpoint tested (e.g., '/api/v1/now-playing').
 * @property {'GET' | 'POST'} method - The HTTP method used for the request (e.g., 'GET', 'POST').
 * @property {number} status - The HTTP status code of the response (e.g., 200, 404).
 * @property {string} statusText - The HTTP status text of the response (e.g., 'OK', 'Not Found').
 * @property {boolean} success - Indicates whether the request was successful (HTTP status 2xx).
 * @property {number} responseTime - The time taken for the request to complete in milliseconds.
 * @property {unknown} [data] - The parsed response body. Can be JSON object or raw text.
 * @property {string} [error] - An error message if the request failed at the network level or encountered an exception.
 * @property {Record<string, string>} [headers] - A dictionary of response headers.
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  success: boolean;
  responseTime: number;
  data?: unknown;
  error?: string;
  headers?: Record<string, string>;
}
