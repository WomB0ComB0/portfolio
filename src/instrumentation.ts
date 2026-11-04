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

// Sentry owns the global OpenTelemetry tracer provider. @vercel/otel used to register one first
// in production, and Sentry then skips its own, so Next.js server spans never reached Sentry.
// This repo configures no exporter for @vercel/otel (no OTEL_EXPORTER_OTLP_* variables).
// Keep this module free of directives: Next.js only needs the two plain exports below.

import * as Sentry from '@sentry/nextjs';

/**
 * Loads the Sentry SDK for the current runtime. Called once by Next.js per server instance.
 * Whether events are sent is decided in the SDK options (src/lib/observability/sentry-options.ts).
 */
export async function register(): Promise<void> {
  const runtime = process.env.NEXT_RUNTIME;
  try {
    if (runtime === 'edge') {
      await import('../instrumentation-edge');
    } else {
      await import('../instrumentation-server');
    }
  } catch (error) {
    // Keep serving without Sentry rather than failing every request.
    console.error(`[instrumentation:${runtime ?? 'nodejs'}] could not initialise Sentry`, error);
  }
}

/**
 * Next.js calls this for errors thrown while rendering, in route handlers, server actions and
 * the proxy. captureRequestError adds the request, route and router context and flushes before
 * the function is frozen.
 */
export const onRequestError = Sentry.captureRequestError;
