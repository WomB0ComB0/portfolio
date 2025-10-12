import { cors } from '@elysiajs/cors';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { serverTiming } from '@elysiajs/server-timing';
import { swagger } from '@elysiajs/swagger';
import type { SocketAddress } from 'bun';
import { Elysia } from 'elysia';
import { ip } from 'elysia-ip';
import { DefaultContext, type Generator, rateLimit } from 'elysia-rate-limit';
import { elysiaHelmet } from 'elysiajs-helmet';
import { getURL, logger, Stringify } from '@/utils';
import { batchSpanProcessor, IS_VERCEL, otelResource, permission, version } from '../../_elysia/constants';
import { apiRoutes, utilityRoutes } from './elysia';

/**
 * Generates a unique identifier for rate limiting based on the request's IP address.
 * @param {*} _r - The request object (unused).
 * @param {*} _s - The response object (unused).
 * @param {{ ip: SocketAddress }} param2 - The context containing the IP address.
 * @returns {string} The IP address or 'unknown' if not available.
 */
const ipGenerator: Generator<{ ip: SocketAddress }> = (_r, _s, { ip }) => ip?.address ?? 'unknown';

const app = new Elysia({ prefix: '/api/v1' })
  .onParse(({ request, contentType }) => {
    if (contentType === 'multipart/form-data') {
      return request.formData();
    }
    if (contentType === 'application/json') {
      return request.json();
    }
    return null;
  })
  .use(utilityRoutes)
  .use(apiRoutes)
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: '🦊 Portfolio v3 API Server',
          version: version || '1.0.0',
          description: `
						Portfolio v3


						> **Contact: [API Support](mailto:mike@mikeodnis.dev)
          `,
          contact: {
            name: 'API Support',
            email: 'mike@mikeodnis.dev',
          },
        },
        tags: [
          {
            name: 'Utility',
            description: 'Status, version, and health check endpoints',
          },
          {
            name: 'Info',
            description: 'API information endpoints',
          },
        ],
      },
    }),
  )
  .trace(
    /**
     * Configures tracing hooks for before/after/error handling.
     * Logs timing and errors for each request.
     * @param {object} param0 - The tracing context.
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
  .use(
    elysiaHelmet({
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
    }),
  )
  .use(ip())
  .use(
    // Only use OpenTelemetry in local development
    batchSpanProcessor
      ? opentelemetry({
          resource: otelResource,
          spanProcessors: [batchSpanProcessor],
        })
      : new Elysia(),
  )
  .use(
    serverTiming({
      trace: {
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
    }),
  )
  // --- CORS configuration for cross-origin requests ---
  .use(
    cors({
      origin: getURL(),
      methods: ['GET', 'POST', 'OPTIONS'], // Specify allowed HTTP methods
      allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
      credentials: true, // Allow credentials (e.g., cookies, authorization headers)
      maxAge: 86_400, // Cache the preflight response for 24 hours
    }),
  )
  .use(
    rateLimit({
      duration: 60_000,
      max: 100,
      headers: true,
      scoping: 'scoped',
      countFailedRequest: true,
      errorResponse: new Response(
        Stringify({
          error: 'Too many requests',
        }),
        { status: 429 },
      ),
      generator: ipGenerator,
      context: new DefaultContext(10_000),
    }),
  )
  .onError(
    /**
     * Global error handler for the API.
     * Logs the error and returns a JSON error response.
     * @param {object} param0 - The error context.
     * @param {string} param0.code - The error code.
     * @param {Error} param0.error - The error object.
     * @param {object} param0.set - The response setter.
     * @returns {string} The JSON error response.
     */
    ({ code, error, set }) => {
      logger.error('API error handler', error, { code });
      set.status = code === 'NOT_FOUND' ? 404 : 500;
      return Stringify({
        error: error instanceof Error ? Stringify({ error }) : Stringify({ error }),
        status: set.status,
      });
    },
  );

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;

/**
 * Gracefully shuts down telemetry on Vercel using waitUntil if available.
 * For local development, flushes the batch span processor.
 */
const shutdown = async (): Promise<void> => {
  if (IS_VERCEL) {
    // On Vercel, we can't rely on process signals, so this is mainly for cleanup
    logger.info('Vercel function cleanup');
  } else {
    logger.info('Shutting down 🦊 Elysia');
    if (batchSpanProcessor) {
      await batchSpanProcessor.forceFlush();
    }
  }
};

// Don't set up process listeners on Vercel
if (!IS_VERCEL) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export type App = typeof app;
