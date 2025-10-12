import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { app } from '@/constants';

/**
 * Check if running on Vercel
 */
export const IS_VERCEL = !!process.env.VERCEL;

/**
 * Content Security Policy permissions for Helmet.
 * Used to configure allowed sources for various content types.
 * @type {object}
 */
export const permission = {
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  HTTPS: 'https:',
  DATA: 'data:',
  NONE: "'none'",
  BLOB: 'blob:',
} as const;

/**
 * OpenTelemetry resource for Jaeger tracing.
 * Sets the service name for trace identification.
 * @type {import('@opentelemetry/resources').Resource}
 */
export const otelResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'elysia-api',
});

/**
 * OTLP trace exporter for sending traces to Jaeger.
 * Only configured for local development.
 * @type {OTLPTraceExporter | undefined}
 */
export const otlpExporter = !IS_VERCEL
  ? new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
      keepAlive: true,
    })
  : undefined;

/**
 * Batch span processor for OpenTelemetry.
 * Handles batching and exporting of trace spans.
 * Only configured for local development.
 * @type {BatchSpanProcessor | undefined}
 */
export const batchSpanProcessor = otlpExporter
  ? new BatchSpanProcessor(otlpExporter, {
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5_000,
      exportTimeoutMillis: 30_000,
      maxQueueSize: 2_048,
    })
  : undefined;

/**
 * The current application version, loaded from package.json.
 * @type {string}
 */
export const version: string = app.version;
