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

import { Duration, Effect, pipe, Result, Schedule, Schema, SchemaIssue } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/http';
import { env } from '@/env';
import type { TimedOut } from '@/lib/async/deadline';
import { ValidationError } from '@/lib/http-clients/validation-error';
import { getURL } from '@/utils';

/**
 * Configuration options for the fetcher utility.
 */
export interface FetcherOptions<T = unknown> {
  /** Number of times to retry the request on failure */
  retries?: number;
  /** Delay in milliseconds between retries */
  retryDelay?: number;
  /** Called once when the request fails (after its last attempt), with the error it fails with. */
  onError?: (error: unknown) => void;
  /** Timeout in milliseconds for the request */
  timeout?: number;
  /** Additional headers to include in the request */
  headers?: Record<string, string>;
  /** Effect/Schema for runtime validation of the response */
  schema?: Schema.Codec<T, any, never>;
  /** Abortsignal */
  signal?: AbortSignal;
  /** Body type - defaults to 'json', use 'text' for form-encoded data */
  bodyType?: 'json' | 'text';
}

/**
 * Represents all supported HTTP methods for the fetcher utility.
 */
export type HttpMethod = Schema.Schema.Type<typeof HttpMethod>;
/**
 * Represents a type-safe map of query parameters.
 * Each value can be a string, number, boolean, null, undefined, or an array of those types.
 */
export type QueryParams = Schema.Schema.Type<typeof QueryParams>;
/**
 * Represents a type-safe request body for HTTP methods that support a body.
 * Can be an object, array, string, number, boolean, or null.
 */
export type RequestBody = Schema.Schema.Type<typeof RequestBody>;
const EMPTY = '';

/**
 * Upper bound on the body an error keeps (a non-2xx response's, one that failed to parse, or one
 * its schema rejected) and on its schema problems, so a large body can't flood memory or logs.
 */
const MAX_ERROR_BODY_CHARS = 2_000;

/** `text` whole, or its first `chars`, copied (a V8 slice keeps the whole text), and `more`. */
const cut = (text: string, chars: number, more = (_rest: number): string => ''): string =>
  text.length > chars ? `${[...text.slice(0, chars)].join('')}${more(text.length - chars)}` : text;

/**
 * What an error keeps of a body (a non-2xx one, or a 2xx one its schema rejects), never more
 * than {@link MAX_ERROR_BODY_CHARS} of it, as the parse failure keeps: a JSON body that short as
 * parsed, any other body's start as text (`responseText`), nothing of an empty or unread body.
 */
const keptErrorBody = (json: unknown, text: string | null): unknown => {
  if (!text) return undefined;
  if (json !== undefined && text.length <= MAX_ERROR_BODY_CHARS) return json;
  return { responseText: cut(text, MAX_ERROR_BODY_CHARS) };
};

/** The most of a body an error's message quotes: messages are logged and sent to Sentry. */
const MESSAGE_BODY_CHARS = 200;

/** `text` as a message quotes it: whole, or its first {@link MESSAGE_BODY_CHARS} and '...'. */
const messageSnippet = (text: string): string => cut(text, MESSAGE_BODY_CHARS, () => '...');

/** A body that is an HTML document: a CDN's or proxy's error page rather than the API's answer. */
const HTML_DOCUMENT = /^\s*<(?:!doctype\s+html|html)[\s>]/i;
/** How much of an HTML page is searched for its title or text: the head comes first. */
const HTML_SCAN_CHARS = 4_000;
const HTML_BODY_START = /<body[\s>]/i;
const HTML_TITLE = /<title[^>]*>([^<]*)<\/title>/i;
/**
 * Comments, script, style and inline svg elements (code and icons, not words), and tags. An
 * element or tag cut off by the scan limit is removed to the end of the scanned text.
 */
const HTML_NOT_TEXT =
  /<!--[\s\S]*?(?:-->|$)|<(script|style|svg)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<[^>]*>?/gi;

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * `text` as an error's message quotes it. An HTML page is quoted by its title (e.g. a CDN's
 * "example.com | 521: Web server is down"), or else its text, never its markup: Sentry titles an
 * issue with the message's first line, and a page's first line is just its doctype. Only the
 * document's own title counts, not an SVG icon's in the body.
 */
const bodyForMessage = (text: string): string => {
  if (!HTML_DOCUMENT.test(text)) return messageSnippet(text);
  const head = text.slice(0, HTML_SCAN_CHARS);
  const title = collapse(HTML_TITLE.exec(head.split(HTML_BODY_START)[0] ?? '')?.[1] ?? '');
  const words = title || collapse(head.replace(HTML_NOT_TEXT, ' '));
  return words ? `HTML page "${messageSnippet(words)}"` : 'HTML page';
};

/**
 * Get the base URL for API requests.
 * - Client-side: returns empty string (uses relative URLs)
 * - Server-side: returns the site's absolute origin from getURL(), which picks it (on production,
 *   the production domain, so SSR self-fetches go through the CDN)
 */
const getBaseURL = (): string => (globalThis.window === undefined ? getURL() : EMPTY);

/** True when `url` is absolute and shares an origin (scheme, host and port) with `baseURL`. */
const isOwnOrigin = (url: string, baseURL: string): boolean => {
  if (!baseURL) return false;
  try {
    return new URL(url).origin === new URL(baseURL).origin;
  } catch {
    return false;
  }
};

/**
 * @module effect-fetcher
 *
 * Type-safe, Effect-based HTTP data fetching utilities with Effect Schema runtime validation.
 *
 * This module provides a generic, type-safe fetcher utility and convenience functions for all HTTP verbs.
 * It supports retries, timeouts, custom headers, error handling, runtime validation with Effect Schema,
 * and integrates with Effect for composable async flows.
 *
 * ## Features
 * - Type-safe HTTP requests for all verbs (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
 * - Runtime type validation with effect/Schema
 * - Effect-based error handling and retry logic
 * - Customizable headers, timeouts, and retry strategies
 * - Rich error context via FetcherError and ValidationError
 * - Query parameter serialization
 * - Designed for use with Effect and React Query
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
 * import { Effect, Schema } from 'effect';
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
 * });
 *
 * const UsersSchema = Schema.Struct({
 *   users: Schema.Array(UserSchema)
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

// HTTP Method type definition
const HttpMethod = Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
// Query parameters type definition
const QueryParams = Schema.Record(
  Schema.String,
  Schema.Union([
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Undefined,
    Schema.Null,
    Schema.Array(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
  ]),
);
// Request body type definition
const RequestBody = Schema.Union([
  Schema.Record(Schema.String, Schema.Unknown),
  Schema.Array(Schema.Unknown),
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
]);

// Defined in its own effect-free module so the QueryClient can import it without effect; it is
// re-exported here so every existing import of it from this module keeps working.
export { ValidationError };

/**
 * Custom error class for fetcher-specific errors.
 * Includes additional context such as the request URL, HTTP status, response data, and attempt number.
 */
export class FetcherError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
    public readonly responseData?: unknown,
    public readonly attempt?: number,
  ) {
    super(message);
    this.name = 'FetcherError';
    Object.setPrototypeOf(this, FetcherError.prototype);
    void this.stack; // Formatted now: V8's unformatted stack keeps its frames, and a body, alive.
  }

  [Symbol.toStringTag] = 'FetcherError';

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
    return `FetcherError: ${this.message} (URL: ${this.url}${this.status ? `, Status: ${this.status}` : ''}${this.attempt ? `, Attempt: ${this.attempt}` : ''})`;
  }
}

/**
 * A request that did not answer within its time budget: no status, nothing read. Still a
 * FetcherError (same name, same handling and retries), marked {@link TimedOut} so the reporter
 * can tell a missed budget from a failure.
 */
export class FetcherTimeoutError extends FetcherError implements TimedOut {
  readonly timedOut = true;

  constructor(message: string, url: string, attempt?: number) {
    super(message, url, undefined, undefined, attempt);
    // FetcherError pins its own prototype; put this class's back.
    Object.setPrototypeOf(this, FetcherTimeoutError.prototype);
  }
}

/**
 * Whether a failed attempt may be retried; the caller's `retries` budget caps the count separately.
 * Validation errors and 4xx responses are final. A 429 is retried only on the server: in the
 * browser every visitor's tab would hit an upstream that is already rate limiting, and TanStack
 * Query decides whether a failed query is worth another try.
 */
const isRetryableError = (error: FetcherError | ValidationError): boolean => {
  if (error instanceof ValidationError) return false;
  const { status } = error;
  if (!status) return true;
  if (status === 429) return globalThis.window === undefined;
  return status < 400 || status >= 500;
};

// --- Overloaded function signatures for type safety with effect/Schema ---

/**
 * Performs a GET request with optional schema validation.
 */
export function fetcher<T = unknown>(
  input: string,
  method?: 'GET',
  options?: FetcherOptions<T>,
  params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a GET request with Effect schema validation and automatic type inference.
 */
export function fetcher<S extends Schema.Codec<any, any, never>>(
  input: string,
  method: 'GET',
  options: FetcherOptions<Schema.Schema.Type<S>> & { schema: S },
  params?: QueryParams,
): Effect.Effect<Schema.Schema.Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a POST, PUT, or PATCH request with a request body and optional schema validation.
 */
export function fetcher<T = unknown>(
  input: string,
  method: 'POST' | 'PUT' | 'PATCH',
  options?: FetcherOptions<T>,
  params?: QueryParams,
  body?: RequestBody,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a POST, PUT, or PATCH request with Effect schema validation and automatic type inference.
 */
export function fetcher<S extends Schema.Codec<any, any, never>>(
  input: string,
  method: 'POST' | 'PUT' | 'PATCH',
  options: FetcherOptions<Schema.Schema.Type<S>> & { schema: S },
  params?: QueryParams,
  body?: RequestBody,
): Effect.Effect<Schema.Schema.Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Performs a DELETE, OPTIONS, or HEAD request with optional schema validation.
 */
export function fetcher<T = unknown>(
  input: string,
  method: 'DELETE' | 'OPTIONS' | 'HEAD',
  options?: FetcherOptions<T>,
  params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

/**
 * Enhanced data fetching utility with type safety, Effect Schema validation, and Effect-based error handling.
 * Supports retries, timeouts, custom headers, runtime validation, and error handling.
 *
 * @template T
 * @param input The URL to request
 * @param method The HTTP method to use
 * @param options Optional fetcher configuration including Effect Schema
 * @param params Optional query parameters
 * @param body Optional request body (for methods that support it)
 * @returns An Effect that resolves to the validated response data of type T
 *
 * @example
 * ```ts
 * import { Schema } from 'effect';
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
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
 *   Effect.provide(HttpClient.layer)
 * )
 * ```
 */
export function fetcher<T = unknown>(
  input: string,
  method: HttpMethod = 'GET',
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
    bodyType = 'json',
  } = options;

  /**
   * Builds a query string from the provided query parameters.
   */
  const buildQueryString = (params?: QueryParams): string => {
    if (!params) return EMPTY;
    const urlParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;

      if (Array.isArray(value)) {
        value
          .filter((item): item is string | number | boolean => item != null)
          .forEach((item) => {
            urlParams.append(key, String(item));
          });
      } else {
        urlParams.append(key, String(value));
      }
    });

    return urlParams.toString();
  };

  const queryString = buildQueryString(params);

  // Build URL based on environment:
  // - Client-side: keep relative URLs for same-origin requests
  // - Server-side: convert to absolute URLs for SSR
  // - External URLs: keep as-is
  let url: string;
  if (input.startsWith('http')) {
    // Already absolute (external API)
    url = queryString ? `${input}?${queryString}` : input;
  } else {
    // Relative URL - prepend base URL for SSR, keep relative for client
    const baseURL = getBaseURL();
    const fullPath = baseURL ? `${baseURL}${input}` : input;
    url = queryString ? `${fullPath}?${queryString}` : fullPath;
  }

  /**
   * Builds a type-safe HttpClientRequest for the given method and URL.
   */
  const buildRequest = (method: HttpMethod, url: string): HttpClientRequest.HttpClientRequest => {
    switch (method) {
      case 'GET':
        return HttpClientRequest.get(url);
      case 'POST':
        return HttpClientRequest.post(url);
      case 'PUT':
        return HttpClientRequest.put(url);
      case 'PATCH':
        return HttpClientRequest.patch(url);
      case 'DELETE':
        return HttpClientRequest.delete(url);
      case 'OPTIONS':
        return HttpClientRequest.options(url);
      case 'HEAD':
        return HttpClientRequest.head(url);
    }
  };

  /**
   * Validates response data using the provided Effect schema.
   */
  const validateResponse = (
    data: unknown,
    attempt: number,
  ): Effect.Effect<T, ValidationError, never> => {
    if (!schema) {
      return Effect.succeed(data as T);
    }

    const result = Schema.decodeUnknownResult(schema, { reportInput: true })(data);

    if (Result.isFailure(result)) {
      const issues = SchemaIssue.makeFormatterDefault()(result.failure.issue);
      const problems = cut(issues, MAX_ERROR_BODY_CHARS, (rest) => `… (${rest} more characters)`);
      const responseData = keptErrorBody(data, JSON.stringify(data));
      // onError hears of it once, where the request's failure is handled below.
      return Effect.fail(
        new ValidationError('Response validation failed', url, problems, responseData, attempt),
      );
    }

    return Effect.succeed(result.success as T);
  };

  return Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    let attempt = 0;

    // Build the request object
    let req = buildRequest(method, url);

    // Add body for methods that support it with proper error handling
    if (body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (bodyType === 'text') {
        // bodyText returns HttpClientRequest directly
        req = HttpClientRequest.bodyText(String(body))(req);
      } else {
        // bodyJson returns an Effect that may fail during serialization
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
          // It fails before the request runs, so outside the handling below: tell onError here.
          Effect.tapError((error) => Effect.sync(() => onError?.(error))),
        );
      }
    }

    // Set headers AFTER body to ensure Content-Type can be overridden
    const finalHeaders = { ...headers };

    // On the server, requests to this deployment may need the Vercel protection bypass secret.
    // Only ever send it to our own origin: external APIs get absolute URLs passed through as-is.
    // The origin check runs first so the browser (where getBaseURL() is '') never reads
    // server-only env, which t3-env rejects on the client.
    if (isOwnOrigin(url, getBaseURL()) && env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      finalHeaders['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    req = HttpClientRequest.setHeaders(finalHeaders)(req);

    /**
     * Wraps an Effect with a timeout, converting timeout errors to FetcherError.
     */
    const withTimeout = <A, E, R>(
      eff: Effect.Effect<A, E, R>,
    ): Effect.Effect<A, FetcherError | E, R> =>
      pipe(
        eff,
        Effect.timeoutOrElse({
          duration: Duration.millis(timeout),
          orElse: () => Effect.fail(new FetcherTimeoutError('Request timed out', url, attempt)),
        }),
      );

    // Retry schedule: exponential backoff from retryDelay, at most `retries` retries (so 0 means
    // one attempt for every status, 429 included), and only for retryable errors.
    const retrySchedule = Schedule.max([
      Schedule.exponential(Duration.millis(retryDelay)),
      Schedule.recurs(retries),
    ]).pipe(
      Schedule.while(({ input }: { input: FetcherError | ValidationError }) =>
        isRetryableError(input),
      ),
    );

    /**
     * Executes the HTTP request, handling errors, HTTP status, response parsing, and validation.
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
          Effect.catch(() => Effect.succeed(undefined)),
        );

        const responseText = yield* pipe(
          response.text,
          Effect.catch(() => Effect.succeed(null)),
        );

        // Enhanced error handling for 429 Rate Limit responses. Otherwise the status and the start
        // of the body: nothing from the request (its headers carry keys and tokens) is quoted.
        const errorMessage =
          response.status === 429
            ? `Rate limit exceeded (429). Please slow down requests to ${url}`
            : `HTTP ${response.status}: ${bodyForMessage(responseText ?? 'Request failed')}`;

        // onError hears of it once, after the last attempt, where the failure is handled below.
        return yield* Effect.fail(
          new FetcherError(
            errorMessage,
            url,
            response.status,
            keptErrorBody(errorData, responseText),
            attempt,
          ),
        );
      }

      // Parse response data as JSON. Effect's HTTP client caches the body text, so when JSON parsing
      // fails the text can be re-read to report what actually came back. Only a failure to read
      // the body at all falls back to the generic message; it must not swallow the detailed one.
      const rawData = yield* pipe(
        response.json,
        Effect.catch((error) =>
          pipe(
            response.text,
            Effect.mapError(
              () =>
                new FetcherError(
                  `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
                  url,
                  response.status,
                  undefined,
                  attempt,
                ),
            ),
            Effect.flatMap((text) => {
              // Effect normalises header names to lower case.
              const contentType = response.headers['content-type'] || 'unknown';
              const errorMessage = `Failed to parse JSON response. Status: ${response.status}, Content-Type: ${contentType}, Body: ${bodyForMessage(text)}`;
              // Text only: the platform's error keeps the request headers, credentials included.
              const originalError = error instanceof Error ? error.message : String(error);
              return Effect.fail(
                new FetcherError(
                  errorMessage,
                  url,
                  response.status,
                  { originalError, responseText: cut(text, MAX_ERROR_BODY_CHARS) },
                  attempt,
                ),
              );
            }),
          ),
        ),
      );

      // Validate the response data using Effect Schema if provided
      const validatedData = yield* validateResponse(rawData, attempt);

      return validatedData;
    });

    // Run the request with retry. The one place onError hears of a request that failed, once,
    // after its last attempt (a body that fails to serialise is told where it fails, above).
    return yield* pipe(
      executeRequest,
      Effect.retry(retrySchedule),
      Effect.catch((error) => {
        if (error instanceof FetcherError || error instanceof ValidationError) {
          if (onError) onError(error);
          return Effect.fail(error);
        }

        const fetcherError = new FetcherError(String(error), url, undefined, undefined, attempt);

        if (onError) onError(fetcherError);
        return Effect.fail(fetcherError);
      }),
    );
  });
}

/**
 * Convenience function for GET requests with optional schema validation.
 *
 * @example
 * ```ts
 * import { Schema } from 'effect';
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
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

export function get<S extends Schema.Codec<any, any, never>>(
  url: string,
  options: FetcherOptions<Schema.Schema.Type<S>> & { schema: S },
  params?: QueryParams,
): Effect.Effect<Schema.Schema.Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>;

export function get<T = unknown>(url: string, options?: FetcherOptions<T>, params?: QueryParams) {
  return fetcher<T>(url, 'GET', options, params);
}

/**
 * Convenience function for POST requests with optional schema validation.
 */
export function post<T = unknown>(
  url: string,
  body?: RequestBody,
  options?: FetcherOptions<T>,
  params?: QueryParams,
): Effect.Effect<T, FetcherError | ValidationError, HttpClient.HttpClient>;

export function post<S extends Schema.Codec<any, any, never>>(
  url: string,
  body: RequestBody,
  options: FetcherOptions<Schema.Schema.Type<S>> & { schema: S },
  params?: QueryParams,
): Effect.Effect<Schema.Schema.Type<S>, FetcherError | ValidationError, HttpClient.HttpClient>;

export function post<T = unknown>(
  url: string,
  body?: RequestBody,
  options?: FetcherOptions<T>,
  params?: QueryParams,
) {
  return fetcher<T>(url, 'POST', options, params, body);
}
