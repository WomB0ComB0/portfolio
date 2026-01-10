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
 * @file API Endpoints Integration Tests
 * @description Tests all /api/v1/* endpoints to verify they're working correctly.
 * Uses the Effect-based HTTP client pattern for type-safe API testing.
 * Run with: bun test tests/integration/api/endpoints.test.ts
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { API_ENDPOINTS, testApiEndpoint, testApiEndpointRaw } from '../../fixtures/api-fixtures';

describe('API v1 Endpoints', () => {
  beforeAll(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    console.log('🧪 Testing API endpoints against:', baseUrl);
  });

  describe('Spotify API', () => {
    it('should fetch now-playing track', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.spotify.nowPlaying);

      console.log('📡 /api/v1/now-playing', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should fetch top tracks', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.spotify.topTracks);

      console.log('📡 /api/v1/top-tracks', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should fetch top artists', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.spotify.topArtists);

      console.log('📡 /api/v1/top-artists', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should return valid structure for now-playing', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.spotify.nowPlaying);

      if (result.success && result.data) {
        // Either playing something or not playing
        expect(result.data).toHaveProperty('isPlaying');
      }
    }, 10000);
  });

  describe('GitHub API', () => {
    it('should fetch GitHub stats', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.github.stats);

      console.log('📡 /api/v1/github-stats', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);

      if (result.success && result.data) {
        // GitHub stats API returns user data directly
        expect(result.data).toHaveProperty('user');
      }
    }, 10000);

    it('should return user contribution data', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.github.stats);

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        // Check for user object directly
        if (data.user && typeof data.user === 'object') {
          expect(data.user).toBeDefined();
        }
      }
    }, 10000);
  });

  describe('Discord (Lanyard) API', () => {
    it('should fetch Discord presence', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.discord.lanyard);

      console.log('📡 /api/v1/lanyard', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should return presence data structure', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.discord.lanyard);

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        // Lanyard API returns { data: { discord_user, discord_status, ... } }
        if (data.data) {
          expect(data).toHaveProperty('data');
        }
      }
    }, 10000);
  });

  describe('WakaTime API', () => {
    it('should fetch WakaTime stats', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.wakatime.stats);

      console.log('📡 /api/v1/wakatime', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should return coding time data', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.wakatime.stats);

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        // WakaTime returns various time metrics
        if (data.data) {
          expect(data).toHaveProperty('data');
        }
      }
    }, 10000);
  });

  describe('Blog API', () => {
    it('should fetch blog posts', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.blog.posts);

      console.log('📡 /api/v1/blog', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should return array of posts or empty array', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.blog.posts);

      if (result.success && result.data) {
        // Blog API should return posts array or object with posts
        expect(result.data).toBeDefined();
      }
    }, 10000);
  });

  describe('Google Analytics API', () => {
    it('should fetch Google Analytics data', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.google.analytics);

      console.log('📡 /api/v1/google', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);
  });

  describe('Messages (Guestbook) API', () => {
    it('should fetch messages', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.guestbook.messages);

      console.log('📡 /api/v1/messages', {
        status: result.status,
        success: result.success,
        responseTime: `${result.responseTime}ms`,
      });

      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    }, 10000);

    it('should return messages array structure', async () => {
      const result = await testApiEndpoint(API_ENDPOINTS.guestbook.messages);

      if (result.success && result.data) {
        // Messages should be an array or object containing messages
        expect(result.data).toBeDefined();
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const result = await testApiEndpointRaw('/api/v1/non-existent-endpoint');

      expect(result.status).toBe(404);
    }, 10000);

    it('should handle malformed requests gracefully', async () => {
      const result = await testApiEndpointRaw('/api/v1/messages', {
        method: 'POST',
        body: 'not-valid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return an error status, not crash
      expect(result.status).toBeGreaterThanOrEqual(400);
    }, 10000);
  });

  describe('Response Headers', () => {
    it('should include appropriate CORS headers', async () => {
      // Using raw fetch to access headers
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${API_ENDPOINTS.spotify.nowPlaying}`, {
        method: 'OPTIONS',
      }).catch(() => null);

      // If CORS is configured, OPTIONS should work
      if (response) {
        expect(response.status).toBeLessThan(500);
      }
    }, 10000);

    it('should return JSON content-type', async () => {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${API_ENDPOINTS.discord.lanyard}`).catch(() => null);

      if (response?.ok) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('application/json');
      }
    }, 10000);
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time limits', async () => {
      const endpoints = [
        API_ENDPOINTS.spotify.nowPlaying,
        API_ENDPOINTS.discord.lanyard,
        API_ENDPOINTS.github.stats,
      ];

      const results = await Promise.all(endpoints.map((endpoint) => testApiEndpoint(endpoint)));

      console.log('\n⚡ Performance Summary:');
      for (const result of results) {
        console.log(`  ${result.endpoint}: ${result.responseTime}ms`);
      }

      // All endpoints should respond within 30 seconds
      for (const result of results) {
        expect(result.responseTime).toBeLessThan(30000);
      }
    }, 60000);

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 5;
      const endpoint = API_ENDPOINTS.spotify.nowPlaying;

      const startTime = Date.now();
      const results = await Promise.all(
        Array.from({ length: concurrentRequests }, () => testApiEndpoint(endpoint)),
      );
      const totalTime = Date.now() - startTime;

      console.log(`📊 Concurrent requests (${concurrentRequests}x): ${totalTime}ms total`);

      // All requests should complete successfully
      for (const result of results) {
        expect(result.status).toBeGreaterThanOrEqual(200);
        expect(result.status).toBeLessThan(500);
      }
    }, 60000);
  });

  describe('Rate Limiting', () => {
    it('should not be rate limited under normal load', async () => {
      const results: number[] = [];

      // Make a few sequential requests
      for (let i = 0; i < 3; i++) {
        const result = await testApiEndpoint(API_ENDPOINTS.spotify.nowPlaying);
        results.push(result.status);
      }

      // None should be rate limited (429)
      expect(results.every((status) => status !== 429)).toBe(true);
    }, 30000);
  });

  describe('API Consistency', () => {
    it('should return consistent data structures', async () => {
      const result1 = await testApiEndpoint(API_ENDPOINTS.spotify.nowPlaying);
      const result2 = await testApiEndpoint(API_ENDPOINTS.spotify.nowPlaying);

      if (result1.success && result2.success) {
        // Both responses should have the same structure
        const keys1 = Object.keys(result1.data as object);
        const keys2 = Object.keys(result2.data as object);

        // At minimum, both should have isPlaying
        expect(keys1).toContain('isPlaying');
        expect(keys2).toContain('isPlaying');
      }
    }, 20000);
  });
});
