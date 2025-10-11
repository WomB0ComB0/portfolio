export class Redacted<T = string> {
  private readonly _value: T;
  private static readonly REDACTED_MARKER = '[REDACTED]';

  private constructor(value: T) {
    this.validateValue(value);
    this._value = value;
  }

  private validateValue(value: T): void {
    if (value === null || value === undefined) {
      throw new Error('Value cannot be null or undefined');
    }
  }

  public static make<T>(value: T): Redacted<T> {
    return new Redacted(value);
  }

  public getValue(): T {
    return this._value;
  }

  public toString(): string {
    return Redacted.REDACTED_MARKER;
  }

  public toJSON(): string {
    return Redacted.REDACTED_MARKER;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return Redacted.REDACTED_MARKER;
  }

  public inspect(): string {
    return Redacted.REDACTED_MARKER;
  }

  public equals(other: Redacted<T>): boolean {
    if (!(other instanceof Redacted)) {
      return false;
    }
    return this._value === other._value;
  }

  public static isRedacted<T>(value: unknown): value is Redacted<T> {
    return value instanceof Redacted;
  }

  public valueOf(): T {
    return this._value;
  }
}
