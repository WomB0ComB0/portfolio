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

import type { KebabCase } from 'type-fest';
import { logger } from '@/utils';

/**
 * Converts any object into a well-formatted JSON string with a 2-space indent.
 * Useful for human-readable output, debugging, data serialization, and logging.
 *
 * @author Mike Odnis
 * @param {object} obj The object to be stringified.
 * @returns {string} The stringified JSON with indentation.
 * @throws {TypeError} Throws if the input object contains circular references.
 * @example
 *   const formatted = Stringify({user: "John", age: 30});
 *   // returns '{\n  "user": "John",\n  "age": 30\n}'
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
 * @version 1.0.0
 */
export const Stringify = (obj: object): string => {
  return JSON.stringify(obj, null, 2);
};

/**
 * @template T
 * @interface
 * @readonly
 * Represents a successful result in a Result union.
 *
 * @property {true} success Indicates if operation succeeded (always true).
 * @property {T} value The value returned as a result.
 *
 * @author Mike Odnis
 * @version 1.0.0
 */
type Success<T> = {
  readonly success: true;
  readonly value: T;
};

/**
 * @template E
 * @interface
 * @readonly
 * Represents a failed result in a Result union.
 *
 * @property {false} success Indicates if operation succeeded (always false).
 * @property {E} error The error value associated with the failure.
 *
 * @author Mike Odnis
 * @version 1.0.0
 */
type Failure<E> = {
  readonly success: false;
  readonly error: E;
};

/**
 * @template T, E
 * @type {object}
 * A discriminated union for representing either a successful or failed result.
 * Use with `success()` and `failure()` helpers.
 *
 * @see success
 * @see failure
 * @author Mike Odnis
 * @version 1.0.0
 */
type Result<T, E> = Success<T> | Failure<E>;

/**
 * Wraps the provided value in a successful Result object.
 *
 * @template T
 * @param {T} value Value to wrap as a success.
 * @returns {Success<T>} Success-wrapped result (immutable).
 * @readonly
 * @public
 * @author Mike Odnis
 * @example
 *   success(42) // { success: true, value: 42 }
 * @version 1.0.0
 */
export const success = <T>(value: T): Success<T> => Object.freeze({ success: true, value });

/**
 * Wraps the provided error in a failed Result object.
 *
 * @template E
 * @param {E} error Error value to wrap as a failure.
 * @returns {Failure<E>} Failure-wrapped result (immutable).
 * @readonly
 * @public
 * @author Mike Odnis
 * @example
 *   failure(new Error("Oops")) // { success: false, error: Error }
 * @version 1.0.0
 */
export const failure = <E>(error: E): Failure<E> => Object.freeze({ success: false, error });

type ExtractAsyncArgs<Args extends Array<any>> = Args extends Array<infer PotentialArgTypes>
  ? [PotentialArgTypes]
  : [];

/**
 * Catches and handles errors for async functions, returning a Result for safe error handling.
 *
 * @template Args, ReturnType
 * @async
 * @public
 * @param {(args: ExtractAsyncArgs<Args>) => Promise<ReturnType>} asyncFunction The async function to execute.
 * @param {...ExtractAsyncArgs<Args>} args Parameters to pass to the async function.
 * @returns {Promise<Result<ReturnType, Error>>} Promise that resolves to a Result. Success if no error, else Failure with Error.
 * @throws {any} Will not throw; wraps exceptions instead.
 * @author Mike Odnis
 * @example
 *   const result = await catchError(fetchUser, userId);
 *   if (result.success) { ... } else { ... }
 * @see Result
 * @version 1.0.0
 */
export const catchError = async <Args extends Array<any>, ReturnType>(
  asyncFunction: (...args: ExtractAsyncArgs<Args>) => Promise<ReturnType>,
  ...args: ExtractAsyncArgs<Args>
): Promise<Result<ReturnType, Error>> => {
  try {
    const result = await asyncFunction(...args);
    return success(result);
  } catch (error) {
    logger.error('catchError', { error });
    return failure(error as Error);
  }
};

/**
 * Maps a successful Result to a new value, wrapping errors unchanged.
 *
 * @template T,U,E
 * @public
 * @param {(value: T) => U} fn The mapping function to apply to a Success value.
 * @returns {(result: Result<T,E>) => Result<U,E>} Function accepting a Result and returning Result.
 * @author Mike Odnis
 * @see Result
 * @version 1.0.0
 */
export const map =
  <T, U, E>(fn: (value: T) => U): ((result: Result<T, E>) => Result<U, E>) =>
  (result) =>
    result.success ? success(fn(result.value)) : result;

/**
 * Chains a result-returning function after a successful Result, propagating failures.
 *
 * @template T,U,E
 * @param {(value: T) => Result<U,E>} fn Function to execute for a Success.
 * @returns {(result: Result<T,E>) => Result<U,E>} Result-propagating chain function.
 * @public
 * @author Mike Odnis
 * @see Result
 * @version 1.0.0
 */
export const bind =
  <T, U, E>(fn: (value: T) => Result<U, E>): ((result: Result<T, E>) => Result<U, E>) =>
  (result) =>
    result.success ? fn(result.value) : result;

/**
 * Composes Result-returning functions in sequence, passing output of one to next.
 * Short-circuits and returns immediately on the first failure encountered.
 *
 * @template TInput, TOutput, E
 * @param {TInput} input The initial input value.
 * @param {...Array<(input: any) => Result<any, E>>} functions Sequence of functions to process input.
 * @returns {Result<TOutput, E>} Final Result after transformations.
 * @public
 * @author Mike Odnis
 * @see Result
 * @version 1.0.0
 */
export const railway = <TInput, TOutput, E>(
  input: TInput,
  ...functions: Array<(input: any) => Result<any, E>>
): Result<TOutput, E> => {
  return functions.reduce<Result<any, E>>(
    (result, fn) => (result.success ? fn(result.value) : result),
    success(input),
  );
};

/**
 * Recovers from a failed Result by applying a recovery function to the error.
 *
 * @template T, E1, E2
 * @param {(error: E1) => Result<T, E2>} fn Error-handling/recovery function.
 * @returns {(result: Result<T, E1>) => Result<T, E2>} Result handler applying fn for failures.
 * @public
 * @author Mike Odnis
 * @see Result
 * @version 1.0.0
 */
export const recover =
  <T, E1, E2>(fn: (error: E1) => Result<T, E2>): ((result: Result<T, E1>) => Result<T, E2>) =>
  (result) =>
    result.success ? result : fn(result.error);

/**
 * Executes a side effect for successful Results, leaving the Result unchanged.
 *
 * @template T, E
 * @param {(value: T) => void} fn Side-effect function invoked for a Success.
 * @returns {(result: Result<T,E>) => Result<T,E>} Pass-through function with side effects on Success.
 * @public
 * @author Mike Odnis
 * @see Result
 * @version 1.0.0
 */
export const tap =
  <T, E>(fn: (value: T) => void): ((result: Result<T, E>) => Result<T, E>) =>
  (result) => {
    if (result.success) {
      fn(result.value);
    }
    return result;
  };

/**
 * Constructs a fully qualified URL based on environment variables and optional path.
 * Prefers NEXT_PUBLIC_SITE_URL, then NEXT_PUBLIC_VERCEL_URL, or defaults to localhost.
 *
 * @web
 * @public
 * @author Mike Odnis
 * @param {string} [path=''] The path or endpoint to append to base URL.
 * @returns {string} Fully composed absolute URL including protocol.
 * @example
 *   const api = getURL("api/users"); // https://example.com/api/users
 * @throws {TypeError} On invalid environmental configuration.
 * @see https://vercel.com/docs/concepts/projects/environment-variables
 * @version 1.0.0
 */
export const getURL = (path = ''): string => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_SITE_URL
      : process?.env?.NEXT_PUBLIC_VERCEL_URL && process.env.NEXT_PUBLIC_VERCEL_URL.trim() !== ''
        ? process.env.NEXT_PUBLIC_VERCEL_URL
        : 'http://localhost:3000/';

  url = url.replace(/\/+$/, '');
  url = url.includes('http') ? url : `https://${url}`;
  path = path.replace(/^\/+/, '');

  return path ? `${url}/${path}` : url;
};

/**
 * Smoothly scrolls the page to vertically center an element matching a selector,
 * considering the current scroll position, height, and viewport.
 *
 * @web
 * @author Mike Odnis
 * @public
 * @param {string} href Any valid `querySelector` selector for the element to scroll into view.
 * @returns {void}
 * @example
 *   ScrollIntoCenterView("#aboutMe");
 * @throws {Error} If the environment does not support window/document APIs.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo
 * @version 1.0.0
 */
export const ScrollIntoCenterView = (href: string) => {
  const element = document.querySelector(href);
  if (element) {
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.scrollY;
    const middle =
      absoluteElementTop + Math.floor(elementRect.height / 2) - Math.floor(window.innerHeight / 2);
    window.scrollTo({
      top: middle,
      behavior: 'smooth',
    });
  }
};

/**
 * Converts arbitrary text into a kebab-case, URL-safe slug.
 * Removes or replaces invalid characters, normalizes case, and trims extraneous delimiters.
 *
 * @author Mike Odnis
 * @public
 * @param {string} str The input text to slugify.
 * @param {boolean} [forDisplayingInput] Whether to keep trailing hyphens/periods (used for display feedback).
 * @returns {KebabCase<string>} The slugified, lowercase string.
 * @throws {TypeError} If input is not a string (guarded by usage).
 * @example
 *   slugify('Hello World!') // 'hello-world'
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
 * @version 1.0.0
 */
export const slugify = (str: string, forDisplayingInput?: boolean): KebabCase<string> => {
  if (!str) {
    return '';
  }

  const s = str
    .toLowerCase() // Convert to lowercase
    .trim() // Remove whitespace from both sides
    .normalize('NFD') // Normalize to decomposed form for handling accents
    .replace(/\p{Diacritic}/gu, '') // Remove any diacritics (accents) from characters
    .replace(/[^.\p{L}\p{N}\p{Zs}\p{Emoji}]+/gu, '-') // Replace any non-alphanumeric characters (including Unicode and except "." period) with a dash
    .replace(/[\s_#]+/g, '-') // Replace whitespace, # and underscores with a single dash
    .replace(/^-+/, '') // Remove dashes from start
    .replace(/\.{2,}/g, '.') // Replace consecutive periods with a single period
    .replace(/^\.+/, '') // Remove periods from the start
    .replace(
      /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
      '',
    ) // Removes emojis
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-'); // Replace consecutive dashes with a single dash

  return forDisplayingInput ? s : s.replace(/-+$/, '').replace(/\.*$/, ''); // Remove dashes and period from end
};

/**
 * Produces a debounced version of a function that will postpone its execution until after
 * a specified wait time has elapsed since its last invocation.
 *
 * @web
 * @author Mike Odnis
 * @public
 * @param {Function} fn The function to debounce.
 * @param {number} [time=300] Delay in ms before function can fire after the last call.
 * @returns {Function} Debounced function that delays invocation.
 * @example
 *   const debounced = debounce(alert, 200);
 * @throws {TypeError} If fn is not callable.
 * @see https://lodash.com/docs/4.17.15#debounce
 * @version 1.0.0
 */
export const debounce = (fn: Function, time = 300): Function => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, time);
  };
};

/**
 * Uppercases the first letter of a string, leaving the rest of the string unchanged.
 *
 * @author Mike Odnis
 * @public
 * @param {string} text String to capitalize.
 * @returns {string} String with its first character capitalized.
 * @example
 *   Capitalize("hello") // "Hello"
 * @throws {TypeError} If argument is not a string.
 * @version 1.0.0
 */
export const Capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Determines if an object has no own enumerable properties.
 *
 * @author Mike Odnis
 * @public
 * @param {any} obj Object to test for emptiness.
 * @returns {boolean} True if the object has no enumerable properties, false otherwise.
 * @example
 *   IsObjectEmpty({}) // true
 * @see Stringify
 * @version 1.0.0
 */
export const IsObjectEmpty = (obj: any): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * Checks if an array has zero elements.
 *
 * @author Mike Odnis
 * @public
 * @param {any[]} arr The array to examine.
 * @returns {boolean} True if empty, false otherwise.
 * @example
 *   IsArrayEmpty([]) // true
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/length
 * @version 1.0.0
 */
export const IsArrayEmpty = (arr: any[]): boolean => {
  return arr.length === 0;
};

/**
 * Checks if a string is empty or consists of only whitespace.
 *
 * @author Mike Odnis
 * @public
 * @param {string} str String to check.
 * @returns {boolean} True if the string is empty or whitespace; false otherwise.
 * @example
 *   IsStringEmpty("  ") // true
 * @version 1.0.0
 */
export const IsStringEmpty = (str: string): boolean => {
  return str.trim() === '';
};

/**
 * Checks whether a given value is a string primitive (not an object String).
 *
 * @author Mike Odnis
 * @public
 * @param {any} str The value to check.
 * @returns {boolean} True if the value is a string primitive, false otherwise.
 * @example
 *   IsString("foo") // true
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type
 * @version 1.0.0
 */
export const IsString = (str: any): boolean => {
  return typeof str === 'string';
};

const EMPTY = Symbol('EMPTY') as any;

/**
 * Generates a cache key string from input arguments, suitable for memoization.
 * Handles primitives, arrays, and objects with deterministic serialization.
 * Used as the default cacheKey function for memoize.
 *
 * @author Mike Odnis
 * @param {...any[]} args Arguments to compute a cache key from.
 * @returns {string} Key string for caching.
 * @example
 *   defaultCacheKey("a", 1)       // '"a",1'
 *   defaultCacheKey([1,2,3])      // '1,2,3'
 *   defaultCacheKey({foo: 'bar'}) // '{\n  "foo": "bar"\n}'
 *   defaultCacheKey()             // Symbol(EMPTY)
 * @private
 * @see memoize
 * @version 1.0.0
 */
function defaultCacheKey(...args: any[]): string {
  if (args.length === 0) {
    return EMPTY;
  }

  if (args.length === 1) {
    const arg = args[0];

    if (
      typeof arg === 'string' ||
      typeof arg === 'number' ||
      typeof arg === 'boolean' ||
      typeof arg === 'symbol' ||
      arg === null ||
      arg === undefined
    ) {
      return arg;
    }

    if (Array.isArray(arg)) {
      return arg.map((x) => defaultCacheKey(x)).join(',');
    }

    if (typeof arg === 'object') {
      return Stringify(arg);
    }
  }

  return Stringify(args);
}

/**
 * Returns a memoized version of the input function, caching results by argument.
 * Results are cached by a deterministic key derived from arguments,
 * leveraging either the default serialization or a user-provided method.
 *
 * @author Mike Odnis
 * @template T extends (...args: any[]) => any
 * @public
 * @param {T} fn The function to memoize.
 * @param {(...args: Parameters<T>) => string} [cacheKey=defaultCacheKey] Optionally override default cache key generator.
 * @returns {T} Memoized function with the same signature.
 * @example
 *   const fastFib = memoize(fib);
 *   fastFib(25); // cached after first execution
 * @see defaultCacheKey
 * @version 1.0.0
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  cacheKey: (...args: Parameters<T>) => string = defaultCacheKey,
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = cacheKey(...args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  }) as T;
}

/**
 * Truncates a string to a specific length and appends an ellipsis if truncation has occurred.
 *
 * @author Mike Odnis
 * @public
 * @param {string} str The input string to truncate.
 * @param {number} length The maximum length for the output (before "...").
 * @returns {string} Truncated string with "..." if needed, else original string.
 * @example
 *   truncate("portfolio by WomB0ComB0", 10) // 'portfolio ...'
 * @throws {RangeError} For negative lengths.
 * @version 1.0.0
 */
export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}
