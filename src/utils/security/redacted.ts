// @ts-check
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
 * A utility class representing a sensitive value that should be redacted when serialized, logged, or inspected.
 *
 * The `Redacted` class encapsulates a value and prevents its accidental exposure via stringification, serialization,
 * or inspection. All such operations will yield the `[REDACTED]` marker instead of the real value.
 * The true value can only be retrieved intentionally via `getValue()` or `valueOf()`.
 *
 * @template T
 * @class
 * @final
 * @web
 * @version 1.0.0
 * @readonly
 * @author Mike Odnis
 * @author WomB0ComB0
 * @project portfolio
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * // Create a redacted value
 * const secret = Redacted.make('mypassword');
 * secret.toString(); // '[REDACTED]'
 * secret.getValue(); // 'mypassword'
 */
export class Redacted<T = string> {
  /**
   * The actual sensitive value.
   * @type {T}
   * @private
   * @readonly
   */
  private readonly _value: T;

  /**
   * The string marker shown in stringification/serialization.
   * @type {string}
   * @private
   * @readonly
   * @static
   */
  private static readonly REDACTED_MARKER = '[REDACTED]';

  /**
   * Constructs a new Redacted instance with the provided value after validation.
   *
   * @param {T} value - The value to be securely redacted.
   * @throws {Error} If the value is null or undefined.
   * @private
   */
  private constructor(value: T) {
    this.validateValue(value);
    this._value = value;
  }

  /**
   * Validates the value to ensure it is neither null nor undefined.
   *
   * @param {T} value - The value to validate.
   * @throws {Error} If the value is null or undefined.
   * @private
   */
  private validateValue(value: T): void {
    if (value === null || value === undefined) {
      throw new Error('Value cannot be null or undefined');
    }
  }

  /**
   * Factory method to create a new Redacted instance.
   *
   * @template T
   * @param {T} value - The value to redact.
   * @returns {Redacted<T>} The redacted wrapper for the value.
   * @throws {Error} If the value is null or undefined.
   * @public
   * @see Redacted#getValue
   * @example
   * const r = Redacted.make(1234);
   */
  public static make<T>(value: T): Redacted<T> {
    return new Redacted(value);
  }

  /**
   * Returns the underlying sensitive value.
   *
   * @returns {T} The original value.
   * @public
   * @see Redacted#valueOf
   */
  public getValue(): T {
    return this._value;
  }

  /**
   * Returns a string representing the redacted value for logging or display.
   *
   * @returns {string} The redaction marker "[REDACTED]".
   * @public
   * @web
   */
  public toString(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Returns a string for JSON serialization, always as "[REDACTED]".
   *
   * @returns {string} The redaction marker "[REDACTED]".
   * @public
   * @web
   * @see Redacted#toString
   */
  public toJSON(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Custom inspect implementation for Node.js, displaying "[REDACTED]".
   *
   * @returns {string} The redaction marker "[REDACTED]".
   * @public
   * @web
   * @see https://nodejs.org/api/util.html#custom-inspection-functions-on-objects
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Returns a string for manual inspection, always "[REDACTED]".
   *
   * @returns {string} The redaction marker "[REDACTED]".
   * @public
   */
  public inspect(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Compares this instance with another Redacted instance for equality of values.
   *
   * @param {Redacted<T>} other - The other instance to compare.
   * @returns {boolean} True if underlying values are equal, else false.
   * @public
   * @example
   * const a = Redacted.make('x');
   * const b = Redacted.make('x');
   * a.equals(b); // true
   */
  public equals(other: Redacted<T>): boolean {
    if (!(other instanceof Redacted)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Type guard to check if a value is a Redacted instance.
   *
   * @template T
   * @param {unknown} value - The value to test.
   * @returns {value is Redacted<T>} True if value is a Redacted.
   * @public
   * @see https://www.typescriptlang.org/docs/handbook/advanced-types.html#using-type-predicates
   */
  public static isRedacted<T>(value: unknown): value is Redacted<T> {
    return value instanceof Redacted;
  }

  /**
   * Returns the actual value for valueOf conversions.
   *
   * @returns {T} The underlying value.
   * @public
   * @readonly
   */
  public valueOf(): T {
    return this._value;
  }
}
