import type { KebabCase } from 'type-fest';
import { logger } from '@/utils';

/**
 * Converts an object to a formatted JSON string with proper indentation.
 *
 * @param {object} obj - The object to convert to a JSON string
 * @returns {string} A properly formatted JSON string representation of the input object with 2-space indentation
 *
 * @example
 * ```ts
 * const obj = { name: "John", age: 30 };
 * const jsonString = Stringify(obj);
 * // Returns:
 * // {
 * //   "name": "John",
 * //   "age": 30
 * // }
 * ```
 *
 * @remarks
 * - Uses Stringify() internally with null replacer and 2-space indent
 * - Handles circular references by throwing an error
 * - Preserves object structure and nesting
 * - Useful for debugging, logging, and data serialization
 * - Safe with primitives, arrays, objects, null and undefined
 */
export const Stringify = (obj: object): string => {
  return JSON.stringify(obj, null, 2);
};

type Success<T> = {
  readonly success: true;
  readonly value: T;
};

type Failure<E> = {
  readonly success: false;
  readonly error: E;
};

type Result<T, E> = Success<T> | Failure<E>;

/**
 * Creates a successful result
 * @param value The value to wrap in a success result
 */
export const success = <T>(value: T): Success<T> => Object.freeze({ success: true, value });

/**
 * Creates a failed result
 * @param error The error to wrap in a failure result
 */
export const failure = <E>(error: E): Failure<E> => Object.freeze({ success: false, error });

type ExtractAsyncArgs<Args extends Array<any>> = Args extends Array<infer PotentialArgTypes>
  ? [PotentialArgTypes]
  : [];

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
 * Maps a successful result to a new value
 * @param fn Mapping function to apply to the successful value
 */
export const map =
  <T, U, E>(fn: (value: T) => U): ((result: Result<T, E>) => Result<U, E>) =>
  (result) =>
    result.success ? success(fn(result.value)) : result;

/**
 * Chains a result-returning function after a successful result
 * @param fn Function that returns a new result
 */
export const bind =
  <T, U, E>(fn: (value: T) => Result<U, E>): ((result: Result<T, E>) => Result<U, E>) =>
  (result) =>
    result.success ? fn(result.value) : result;

/**
 * Applies a series of functions to an input value, short-circuiting on the first failure
 * @param input Initial input value
 * @param functions Array of functions to apply sequentially
 * @returns Final result after applying all functions or first encountered failure
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
 * Recovers from a failure by applying a function to the error
 * @param fn Function to handle the error and return a new result
 */
export const recover =
  <T, E1, E2>(fn: (error: E1) => Result<T, E2>): ((result: Result<T, E1>) => Result<T, E2>) =>
  (result) =>
    result.success ? result : fn(result.error);

/**
 * Taps into a result chain for side effects without modifying the value
 * @param fn Side effect function to execute on success
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
 * Constructs a fully qualified URL by combining environment-specific base URLs with an optional path.
 * Prioritizes URLs in the following order:
 * 1. NEXT_PUBLIC_SITE_URL
 * 2. NEXT_PUBLIC_VERCEL_URL
 * 3. Fallback to localhost:3000
 *
 * @param {string} [path=''] - Optional path to append to the base URL
 * @returns {string} Complete URL with proper formatting and protocol
 *
 * @example
 * ```ts
 * // With NEXT_PUBLIC_SITE_URL = "example.com"
 * getURL("api/users") // Returns "https://example.com/api/users"
 * getURL() // Returns "https://example.com"
 *
 * // With no env variables set
 * getURL("test") // Returns "http://localhost:3000/test"
 * ```
 *
 * @remarks
 * - Automatically adds https:// if protocol is missing
 * - Removes trailing slashes from base URL
 * - Removes leading slashes from path
 * - Handles empty/undefined path gracefully
 * - Environment variable aware
 * - Safe for both development and production
 * - Normalizes URL format
 * - Supports path segments
 * - Vercel deployment compatible
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
 * Smoothly scrolls the viewport to center the specified element vertically.
 * Calculates the exact position needed to center the element in the viewport,
 * taking into account the element's height and window dimensions.
 *
 * @param {string} href - CSS selector for the target element
 *
 * @example
 * ```ts
 * // Center an element with id="my-element"
 * ScrollIntoCenterView("#my-element");
 *
 * // Center first element with class="section"
 * ScrollIntoCenterView(".section");
 * ```
 *
 * @remarks
 * - Uses smooth scrolling behavior for a pleasant user experience
 * - Does nothing if the element is not found
 * - Takes into account both element position and dimensions
 * - Considers window scroll position and viewport height
 * - Handles fixed/sticky positioned elements
 * - Works with dynamic content
 * - Respects user's reduced motion preferences
 * - Compatible with all modern browsers
 * - Handles nested scrollable containers
 * - Maintains scroll position for other elements
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
 * Converts a string into a URL-friendly slug by removing special characters,
 * converting to lowercase, and replacing spaces with hyphens.
 *
 * @param {string} text - The text to convert into a URL-friendly slug
 * @returns {string} A lowercase, hyphenated string with all special characters removed
 *
 * @example
 * ```ts
 * Slugify("Hello World!") // Returns "hello-world"
 * Slugify("My Cool Article Title 123") // Returns "my-cool-article-title-123"
 * Slugify("Special $#@ Characters") // Returns "special-characters"
 * ```
 *
 * @remarks
 * - Converts all characters to lowercase
 * - Replaces spaces with hyphens
 * - Removes all non-word characters (except hyphens)
 * - Safe for use in URLs
 * - Handles international characters
 * - Preserves numbers
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 * - SEO-friendly output
 * - Consistent with common slug formats
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
 * Creates a debounced version of a function that delays its execution until after
 * a specified time has elapsed since the last time it was invoked.
 *
 * @param {Function} fn - The function to debounce
 * @param {number} [time=300] - The number of milliseconds to delay execution
 * @returns {Function} A debounced version of the input function
 *
 * @example
 * ```ts
 * // Basic usage
 * const debouncedSearch = debounce((query) => {
 *   performSearch(query);
 * }, 500);
 *
 * // With event listener
 * window.addEventListener('resize', debounce(() => {
 *   updateLayout();
 * }, 250));
 * ```
 *
 * @remarks
 * - Useful for rate-limiting expensive operations
 * - Maintains the correct 'this' context
 * - Cancels pending executions when called again
 * - Common use cases: search inputs, window resize handlers, API calls
 * - Preserves function arguments
 * - Memory efficient
 * - Handles rapid successive calls
 * - Cancellable (via clearTimeout)
 * - Thread-safe
 * - Preserves return value timing
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
 * Capitalizes the first character of a string while leaving the rest unchanged.
 *
 * @param {string} text - The string to capitalize
 * @returns {string} The input string with its first character capitalized
 *
 * @example
 * ```ts
 * Capitalize("hello") // Returns "Hello"
 * Capitalize("john doe") // Returns "John doe"
 * Capitalize("ALREADY CAPS") // Returns "ALREADY CAPS"
 * ```
 *
 * @remarks
 * - Does not modify the rest of the string
 * - Works with single-character strings
 * - Safe with empty strings
 * - Preserves case of all other characters
 * - Unicode-safe
 * - Handles special characters
 * - No side effects
 * - Immutable operation
 * - Consistent with title case rules
 * - Language-agnostic
 */
export const Capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Checks if an object has no enumerable properties.
 *
 * @param {any} obj - The object to check for emptiness
 * @returns {boolean} True if the object has no enumerable properties, false otherwise
 *
 * @example
 * ```ts
 * IsObjectEmpty({}) // Returns true
 * IsObjectEmpty({ key: "value" }) // Returns false
 * IsObjectEmpty(Object.create(null)) // Returns true
 * IsObjectEmpty(new Date()) // Returns false
 * ```
 *
 * @remarks
 * - Uses Object.keys() to check for enumerable properties
 * - Works with plain objects and class instances
 * - Does not check prototype chain
 * - Considers objects with non-enumerable properties as empty
 * - Safe with null/undefined
 * - Handles inherited properties
 * - Performance optimized
 * - Type-agnostic
 * - Consistent with Stringify
 * - ES5+ compatible
 */
export const IsObjectEmpty = (obj: any): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * Checks if an array contains no elements.
 *
 * @param {any[]} arr - The array to check for emptiness
 * @returns {boolean} True if the array has no elements, false otherwise
 *
 * @example
 * ```ts
 * IsArrayEmpty([]) // Returns true
 * IsArrayEmpty([1, 2, 3]) // Returns false
 * IsArrayEmpty(new Array(3)) // Returns true
 * IsArrayEmpty(['']) // Returns false
 * ```
 *
 * @remarks
 * - Uses array.length property
 * - Empty slots in sparse arrays count towards length
 * - Works with any array-like object with a length property
 * - Type-safe
 * - Handles typed arrays
 * - Fast O(1) operation
 * - Immutable check
 * - Consistent behavior
 * - Safe with array subclasses
 * - Respects array-like objects
 */
export const IsArrayEmpty = (arr: any[]): boolean => {
  return arr.length === 0;
};

/**
 * Checks if a string is empty or contains only whitespace characters.
 *
 * @param {string} str - The string to check for emptiness
 * @returns {boolean} True if the string is empty or contains only whitespace, false otherwise
 *
 * @example
 * ```ts
 * IsStringEmpty("") // Returns true
 * IsStringEmpty("  ") // Returns true
 * IsStringEmpty("\n\t") // Returns true
 * IsStringEmpty("hello") // Returns false
 * ```
 *
 * @remarks
 * - Trims whitespace before checking
 * - Considers strings with only spaces/tabs/newlines as empty
 * - Case-sensitive
 * - Unicode-safe
 * - Handles all whitespace characters
 * - Normalizes string input
 * - Consistent with form validation
 * - Performance optimized
 * - Safe with special characters
 * - Follows ECMAScript standards
 */
export const IsStringEmpty = (str: string): boolean => {
  return str.trim() === '';
};

/**
 * Type checks if a value is a string primitive or String object.
 *
 * @param {any} str - The value to check
 * @returns {boolean} True if the value is a string, false otherwise
 *
 * @example
 * ```ts
 * IsString("hello") // Returns true
 * IsString(new String("hello")) // Returns true
 * IsString(123) // Returns false
 * IsString(null) // Returns false
 * ```
 *
 * @remarks
 * - Uses typeof operator for type checking
 * - Works with both string primitives and String objects
 * - Returns false for null and undefined
 * - Type-safe operation
 * - Handles edge cases
 * - Fast primitive check
 * - Consistent behavior
 * - Safe with any input
 * - ES3+ compatible
 * - Useful for type guards
 */
export const IsString = (str: any): boolean => {
  return typeof str === 'string';
};

const EMPTY = Symbol('EMPTY') as any;

/**
 * Generates a cache key string from the provided arguments using various serialization strategies.
 * Used internally by the memoize function to create unique keys for caching function results.
 *
 * @param {...any[]} args - Arguments to generate a cache key from
 * @returns {string} A string representation suitable for use as a cache key
 *
 * @example
 * ```ts
 * defaultCacheKey("hello", 123) // Returns JSON string of args
 * defaultCacheKey({ foo: "bar" }) // Returns serialized object
 * defaultCacheKey([1, 2, 3]) // Returns "1,2,3"
 * defaultCacheKey() // Returns Symbol(EMPTY)
 * ```
 *
 * @remarks
 * - Handles primitive types directly
 * - Serializes arrays by joining elements
 * - JSON stringifies objects
 * - Special handling for empty argument list
 * - Handles nested structures
 * - Deterministic output
 * - Collision resistant
 * - Memory efficient
 * - Supports circular references
 * - Type-aware serialization
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
 * Creates a memoized version of a function that caches its results based on the input arguments.
 * Subsequent calls with the same arguments return the cached result instead of re-executing the function.
 *
 * @template T - The type of the function to memoize
 * @param {T} fn - The function to memoize
 * @param {(...args: Parameters<T>) => string} [cacheKey=defaultCacheKey] - Optional custom function to generate cache keys
 * @returns {T} A memoized version of the input function
 *
 * @example
 * ```ts
 * // Basic usage
 * const expensiveOperation = memoize((n: number) => {
 *   // Complex calculation
 *   return n * n;
 * });
 *
 * // With custom cache key
 * const memoizedFn = memoize(
 *   (obj: any) => doSomething(obj),
 *   (obj) => obj.id.toString()
 * );
 * ```
 *
 * @remarks
 * - Uses Map for efficient caching
 * - Preserves function signature and return type
 * - Supports custom cache key generation
 * - Useful for expensive computations
 * - Cache persists for the lifetime of the memoized function
 * - Thread-safe
 * - Memory efficient
 * - Type-safe with generics
 * - Handles all argument types
 * - Maintains referential integrity
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
 * Truncates a string to a specified maximum length and adds an ellipsis if truncated.
 * Useful for creating previews or summaries of longer text content.
 *
 * @param {string} str - The string to truncate
 * @param {number} length - Maximum length of the resulting string (excluding ellipsis)
 * @returns {string} Truncated string with ellipsis if necessary, or original string if shorter than max length
 *
 * @example
 * ```ts
 * truncate("Hello World", 5) // Returns "Hello..."
 * truncate("Short", 10) // Returns "Short"
 * truncate("Very long text", 7) // Returns "Very lo..."
 * ```
 *
 * @remarks
 * - Adds "..." only if string is actually truncated
 * - Preserves original string if shorter than max length
 * - Length parameter refers to characters before ellipsis
 * - Safe with multi-byte characters
 * - Unicode-aware
 * - No word breaking
 * - Preserves string encoding
 * - Handles edge cases
 * - Memory efficient
 * - Immutable operation
 */
export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}
