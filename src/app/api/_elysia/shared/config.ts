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
  type Generator,
  type Options as RateLimitOptions,
  rateLimit,
} from 'elysia-rate-limit';
import { elysiaHelmet } from 'elysiajs-helmet';
import { getURL, logger, Stringify } from '@/utils';
import { batchSpanProcessor, otelResource, permission } from '../constants';

/**
 * Configuration options for the Elysia API application
 */
export interface ElysiaApiConfig {
  /**
   * API prefix (e.g., '/api/v1')
   */
  prefix: string;

  /**
   * CORS configuration
   * Uses the same parameters as the @elysiajs/cors plugin
   */
  cors?: Parameters<typeof cors>[0];

  /**
   * Rate limiting configuration
   * Uses the same options as the elysia-rate-limit plugin
   */
  rateLimit?: Partial<RateLimitOptions>;

  /**
   * Security headers configuration
   * Uses the same parameters as the elysiajs-helmet plugin
   */
  security?: Parameters<typeof elysiaHelmet>[0];

  /**
   * Server timing trace configuration
   * Uses the trace options from @elysiajs/server-timing
   */
  serverTiming?: ServerTimingOptions['trace'];

  /**
   * Whether to enable OpenTelemetry tracing
   * @default true (enabled only in non-Vercel environments)
   */
  enableTelemetry?: boolean;

  /**
   * OpenTelemetry configuration
   * Uses the same options as the @elysiajs/opentelemetry plugin
   */
  telemetry?: Partial<ElysiaOpenTelemetryOptions>;

  /**
   * Custom error handler
   */
  errorHandler?: (context: { code: string; error: Error | unknown; set: any }) => any;
}

/**
 * Default configuration values
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
 * Generates a unique identifier for rate limiting based on the request's IP address.
 * @param {*} _r - The request object (unused).
 * @param {*} _s - The response object (unused).
 * @param {{ ip: SocketAddress }} param2 - The context containing the IP address.
 * @returns {string} The IP address or 'unknown' if not available.
 */
const ipGenerator: Generator<{ ip: SocketAddress }> = (_r, _s, { ip }) => ip?.address ?? 'unknown';

/**
 * Creates a configured Elysia application instance with all standard middleware
 * @param config - Configuration options for the Elysia app
 * @returns Configured Elysia instance
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
       * Configures tracing hooks for before/after/error handling.
       * Logs timing and errors for each request.
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
 * Default error handler for API routes
 * Can be imported and used by individual routes
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
