import { StatusMap } from 'elysia';
import { Stringify } from '@/utils';

/**
 * Standard API response structure for successful responses
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

/**
 * Standard API response structure for error responses
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
}

/**
 * Union of all possible API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Response builder options
 */
export interface ResponseOptions {
  status?: keyof typeof StatusMap;
  headers?: Record<string, string>;
}

/**
 * Default JSON headers
 */
const DEFAULT_JSON_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Creates a standardized success JSON response
 * @param data - Response data
 * @param message - Optional success message
 * @param options - Response options (status, headers)
 * @returns Response object
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
 * Creates a standardized error JSON response
 * @param error - Error message or Error object
 * @param message - Optional detailed error message
 * @param options - Response options (status, headers)
 * @returns Response object
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
 * Creates a bad request error response
 * @param message - Error message
 * @returns Response object
 */
export function createBadRequestResponse(message: string): Response {
  return createErrorResponse(message, undefined, { status: 'Bad Request' });
}

/**
 * Creates an unauthorized error response
 * @param message - Error message
 * @returns Response object
 */
export function createUnauthorizedResponse(message = 'Unauthorized'): Response {
  return createErrorResponse(message, 'Invalid or missing authentication token', {
    status: 'Unauthorized',
  });
}

/**
 * Creates a not found error response
 * @param message - Error message
 * @returns Response object
 */
export function createNotFoundResponse(message = 'Not Found'): Response {
  return createErrorResponse(message, undefined, { status: 'Not Found' });
}
