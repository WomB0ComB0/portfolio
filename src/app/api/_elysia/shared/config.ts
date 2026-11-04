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

import { cors } from '@elysiajs/cors';
import type { ElysiaOpenTelemetryOptions } from '@elysiajs/opentelemetry';
import { opentelemetry } from '@elysiajs/opentelemetry';
import type { ServerTimingOptions } from '@elysiajs/server-timing';
import { serverTiming } from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { ip } from 'elysia-ip';
import {
  DefaultContext,
  type Generator,
  type Options as RateLimitOptions,
  rateLimit,
} from 'elysia-rate-limit';
import { getClientIP } from '@/lib/security/get-ip';
import { getURL, logger, Stringify } from '@/utils';
import { batchSpanProcessor, otelResource } from '../constants';

/**
 * @interface ElysiaApiConfig
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://elysiajs.com/
 * @see https://github.com/WomB0ComB0/portfolio
 *
 * Configuration options for the Elysia API application.
 */
export interface ElysiaApiConfig {
  /**
   * API endpoint prefix (e.g., '/api/v1').
   * @readonly
   */
  prefix: string;

  /**
   * CORS configuration.
   * Uses the same parameters as the @elysiajs/cors plugin.
   * @see https://elysiajs.com/plugins/cors.html
   */
  cors?: Parameters<typeof cors>[0];

  /**
   * Rate limiting configuration.
   * Uses the same options as the elysia-rate-limit plugin.
   * @see https://github.com/elysiajs/elysia-rate-limit
   */
  rateLimit?: Partial<RateLimitOptions>;

  /**
   * Server timing trace configuration.
   * Uses the trace options from @elysiajs/server-timing.
   * @see https://elysiajs.com/plugins/server-timing.html
   */
  serverTiming?: ServerTimingOptions['trace'];

  /**
   * Whether to enable OpenTelemetry tracing.
   * @default true (enabled only in non-Vercel environments)
   * @see https://opentelemetry.io/docs/
   */
  enableTelemetry?: boolean;

  /**
   * OpenTelemetry configuration.
   * Uses the same options as the @elysiajs/opentelemetry plugin.
   * @see https://elysiajs.com/plugins/opentelemetry.html
   */
  telemetry?: Partial<ElysiaOpenTelemetryOptions>;

  /**
   * Custom error handler.
   * @param context - Contains `code`, `error`, and response `set` modifier
   * @returns {any}
   * @example
   *   * errorHandler: ({ code, error, set }) => { set.status = 404; return {...}; }
   * ```
   * @throws Error
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorHandler?: (context: any) => any;
}

/**
 * The default error handler: a 400, 404 or 500 with a fixed JSON body.
 *
 * Bad input is the client's mistake: answer 400 without echoing the validator schema back.
 * A handler returning data that breaks its own response schema is also a VALIDATION error, but
 * that one is a server bug, so it takes the 500 path. The 404 and 500 bodies are fixed strings;
 * the error itself only goes to the log.
 * @function
 * @param {{ code: unknown, error: unknown, set: { status: number } }} context - Error context.
 * @returns {string} The JSON response body.
 */
function handleApiError({
  code,
  error,
  set,
}: {
  code: unknown;
  error: unknown;
  set: { status: number };
}): string {
  const isResponseValidation =
    code === 'VALIDATION' && (error as { type?: unknown } | null)?.type === 'response';
  if ((code === 'VALIDATION' && !isResponseValidation) || code === 'PARSE') {
    logger.warn('API request rejected', { code });
    set.status = 400;
    return Stringify({
      error: code === 'PARSE' ? 'Malformed request body' : 'Invalid request',
      status: 400,
    });
  }
  logger.error('API error handler', error, { code });
  const isNotFound = code === 'NOT_FOUND' || code === 404;
  set.status = isNotFound ? 404 : 500;
  return Stringify({
    error: isNotFound ? 'Not found' : 'Internal server error',
    status: set.status,
  });
}

/**
 * @const DEFAULT_CONFIG
 * @type {Partial<ElysiaApiConfig>}
 * @readonly
 * @author Mike Odnis
 * @see ElysiaApiConfig
 * @description
 * Default configuration values used for initializing the Elysia API.
 */
const DEFAULT_CONFIG: Partial<ElysiaApiConfig> = {
  cors: {
    origin: getURL(),
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86_400,
  },
  rateLimit: {
    duration: 60_000,
    max: 100,
    headers: true,
    scoping: 'scoped',
    countFailedRequest: true,
  },
  serverTiming: {
    request: true,
    parse: true,
    transform: true,
    beforeHandle: true,
    handle: true,
    afterHandle: true,
    error: true,
    mapResponse: true,
    total: true,
  },
  enableTelemetry: true,
  errorHandler: handleApiError,
};

/**
 * Rate-limit key: the client IP from the hosting layer's headers (see getClientIP).
 *
 * It used to read `ip.address` from elysia-ip's derived context, but that value is a plain string,
 * so every client was keyed as 'unknown' and all visitors shared one bucket per instance.
 * @function
 * @param {Request} request - The incoming request.
 * @returns {string} The client's IP address.
 */
const ipGenerator: Generator = (request) => getClientIP(request);

/**
 * Creates a configured Elysia application instance with all standard middleware.
 * @function
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @web
 * @param {ElysiaApiConfig} config - Configuration options for the Elysia app.
 * @returns {Elysia} Configured Elysia instance.
 * @throws Error If plugin initialization fails.
 * @see https://elysiajs.com/
 * @see ElysiaApiConfig
 * @async
 * @example
 * ```ts
 * const app = createElysiaApp({ prefix: '/api', cors: {...} });
 * ```
 */
export function createElysiaApp(config: ElysiaApiConfig) {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    cors: { ...DEFAULT_CONFIG.cors, ...config.cors },
    rateLimit: { ...DEFAULT_CONFIG.rateLimit, ...config.rateLimit },
    serverTiming: { ...DEFAULT_CONFIG.serverTiming, ...config.serverTiming },
  } as Required<ElysiaApiConfig>;

  const api = new Elysia({ prefix: mergedConfig.prefix })
    .onParse(({ request }) => {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('multipart/form-data')) {
        return request.formData();
      }
      if (contentType?.includes('application/json')) {
        return request.json();
      }
      return null;
    })
    .trace(
      /**
       * Registers tracing hooks for before/after/error handling.
       * Logs timing and errors per request lifecycle.
       *
       * @async
       * @param {{
       *    onBeforeHandle: Function,
       *    onAfterHandle: Function,
       *    onError: Function
       * }} context Elysia trace event APIs.
       * @returns {Promise<void>}
       * @author Mike Odnis
       * @version 1.0.0
       * @see https://elysiajs.com/plugins/opentelemetry.html
       */
      async ({ onBeforeHandle, onAfterHandle, onError }) => {
        onBeforeHandle(({ begin, onStop }) => {
          onStop(({ end }) => {
            logger.debug('BeforeHandle took', { duration: end - begin });
          });
        });
        onAfterHandle(({ begin, onStop }) => {
          onStop(({ end }) => {
            logger.debug('AfterHandle took', { duration: end - begin });
          });
        });
        onError(({ begin, onStop }) => {
          onStop(({ end, error }) => {
            logger.error('Error occurred after trace', error, { duration: end - begin });
          });
        });
      },
    )
    // Security headers (HSTS, CSP, COOP, CORP, Permissions-Policy, ...) come from next.config.ts
    // headers(), see src/config/security-headers.ts. A header set here would replace that value
    // for the same key, so this app does not set any of them.
    .use(ip())
    .use(
      // Only use OpenTelemetry in local development
      mergedConfig.enableTelemetry && batchSpanProcessor
        ? opentelemetry({
            resource: otelResource,
            spanProcessors: [batchSpanProcessor],
          })
        : new Elysia(),
    )
    .use(
      serverTiming({
        trace: mergedConfig.serverTiming,
      }),
    )
    .use(
      cors({
        origin: mergedConfig.cors.origin,
        methods: mergedConfig.cors.methods,
        allowedHeaders: mergedConfig.cors.allowedHeaders,
        credentials: mergedConfig.cors.credentials,
        maxAge: mergedConfig.cors.maxAge,
      }),
    )
    .use(
      rateLimit({
        duration: mergedConfig.rateLimit.duration,
        max: mergedConfig.rateLimit.max,
        headers: mergedConfig.rateLimit.headers,
        scoping: mergedConfig.rateLimit.scoping,
        countFailedRequest: mergedConfig.rateLimit.countFailedRequest,
        errorResponse: new Response(
          Stringify({
            error: 'Too many requests',
          }),
          { status: 429 },
        ),
        generator: ipGenerator,
        context: new DefaultContext(10_000),
      }),
    );

  // Swagger is disabled due to compatibility issues with Next.js serverless environment
  // To enable API documentation, consider using a separate documentation solution

  // Add error handler
  if (mergedConfig.errorHandler) {
    api.onError(mergedConfig.errorHandler);
  }

  return api;
}

/**
 * Default error handler for API routes.
 * @constant
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @description
 * Can be imported and used by individual API routes for consistent error formatting and logging.
 * @param {{ code: unknown, error: unknown, set: { status: number } }} context - Error context.
 * @returns {string} The JSON response body.
 * @see handleApiError
 * @example
 * ```ts
 * app.onError(defaultErrorHandler);
 * ```
 */
export const defaultErrorHandler = handleApiError;
