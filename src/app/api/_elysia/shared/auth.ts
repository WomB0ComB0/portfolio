import { StatusMap, type HTTPHeaders } from 'elysia';
import { Logger } from '@/utils';

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /**
   * Name of the environment variable containing the auth token
   */
  envVar: string;
  /**
   * Logger instance for this auth check
   */
  logger: ReturnType<typeof Logger.getLogger>;
  /**
   * Custom error message for unauthorized requests
   */
  errorMessage?: string;
  /**
   * WWW-Authenticate realm
   * @default 'admin'
   */
  realm?: string;
}

/**
 * Bearer authentication context extension
 * Extends Elysia's context with bearer token from @elysiajs/bearer plugin
 */
export interface BearerContext {
  bearer?: string;
  set: {
    status?: number | keyof typeof import('elysia').StatusMap;
    headers: HTTPHeaders;
  };
}

/**
 * Standard auth error response
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
  message: string;
}

/**
 * Validates a bearer token against an environment variable
 * @param token - The bearer token to validate
 * @param envVar - The environment variable name containing the expected token
 * @param logger - Logger instance for error logging
 * @returns true if token is valid, false otherwise
 */
export function validateBearerToken(
  token: string | undefined,
  envVar: string,
  logger: ReturnType<typeof Logger.getLogger>,
): boolean {
  if (!token) {
    return false;
  }

  const expectedToken = process.env[envVar];

  if (!expectedToken) {
    logger.error(`${envVar} not configured in environment`);
    return false;
  }

  return token === expectedToken;
}

/**
 * Factory function to create a bearer authentication guard for Elysia routes
 * Uses the @elysiajs/bearer plugin pattern
 *
 * @param config - Authentication configuration
 * @returns beforeHandle function for Elysia routes
 *
 * @example
 * ```ts
 * const guard = createBearerGuard({
 *   envVar: 'ADMIN_API_TOKEN',
 *   logger: Logger.getLogger('AdminAPI'),
 *   realm: 'admin'
 * });
 *
 * new Elysia()
 *   .use(bearer())
 *   .get('/protected', handler, {
 *     beforeHandle: guard
 *   });
 * ```
 */
export function createBearerGuard(config: AuthConfig) {
  const realm = config.realm || 'admin';

  return (context: BearerContext): AuthErrorResponse | undefined => {
    if (!validateBearerToken(context.bearer, config.envVar, config.logger)) {
      config.logger.warn('Unauthorized API access attempt');

      // Set WWW-Authenticate header per RFC 6750
      context.set.headers['WWW-Authenticate'] = `Bearer realm='${realm}', error="invalid_token"`;
      context.set.status = StatusMap['Unauthorized'];

      return {
        success: false,
        error: 'Unauthorized',
        message: config.errorMessage || 'Invalid or missing authentication token',
      };
    }
  };
}

/**
 * Create a standard admin bearer authentication guard
 * Uses ADMIN_API_TOKEN environment variable
 * @param loggerName - Logger name for this authenticator
 * @returns beforeHandle function for Elysia routes
 */
export function createAdminBearerGuard(loggerName: string) {
  return createBearerGuard({
    envVar: 'ADMIN_API_TOKEN',
    logger: Logger.getLogger(loggerName),
    errorMessage: 'Invalid or missing admin authentication token',
  });
}

/**
 * Legacy authentication checker (deprecated - use createBearerGuard instead)
 * @deprecated Use createBearerGuard with @elysiajs/bearer plugin instead
 */
export function createAuthenticator(config: AuthConfig) {
  return (headers: Headers): boolean => {
    const authHeader = headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.slice(7);
    return validateBearerToken(token, config.envVar, config.logger);
  };
}

/**
 * Create a standard admin authenticator (legacy)
 * @deprecated Use createAdminBearerGuard instead
 */
export function createAdminAuthenticator(loggerName: string) {
  return createAuthenticator({
    envVar: 'ADMIN_API_TOKEN',
    logger: Logger.getLogger(loggerName),
  });
}
