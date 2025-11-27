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
 * @template T
 * @interface
 * @readonly
 * Represents a successful result in a Result union.
 * @property {true} success Indicates if operation succeeded (always true).
 * @property {T} value The value returned as a result.
 * @author Mike Odnis
 * @version 1.0.0
 */
export type Success<T> = {
  readonly success: true;
  readonly value: T;
};
/**
 * @template E
 * @interface
 * @readonly
 * Represents a failed result in a Result union.
 * @property {false} success Indicates if operation succeeded (always false).
 * @property {E} error The error value associated with the failure.
 * @author Mike Odnis
 * @version 1.0.0
 */
export type Failure<E> = {
  readonly success: false;
  readonly error: E;
};
/**
 * @template T, E
 * @type {object}
 * A discriminated union for representing either a successful or failed result.
 * Use with `success()` and `failure()` helpers.
 * @see success
 * @see failure
 * @author Mike Odnis
 * @version 1.0.0
 */
export type Result<T, E> = Success<T> | Failure<E>;
export type ExtractAsyncArgs<Args extends Array<any>> = Args extends Array<infer PotentialArgTypes>
  ? [PotentialArgTypes]
  : [];
