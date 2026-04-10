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
 * @file API Test Fixtures
 * @description Shared fixtures and utilities for API testing using Effect-based HTTP client.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';

/**
 * Result structure for API endpoint tests.
 */
export interface ApiTestResult {
  /** The API endpoint that was tested */
  readonly endpoint: string;
  /** HTTP status code (0 if network error) */
  readonly status: number;
  /** Whether the request was successful (2xx) */
  readonly success: boolean;
  /** Parsed response data */
  readonly data?: unknown;
  /** Error message if request failed */
  readonly error?: string;
  /** Response time in milliseconds */
  readonly responseTime: number;
}

/**
 * Generic JSON response schema for flexible API testing
 */
const GenericResponseSchema = Schema.Unknown;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Test an API endpoint using Effect-based HTTP client and return structured results.
 *
 * @param endpoint - The API endpoint path (e.g., '/api/v1/now-playing')
 * @param options - Optional configuration
 * @returns Promise resolving to test result
 *
 * @example
 * const result = await testApiEndpoint('/api/v1/now-playing');
 * expect(result.status).toBe(200);
 */
export async function testApiEndpoint(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
  } = {},
): Promise<ApiTestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;

  try {
    const effect = pipe(
      get(url, {
        schema: GenericResponseSchema,
        retries: 0,
        timeout: options.timeout ?? 10_000,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }),
      Effect.provide(FetchHttpClient.layer),
    );

    const data = await Effect.runPromise(effect);
    const responseTime = Date.now() - startTime;

    return {
      endpoint,
      status: 200, // Effect client throws on non-2xx
      success: true,
      data,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Extract status from Effect error if available
    let status = 0;
    let errorMessage = 'Unknown error';

    if (error && typeof error === 'object') {
      if ('status' in error && typeof error.status === 'number') {
        status = error.status;
      }
      if ('message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      endpoint,
      status,
      success: false,
      error: errorMessage,
      responseTime,
    };
  }
}

/**
 * Test an API endpoint with standard fetch (fallback for when Effect client isn't needed).
 * Useful for testing error responses and non-JSON endpoints.
 */
export async function testApiEndpointRaw(
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

/**
 * Mock data for Spotify API responses.
 */
export const spotifyMocks = {
  nowPlaying: {
    isPlaying: true,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    albumImageUrl: 'https://example.com/album.jpg',
    songUrl: 'https://open.spotify.com/track/123',
  },
  topTracks: {
    tracks: [
      { name: 'Track 1', artist: 'Artist 1' },
      { name: 'Track 2', artist: 'Artist 2' },
    ],
  },
  topArtists: {
    artists: [{ name: 'Artist 1' }, { name: 'Artist 2' }],
  },
};

/**
 * Mock data for GitHub API responses.
 */
export const githubMocks = {
  stats: {
    data: {
      user: {
        contributionsCollection: {
          totalCommitContributions: 500,
        },
        repositories: {
          totalCount: 50,
        },
        followers: {
          totalCount: 100,
        },
      },
    },
  },
};

/**
 * Mock data for Lanyard (Discord) API responses.
 */
export const lanyardMocks = {
  presence: {
    data: {
      discord_user: {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'abc123',
      },
      discord_status: 'online',
      activities: [],
    },
    success: true,
  },
  offline: {
    data: {
      discord_user: {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'abc123',
      },
      discord_status: 'offline',
      activities: [],
    },
    success: true,
  },
  withActivity: {
    data: {
      discord_user: {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'abc123',
      },
      discord_status: 'online',
      activities: [
        {
          name: 'Visual Studio Code',
          type: 0,
          state: 'Editing test.ts',
          details: 'In portfolio',
        },
      ],
    },
    success: true,
  },
};

/**
 * Mock data for WakaTime API responses.
 */
export const wakatimeMocks = {
  stats: {
    data: {
      total_seconds: 360000,
      human_readable_total: '100 hrs',
      daily_average: 14400,
      human_readable_daily_average: '4 hrs',
    },
  },
  detailed: {
    data: {
      total_seconds: 360000,
      human_readable_total: '100 hrs',
      daily_average: 14400,
      human_readable_daily_average: '4 hrs',
      languages: [
        { name: 'TypeScript', total_seconds: 180000, percent: 50 },
        { name: 'JavaScript', total_seconds: 90000, percent: 25 },
        { name: 'CSS', total_seconds: 54000, percent: 15 },
        { name: 'Other', total_seconds: 36000, percent: 10 },
      ],
      editors: [{ name: 'VS Code', total_seconds: 360000, percent: 100 }],
      projects: [
        { name: 'portfolio', total_seconds: 180000, percent: 50 },
        { name: 'other-project', total_seconds: 180000, percent: 50 },
      ],
    },
  },
};

/**
 * Mock data for Google Analytics API responses.
 */
export const googleAnalyticsMocks = {
  pageViews: {
    rows: [
      { dimensionValues: [{ value: '/' }], metricValues: [{ value: '1000' }] },
      { dimensionValues: [{ value: '/about' }], metricValues: [{ value: '500' }] },
    ],
  },
  empty: {
    rows: [],
  },
};

/**
 * Mock data for guestbook messages.
 */
export const guestbookMocks = {
  messages: [
    {
      id: '1',
      message: 'Great portfolio!',
      createdBy: {
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://example.com/avatar.jpg',
      },
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      message: 'Nice work!',
      createdBy: {
        name: 'Another User',
        email: 'another@example.com',
        image: 'https://example.com/avatar2.jpg',
      },
      createdAt: '2025-01-02T00:00:00Z',
    },
  ],
  empty: [],
};

/**
 * Mock data for GitHub Sponsors API responses.
 */
export const sponsorsMocks = {
  sponsors: [
    {
      login: 'sponsor1',
      name: 'Test Sponsor',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      url: 'https://github.com/sponsor1',
      tier: {
        name: 'Bronze',
        monthlyPriceInDollars: 5,
      },
      createdAt: '2025-01-01T00:00:00Z',
      isActive: true,
      type: 'User' as const,
    },
    {
      login: 'sponsor2',
      name: 'Corporate Sponsor',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2',
      url: 'https://github.com/sponsor2',
      tier: {
        name: 'Gold',
        monthlyPriceInDollars: 50,
      },
      createdAt: '2024-06-01T00:00:00Z',
      isActive: true,
      type: 'Organization' as const,
    },
  ],
  empty: {
    sponsors: [],
    totalCount: 0,
    totalMonthlyIncome: 0,
  },
};

/**
 * API endpoints configuration for testing.
 */
export const API_ENDPOINTS = {
  spotify: {
    nowPlaying: '/api/v1/now-playing',
    topTracks: '/api/v1/top-tracks',
    topArtists: '/api/v1/top-artists',
  },
  github: {
    stats: '/api/v1/github-stats',
  },
  discord: {
    lanyard: '/api/v1/lanyard',
  },
  wakatime: {
    stats: '/api/v1/wakatime',
  },
  blog: {
    posts: '/api/v1/blog',
  },
  google: {
    analytics: '/api/v1/google',
  },
  guestbook: {
    messages: '/api/v1/messages',
  },
  health: {
    check: '/api/health',
  },
} as const;

/**
 * Response schemas for type-safe API testing using Effect Schema.
 */
export const ResponseSchemas = {
  /**
   * Schema for Spotify now-playing response
   */
  nowPlaying: Schema.Struct({
    isPlaying: Schema.Boolean,
    title: Schema.optional(Schema.String),
    artist: Schema.optional(Schema.String),
    album: Schema.optional(Schema.String),
    albumImageUrl: Schema.optional(Schema.String),
    songUrl: Schema.optional(Schema.String),
  }),

  /**
   * Schema for API health check
   */
  health: Schema.Struct({
    status: Schema.String,
    timestamp: Schema.optional(Schema.String),
  }),

  /**
   * Schema for generic success response
   */
  success: Schema.Struct({
    success: Schema.Boolean,
    data: Schema.optional(Schema.Unknown),
    message: Schema.optional(Schema.String),
  }),

  /**
   * Schema for error response
   */
  error: Schema.Struct({
    error: Schema.String,
    message: Schema.optional(Schema.String),
    statusCode: Schema.optional(Schema.Number),
  }),
};

/**
 * Test helper to create mock responses for unit tests.
 */
export function createMockResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Test helper to simulate network delay.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test helper to create a timeout race condition.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeoutPromise]);
}
