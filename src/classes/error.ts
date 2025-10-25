import type { AggregateErrorOptions } from './error.types';
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

  /**
   * Returns an array of key-value pairs representing error properties.
   * Useful for destructuring or iterating over error details.
   *
   * @returns {Array<[string, any]>} Key-value pairs of error properties
   *
   * @example
   * const error = new BaseError(new Error('Failed'), 'operation', { userId: '123' });
   *
   * // Using entries method
   * for (const [key, value] of error.entries()) {
   *   console.log(`${key}: ${value}`);
   * }
   *
   * // Using spread with entries
   * const entries = [...error.entries()];
   * console.log(entries);
   *
   * // Using Map constructor
   * const errorMap = new Map(error.entries());
   */
  public entries(): Array<[string, any]> {
    const result: Array<[string, any]> = [
      ['name', this.name],
      ['message', this.cause.message],
      ['command', this.command],
      ['timestamp', this.timestamp],
    ];

    if (this.metadata) {
      result.push(['metadata', this.metadata]);
    }
    if (this.parseResult) {
      result.push(['parseResult', this.parseResult]);
    }
    result.push(['cause', this.cause]);

    return result;
  }

  /**
   * Checks if this error was caused by a specific error type.
   *
   * @param {new (...args: any[]) => Error} errorType - The error constructor to check against
   * @returns {boolean} True if the cause is an instance of the specified type
   *
   * @example
   * const error = new BaseError(
   *   new TypeError('Invalid type'),
   *   'validation'
   * );
   *
   * if (error.isCausedBy(TypeError)) {
   *   console.log('Type error detected');
   * }
   */
  public isCausedBy(errorType: new (...args: any[]) => Error): boolean {
    return this.cause instanceof errorType;
  }

  /**
   * Checks if the error occurred during a specific command or command pattern.
   *
   * @param {string | RegExp} pattern - Command string or regex pattern to match
   * @returns {boolean} True if the command matches the pattern
   *
   * @example
   * const error = new BaseError(
   *   new Error('Failed'),
   *   'database:users:query'
   * );
   *
   * error.isCommand('database:users:query'); // true
   * error.isCommand(/^database:/); // true
   * error.isCommand('api:'); // false
   */
  public isCommand(pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return this.command === pattern;
    }
    return pattern.test(this.command);
  }

  /**
   * Attaches additional metadata to the error.
   *
   * @param {string} key - The metadata key
   * @param {unknown} value - The metadata value
   * @returns {this} The error instance for method chaining
   *
   * @example
   * const error = new BaseError(
   *   new Error('Failed'),
   *   'process'
   * );
   *
   * error
   *   .withMetadata('attemptNumber', 3)
   *   .withMetadata('retryable', true);
   */
  public withMetadata(key: string, value: unknown): this {
    if (!this.metadata) {
      (this as any).metadata = {};
    }
    this.metadata![key] = value;
    return this;
  }

  /**
   * Creates a new error with the same properties but a different command.
   * Useful for wrapping errors as they bubble up through different layers.
   *
   * @param {string} newCommand - The new command identifier
   * @returns {BaseError} A new BaseError instance
   *
   * @example
   * try {
   *   lowLevelOperation();
   * } catch (error) {
   *   if (error instanceof BaseError) {
   *     throw error.withCommand('high-level:operation');
   *   }
   *   throw error;
   * }
   */
  public withCommand(newCommand: string): BaseError {
    const newError = new BaseError(this.cause, newCommand, this.metadata);
    if (this.parseResult) {
      (newError as any).parseResult = this.parseResult;
    }
    return newError;
  }
}

/**
 * Creates a new tagged error class factory for custom error types.
 *
 * This utility function simplifies creating domain-specific error types
 * that integrate with Effect's tagged error system and discriminated unions.
 *
 * @template T - The tag name literal type
 * @param {T} name - The tag name for the error type
 * @returns {typeof Data.TaggedError} A tagged error constructor
 *
 * @example
 * // Create a custom error type
 * const ValidationErrorBase = createTaggedError('ValidationError');
 *
 * export class ValidationError extends ValidationErrorBase<{
 *   cause: Error;
 *   command: string;
 *   field: string;
 *   value: unknown;
 * }> {
 *   constructor(cause: Error, command: string, field: string, value: unknown) {
 *     super({ cause, command, field, value });
 *   }
 * }
 *
 * @example
 * // Usage in application
 * throw new ValidationError(
 *   new Error('Invalid email format'),
 *   'user:validate',
 *   'email',
 *   'invalid-email'
 * );
 *
 * @example
 * // Creating multiple custom errors
 * export const NetworkErrorBase = createTaggedError('NetworkError');
 * export const DatabaseErrorBase = createTaggedError('DatabaseError');
 * export const AuthErrorBase = createTaggedError('AuthError');
 */
export const createTaggedError = <T extends string>(name: T) => Data.TaggedError(name);

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
 * Creates a BaseError from an Effect ParseResult.ParseError.
 *
 * This function is specifically designed to handle Effect schema validation
 * errors and attach the parse result for detailed error information.
 *
 * @param {ParseResult.ParseError} parseError - The Effect parse error
 * @param {string} command - The command identifier
 * @param {Record<string, unknown>} [metadata] - Optional metadata
 * @returns {BaseError} A BaseError with attached parse result
 *
 * @example
 * import { Schema } from 'effect';
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.String,
 *   email: Schema.String,
 *   age: Schema.Number
 * });
 *
 * function validateUser(data: unknown): User {
 *   const result = Schema.decodeUnknownEither(UserSchema)(data);
 *
 *   if (Either.isLeft(result)) {
 *     throw fromParseError(
 *       result.left,
 *       'user:validate',
 *       { input: data }
 *     );
 *   }
 *
 *   return result.right;
 * }
 */
export const fromParseError = (
  parseError: ParseResult.ParseError,
  command: string,
  metadata?: Record<string, unknown>,
): BaseError => {
  const error = new BaseError(new Error('Parse error'), command, metadata);
  (error as any).parseResult = parseError;
  return error;
};
/**
 * Aggregates multiple errors into a single BaseError.
 *
 * Useful when multiple operations fail and you want to collect all errors
 * before reporting them together.
 *
 * @param {Error[]} errors - Array of errors to aggregate
 * @param {AggregateErrorOptions} options - Configuration options
 * @returns {BaseError} A BaseError containing all aggregated errors
 *
 * @example
 * const errors: Error[] = [];
 *
 * for (const item of items) {
 *   try {
 *     await processItem(item);
 *   } catch (error) {
 *     errors.push(error as Error);
 *   }
 * }
 *
 * if (errors.length > 0) {
 *   throw aggregateErrors(errors, {
 *     command: 'batch:process',
 *     metadata: { totalItems: items.length }
 *   });
 * }
 *
 * @example
 * // Custom message
 * throw aggregateErrors(errors, {
 *   command: 'validation:all',
 *   message: 'Multiple validation failures occurred'
 * });
 */
export const aggregateErrors = (errors: Error[], options: AggregateErrorOptions): BaseError => {
  const message = options.message || `${errors.length} errors occurred`;
  const aggregateError = new Error(message);

  const metadata = {
    ...options.metadata,
    errorCount: errors.length,
    errors: errors.map((e) => ({
      name: e.name,
      message: e.message,
      stack: e.stack,
    })),
  };

  return new BaseError(aggregateError, options.command, metadata);
};

/**
 * Re-export Effect types for convenience.
 */
export type { ParseResult } from 'effect';
