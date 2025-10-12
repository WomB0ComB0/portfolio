import { t } from 'elysia';

/**
 * Zod validation schemas for health endpoints
 */

/**
 * Health check response schema
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
 * Readiness check response schema
 */
export const readinessCheckSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Object({
    ready: t.Boolean(),
  }),
});

/**
 * Liveness check response schema
 */
export const livenessCheckSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Object({
    alive: t.Boolean(),
  }),
});

/**
 * Error response schema
 */
export const errorSchema = t.Object({
  success: t.Literal(false),
  error: t.String(),
  message: t.Optional(t.String()),
});

/**
 * Model registry for health schemas
 */
export const healthSchemas = {
  'health.response': healthCheckSchema,
  'health.readiness': readinessCheckSchema,
  'health.liveness': livenessCheckSchema,
  'health.error': errorSchema,
};
