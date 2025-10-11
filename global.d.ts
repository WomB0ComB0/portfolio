//#region Custom
/**
 * Prettifies a type by removing `readonly` and optional modifiers.
 * @template T - The type to prettify.
 * @typedef {object} Prettify
 */
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Prettifies a function type by preserving its parameters and return type.
 * @template T - The function type to prettify.
 * @typedef {Function} PrettifyFunction
 */
type PrettifyFunction<T extends (...args: any[]) => any> = T extends (...args: infer P) => infer R
  ? (...args: P) => R
  : never;

/**
 * Gets the first element of an array.
 * @template T - The array type.
 * @typedef {any} Head
 */
type Head<T extends Array<any>> = T extends [infer U, ...infer _Rest] ? U : never;

/**
 * Gets the tail (all but the first element) of an array.
 * @template T - The array type.
 * @typedef {any[]} Tail
 */
type Tail<T extends any[]> = T extends [infer _U, ...infer Rest] ? Rest : never;

/**
 * Merges two objects, omitting properties from the second object that are also present in the first object.
 * @template T - The first object type.
 * @template U - The second object type.
 * @typedef {object} Merge
 */
type Merge<T, U> = Prettify<Omit<T, keyof U> & U>;

/**
 * Merges an array of objects into a single object.
 * @template T - The array of object types.
 * @typedef {any[]} MergeAll
 */
type MergeAll<T> = T extends []
  ? []
  : T extends [infer Head, ...infer Tail]
    ? [Merge<Head, Tail[0]>, ...MergeAll<Tail>]
    : [T];

/**
 * Creates a non-empty array type.
 * @template T - The element type.
 * @typedef {T[]} NonEmptyArray
 */
type NonEmptyArray<T> = [T, ...T[]];

/**
 * Splits a string into an array of strings using a delimiter.
 * @template S - The string to split.
 * @template D - The delimiter.
 * @typedef {string[]} Split
 */
type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends ''
    ? []
    : S extends `${infer T}${D}${infer U}`
      ? [T, ...Split<U, D>]
      : [S];

/**
 * Joins an array of strings into a single string.
 * @template T - The array of strings.
 * @typedef {string} Join
 */
type Join<T> = T extends [infer F, ...infer R]
  ? R['length'] extends 0
    ? `${F & string}`
    : `${F & string}${Join<R>}`
  : never;

/**
 * Parses a string to a number.
 * @template T - The string to parse.
 * @typedef {number} ParseInt
 */
type ParseInt<T> = T extends `${infer N extends number}` ? N : never;

/**
 * Filters an array to an object based on a type.
 * @template T - The array type.
 * @template I - The type to filter by.
 * @typedef {object} FilterArrayToObject
 */
type FilterArrayToObject<T, I> = {
  [K in keyof T as T[K] extends I ? K : never]: T[K];
};

/**
 * Creates an array of a given length.
 * @template Length - The desired length.
 * @template T - The array type (internal use).
 * @typedef {unknown[]} ArrayOfLength
 */
type ArrayOfLength<Length extends number, T extends unknown[] = []> = T['length'] extends Length
  ? T
  : ArrayOfLength<Length, [...T, T['length']]>;

/**
 * Fills an array to a given length with a specified type.
 * @template T - The element type.
 * @template Length - The desired length.
 * @template Arr - The array type (internal use).
 * @typedef {T[]} Fill
 */
type Fill<T, Length extends number, Arr extends readonly T[] = []> = Arr['length'] extends Length
  ? Arr
  : Fill<T, Length, [T, ...Arr]>;

/**
 * Gets the element at a specific index in an array.
 * @template Arr - The array type.
 * @template Index - The index.
 * @typedef {unknown} GetIndex
 */
type GetIndex<Arr extends readonly unknown[], Index> = Index extends keyof Arr
  ? Arr[Index]
  : GetIndex<[...Arr, ...Arr], Index>;

/**
 * Flattens an array of arrays into a single array.
 * @template T - The array of arrays.
 * @typedef {unknown[]} Flatten
 */
type Flatten<T> = T extends [infer First extends unknown[], ...infer Rest extends unknown[][]]
  ? [...First, ...Flatten<Rest>]
  : [];

/**
 * Zips two arrays together into an array of pairs.
 * @template T - The first array.
 * @template U - The second array.
 * @typedef {Array<[any, any]>} Zip
 */
type Zip<T extends any[], U extends any[]> = T extends [infer A, ...infer RestT]
  ? U extends [infer B, ...infer RestU]
    ? [[A, B], ...Zip<RestT, RestU>]
    : []
  : [];

/**
 * Gets all paths of an object as arrays of keys.
 * @template T - The object type.
 * @typedef {Array<any>} Paths
 */
type Paths<T extends Record<string, any>> = keyof T extends never
  ? []
  : T extends object
    ? { [K in keyof T]: [K, ...Paths<T[K]>] }[keyof T]
    : [];

/**
 * Omits properties from an object based on their type.
 * @template T - The object type.
 * @template U - The type to omit.
 * @typedef {object} OmitByType
 */
type OmitByType<T, U> = T extends object
  ? {
      [K in keyof T as T[K] extends U ? never : K]: T[K];
    }
  : never;

/**
 * Makes all properties in an object and its nested objects partial (optional).
 * @template T - The object type.
 * @typedef {object} DeepPartial
 */
type DeepPartial<T extends object> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Makes all properties in an object and its nested objects required.
 * @template T - The object type.
 * @typedef {object} DeepRequired
 */
type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? DeepRequired<T[K]> : T[K];
};

/**
 * Makes all properties in an object and its nested objects readonly.
 * @template T - The object type.
 * @typedef {object} DeepReadonly
 */
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

/**
 * Converts a union type to an intersection type.
 * @template U - The union type.
 * @typedef {any} UnionToIntersection
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/**
 * Removes index signatures from a type.
 * @template T - The object type.
 * @typedef {object} RemoveIndexSignature
 */
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/**
 * Makes all properties in an object and its nested objects non-nullable.
 * @template T - The object type.
 * @typedef {object} DeepNonNullable
 */
type DeepNonNullable<T> = {
  [K in keyof T]: T[K] extends object ? DeepNonNullable<T[K]> : NonNullable<T[K]>;
};

/**
 * Gets the type of all values in an object.
 * @template T - The object type.
 * @typedef {any} ValueOf
 */
type ValueOf<T> = T[keyof T];

/**
 * Makes at least one property required in a type.
 * @template T - The object type.
 * @template Keys - The keys to require at least one of.
 * @typedef {object} RequireAtLeastOne
 */
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Makes exactly one property required and the rest optional.
 * @template T - The object type.
 * @template Keys - The keys to require only one of.
 * @typedef {object} RequireOnlyOne
 */
type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
  }[Keys];

/**
 * Gets the type inside a Promise.
 * @template T - The Promise type.
 * @typedef {any} Awaited
 */
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

/**
 * Makes all properties in an object and its nested objects mutable (removes readonly).
 * @template T - The object type.
 * @typedef {object} DeepMutable
 */
type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? DeepMutable<T[K]> : T[K];
};

/**
 * Creates a type without certain properties.
 * @template T - The base type.
 * @template U - The type whose properties to exclude.
 * @typedef {object} Without
 */
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * Creates an exclusive OR (XOR) type between two types.
 * @template T - The first type.
 * @template U - The second type.
 * @typedef {object} XOR
 */
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

/**
 * Like Pick but works with nested properties using dot notation.
 * @template T - The object type.
 * @template Paths - The dot-notated property paths.
 * @typedef {object} DeepPick
 */
type DeepPick<T, Paths extends string> = Prettify<{
  [P in Paths as P extends `${infer Key}.${infer Rest}`
    ? Key
    : P]: P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? DeepPick<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;
}>;

/**
 * Checks if two types are exactly equal.
 * @template T - The first type.
 * @template U - The second type.
 * @typedef {boolean} IsEqual
 */
type IsEqual<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
  ? true
  : false;

/**
 * Converts a union type to a tuple type.
 * @template T - The union type.
 * @typedef {any[]} UnionToTuple
 */
type UnionToTuple<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer A
  ? [...UnionToTuple<Exclude<T, A>>, A]
  : [];

/**
 * Decrements a numeric type by one, up to 19.
 * @template N - The number to decrement.
 * @typedef {number} Decrement
 */
type Decrement<N extends number> = [
  -1,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
][N];

/**
 * Extracts the Nth property from a tuple.
 * @template T - The tuple type.
 * @template N - The index.
 * @typedef {any} ExtractNthProperty
 */
type ExtractNthProperty<T, N extends number> = T extends readonly [infer First, ...infer Rest]
  ? N extends 0
    ? First
    : ExtractNthProperty<Rest, Decrement<N>>
  : never;

/**
 * Extracts a property by name from an object.
 * @template T - The object type.
 * @template K - The property key.
 * @typedef {any} ExtractPropertyByName
 */
type ExtractPropertyByName<T, K extends keyof T> = T[K];

/**
 * Gets the type of the first argument of a function.
 * @template T - The function type.
 * @typedef {any} FirstArgument
 */
type FirstArgument<T> = T extends (first: infer First, ...args: any[]) => any ? First : never;

/**
 * Gets the types of all arguments of a function as a tuple.
 * @template T - The function type.
 * @typedef {any[]} AllArguments
 */
type AllArguments<T> = T extends (...args: infer Args) => any ? Args : never;

/**
 * Checks if a value is not null.
 *
 * @template Value
 * @param {Value} value - The value to check.
 * @returns {value is Exclude<Value, null>} Returns true if the value is not null, otherwise false.
 * @example
 * isNotNull(5); // true
 * isNotNull(null); // false
 */
declare const isNotNull = <Value>(value: Value): value is Exclude<Value, null> => {
  return value !== null;
};

/**
 * Returns a promise that resolves after a specified number of milliseconds.
 *
 * @template A extends number
 * @template R extends void
 * @param {A} n - The number of milliseconds to sleep.
 * @returns {Promise<R>} A promise that resolves after the specified delay.
 * @example
 * await sleep(1000); // Waits for 1 second
 */
declare const sleep = <A extends number, R extends void>(n: A): Promise<R> => {
  return new Promise((resolve) => setTimeout(resolve, n));
};


/**
 * Handles an error value by optionally transforming it with a provided function.
 *
 * This utility checks if the input `e` is an instance of `Error` (using `Error.isError`).
 * If it is an error and a handler function `fn` is provided, it calls the handler with the error and any additional arguments.
 * If it is an error and no handler is provided, it simply returns the error as is.
 * If the input is not an error, it returns the input unchanged.
 *
 * @template I - The type of the input value (can be an error or any other type).
 * @template O - The type returned by the handler function if provided.
 *
 * @param {I} e - The value to check and potentially handle if it is an error.
 * @param {(error: I, ...args: any[]) => O} [fn] - Optional handler function to process the error.
 * @param {...any} opts - Additional arguments to pass to the handler function if invoked.
 * @returns {I | O} Returns the original value if it is not an error, the error itself if no handler is provided, or the result of the handler function if provided.
 *
 * @example
 * // Returns the error unchanged if no handler is provided
 * const err = new Error("Something went wrong");
 * const result = error(err); // result === err
 *
 * @example
 * // Handles the error with a custom function
 * const err = new Error("Something went wrong");
 * const result = error(err, (e) => e.message); // result === "Something went wrong"
 *
 * @example
 * // Returns the value unchanged if it is not an error
 * const value = 42;
 * const result = error(value); // result === 42
 */
const error = <I, O>(
  e: I, 
  fn?: (error: I, ...args: any[]) => O, 
  ...opts: any[]
): I | O => {
  const isError = Error.isError(e);
  return isError 
    ? ( fn 
      ? fn(e, ...opts) 
      : e) 
    : e;
};
//#endregion
