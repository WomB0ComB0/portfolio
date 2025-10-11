"use strict";

import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { type Type, type } from "arktype";
import { Duration, Effect, pipe, Schedule } from "effect";

declare const EMPTY = "";

/**
 * @module effect-fetcher
 *
 * Provides type-safe, Effect-based HTTP data fetching utilities with ArkType runtime validation.
 *
 * This module exposes a generic, type-safe fetcher utility and convenience functions for all HTTP verbs.
 * It supports retries, timeouts, custom headers, error handling, runtime validation with ArkType,
 * and integrates with Effect-TS for composable async flows.
 *
 * ## Features
 * - Type-safe HTTP requests for all verbs (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
 * - Runtime type validation with ArkType
 * - Effect-based error handling and retry logic
 * - Customizable headers, timeouts, and retry strategies
 * - Rich error context via FetcherError and ValidationError
 * - Query parameter serialization
 * - Designed for use with Effect-TS and React Query
 *
 * @see FetcherError
 * @see ValidationError
 * @see fetcher
 * @see get
 * @see post
 * @see put
 * @see patch
 * @see del
 * @see options
 * @see head
 *
 * @example
 * ```ts
 * import { get } from './effect-fetcher';
 * import { Effect } from 'effect';
 * import { type } from 'arktype';
 *
 * const UserSchema = type({
 *   id: 'number',
 *   name: 'string',
 *   email: 'string'
 * });
 *
 * const UsersSchema = type({
 *   users: [UserSchema]
 * });
 *
 * const effect = get('/api/users', {
 *   retries: 2,
 *   schema: UsersSchema
 * });
 * const result = await Effect.runPromise(effect);
 * console.log(result.users); // Fully typed and validated!
 * ```
 */

/**
 * Type definition for supported HTTP methods.
 * Used to restrict the allowed HTTP methods for the fetcher utility.
 */
const HttpMethod = type(
	"'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'",
);

/**
 * Represents all supported HTTP methods for the fetcher utility.
 * @typedef {"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD"} HttpMethod
 */
type HttpMethod = typeof HttpMethod.infer;

/**
 * Type definition for query parameters.
 * Each key is a string, and each value can be a string, number, boolean, null, undefined, or an array of those types.
 */
const QueryParams = type({
	"[string]":
		"string | number | boolean | undefined | null | (string | number | boolean)[]",
});

/**
 * Represents a type-safe map of query parameters.
 * Each value can be a string, number, boolean, null, undefined, or an array of those types.
 * @typedef {Record<string, string | number | boolean | undefined | null | (string | number | boolean)[]>} QueryParams
 */
export type QueryParams = typeof QueryParams.infer;

/**
 * Type definition for request body.
 * Can be an object, array, string, number, boolean, or null.
 */
const RequestBody = type(
	"Record<string, unknown> | unknown[] | string | number | boolean | null",
);

/**
 * Represents a type-safe request body for HTTP methods that support a body.
 * Can be an object, array, string, number, boolean, or null.
 * @typedef {Record<string, unknown> | unknown[] | string | number | boolean | null} RequestBody
 */
type RequestBody = typeof RequestBody.infer;

/**
 * Type definition for HTTP headers.
 * Each key and value is a string.
 */
const Headers = type({
	"[string]": "string",
});

/**
 * Represents HTTP headers as key-value string pairs.
 * @typedef {Record<string, string>} Headers
 */
type Headers = typeof Headers.infer;

/**
 * Type definition for fetcher options.
 * Used for runtime validation and documentation.
 */
const FetcherOptions = type({
	"retries?": "number",
	"retryDelay?": "number",
	"onError?": "Function",
	"timeout?": "number",
	"headers?": Headers,
	"schema?": "unknown",
});

/**
 * Configuration options for the fetcher utility.
 * @template T
 * @property {number} [retries] - Number of times to retry the request on failure.
 * @property {number} [retryDelay] - Delay in milliseconds between retries.
 * @property {(error: unknown) => void} [onError] - Optional callback invoked on error.
 * @property {number} [timeout] - Timeout in milliseconds for the request.
 * @property {Record<string, string>} [headers] - Additional headers to include in the request.
 * @property {Type<T>} [schema] - ArkType schema for runtime validation of the response.
 * @property {AbortSignal} [signal] - Optional AbortSignal to cancel the request.
 */
export interface FetcherOptions<T = unknown> {
	retries?: number;
	retryDelay?: number;
	onError?: (error: unknown) => void;
	timeout?: number;
	headers?: Record<string, string>;
	schema?: Type<T>;
	signal?: AbortSignal;
}

/**
 * Error thrown when response data fails ArkType schema validation.
 * Includes detailed validation problems from ArkType, the request URL, the invalid response data, and the attempt number.
 *
 * @extends Error
 */
export class ValidationError extends Error {
	/**
	 * @param {string} message - Error message.
	 * @param {string} url - The URL of the request that failed validation.
	 * @param {string} problems - ArkType validation problems summary.
	 * @param {unknown} responseData - The actual response data that failed validation.
	 * @param {number} [attempt] - The attempt number when the error occurred.
	 */
	constructor(
		message: string,
		public readonly url: string,
		public readonly problems: string,
		public readonly responseData: unknown,
		public readonly attempt?: number,
	) {
		super(message);
		this.name = "ValidationError";
		Object.setPrototypeOf(this, ValidationError.prototype);
	}

	[Symbol.toStringTag] = "ValidationError";

	[Symbol.for("nodejs.util.inspect.custom")]() {
		return this.toString();
	}

	[Symbol.for("Deno.customInspect")]() {
		return this.toString();
	}

	[Symbol.for("react.element")]() {
		return this.toString();
	}

	/**
	 * Returns a string representation of the ValidationError.
	 * @returns {string}
	 */
	toString(): string {
		return `ValidationError: ${this.message} (URL: ${this.url}${this.attempt ? `, Attempt: ${this.attempt}` : ""})`;
	}

	/**
	 * Get a formatted string of all validation problems.
	 * @returns {string}
	 */
	getProblemsString(): string {
		return this.problems;
	}
}

/**
 * Error thrown for fetcher-specific errors, such as network errors, HTTP errors, or request serialization errors.
 * Includes additional context such as the request URL, HTTP status, response data, and attempt number.
 *
 * @extends Error
 */
export class FetcherError extends Error {
	/**
	 * @param {string} message - Error message.
	 * @param {string} url - The URL of the request that failed.
	 * @param {number} [status] - HTTP status code, if available.
	 * @param {unknown} [responseData] - The response data, if available.
	 * @param {number} [attempt] - The attempt number when the error occurred.
	 */
	constructor(
		message: string,
		public readonly url: string,
		public readonly status?: number,
		public readonly responseData?: unknown,
		public readonly attempt?: number,
	) {
		super(message);
		this.name = "FetcherError";
		Object.setPrototypeOf(this, FetcherError.prototype);
	}

	[Symbol.toStringTag] = "FetcherError";

	[Symbol.for("nodejs.util.inspect.custom")]() {
		return this.toString();
	}

	[Symbol.for("Deno.customInspect")]() {
		return this.toString();
	}

	[Symbol.for("react.element")]() {
		return this.toString();
	}

	/**
	 * Returns a string representation of the FetcherError.
	 * @returns {string}
	 */
	toString(): string {
		return `FetcherError: ${this.message} (URL: ${this.url}${this.status ? `, Status: ${this.status}` : ""}${this.attempt ? `, Attempt: ${this.attempt}` : parseInt("0")})`;
	}
}

/**
 * Performs a GET request with optional schema validation.
 *
 * @template T
 * @param {string} input - The URL to request.
 * @param {"GET"} [method] - The HTTP method (must be "GET").
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function fetcher<T = unknown>(
	input: string,
	method?: "GET",
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a GET request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} input - The URL to request.
 * @param {"GET"} method - The HTTP method (must be "GET").
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function fetcher<S extends Type<any>>(
	input: string,
	method: "GET",
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Performs a POST, PUT, or PATCH request with a request body and optional schema validation.
 *
 * @template T
 * @param {string} input - The URL to request.
 * @param {"POST" | "PUT" | "PATCH"} method - The HTTP method.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @param {RequestBody} [body] - Optional request body.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function fetcher<T = unknown>(
	input: string,
	method: "POST" | "PUT" | "PATCH",
	options?: FetcherOptions<T>,
	params?: QueryParams,
	body?: RequestBody,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a POST, PUT, or PATCH request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} input - The URL to request.
 * @param {"POST" | "PUT" | "PATCH"} method - The HTTP method.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @param {RequestBody} [body] - Optional request body.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function fetcher<S extends Type<any>>(
	input: string,
	method: "POST" | "PUT" | "PATCH",
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
	body?: RequestBody,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Performs a DELETE, OPTIONS, or HEAD request with optional schema validation.
 *
 * @template T
 * @param {string} input - The URL to request.
 * @param {"DELETE" | "OPTIONS" | "HEAD"} method - The HTTP method.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function fetcher<T = unknown>(
	input: string,
	method: "DELETE" | "OPTIONS" | "HEAD",
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Enhanced data fetching utility with type safety, ArkType validation, and Effect-based error handling.
 * Supports retries, timeouts, custom headers, runtime validation, and error handling.
 *
 * @template T
 * @param {string} input - The URL to request.
 * @param {HttpMethod} [method="GET"] - The HTTP method to use.
 * @param {FetcherOptions<T>} [options={}] - Optional fetcher configuration including ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @param {RequestBody} [body] - Optional request body (for methods that support it).
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>} An Effect that resolves to the validated response data of type T.
 *
 * @example
 * ```ts
 * import { type } from 'arktype';
 *
 * const UserSchema = type({
 *   id: 'number',
 *   name: 'string',
 *   email: 'string'
 * });
 *
 * const effect = pipe(
 *   get("/api/user/123", {
 *     retries: 1,
 *     retryDelay: 1_000,
 *     timeout: 10_000,
 *     schema: UserSchema,
 *     onError: (error) => {
 *       if (error instanceof ValidationError) {
 *         console.error("Validation failed:", error.getProblemsString())
 *       }
 *     }
 *   }),
 *   Effect.provide(FetchHttpClient.layer)
 * )
 * ```
 */
export function fetcher<T = unknown>(
	input: string,
	method: HttpMethod = "GET",
	options: FetcherOptions<T> = {},
	params?: QueryParams,
	body?: RequestBody,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient> {
	const {
		retries = 0,
		retryDelay = 1_000,
		onError,
		timeout = 10_000,
		headers = {},
		schema,
	} = options;

	/**
	 * Builds a query string from the provided query parameters.
	 * @param {QueryParams} [params] - The query parameters to serialize.
	 * @returns {string} The serialized query string.
	 */
	const buildQueryString = (params?: QueryParams): string => {
		if (!params) return EMPTY;
		const urlParams = new URLSearchParams();

		Object.entries(params).forEach(([key, value]) => {
			if (value == null) return;

			if (Array.isArray(value)) {
				value
					.filter((item): item is string | number | boolean => item != null)
					.forEach((item) => urlParams.append(key, String(item)));
			} else {
				urlParams.append(key, String(value));
			}
		});

		return urlParams.toString();
	};

	const url = params ? `${input}?${buildQueryString(params)}` : input;

	/**
	 * Builds a type-safe HttpClientRequest for the given method and URL.
	 * @param {HttpMethod} method - The HTTP method.
	 * @param {string} url - The request URL.
	 * @returns {HttpClientRequest.HttpClientRequest}
	 */
	const buildRequest = (
		method: HttpMethod,
		url: string,
	): HttpClientRequest.HttpClientRequest => {
		switch (method) {
			case "GET":
				return HttpClientRequest.get(url);
			case "POST":
				return HttpClientRequest.post(url);
			case "PUT":
				return HttpClientRequest.put(url);
			case "PATCH":
				return HttpClientRequest.patch(url);
			case "DELETE":
				return HttpClientRequest.del(url);
			case "OPTIONS":
				return HttpClientRequest.options(url);
			case "HEAD":
				return HttpClientRequest.head(url);
			default: {
				// @ts-ignore
				const _exhaustive: never = method;
				throw new Error(`Unsupported HTTP method: ${method}`);
			}
		}
	};

	/**
	 * Validates response data using the provided ArkType schema.
	 * @param {unknown} data - The response data to validate.
	 * @param {number} attempt - The attempt number.
	 * @returns {Effect.Effect<T, ValidationError, never>}
	 */
	const validateResponse = (
		data: unknown,
		attempt: number,
	): Effect.Effect<T, ValidationError, never> => {
		if (!schema) {
			return Effect.succeed(data as T);
		}

		const result = schema(data);

		if (result instanceof type.errors) {
			const validationError = new ValidationError(
				`Response validation failed: ${result.summary}`,
				url,
				result.summary,
				data,
				attempt,
			);

			if (onError) onError(validationError);
			return Effect.fail(validationError);
		}

		// Use type assertion since we know the validation passed
		return Effect.succeed(result as T);
	};

	return Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;
		let attempt = 0;

		// Build the request object
		let req = buildRequest(method, url);
		req = HttpClientRequest.setHeaders(headers)(req);

		// Add body for methods that support it with proper error handling
		if (
			body != null &&
			(method === "POST" || method === "PUT" || method === "PATCH")
		) {
			req = yield* pipe(
				HttpClientRequest.bodyJson(body)(req),
				Effect.mapError(
					(error) =>
						new FetcherError(
							`Failed to serialize request body: ${error instanceof Error ? error.message : String(error)}`,
							url,
							undefined,
							undefined,
							attempt,
						),
				),
			);
		}

		/**
		 * Wraps an Effect with a timeout, converting timeout errors to FetcherError.
		 * @template A, E, R
		 * @param {Effect.Effect<A, E, R>} eff - The effect to wrap with a timeout.
		 * @returns {Effect.Effect<A, FetcherError | E, R>}
		 */
		const withTimeout = <A, E, R>(
			eff: Effect.Effect<A, E, R>,
		): Effect.Effect<A, FetcherError | E, R> =>
			pipe(
				eff,
				Effect.timeoutFail({
					duration: Duration.millis(timeout),
					onTimeout: () =>
						new FetcherError(
							"Request timed out",
							url,
							undefined,
							undefined,
							attempt,
						),
				}),
			);

		// Retry schedule with exponential backoff and maximum number of retries
		const retrySchedule = Schedule.intersect(
			Schedule.exponential(Duration.millis(retryDelay)),
			Schedule.recurs(retries),
		);

		/**
		 * Executes the HTTP request, handling errors, HTTP status, response parsing, and validation.
		 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
		 */
		const executeRequest = Effect.gen(function* () {
			attempt++;

			// Execute the HTTP request and handle network/transport errors
			const response = yield* pipe(
				client.execute(req),
				withTimeout,
				Effect.mapError((error) => {
					if (error instanceof FetcherError) return error;

					return new FetcherError(
						error instanceof Error ? error.message : String(error),
						url,
						undefined,
						undefined,
						attempt,
					);
				}),
			);

			// Check for HTTP errors (non-2xx status codes)
			if (response.status < 200 || response.status >= 300) {
				const errorData = yield* pipe(
					response.json,
					Effect.catchAll(() => Effect.succeed(undefined)),
				);

				const error = new FetcherError(
					`HTTP ${response.status}: ${response.text || "Request failed"}`,
					url,
					response.status,
					errorData,
					attempt,
				);

				if (onError) onError(error);
				return yield* Effect.fail(error);
			}

			// Parse response data as JSON, with fallback to text and detailed error reporting
			const rawData = yield* pipe(
				response.json,
				Effect.catchAll((error) => {
					// Try to get response text for better debugging
					return pipe(
						response.text,
						Effect.flatMap((text) => {
							const errorMessage = `Failed to parse JSON response. Status: ${response.status}, Content-Type: ${response.headers["Content-Type"] || "unknown"}, Body: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`;
							return Effect.fail(
								new FetcherError(
									errorMessage,
									url,
									response.status,
									{ originalError: error, responseText: text },
									attempt,
								),
							);
						}),
						Effect.catchAll(() =>
							Effect.fail(
								new FetcherError(
									`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
									url,
									response.status,
									undefined,
									attempt,
								),
							),
						),
					);
				}),
			);

			// Validate the response data using ArkType schema if provided
			const validatedData = yield* validateResponse(rawData, attempt);

			return validatedData;
		});

		// Run the request with retry and error handling
		return yield* pipe(
			executeRequest,
			Effect.retry(retrySchedule),
			Effect.catchAll((error) => {
				if (error instanceof FetcherError || error instanceof ValidationError) {
					if (onError) onError(error);
					return Effect.fail(error);
				}

				const fetcherError = new FetcherError(
					String(error),
					url,
					undefined,
					undefined,
					attempt,
				);

				if (onError) onError(fetcherError);
				return Effect.fail(fetcherError);
			}),
		);
	});
}

/**
 * Convenience function for GET requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 *
 * @example
 * ```ts
 * import { type } from 'arktype';
 *
 * const UserSchema = type({
 *   id: 'number',
 *   name: 'string',
 *   email: 'string'
 * });
 *
 * const effect = get("/api/user", { schema: UserSchema });
 * const user = await Effect.runPromise(effect); // Fully typed and validated!
 * ```
 */
export function get<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * GET request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function get<S extends Type<any>>(
	url: string,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for GET requests.
 * @private
 */
export function get<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "GET", options, params);
}

/**
 * Convenience function for POST requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {RequestBody} [body] - Optional request body.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function post<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * POST request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {RequestBody} body - The request body.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function post<S extends Type<any>>(
	url: string,
	body: RequestBody,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for POST requests.
 * @private
 */
export function post<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "POST", options, params, body);
}

/**
 * Convenience function for PUT requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {RequestBody} [body] - Optional request body.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function put<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * PUT request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {RequestBody} body - The request body.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function put<S extends Type<any>>(
	url: string,
	body: RequestBody,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for PUT requests.
 * @private
 */
export function put<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "PUT", options, params, body);
}

/**
 * Convenience function for PATCH requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {RequestBody} [body] - Optional request body.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function patch<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * PATCH request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {RequestBody} body - The request body.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function patch<S extends Type<any>>(
	url: string,
	body: RequestBody,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for PATCH requests.
 * @private
 */
export function patch<T = unknown>(
	url: string,
	body?: RequestBody,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "PATCH", options, params, body);
}

/**
 * Convenience function for DELETE requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function del<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * DELETE request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function del<S extends Type<any>>(
	url: string,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for DELETE requests.
 * @private
 */
export function del<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "DELETE", options, params);
}

/**
 * Convenience function for OPTIONS requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function options<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * OPTIONS request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function options<S extends Type<any>>(
	url: string,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for OPTIONS requests.
 * @private
 */
export function options<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "OPTIONS", options, params);
}

/**
 * Convenience function for HEAD requests with optional schema validation.
 *
 * @template T
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<T>} [options] - Optional fetcher configuration.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function head<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * HEAD request with ArkType schema validation and automatic type inference.
 *
 * @template S
 * @param {string} url - The URL to request.
 * @param {FetcherOptions<Type<S>> & { schema: S }} options - Fetcher configuration with ArkType schema.
 * @param {QueryParams} [params] - Optional query parameters.
 * @returns {Effect.Effect<Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>}
 */
export function head<S extends Type<any>>(
	url: string,
	options: FetcherOptions<Type<S>> & { schema: S },
	params?: QueryParams,
): Effect.Effect<
	Type<S>,
	FetcherError | ValidationError,
	HttpClient.HttpClient
>;

/**
 * Implementation for HEAD requests.
 * @private
 */
export function head<T = unknown>(
	url: string,
	options?: FetcherOptions<T>,
	params?: QueryParams,
) {
	return fetcher<T>(url, "HEAD", options, params);
}

// --- Utility functions for common schema patterns ---

/**
 * Helper function to create a paginated response schema.
 *
 * @template T
 * @param {Type<T>} itemSchema - The ArkType schema for a single item in the paginated data array.
 * @returns {Type<{ data: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>} The paginated response schema.
 *
 * @example
 * ```ts
 * const UserSchema = type({
 *   id: 'number',
 *   name: 'string'
 * });
 *
 * const PaginatedUsersSchema = createPaginatedSchema(UserSchema);
 *
 * const effect = get("/api/users", {
 *   schema: PaginatedUsersSchema
 * });
 * ```
 */
export const createPaginatedSchema = <T>(itemSchema: Type<T>) => {
	return type({
		data: [itemSchema],
		pagination: {
			page: "number",
			pageSize: "number",
			total: "number",
			totalPages: "number",
		},
	});
};

/**
 * Helper function to create a generic API response wrapper schema.
 *
 * @template T
 * @param {Type<T>} dataSchema - The ArkType schema for the data property of the API response.
 * @returns {Type<{ success: boolean; data: T; message?: string; errors?: string[] }>} The API response wrapper schema.
 *
 * @example
 * ```ts
 * const UserSchema = type({
 *   id: 'number',
 *   name: 'string'
 * });
 *
 * const WrappedUserSchema = createApiResponseSchema(UserSchema);
 *
 * const effect = get("/api/user/123", {
 *   schema: WrappedUserSchema
 * });
 * ```
 */
export const createApiResponseSchema = <T>(dataSchema: Type<T>) => {
	return type({
		success: "boolean",
		data: dataSchema,
		message: "string?",
		errors: "string[]?",
	});
};

/**
 * Runs an Effect in the Effect runtime, providing the FetchHttpClient layer if needed.
 * @template A The success type of the Effect.
 * @template E The error type of the Effect.
 * @template R The environment type of the Effect.
 * @param {Effect.Effect<A, E, R>} eff - The Effect to run.
 * @returns {Promise<A>} A promise resolving to the Effect's result.
 */
export function run<A, E>(eff: Effect.Effect<A, E, never>): Promise<A>;
export function run<A, E>(eff: Effect.Effect<A, E, typeof import("@effect/platform/HttpClient").HttpClient>): Promise<A>;
export function run<A, E, R>(eff: Effect.Effect<A, E, R>): Promise<A> {
  const provided = (eff as Effect.Effect<A, E, typeof import("@effect/platform/HttpClient").HttpClient | never>).pipe(
    Effect.provide(FetchHttpClient.layer),
  );
  return Effect.runPromise(provided as Effect.Effect<A, E, never>);
}
