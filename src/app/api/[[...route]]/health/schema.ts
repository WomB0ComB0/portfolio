
import { t } from 'elysia';

/**
 * @const healthCheckSchema
 * @description Schema definition for health check API responses.
 * Ensures health check endpoints return properly structured data with status, timestamp, uptime, and optional service/version metrics.
 * @type {import('elysia').Schema}
 * @readonly
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @see https://elysiajs.com/docs/types.html
 * @example
 * // Expected API response shape:
 * {
 *   success: true,
 *   message: "Service is healthy",
 *   data: {
 *     status: "healthy",
 *     timestamp: "2023-06-10T17:25:23.000Z",
 *     uptime: 123456,
 *     version: "1.2.3",
 *     services: { api: true }
 *   }
 * }
 */
export const healthCheckSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Object({
    status: t.Union([t.Literal('healthy'), t.Literal('degraded'), t.Literal('unhealthy')]),
    timestamp: t.String(),
    uptime: t.Number(),
    version: t.Optional(t.String()),
    services: t.Optional(t.Record(t.String(), t.Boolean())),
  }),
});

/**
 * @const readinessCheckSchema
 * @description Schema for readiness check endpoint. Indicates whether the service is ready to accept network traffic.
 * @type {import('elysia').Schema}
 * @readonly
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
 * @example
 * {
 *   success: true,
 *   message: "Ready for traffic",
 *   data: { ready: true }
 * }
 */
export const readinessCheckSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Object({
    ready: t.Boolean(),
  }),
});

/**
 * @const livenessCheckSchema
 * @description Schema for liveness probe. Used by orchestrators or load balancers to check if the process is running.
 * @type {import('elysia').Schema}
 * @readonly
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
 * @example
 * {
 *   success: true,
 *   message: "Process alive",
 *   data: { alive: true }
 * }
 */
export const livenessCheckSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Object({
    alive: t.Boolean(),
  }),
});

/**
 * @const errorSchema
 * @description Generic error schema for health-related endpoint errors.
 * Always has success: false and provides error/message details.
 * @type {import('elysia').Schema}
 * @readonly
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * {
 *   success: false,
 *   error: "Database unreachable",
 *   message: "Failed health check"
 * }
 */
export const errorSchema = t.Object({
  success: t.Literal(false),
  error: t.String(),
  message: t.Optional(t.String()),
});

/**
 * @const healthSchemas
 * @description Registry of response schemas for various health endpoints, keyed by semantic identifier string. Use this registry for Elysia route validation.
 * @type {{
 *   'health.response': typeof healthCheckSchema,
 *   'health.readiness': typeof readinessCheckSchema,
 *   'health.liveness': typeof livenessCheckSchema,
 *   'health.error': typeof errorSchema
 * }}
 * @readonly
 * @public
 * @author Mike Odnis
 * @see healthCheckSchema
 * @see readinessCheckSchema
 * @see livenessCheckSchema
 * @see errorSchema
 * @version 1.0.0
 * @example
 * import { healthSchemas } from './schema';
 * app.get('/healthz', { response: healthSchemas['health.response'] }, handler);
 */
export const healthSchemas = {
  'health.response': healthCheckSchema,
  'health.readiness': readinessCheckSchema,
  'health.liveness': livenessCheckSchema,
  'health.error': errorSchema,
};

