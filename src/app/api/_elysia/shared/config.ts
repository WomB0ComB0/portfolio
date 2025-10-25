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

import { getURL, logger, Stringify } from '@/utils';
import { cors } from '@elysiajs/cors';
import type { ElysiaOpenTelemetryOptions } from '@elysiajs/opentelemetry';
import { opentelemetry } from '@elysiajs/opentelemetry';
import type { ServerTimingOptions } from '@elysiajs/server-timing';
import { serverTiming } from '@elysiajs/server-timing';
import type { SocketAddress } from 'bun';
import { Elysia } from 'elysia';
import { ip } from 'elysia-ip';
import {
  DefaultContext,
  rateLimit,
  type Generator,
  type Options as RateLimitOptions,
} from 'elysia-rate-limit';
import { elysiaHelmet } from 'elysiajs-helmet';
import { batchSpanProcessor, otelResource, permission } from '../constants';

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
   * Security headers configuration.
   * Uses the same parameters as the elysiajs-helmet plugin.
   * @see https://github.com/EverlastingBugstopper/elysiajs-helmet
   */
  security?: Parameters<typeof elysiaHelmet>[0];

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
  errorHandler?: (context: { code: string; error: Error | unknown; set: any }) => any;
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
  security: {
    csp: {
      defaultSrc: [permission.SELF],
      scriptSrc: [permission.SELF, permission.UNSAFE_INLINE],
      styleSrc: [permission.SELF, permission.UNSAFE_INLINE],
      imgSrc: [permission.SELF, permission.DATA, permission.HTTPS],
      useNonce: true,
    },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [permission.NONE],
      microphone: [permission.NONE],
    },
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
  errorHandler: ({ code, error, set }) => {
    logger.error('API error handler', error, { code });
    set.status = code === 'NOT_FOUND' ? 404 : 500;
    return Stringify({
      error: error instanceof Error ? Stringify({ error }) : Stringify({ error }),
      status: set.status,
    });
  },
};

/**
 * Generates a unique identifier for rate limiting using the request's IP address.
 * @function
 * @author Mike Odnis
 * @param {any} _r - The request object (unused in context).
 * @param {any} _s - The response object (unused in context).
 * @param {{ ip: SocketAddress }} param2 - The Elysia context containing the client IP.
 * @returns {string} The client's IP address or 'unknown' if not available.
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * const id = ipGenerator(req, res, { ip: { address: '127.0.0.1' } });
 */
const ipGenerator: Generator<{ ip: SocketAddress }> = (_r, _s, { ip }) => ip?.address ?? 'unknown';

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
    security: { ...DEFAULT_CONFIG.security, ...config.security },
    serverTiming: { ...DEFAULT_CONFIG.serverTiming, ...config.serverTiming },
  } as Required<ElysiaApiConfig>;

  const api = new Elysia({ prefix: mergedConfig.prefix })
    .onParse(({ request, contentType }) => {
      if (contentType === 'multipart/form-data') {
        return request.formData();
      }
      if (contentType === 'application/json') {
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
    .use(elysiaHelmet(mergedConfig.security))
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
 * @param {{ code: string, error: Error | unknown, set: any }} context - Error handling context.
 * @returns {any} JSON serialization of the error payload.
 * @throws Error If context.error is thrown further.
 * @example
 * ```ts
 * app.onError(defaultErrorHandler);
 * ```
 */
export const defaultErrorHandler =
  DEFAULT_CONFIG.errorHandler ??
  (({ code, error, set }) => {
    logger.error('API error handler', error, { code });
    set.status = code === 'NOT_FOUND' ? 404 : 500;
    return Stringify({
      error: error instanceof Error ? Stringify({ error }) : Stringify({ error }),
      status: set.status,
    });
  });
