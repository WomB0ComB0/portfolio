/**
 * @fileoverview Request queue manager for preventing concurrent API requests
 *
 * Implements request deduplication, queuing, and throttling to prevent
 * rate limiting from external APIs. Ensures only one request per unique
 * endpoint is in flight at a time.
 */

import { logger } from '@/utils';

/**
 * Represents a pending request in the queue
 */
interface PendingRequest<T> {
  /** Promise that resolves when the request completes */
  promise: Promise<T>;
  /** Timestamp when the request was queued */
  timestamp: number;
  /** Number of consumers waiting for this request */
  refCount: number;
}

/**
 * Configuration for rate limiting per endpoint
 */
interface RateLimitConfig {
  /** Minimum time (ms) between requests to the same endpoint */
  minInterval: number;
  /** Maximum number of requests per time window */
  maxRequests: number;
  /** Time window (ms) for maxRequests */
  windowMs: number;
}

/**
 * Tracks request timing for rate limiting
 */
interface RequestTiming {
  /** Last request timestamp */
  lastRequest: number;
  /** Request timestamps within current window */
  requests: number[];
}

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  minInterval: 100, // 100ms between same endpoint requests
  maxRequests: 10, // Max 10 requests per window
  windowMs: 60_000, // 1 minute window
};

/**
 * Singleton request queue manager
 *
 * Features:
 * - Automatic request deduplication
 * - Request queuing with timing control
 * - Per-endpoint rate limiting
 * - Exponential backoff on 429 responses
 * - Automatic cleanup of stale requests
 */
class RequestQueueManager {
  /** Map of endpoint URLs to pending requests */
  private pendingRequests = new Map<string, PendingRequest<any>>();

  /** Map of endpoint URLs to request timing data */
  private requestTimings = new Map<string, RequestTiming>();

  /** Map of endpoint patterns to rate limit configs */
  private rateLimits = new Map<string | RegExp, RateLimitConfig>();

  /** Global rate limit applied to all requests */
  private globalRateLimit: RateLimitConfig = DEFAULT_RATE_LIMIT;

  /** Cleanup interval ID */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup job to remove stale requests every 30 seconds
    this.startCleanupJob();
  }

  /**
   * Configure rate limit for a specific endpoint or pattern
   */
  public setRateLimit(pattern: string | RegExp, config: Partial<RateLimitConfig>): void {
    this.rateLimits.set(pattern, {
      ...DEFAULT_RATE_LIMIT,
      ...config,
    });
  }

  /**
   * Configure global rate limit
   */
  public setGlobalRateLimit(config: Partial<RateLimitConfig>): void {
    this.globalRateLimit = {
      ...this.globalRateLimit,
      ...config,
    };
  }

  /**
   * Get rate limit config for a specific endpoint
   */
  private getRateLimitConfig(url: string): RateLimitConfig {
    // Check for matching pattern
    for (const [pattern, config] of this.rateLimits.entries()) {
      if (pattern instanceof RegExp) {
        if (pattern.test(url)) return config;
      } else if (url.includes(pattern)) {
        return config;
      }
    }

    return this.globalRateLimit;
  }

  /**
   * Check if a request can be made based on rate limits
   */
  private canMakeRequest(url: string): { allowed: boolean; waitTime?: number } {
    const config = this.getRateLimitConfig(url);
    const timing = this.requestTimings.get(url);
    const now = Date.now();

    if (!timing) {
      return { allowed: true };
    }

    // Check minimum interval between requests
    const timeSinceLastRequest = now - timing.lastRequest;
    if (timeSinceLastRequest < config.minInterval) {
      return {
        allowed: false,
        waitTime: config.minInterval - timeSinceLastRequest,
      };
    }

    // Check max requests per window
    const recentRequests = timing.requests.filter((timestamp) => now - timestamp < config.windowMs);

    if (recentRequests.length >= config.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = config.windowMs - (now - oldestRequest);
      return {
        allowed: false,
        waitTime: Math.max(waitTime, 0),
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request for rate limiting tracking
   */
  private recordRequest(url: string): void {
    const now = Date.now();
    const config = this.getRateLimitConfig(url);

    const timing = this.requestTimings.get(url) || {
      lastRequest: 0,
      requests: [],
    };

    // Add current request
    timing.lastRequest = now;
    timing.requests.push(now);

    // Clean up old requests outside the window
    timing.requests = timing.requests.filter((timestamp) => now - timestamp < config.windowMs);

    this.requestTimings.set(url, timing);
  }

  /**
   * Generate a cache key for request deduplication
   */
  private getCacheKey(
    url: string,
    method: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): string {
    const parts = [method, url];

    if (body) {
      parts.push(JSON.stringify(body));
    }

    // Include relevant headers that affect response (e.g., Authorization)
    if (headers) {
      const relevantHeaders = ['authorization', 'content-type'];
      for (const key of relevantHeaders) {
        const value = headers[key.toLowerCase()];
        if (value) parts.push(`${key}:${value}`);
      }
    }

    return parts.join('|');
  }

  /**
   * Execute a request with deduplication, queueing, and rate limiting
   */
  public async enqueue<T>(
    url: string,
    method: string,
    executor: () => Promise<T>,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      bypassDeduplication?: boolean;
    },
  ): Promise<T> {
    const cacheKey = this.getCacheKey(url, method, options?.body, options?.headers);

    // Check if there's already a pending request for this exact call
    if (!options?.bypassDeduplication) {
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) {
        pending.refCount++;
        logger.info(
          `[RequestQueue] Deduplicating request to ${url} (${pending.refCount} consumers)`,
        );
        return pending.promise as Promise<T>;
      }
    }

    // Check rate limits
    const rateCheck = this.canMakeRequest(url);
    if (!rateCheck.allowed && rateCheck.waitTime) {
      logger.info(`[RequestQueue] Rate limit reached for ${url}, waiting ${rateCheck.waitTime}ms`);
      await this.sleep(rateCheck.waitTime);
    }

    // Record the request
    this.recordRequest(url);

    // Create and store the pending request
    const promise = executor()
      .then((result) => {
        this.pendingRequests.delete(cacheKey);
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(cacheKey);

        // Handle 429 rate limit responses
        if (this.is429Error(error)) {
          logger.warn(`[RequestQueue] 429 Rate Limit hit for ${url}`);
          // Increase minimum interval for this endpoint
          const currentConfig = this.getRateLimitConfig(url);
          this.setRateLimit(url, {
            minInterval: Math.min(currentConfig.minInterval * 2, 5000),
          });
        }

        throw error;
      });

    this.pendingRequests.set(cacheKey, {
      promise,
      timestamp: Date.now(),
      refCount: 1,
    });

    logger.info(`[RequestQueue] Executing request to ${url}`);
    return promise;
  }

  /**
   * Check if an error is a 429 rate limit error
   */
  private is429Error(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.response?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.toLowerCase().includes('rate limit')
    );
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start cleanup job to remove stale requests
   */
  private startCleanupJob(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      // Clean up stale pending requests
      for (const [key, pending] of this.pendingRequests.entries()) {
        if (now - pending.timestamp > staleThreshold) {
          this.pendingRequests.delete(key);
          logger.warn(`[RequestQueue] Cleaned up stale request: ${key}`);
        }
      }

      // Clean up old timing data
      for (const [url, timing] of this.requestTimings.entries()) {
        if (now - timing.lastRequest > staleThreshold) {
          this.requestTimings.delete(url);
        }
      }
    }, 30_000); // Run every 30 seconds
  }

  /**
   * Stop cleanup job (for testing or shutdown)
   */
  public stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all pending requests (for testing)
   */
  public clear(): void {
    this.pendingRequests.clear();
    this.requestTimings.clear();
  }

  /**
   * Get statistics about current queue state
   */
  public getStats(): {
    pendingRequests: number;
    trackedEndpoints: number;
    rateLimitConfigs: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      trackedEndpoints: this.requestTimings.size,
      rateLimitConfigs: this.rateLimits.size,
    };
  }
}

// Export singleton instance
export const requestQueue = new RequestQueueManager();

// Configure rate limits for known endpoints
requestQueue.setRateLimit('/api/v1/sanity', {
  minInterval: 200, // 200ms between Sanity requests
  maxRequests: 5, // Max 5 Sanity requests per minute
  windowMs: 60_000,
});

requestQueue.setRateLimit('/api/v1/github', {
  minInterval: 500, // 500ms between GitHub requests
  maxRequests: 3, // Max 3 GitHub requests per minute
  windowMs: 60_000,
});

requestQueue.setRateLimit('/api/v1/spotify', {
  minInterval: 300, // 300ms between Spotify requests
  maxRequests: 5, // Max 5 Spotify requests per minute
  windowMs: 60_000,
});

requestQueue.setRateLimit(/\/api\/v1\/(now-playing|top-artists|top-tracks)/, {
  minInterval: 300,
  maxRequests: 5,
  windowMs: 60_000,
});

// Global default for all other endpoints
requestQueue.setGlobalRateLimit({
  minInterval: 100,
  maxRequests: 10,
  windowMs: 60_000,
});
