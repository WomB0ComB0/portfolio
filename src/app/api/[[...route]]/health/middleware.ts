/**
 * Health check middleware
 * Currently no authentication required for health endpoints
 * These are typically public endpoints for monitoring systems
 */

/**
 * Future: Could add rate limiting middleware here
 * to prevent health endpoint abuse
 */
export const healthMiddleware = {
  // No authentication required for health checks
  // These endpoints are typically monitored by external systems
};
