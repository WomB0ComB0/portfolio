import { Elysia } from 'elysia';
import {
  handleDetailedHealthCheck,
  handleHealthCheck,
  handleLivenessCheck,
  handleReadinessCheck,
} from './handlers';
import { healthSchemas } from './schema';

/**
 * Health check routes
 * Provides endpoints for service health monitoring
 *
 * Endpoints:
 * - GET /health - Basic health check
 * - GET /health/detailed - Detailed health information
 * - GET /health/ready - Readiness probe (K8s compatible)
 * - GET /health/live - Liveness probe (K8s compatible)
 */
export const healthRoute = new Elysia({ prefix: '/health' })
  .model(healthSchemas)
  .get(
    '/',
    async () => {
      try {
        const result = handleHealthCheck();
        return {
          success: true as const,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Health check failed',
          message: 'Failed to perform health check',
        };
      }
    },
    {
      detail: {
        summary: 'Basic health check',
        description: 'Returns basic service health status',
        tags: ['Health'],
      },
      response: {
        200: 'health.response',
        500: 'health.error',
      },
    },
  )
  .get(
    '/detailed',
    async () => {
      try {
        const result = handleDetailedHealthCheck();
        return {
          success: true as const,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Detailed health check failed',
          message: 'Failed to perform detailed health check',
        };
      }
    },
    {
      detail: {
        summary: 'Detailed health check',
        description: 'Returns comprehensive service health information',
        tags: ['Health'],
      },
      response: {
        200: 'health.response',
        500: 'health.error',
      },
    },
  )
  .get(
    '/ready',
    async () => {
      try {
        const result = handleReadinessCheck();
        return {
          success: true as const,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Readiness check failed',
          message: 'Service is not ready',
        };
      }
    },
    {
      detail: {
        summary: 'Readiness probe',
        description: 'Checks if service is ready to accept traffic (Kubernetes compatible)',
        tags: ['Health', 'Kubernetes'],
      },
      response: {
        200: 'health.readiness',
        503: 'health.error',
      },
    },
  )
  .get(
    '/live',
    async () => {
      try {
        const result = handleLivenessCheck();
        return {
          success: true as const,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Liveness check failed',
          message: 'Service is not alive',
        };
      }
    },
    {
      detail: {
        summary: 'Liveness probe',
        description: 'Checks if service is alive (Kubernetes compatible)',
        tags: ['Health', 'Kubernetes'],
      },
      response: {
        200: 'health.liveness',
        500: 'health.error',
      },
    },
  );
