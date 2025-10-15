/**
 * API Endpoints Integration Tests
 * Tests all /api/v1/* endpoints to verify they're working correctly
 * Run with: bun test src/__tests__/api-endpoints.test.ts
 */

import { beforeAll, describe, expect, it } from 'vitest';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface ApiTestResult {
  endpoint: string;
  status: number;
  success: boolean;
  data?: unknown;
  error?: string;
  responseTime: number;
}

/**
 * Generic API test helper
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
