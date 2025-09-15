// @ts-check

/**
 * Copyright 2025 GDG on Campus Farmingdale State College
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
