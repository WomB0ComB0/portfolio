
import { Elysia } from 'elysia';
import {
  handleDetailedHealthCheck,
  handleHealthCheck,
  handleLivenessCheck,
  handleReadinessCheck,
} from './handlers';
import { healthSchemas } from './schema';

/**
 * @class
 * @classdesc
 * Defines all service health monitoring HTTP endpoints for the portfolio project.
 * Provides RESTful APIs for basic health, detailed health, readiness, and liveness checks.
 * Endpoints documented below are compatible with common orchestration/monitoring systems.
 *
 * @readonly
 * @public
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://elysiajs.com/docs/
 * @version 1.0.0
 *
 * @example
 * import { healthRoute } from './health';
 * app.use(healthRoute);
 */
export const healthRoute = new Elysia({ prefix: '/health' })
  .model(healthSchemas)
  /**
   * Basic health check endpoint.
   *
   * @route GET /health
   * @async
   * @function
   * @returns {Promise<import('./schema').healthCheckSchema>} Resolves with a basic health check response object on 200.
   * @throws {Error} Throws error if the health check cannot be performed.
   * @web
   * @public
   * @author Mike Odnis
   * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
   * @version 1.0.0
   * @example
   * // Returns:
   * // { success: true, message: 'OK', data: { ... } }
   */
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
  /**
   * Detailed health check endpoint.
   *
   * @route GET /health/detailed
   * @async
   * @function
   * @returns {Promise<import('./schema').healthCheckSchema>} Resolves with a detailed health check response object on 200.
   * @throws {Error} Throws if unable to perform a detailed health check.
   * @web
   * @public
   * @author Mike Odnis
   * @see https://github.com/WomB0ComB0/portfolio
   * @version 1.0.0
   * @example
   * // GET /health/detailed
   * // Returns:
   * // { success: true, message: "All dependencies healthy", data: { ... } }
   */
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
  /**
   * Readiness probe endpoint for Kubernetes.
   *
   * @route GET /health/ready
   * @async
   * @function
   * @returns {Promise<import('./schema').readinessCheckSchema>} Resolves to readiness response, describing if service is ready.
   * @throws {Error} Throws if readiness check fails.
   * @web
   * @public
   * @author Mike Odnis
   * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
   * @version 1.0.0
   * @example
   * // GET /health/ready
   * // { success: true, data: { ready: true } }
   */
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
  /**
   * Liveness probe endpoint for Kubernetes.
   *
   * @route GET /health/live
   * @async
   * @function
   * @returns {Promise<import('./schema').livenessCheckSchema>} Resolves to liveness response, describing if service process is alive.
   * @throws {Error} Throws if liveness check fails.
   * @web
   * @public
   * @author Mike Odnis
   * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
   * @version 1.0.0
   * @example
   * // GET /health/live
   * // { success: true, data: { alive: true } }
   */
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

