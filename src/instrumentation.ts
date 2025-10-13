'use server';

import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import defer * as Sentry from '@sentry/nextjs';
import type { Configuration } from '@vercel/otel';
import { registerOTel } from '@vercel/otel';
import { env } from '@/env';

/**
 * Registers and configures instrumentation services for the application.
 * This includes OpenTelemetry for observability and Sentry for error tracking.
 *
 * @async
 * @const register
 * @returns {Promise<void>} A promise that resolves when all instrumentation is configured
 *
 * @example
 * ```ts
 * // This is typically called automatically by Next.js
 * await register();
 * ```
 *
 * @remarks
 * - Initializes OpenTelemetry with the service name 'portfolio'
 * - Conditionally imports Sentry configs based on runtime environment
 * - Handles both Node.js and Edge runtime environments
 * - Should be called before the application starts handling requests
 *
 * @throws {Error} May throw if Sentry config imports fail or if OTel registration fails
 */
export const register = async (): Promise<void> => {
  const runtime = process.env.NEXT_RUNTIME;

  try {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
      registerOTel({
        serviceName: 'portfolio',
        instrumentations: runtime === 'edge' ? [] : undefined,
        instrumentationConfig: {
          fetch: {
            ignoreUrls: [/health/, /metrics/, /api\.mikeodnis\.dev/],
            propagateContextUrls: [
              /api\.mikeodnis\.dev/, // API domain for Mike Odnis
              /vercel\.app/,
            ],
            resourceNameTemplate: '{http.host}{http.target}',
          },
        },
        traceSampler: runtime === 'edge' ? undefined : new TraceIdRatioBasedSampler(0.1), // Sample 10% of requests
      } satisfies Configuration);
    }

    if (env.NEXT_PUBLIC_SENTRY_DSN) {
      try {
        if (runtime === 'edge') {
          (await import('../instrumentation-edge').catch(() => {
            throw new Error('Could not load Sentry edge config');
          })) satisfies typeof import('../instrumentation-edge');
        } else {
          (await import('../instrumentation-server').catch(() => {
            throw new Error('Could not load Sentry server config');
          })) satisfies typeof import('../instrumentation-server');
        }
      } catch (e) {
        console.warn('Could not load Sentry config:', e);
        // Optionally continue without Sentry rather than crashing
      }
    }
  } catch (error) {
    console.error(
      `[Instrumentation:${runtime || 'unknown'}]`,
      Error.isError(error) ? error : `Error: ${String(error)}`,
    );
    Sentry.captureException(error);
    throw Error.isError(error)
      ? error
      : new Error(`Instrumentation initialization failed: ${String(error)}`);
  }
};

/**
 * Error handler function that captures and reports request errors to Sentry.
 * Direct export of Sentry's captureRequestError function for use in error boundaries
 * or request handlers.
 *
 * @const onRequestError
 * @type {typeof Sentry.captureRequestError}
 *
 * @example
 * ```ts
 * try {
 *   await handleRequest(req);
 * } catch (error) {
 *   onRequestError(error);
 * }
 * ```
 *
 * @remarks
 * - Automatically captures request context and error details
 * - Integrates with Sentry's error tracking system
 * - Preserves error stack traces and metadata
 * - Should be used for handling request-specific errors
 */
export const onRequestError = Sentry.captureException;
