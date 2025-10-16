/**
 * Represents a sensitive or secret value meant to be concealed from string, JSON, or developer output.
 *
 * Instances of this class always redact their value when serialized, stringified, or inspected.
 * Provides equality checks and safe retrieval of the concealed value.
 *
 * @template T Underlying type of the redacted value.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://github.com/WomB0ComB0/portfolio | portfolio project}
 * @example
 * * const secret = Redacted.make('supersecret');
 * console.log(secret.toString()); // [REDACTED]
 * ```
 */
export class Redacted<T = string> {
  /**
   * The concealed value.
   * @private
   * @readonly
   */
  private readonly _value: T;

  /**
   * The marker used when displaying a redacted value.
   * @private
   * @readonly
   */
  private static readonly REDACTED_MARKER = '[REDACTED]';

  /**
   * Constructs a new Redacted instance.
   * Use {@link Redacted.make} to create an instance.
   *
   * @private
   * @param {T} value The value to redact.
   * @throws {Error} If value is null or undefined.
   */
  private constructor(value: T) {
    this.validateValue(value);
    this._value = value;
  }

  /**
   * Validates the input value.
   *
   * @private
   * @param {T} value Value to validate.
   * @throws {Error} If value is null or undefined.
   */
  private validateValue(value: T): void {
    if (value === null || value === undefined) {
      throw new Error('Value cannot be null or undefined');
    }
  }

  /**
   * Factory method to create a new Redacted instance.
   *
   * @public
   * @static
   * @param {T} value The value to redact.
   * @returns {Redacted<T>} The redacted value instance.
   * @throws {Error} If value is null or undefined.
   * @author Mike Odnis
   * @example
   * ```ts
   * const r = Redacted.make('password');
   * ```
   */
  public static make<T>(value: T): Redacted<T> {
    return new Redacted(value);
  }

  /**
   * Gets the original concealed value.
   * Use this only when absolutely safe.
   *
   * @public
   * @returns {T} The underlying value.
   * @author Mike Odnis
   */
  public getValue(): T {
    return this._value;
  }

  /**
   * Returns the redacted marker as a string representation.
   *
   * @public
   * @returns {string} The redacted marker.
   * @example
   * secret.toString(); // [REDACTED]
   */
  public toString(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Returns the redacted marker for JSON serialization.
   *
   * @public
   * @returns {string} The redacted marker.
   * @example
   * JSON.stringify(secret); // "[REDACTED]"
   */
  public toJSON(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Custom node.js inspection method (e.g., console.log, util.inspect).
   *
   * @public
   * @returns {string} The redacted marker.
   * @see {@link https://nodejs.org/api/util.html#custom-inspection-functions-on-objects}
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Returns the redacted marker for custom inspection/debugging tools.
   *
   * @public
   * @returns {string} The redacted marker.
   */
  public inspect(): string {
    return Redacted.REDACTED_MARKER;
  }

  /**
   * Checks whether another Redacted instance is equal to this one (by comparing underlying values).
   *
   * @public
   * @param {Redacted<T>} other The other Redacted instance.
   * @returns {boolean} True if the values are equal, false otherwise.
   * @example
   * Redacted.make(1).equals(Redacted.make(1)); // true
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
   * @public
   * @static
   * @param {unknown} value The value to test.
   * @returns {value is Redacted<T>} True if value is a Redacted instance.
   * @example
   * Redacted.isRedacted(secret); // true or false
   */
  public static isRedacted<T>(value: unknown): value is Redacted<T> {
    return value instanceof Redacted;
  }

  /**
   * Returns the concealed value for use in value comparisons and operators.
   *
   * @public
   * @returns {T} The underlying concealed value.
   */
  public valueOf(): T {
    return this._value;
  }
}
