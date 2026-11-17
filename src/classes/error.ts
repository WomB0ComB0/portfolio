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

import type { ParseResult } from 'effect';
import { Data } from 'effect';

/**
 * Represents a base error class with enhanced error reporting capabilities.
 *
 * This class extends Effect's `Data.TaggedError` to provide a structured approach
 * to error handling with rich context, making errors easier to track, debug, and
 * handle throughout your application.
 *
 * @class BaseError
 * @extends {Data.TaggedError<"BaseError">}
 *
 * @property {Error} cause - The original error that triggered this error
 * @property {string} command - The command or operation identifier
 * @property {ParseResult.ParseError} [parseResult] - Optional parsing error from Effect schemas
 * @property {Record<string, unknown>} [metadata] - Additional contextual data
 * @property {number} timestamp - When the error was created (milliseconds since epoch)
 * @property {string} name - The error name (defaults to the tag value)
 * @property {string} _tag - Discriminator for tagged unions ("BaseError")
 *
 * @example
 * // Basic usage
 * try {
 *   await database.query('SELECT * FROM users');
 * } catch (error) {
 *   throw new BaseError(error as Error, 'database:query');
 * }
 *
 * @example
 * // With metadata
 * try {
 *   const result = await apiCall();
 * } catch (error) {
 *   throw new BaseError(error as Error, 'api:fetch', {
 *     endpoint: '/users',
 *     method: 'GET'
 *   });
 * }
 *
 * @example
 * // Error handling
 * try {
 *   performOperation();
 * } catch (error) {
 *   if (error instanceof BaseError) {
 *     console.error(`Failed at: ${error.command}`);
 *     console.error(`Root cause: ${error.cause.message}`);
 *     console.error(`Metadata:`, error.metadata);
 *   }
 * }
 */
export class BaseError extends Data.TaggedError<'BaseError'>('BaseError')<{
  /** `<command>: <cause message>`, so logs and Sentry issue titles say what failed. */
  message: string;
  cause: Error;
  command: string;
  parseResult?: ParseResult.ParseError;
  metadata?: Record<string, unknown>;
  timestamp: number;
}> {
  /**
   * Creates a new BaseError instance.
   *
   * @constructor
   * @param {Error} cause - The original error that caused this error
   * @param {string} command - The command identifier for context (e.g., "user:create", "database:connect")
   * @param {Record<string, unknown>} [metadata={}] - Optional additional context information
   *
   * @example
   * // Simple error
   * const error = new BaseError(
   *   new Error('Connection refused'),
   *   'database:connect'
   * );
   *
   * @example
   * // With metadata
   * const error = new BaseError(
   *   new Error('Not found'),
   *   'user:fetch',
   *   { userId: '123', attempted: true }
   * );
   */
  constructor(cause: Error, command: string, metadata: Record<string, unknown> = {}) {
    super({
      message: cause.message ? `${command}: ${cause.message}` : command,
      cause,
      command,
      metadata,
      timestamp: Date.now(),
    });
    this.name = this._tag;
  }

  /**
   * Converts the error to a human-readable string representation.
   *
   * This method formats the error with its name, message, command context,
   * and timestamp for easy console logging and debugging.
   *
   * @returns {string} A formatted error string
   *
   * @example
   * const error = new BaseError(
   *   new Error('Timeout'),
   *   'api:request'
   * );
   * console.log(error.toString());
   * // Output:
   * // BaseError: Timeout (Command: api:request)
   * // Timestamp: 2025-10-13T...
   */
  public toString(): string {
    const date = new Date(this.timestamp).toISOString();
    return `
${this.name}: ${this.cause.message} (Command: ${this.command})
Timestamp: ${date}${
      this.metadata && Object.keys(this.metadata).length > 0
        ? `
Metadata: ${JSON.stringify(this.metadata, null, 2)}`
        : ''
    }
    `.trim();
  }

  /**
   * Serializes the error to a JSON-compatible object.
   *
   * This method is useful for logging, API responses, and error tracking services.
   * It provides a structured representation of all error properties.
   *
   * @returns {object} A JSON-serializable object containing all error details
   * @returns {string} return.name - The error name
   * @returns {string} return.message - The error message
   * @returns {string} return.command - The command identifier
   * @returns {object} return.cause - The original error (serialized)
   * @returns {ParseResult.ParseError} [return.parseResult] - Parse error details if available
   * @returns {Record<string, unknown>} [return.metadata] - Additional context
   * @returns {number} return.timestamp - When the error occurred
   * @returns {string} [return.stack] - Stack trace from the original error
   *
   * @example
   * const error = new BaseError(
   *   new Error('Invalid input'),
   *   'validation:check',
   *   { field: 'email' }
   * );
   *
   * const json = error.toJSON();
   * console.log(JSON.stringify(json, null, 2));
   * // {
   * //   "name": "BaseError",
   * //   "message": "Invalid input",
   * //   "command": "validation:check",
   * //   "metadata": { "field": "email" },
   * //   "timestamp": 1697203200000,
   * //   ...
   * // }
   */
  public toJSON(): {
    name: string;
    message: string;
    command: string;
    cause: {
      name: string;
      message: string;
      stack?: string;
    };
    parseResult?: ParseResult.ParseError;
    metadata?: Record<string, unknown>;
    timestamp: number;
    stack?: string;
  } {
    return {
      name: this.name,
      message: this.cause.message,
      command: this.command,
      cause: {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      },
      parseResult: this.parseResult,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.cause.stack,
    };
  }

  /**
   * Custom Node.js inspection method for better console output.
   *
   * This method is automatically called by Node.js utilities like `console.log`
   * and provides a formatted representation of the error.
   *
   * @returns {string} The string representation of the error
   *
   * @example
   * const error = new BaseError(
   *   new Error('Failed'),
   *   'operation:execute'
   * );
   *
   * console.log(error); // Automatically uses this method
   * // Output: BaseError: Failed (Command: operation:execute)...
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }

  /**
   * Returns a string representation for string coercion.
   * Called when the error is coerced to a string (e.g., `String(error)` or template literals).
   *
   * @returns {string} The string representation of the error
   *
   * @example
   * const error = new BaseError(new Error('Failed'), 'operation');
   * console.log(`Error occurred: ${error}`); // Uses Symbol.toStringTag
   * console.log(String(error)); // Also uses this method
   */
  [Symbol.toStringTag]: string = this.name;

  /**
   * Returns a primitive value representation of the error.
   * This is called during type coercion operations.
   *
   * @param {string} hint - The type of primitive to return ('string', 'number', or 'default')
   * @returns {string | number} The primitive representation
   *
   * @example
   * const error = new BaseError(new Error('Failed'), 'operation');
   * console.log(error + ''); // String coercion
   * console.log(`${error}`); // Template literal coercion
   */
  [Symbol.toPrimitive](hint: 'string' | 'number' | 'default'): string | number {
    if (hint === 'number') {
      return this.timestamp;
    }
    return this.toString();
  }
  /**
   * Custom Deno inspection method for better console output in Deno environment.
   * This method is automatically called by Deno utilities like `console.log`
   *
   * @returns {string} The string representation of the error
   */
  [Symbol.for('Deno.customInspect')](): string {
    return this.toString();
  }

  /**
   * Custom React element inspection method for better console output in React environment.
   * This method is automatically called by React utilities like `console.log`
   *
   * @returns {string} The string representation of the error
   */
  [Symbol.for('react.element')](): string {
    return this.toString();
  }
}

/**
 * Type guard to check if an error is a BaseError instance.
 *
 * @param {unknown} error - The error to check
 * @returns {error is BaseError} True if the error is a BaseError
 *
 * @example
 * try {
 *   performOperation();
 * } catch (error) {
 *   if (isBaseError(error)) {
 *     console.log(error.command);
 *     console.log(error.metadata);
 *   } else {
 *     console.log('Unknown error type');
 *   }
 * }
 */
export const isBaseError = (error: unknown): error is BaseError => {
  return error instanceof BaseError;
};

/**
 * Wraps an unknown error in a BaseError if it isn't already one.
 *
 * @param {unknown} error - The error to wrap
 * @param {string} command - The command identifier
 * @param {Record<string, unknown>} [metadata] - Optional metadata
 * @returns {BaseError} A BaseError instance
 *
 * @example
 * try {
 *   await externalLibraryCall();
 * } catch (error) {
 *   throw ensureBaseError(error, 'external:call', {
 *     library: 'external-lib'
 *   });
 * }
 *
 * @example
 * // In a catch-all handler
 * app.use((error: unknown, req, res, next) => {
 *   const baseError = ensureBaseError(error, 'http:request', {
 *     path: req.path,
 *     method: req.method
 *   });
 *
 *   res.status(500).json(baseError.toJSON());
 * });
 */
export const ensureBaseError = (
  error: unknown,
  command: string,
  metadata?: Record<string, unknown>,
): BaseError => {
  if (isBaseError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError(error, command, metadata);
  }

  // Handle non-Error objects
  return new BaseError(new Error(String(error)), command, metadata);
};
/**
 * Re-export Effect types for convenience.
 */
export type { ParseResult } from 'effect';
