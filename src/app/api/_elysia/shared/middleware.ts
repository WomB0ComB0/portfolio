/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview
 * Shared middleware utilities for Elysia routes.
 * Provides configurable cache headers and error handling for portfolio (github: WomB0ComB0).
 * Also includes preset cache configurations and error handler customization.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 */

import { ensureBaseError, isBaseError } from '@/classes/error';
import { onRequestError } from '@/core';
import { logger } from '@/utils';

/**
 * Defines the shape of cache configuration for request/response handling.
 *
 * @public
 * @interface
 * @property {string} [contentType] - The value for the Content-Type HTTP header.
 * @default 'application/json'
 * @property {string} [cacheControl] - The value for the Cache-Control HTTP header.
 * @default undefined (no cache control)
 * @author Mike Odnis
 * @version 1.0.0
 * @see createCacheHeaders
 */
export interface CacheConfig {
  contentType?: string;
  cacheControl?: string;
}

/**
 * Defines configuration for handling errors in middleware, including
 * contextual information, custom error messages, and error detail inclusion.
 *
 * @public
 * @interface
 * @property {string} context - Context name for logging (e.g., 'fetching blogs').
 * @property {(error: unknown) => string} [customMessage] - Custom error message generator.
 * @property {boolean} [includeErrorDetails] - Whether to include the error message in the response.
 * @default false
 * @author Mike Odnis
 * @version 1.0.0
 * @see createErrorHandler
 */
export interface ErrorHandlerConfig {
  context: string;
  customMessage?: (error: unknown) => string;
  includeErrorDetails?: boolean;
}

/**
 * Preset configurations for common cache header patterns.
 *
 * @readonly
 * @public
 * @const
 * @property {CacheConfig} NoCache - No caching, always revalidate.
 * @property {CacheConfig} Short - Short cache, 1 minute.
 * @property {CacheConfig} Medium - Medium cache, 1 hour.
 * @property {CacheConfig} Long - Long cache, 24 hours.
 * @property {CacheConfig} JsonOnly - JSON only, no cache control.
 * @author Mike Odnis
 * @version 1.0.0
 * @see CacheConfig
 */
export const CachePresets = {
  NoCache: {
    contentType: 'application/json',
    cacheControl: 'no-cache, must-revalidate, max-age=0',
  },
  Short: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=60, stale-while-revalidate=30',
  },
  Medium: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=3600, stale-while-revalidate=1800',
  },
  Long: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=86400, stale-while-revalidate=43200',
  },
  JsonOnly: {
    contentType: 'application/json',
  },
} as const;

/**
 * Returns a function that generates cache-related HTTP headers
 * based on the provided configuration or preset name.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @param {CacheConfig | keyof typeof CachePresets} [config='JsonOnly'] - Cache configuration or preset.
 * @returns {() => Record<string, string>} - Function returning a headers object for responses.
 * @example
 * const headers = createCacheHeaders('Short')();
 * // { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }
 * @see CachePresets
 */
export function createCacheHeaders(config: CacheConfig | keyof typeof CachePresets = 'JsonOnly') {
  const actualConfig: CacheConfig = typeof config === 'string' ? CachePresets[config] : config;

  return () => {
    const headers: Record<string, string> = {};

    if (actualConfig.contentType) {
      headers['Content-Type'] = actualConfig.contentType;
    }

    if (actualConfig.cacheControl) {
      headers['Cache-Control'] = actualConfig.cacheControl;
    }

    return headers;
  };
}

/**
 * Factory function for error handlers, returning a handler that logs,
 * reports to Sentry, and formats error responses for the API.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @param {ErrorHandlerConfig} config - Error handler configuration.
 * @returns {(error: unknown) => { error: string, status: number, metadata?: unknown, command?: string }} - Error handling function.
 * @throws {Error} If error message determination fails internally.
 * @example
 * const handleError = createErrorHandler({ context: 'creating item' });
 * const result = handleError(new Error('oops'));
 * // { error: 'Failed to creating item', status: 500 }
 * @see ErrorHandlerConfig
 */
export function createErrorHandler(config: ErrorHandlerConfig) {
  return (error: unknown) => {
    // Wrap error in BaseError if it isn't already
    const baseError = ensureBaseError(error, config.context, {
      includeErrorDetails: config.includeErrorDetails,
    });

    logger.error(`Error ${config.context}:`, baseError.toString());

    // Capture error to Sentry for monitoring
    onRequestError(baseError);

    let errorMessage: string;

    if (config.customMessage) {
      errorMessage = config.customMessage(baseError);
    } else if (config.includeErrorDetails) {
      errorMessage = baseError.cause.message;
    } else {
      errorMessage = `Failed to ${config.context}`;
    }

    return {
      error: errorMessage,
      status: 500,
      ...(config.includeErrorDetails && isBaseError(error)
        ? { metadata: baseError.metadata, command: baseError.command }
        : {}),
    };
  };
}

/**
 * Creates an error handler for routes that should always return data,
 * even in the case of error (e.g. analytics endpoints).
 *
 * @function
 * @public
 * @template T extends Record<string, unknown>
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @param {ErrorHandlerConfig} config - Error handler configuration.
 * @param {T} defaultData - Default data to return if an error occurs.
 * @returns {(error: unknown) => T & { error: string, command?: string, timestamp?: number }} - Error handler supplying `defaultData`.
 * @throws {Error} If error processing fails internally.
 * @example
 * const handleErrorAnalytics = createErrorHandlerWithDefault({ context: 'analytics' }, { count: 0 });
 * const result = handleErrorAnalytics(new Error("Fail"));
 * // { count: 0, error: "...", ... }
 * @see ErrorHandlerConfig
 */
export function createErrorHandlerWithDefault<T extends Record<string, unknown>>(
  config: ErrorHandlerConfig,
  defaultData: T,
) {
  return (error: unknown) => {
    // Wrap error in BaseError if it isn't already
    const baseError = ensureBaseError(error, config.context, {
      defaultData,
    });

    logger.error(`Error ${config.context}:`, baseError.toString());

    // Capture error to Sentry for monitoring
    onRequestError(baseError);

    const errorMessage = baseError.cause.message;

    return {
      ...defaultData,
      error: errorMessage,
      ...(config.includeErrorDetails
        ? { command: baseError.command, timestamp: baseError.timestamp }
        : {}),
    };
  };
}
