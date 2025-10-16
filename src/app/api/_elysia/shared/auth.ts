import { type HTTPHeaders, StatusMap } from 'elysia';
import { Logger } from '@/utils';

/**
 * @interface AuthConfig
 * @description
 * Configuration object for authentication handling using bearer tokens.
 * Used to setup environment-based bearer token validation and logging for protected API routes.
 *
 * @property {string} envVar Name of the environment variable containing the auth token. **@readonly**
 * @property {ReturnType<typeof Logger.getLogger>} logger Logger instance for this auth check. **@readonly**
 * @property {string} [errorMessage] Optional custom error message for unauthorized requests.
 * @property {string} [realm='admin'] Optional realm for WWW-Authenticate header.
 *
 * @author Mike Odnis
 * @see {@link https://github.com/WomB0ComB0/portfolio}
 * @version 1.0.0
 */
export interface AuthConfig {
  envVar: string;
  logger: ReturnType<typeof Logger.getLogger>;
  errorMessage?: string;
  realm?: string;
}

/**
 * @interface BearerContext
 * @description
 * Context extension for bearer authentication in Elysia. Injected by @elysiajs/bearer.
 * Includes bearer token and response mutation helpers.
 *
 * @property {string} [bearer] Bearer token from request (if provided).
 * @property {object} set Object for mutating HTTP status and headers in the response.
 * @property {number | keyof typeof import('elysia').StatusMap} [set.status] Status code to return.
 * @property {HTTPHeaders} set.headers Response headers object.
 *
 * @see {@link https://elysiajs.com/plugins/bearer.html}
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface BearerContext {
  bearer?: string;
  set: {
    status?: number | keyof typeof import('elysia').StatusMap;
    headers: HTTPHeaders;
  };
}

/**
 * @interface AuthErrorResponse
 * @description
 * Standard error shape for failed authentication attempts.
 *
 * @property {false} success Indicates unsuccessful authentication (always false).
 * @property {string} error Error title ("Unauthorized").
 * @property {string} message Descriptive error message intended for clients.
 *
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
  message: string;
}

/**
 * @function validateBearerToken
 * @description
 * Validates a bearer token against a configured environment variable.
 * Used internally for guarding protected API routes.
 *
 * @param {string | undefined} token Bearer token from client (if set).
 * @param {string} envVar Name of the environment variable holding the expected secret value.
 * @param {ReturnType<typeof Logger.getLogger>} logger Project logger instance for error output.
 * @returns {boolean} True if token matches environment configuration; false otherwise.
 *
 * @throws {Error} Throws error if the environment variable is missing.
 * @example
 * validateBearerToken('xyz', 'ADMIN_API_TOKEN', Logger.getLogger('admin'))
 *
 * @see AuthConfig
 * @author Mike Odnis
 * @version 1.0.0
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
 * @function createBearerGuard
 * @description
 * Factory function that generates a beforeHandle guard function for Elysia route protection.
 * Uses the @elysiajs/bearer plugin's token extraction and verifies the token.
 *
 * @param {AuthConfig} config Configuration object for the guard, including env var, logger, and optional realm/errorMessage.
 * @returns {(context: BearerContext) => AuthErrorResponse | undefined} Route hook for Elysia's beforeHandle – returns error response on fail, or undefined on success.
 *
 * @example
 * * const guard = createBearerGuard({
 *   envVar: 'ADMIN_API_TOKEN',
 *   logger: Logger.getLogger('AdminAPI')
 * });
 *
 * new Elysia()
 *   .use(bearer())
 *   .get('/protected', handler, { beforeHandle: guard });
 * ```
 *
 * @web
 * @see https://elysiajs.com/plugins/bearer.html
 * @see AuthConfig
 * @author Mike Odnis
 * @version 1.0.0
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
    return undefined; // Auth successful
  };
}

/**
 * @function createAdminBearerGuard
 * @description
 * Factory for a bearer guard enforcing the ADMIN_API_TOKEN secret.
 *
 * @param {string} loggerName Name for constructing a logger instance.
 * @returns {(context: BearerContext) => AuthErrorResponse | undefined} Bearer guard for Elysia beforeHandle.
 *
 * @example
 * ```ts
 * .get('/admin', handlerFn, { beforeHandle: createAdminBearerGuard('api-admin') })
 * ```
 * @web
 * @see createBearerGuard
 * @author Mike Odnis
 * @version 1.0.0
 */
export function createAdminBearerGuard(loggerName: string) {
  return createBearerGuard({
    envVar: 'ADMIN_API_TOKEN',
    logger: Logger.getLogger(loggerName),
    errorMessage: 'Invalid or missing admin authentication token',
  });
}

/**
 * @function createAuthenticator
 * @description
 * Legacy authentication checker using the Authorization header string.
 * Use only if @elysiajs/bearer plugin is unavailable.
 *
 * @deprecated Use createBearerGuard with @elysiajs/bearer plugin instead.
 * @param {AuthConfig} config Authentication configuration as per AuthConfig.
 * @returns {(headers: Headers) => boolean} Function to validate requests based on headers.
 * @see createBearerGuard
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization
 * @author Mike Odnis
 * @version 1.0.0
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
 * @function createAdminAuthenticator
 * @description
 * Legacy function for constructing an admin authenticator using ADMIN_API_TOKEN.
 *
 * @deprecated Use createAdminBearerGuard instead.
 * @param {string} loggerName Name of the logger for context.
 * @returns {(headers: Headers) => boolean} Authenticator function for admin token.
 * @see createAuthenticator
 * @author Mike Odnis
 * @version 1.0.0
 */
export function createAdminAuthenticator(loggerName: string) {
  return createAuthenticator({
    envVar: 'ADMIN_API_TOKEN',
    logger: Logger.getLogger(loggerName),
  });
}
