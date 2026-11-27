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
 * @file The error effect-fetcher throws when a response fails its schema. It lives in its own
 * module, with no imports, so code that only needs to recognise it (the QueryClient's retry
 * predicate, which every page loads) can import it without pulling in effect: importing it from
 * effect-fetcher put the whole effect package, about 60 KB gzipped, into every route's first-load
 * JavaScript. effect-fetcher re-exports it, so both import paths give the same class.
 */

/**
 * Custom error class for validation-specific errors.
 * Includes detailed validation problems from effect/Schema.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly problems: string,
    public readonly responseData: unknown,
    public readonly attempt?: number,
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
    void this.stack; // Formatted now: V8's unformatted stack keeps its frames, and a body, alive.
  }

  [Symbol.toStringTag] = 'ValidationError';

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString();
  }

  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }

  [Symbol.for('react.element')]() {
    return this.toString();
  }

  toString(): string {
    return `ValidationError: ${this.message} (URL: ${this.url}${this.attempt ? `, Attempt: ${this.attempt}` : ''})`;
  }

  /**
   * Get a formatted string of all validation problems
   */
  getProblemsString(): string {
    return this.problems;
  }
}
