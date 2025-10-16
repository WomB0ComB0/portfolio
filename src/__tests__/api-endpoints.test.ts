/**
 * @file API Endpoints Integration Tests
 * @description Tests all /api/v1/* endpoints to verify they're working correctly.
 * Run with: bun test src/__tests__/api-endpoints.test.ts
 * @author Mike Odnis
 * @since 2025
 * @version 1.0.0
 * @see https://vitest.dev/guide/
 */

import { beforeAll, describe, expect, it } from 'vitest';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * @interface ApiTestResult
 * @description Represents the structured result of an API endpoint test,
 * including status, success, response data, and response time.
 * @author Mike Odnis
 * @since 1.0.0
 * @version 1.0.0
 */
interface ApiTestResult {
  /**
   * @readonly
   * @type {string}
   * The API endpoint that was tested.
   */
  readonly endpoint: string;
  /**
   * @readonly
   * @type {number}
   * The HTTP status code of the response. Will be 0 if a network error occurred.
   */
  readonly status: number;
  /**
   * @readonly
   * @type {boolean}
   * Indicates if the request was successful (HTTP status 2xx).
   */
  readonly success: boolean;
  /**
   * @readonly
   * @type {unknown}
   * The parsed response data (JSON or text). Undefined if an error occurred before parsing.
   */
  readonly data?: unknown;
  /**
   * @readonly
   * @type {string}
   * An error message if the fetch operation failed (e.g., network error).
   */
  readonly error?: string;
  /**
   * @readonly
   * @type {number}
   * The time taken for the API call to complete in milliseconds.
   */
  readonly responseTime: number;
}

/**
 * @function testApiEndpoint
 * @description A generic asynchronous helper function to test a given API endpoint.
 * It sends a request, measures response time, and parses the response data.
 * @public
 * @async
 * @web
 * @author Mike Odnis
 * @since 1.0.0
 * @version 1.0.0
 *
 * @param {string} endpoint The API endpoint path to test, relative to `BASE_URL`. E.g., '/api/v1/now-playing'.
 * @param {RequestInit} [options={}] Optional request initialization options for the `fetch` API.
 *                                   Defaults to `{}`. Common options include `method`, `headers`, `body`.
 * @returns {Promise<ApiTestResult>} A promise that resolves to an `ApiTestResult` object containing
 *                                   the status, success, data, error, and response time of the API call.
 * @throws {Error} Although caught internally, network errors or issues preventing
 *                 a response entirely could conceptually throw an error. The function
 *                 itself handles errors by returning an `ApiTestResult` with `success: false`
 *                 and an `error` message.
 *
 * @example
 * // Test a simple GET endpoint
 * const result = await testApiEndpoint('/api/v1/now-playing');
 * console.log(result.status); // e.g., 200
 * console.log(result.data);   // e.g., { track: 'Song Title' }
 *
 * @example
 * // Test a POST endpoint with a JSON body
 * const postResult = await testApiEndpoint('/api/v1/messages', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({ message: 'Hello Vitest!' }),
 * });
 * console.log(postResult.success); // e.g., true
 */
async function testApiEndpoint(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiTestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const responseTime = Date.now() - startTime;
    const contentType = response.headers.get('content-type');

    let data: unknown;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      endpoint,
      status: response.status,
      success: response.ok,
      data,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      endpoint,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime,
    };
  }
}

describe('API v1 Endpoints', () => {
  beforeAll(() => {
    console.log('🧪 Testing API endpoints against:', BASE_URL);
  });

  describe('Spotify API', () => {
    it('should fetch now-playing track', async () => {
      const result = await testApiEndpoint('/api/v1/now-playing');

      console.log('📡 /api/v1/now-playing', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        data: result.data,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should fetch top tracks', async () => {
      const result = await testApiEndpoint('/api/v1/top-tracks');

      console.log('📡 /api/v1/top-tracks', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should fetch top artists', async () => {
      const result = await testApiEndpoint('/api/v1/top-artists');

      console.log('📡 /api/v1/top-artists', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('GitHub API', () => {
    it('should fetch GitHub stats', async () => {
      const result = await testApiEndpoint('/api/v1/github-stats');

      console.log('📡 /api/v1/github-stats', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);

      if (result.success && result.data) {
        expect(result.data).toHaveProperty('data');
      }
    }, 10000);
  });

  describe('Discord (Lanyard) API', () => {
    it('should fetch Discord presence', async () => {
      const result = await testApiEndpoint('/api/v1/lanyard');

      console.log('📡 /api/v1/lanyard', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('WakaTime API', () => {
    it('should fetch WakaTime stats', async () => {
      const result = await testApiEndpoint('/api/v1/wakatime');

      console.log('📡 /api/v1/wakatime', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('Blog API', () => {
    it('should fetch blog posts', async () => {
      const result = await testApiEndpoint('/api/v1/blog');

      console.log('📡 /api/v1/blog', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('Google Analytics API', () => {
    it('should fetch Google Analytics data', async () => {
      const result = await testApiEndpoint('/api/v1/google');

      console.log('📡 /api/v1/google', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('Messages (Guestbook) API', () => {
    it('should fetch messages', async () => {
      const result = await testApiEndpoint('/api/v1/messages');

      console.log('📡 /api/v1/messages', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time limits', async () => {
      const endpoints = ['/api/v1/now-playing', '/api/v1/lanyard', '/api/v1/github-stats'];

      const results = await Promise.all(endpoints.map((endpoint) => testApiEndpoint(endpoint)));

      console.log('\n⚡ Performance Summary:');
      results.forEach((result) => {
        console.log(`  ${result.endpoint}: ${result.responseTime}ms`);
      });

      // All endpoints should respond within 30 seconds
      results.forEach((result) => {
        expect(result.responseTime).toBeLessThan(30000);
      });
    }, 60000);
  });
});
