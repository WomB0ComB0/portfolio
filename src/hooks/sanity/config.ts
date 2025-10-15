/**
 * @fileoverview Configuration and utilities for Sanity data fetching
 * 
 * Centralized configuration for cache times, API endpoints, and
 * common options used across all Sanity data fetching hooks.
 */

import type { Schema } from 'effect';

/**
 * Base API path for all Sanity endpoints
 */
export const SANITY_API_BASE = '/api/v1/sanity';

/**
 * Default cache configuration for Sanity data
 */
export const SANITY_CACHE_CONFIG = {
  /** How long data is considered fresh (5 minutes) */
  staleTime: 5 * 60 * 1000,
  /** How long to keep unused data in cache (10 minutes) */
  gcTime: 10 * 60 * 1000,
  /** How often to refetch in background (5 minutes) */
  refetchInterval: 5 * 60 * 1000,
} as const;

/**
 * Default Effect fetcher options for Sanity requests
 */
export const SANITY_FETCHER_OPTIONS = {
  /** Number of retry attempts on failure */
  retries: 2,
  /** Request timeout in milliseconds */
  timeout: 10_000,
} as const;

/**
 * Sanity API endpoints
 */
export const SANITY_ENDPOINTS = {
  experiences: `${SANITY_API_BASE}/experiences`,
  projects: `${SANITY_API_BASE}/projects`,
  featuredProjects: `${SANITY_API_BASE}/projects/featured`,
  certifications: `${SANITY_API_BASE}/certifications`,
  places: `${SANITY_API_BASE}/places`,
} as const;

/**
 * Type-safe endpoint keys
 */
export type SanityEndpoint = keyof typeof SANITY_ENDPOINTS;

/**
 * Get full URL for a Sanity endpoint
 */
export function getSanityEndpoint(endpoint: SanityEndpoint): string {
  return SANITY_ENDPOINTS[endpoint];
}

/**
 * Create query key for React Query
 */
export function createSanityQueryKey(endpoint: SanityEndpoint, ...params: string[]): string[] {
  return ['sanity', endpoint, ...params];
}

/**
 * Create options for useDataLoader with schema validation
 */
export function createDataLoaderOptions<S extends Schema.Schema<any, any, never>>(schema: S) {
  return {
    schema,
    options: {
      ...SANITY_FETCHER_OPTIONS,
      schema,
    },
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    refetchInterval: SANITY_CACHE_CONFIG.refetchInterval,
  };
}
