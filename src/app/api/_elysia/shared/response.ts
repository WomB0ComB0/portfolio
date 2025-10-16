
import { Stringify } from '@/utils';
import { StatusMap } from 'elysia';

/**
 * Represents the structure of a successful API response.
 *
 * @template T - The type of the data returned.
 * @property {true} success - Indicates the response is a success.
 * @property {string} [message] - Optional message providing additional info.
 * @property {T} [data] - Optional returned data.
 * @interface
 * @public
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

/**
 * Represents the structure of an error API response.
 *
 * @property {false} success - Indicates the response is an error.
 * @property {string} error - Description of the error.
 * @property {string} [message] - Optional additional error message.
 * @interface
 * @public
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
}

/**
 * Union type of possible API responses — either successful or error.
 *
 * @template T
 * @public
 * @author Mike Odnis
 * @see ApiSuccessResponse
 * @see ApiErrorResponse
 * @version 1.0.0
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Options for customizing the API response creator functions.
 *
 * @property {keyof typeof StatusMap} [status] - Status as a key from StatusMap.
 * @property {Record<string, string>} [headers] - Custom headers to append.
 * @interface
 * @public
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export interface ResponseOptions {
  status?: keyof typeof StatusMap;
  headers?: Record<string, string>;
}

/**
 * Default JSON headers for response objects.
 *
 * @readonly
 * @public
 * @type {{ 'Content-Type': string }}
 * @author Mike Odnis
 * @version 1.0.0
 */
const DEFAULT_JSON_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Creates a standardized JSON HTTP response for successful operations.
 *
 * @template T
 * @param {T} data - The payload to return to the client.
 * @param {string} [message] - Optional success message for consumers.
 * @param {ResponseOptions} [options={}] - Optional status and headers for the response.
 * @returns {Response} A standardized HTTP JSON Response for success.
 * @throws {Error} If response creation fails internally.
 * @web
 * @example
 * // Basic usage in a handler
 * return createSuccessResponse({ name: "World" }, "Greeting successful");
 * @author Mike Odnis
 * @see ApiSuccessResponse
 * @version 1.0.0
 * @public
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  options: ResponseOptions = {},
): Response {
  const { status = 'OK', headers = {} } = options;

  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    body.message = message;
  }

  return new Response(Stringify(body), {
    status: StatusMap[status],
    headers: {
      ...DEFAULT_JSON_HEADERS,
      ...headers,
    },
  });
}

/**
 * Creates a standardized JSON HTTP response for error results.
 *
 * @param {string | Error} error - Description or Error object for the failure.
 * @param {string} [message] - Additional detail about the error, if applicable.
 * @param {ResponseOptions} [options={}] - Optionally specify status and headers.
 * @returns {Response} A standardized HTTP JSON Response indicating an error.
 * @throws {Error} If response creation fails.
 * @web
 * @example
 * // Usage when catching errors
 * return createErrorResponse("Invalid data", "Validation error", { status: "Bad Request" });
 * @author Mike Odnis
 * @see ApiErrorResponse
 * @version 1.0.0
 * @public
 */
export function createErrorResponse(
  error: string | Error,
  message?: string,
  options: ResponseOptions = {},
): Response {
  const { status = 'Internal Server Error', headers = {} } = options;

  const errorMessage = typeof error === 'string' ? error : error.message;

  const body: ApiResponse = {
    success: false,
    error: errorMessage,
  };

  if (message) {
    body.message = message;
  }

  return new Response(Stringify(body), {
    status: StatusMap[status],
    headers: {
      ...DEFAULT_JSON_HEADERS,
      ...headers,
    },
  });
}

/**
 * Creates a standardized "400 Bad Request" error response.
 *
 * @param {string} message - Message describing what was wrong with the request.
 * @returns {Response} A HTTP response object for a bad request.
 * @web
 * @example
 * return createBadRequestResponse("Missing required field");
 * @author Mike Odnis
 * @see createErrorResponse
 * @version 1.0.0
 * @public
 */
export function createBadRequestResponse(message: string): Response {
  return createErrorResponse(message, undefined, { status: 'Bad Request' });
}

/**
 * Creates a standardized "401 Unauthorized" error response.
 *
 * @param {string} [message="Unauthorized"] - Underlying error reason.
 * @returns {Response} A HTTP response object for unauthorized access.
 * @web
 * @example
 * return createUnauthorizedResponse();
 * @author Mike Odnis
 * @see createErrorResponse
 * @version 1.0.0
 * @public
 */
export function createUnauthorizedResponse(message = 'Unauthorized'): Response {
  return createErrorResponse(message, 'Invalid or missing authentication token', {
    status: 'Unauthorized',
  });
}

/**
 * Creates a standardized "404 Not Found" error response.
 *
 * @param {string} [message="Not Found"] - Error reason for missing resource.
 * @returns {Response} A HTTP response object for not found errors.
 * @web
 * @example
 * return createNotFoundResponse();
 * @author Mike Odnis
 * @see createErrorResponse
 * @version 1.0.0
 * @public
 */
export function createNotFoundResponse(message = 'Not Found'): Response {
  return createErrorResponse(message, undefined, { status: 'Not Found' });
}

