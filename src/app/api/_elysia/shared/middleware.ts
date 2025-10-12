/**
 * Shared middleware utilities for Elysia routes.
 * Provides configurable cache headers and error handling.
 */

export interface CacheConfig {
  /**
   * Content-Type header value
   * @default 'application/json'
   */
  contentType?: string;
  /**
   * Cache-Control header value
   * @default undefined (no cache control)
   */
  cacheControl?: string;
}

export interface ErrorHandlerConfig {
  /**
   * Context name for logging (e.g., 'fetching blogs', 'adding message')
   */
  context: string;
  /**
   * Custom error message generator
   * @param error - The caught error
   * @returns Error message string
   */
  customMessage?: (error: unknown) => string;
  /**
   * Whether to include the error message in the response
   * @default false
   */
  includeErrorDetails?: boolean;
}

/**
 * Cache header presets for common scenarios
 */
export const CachePresets = {
  /** No caching - always revalidate */
  NoCache: {
    contentType: 'application/json',
    cacheControl: 'no-cache, must-revalidate, max-age=0',
  },
  /** Short cache - 1 minute */
  Short: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=60, stale-while-revalidate=30',
  },
  /** Medium cache - 1 hour */
  Medium: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=3600, stale-while-revalidate=1800',
  },
  /** Long cache - 24 hours */
  Long: {
    contentType: 'application/json',
    cacheControl: 'public, s-maxage=86400, stale-while-revalidate=43200',
  },
  /** JSON only - no cache control */
  JsonOnly: {
    contentType: 'application/json',
  },
} as const;

/**
 * Factory function to create cache headers
 * @param config - Cache configuration or preset name
 * @returns Function that returns cache headers
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
 * Factory function to create error handler
 * @param config - Error handler configuration
 * @returns Function that handles errors
 */
export function createErrorHandler(config: ErrorHandlerConfig) {
  return (error: unknown) => {
    console.error(`Error ${config.context}:`, error);

    let errorMessage: string;

    if (config.customMessage) {
      errorMessage = config.customMessage(error);
    } else if (config.includeErrorDetails && error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = `Failed to ${config.context}`;
    }

    return {
      error: errorMessage,
      status: 500,
    };
  };
}

/**
 * Special error handler for routes that return data even on error (e.g., Google Analytics)
 * @param config - Error handler configuration
 * @param defaultData - Default data to return on error
 * @returns Function that handles errors
 */
export function createErrorHandlerWithDefault<T extends Record<string, unknown>>(
  config: ErrorHandlerConfig,
  defaultData: T,
) {
  return (error: unknown) => {
    console.error(`Error ${config.context}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      ...defaultData,
      error: errorMessage,
    };
  };
}
