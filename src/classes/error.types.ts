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
 * Configuration options for BaseError instances.
 *
 * @interface BaseErrorOptions
 * @property {Error} cause - The original error that caused this error
 * @property {string} command - The command identifier that was being executed
 * @property {ParseResult.ParseError} [parseResult] - Optional Effect parsing error details
 * @property {Record<string, unknown>} [metadata] - Additional contextual information
 * @property {number} [timestamp] - When the error occurred (milliseconds since epoch)
 */
export interface BaseErrorOptions {
  cause: Error;
  command: string;
  parseResult?: import('effect').ParseResult.ParseError;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Options for error aggregation.
 *
 * @interface AggregateErrorOptions
 * @property {string} command - The command identifier for the aggregate error
 * @property {string} [message] - Optional custom message (defaults to error count)
 * @property {Record<string, unknown>} [metadata] - Optional metadata
 */
export interface AggregateErrorOptions {
  command: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
