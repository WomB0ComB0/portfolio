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
 * Sanity CMS client configuration and utilities
 * This module works in both server and client contexts:
 * - Server: Uses env.ts for full access (including SANITY_API_TOKEN)
 * - Client: Uses @/config for public-only variables (NEXT_PUBLIC_*)
 */

import type { SanityClient } from '@sanity/client';
import { createClient } from '@sanity/client';
import {
  createImageUrlBuilder,
  type ImageUrlBuilder,
  type SanityImageSource,
} from '@sanity/image-url';

// Check if we're in a browser context
const isBrowser = globalThis.window !== undefined;

// Import appropriate config based on context
const getConfig = () => {
  if (isBrowser) {
    // Client-side: use the safe config object
    const { config } = require('@/config');
    return {
      projectId: config.sanity.projectId,
      dataset: config.sanity.dataset || 'production',
      apiVersion: config.sanity.apiVersion || '2024-10-14',
      token: undefined, // No token on client
    };
  } else {
    // Server-side: use env.ts for full access
    const { env } = require('@/env');
    return {
      projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      dataset: env.NEXT_PUBLIC_SANITY_DATASET || 'production',
      apiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-14',
      token: env.SANITY_API_TOKEN,
    };
  }
};

const config = getConfig();

/**
 * Sanity client configuration
 */
export const sanityConfig = {
  projectId: config.projectId,
  dataset: config.dataset,
  apiVersion: config.apiVersion,
  useCdn: process.env.NODE_ENV === 'production',
  perspective: 'published' as const,
} as const;

/**
 * Sanity client instance
 * Safe to use in both server and client components
 */
export const sanityClient: SanityClient = createClient(sanityConfig);

/**
 * Sanity client with token for authenticated requests
 * SERVER-ONLY: Returns regular client on client-side (no token available)
 */
export const sanityClientWithToken: SanityClient = config.token
  ? createClient({
      ...sanityConfig,
      token: config.token,
      useCdn: false,
      perspective: 'published' as const, // Use 'published' instead of 'previewDrafts'
    })
  : sanityClient; // Fallback to regular client on client-side

/**
 * Image URL builder instance
 * Safe to use in both server and client components
 */
const builder: ImageUrlBuilder = createImageUrlBuilder(sanityClient);

/**
 * Helper function to generate optimized image URLs from Sanity
 * Safe to use in both server and client components
 *
 * @param source - Sanity image source
 * @returns Image URL builder instance
 *
 * @example
 * ```ts
 * const imageUrl = urlFor(image)
 *   .width(800)
 *   .height(600)
 *   .fit('crop')
 *   .url();
 * ```
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

/**
 * Type-safe GROQ query helper
 * Safe to use in both server and client components
 *
 * @param query - GROQ query string
 * @param params - Query parameters
 * @returns Promise with typed result
 */
export async function sanityFetch<T = any>(
  query: string,
  params: Record<string, any> = {},
): Promise<T> {
  return sanityClient.fetch<T>(query, params);
}

/**
 * Type-safe GROQ query helper with authentication
 * SERVER-ONLY: Falls back to regular fetch on client-side
 *
 * @param query - GROQ query string
 * @param params - Query parameters
 * @returns Promise with typed result
 */
export async function sanityFetchWithToken<T = any>(
  query: string,
  params: Record<string, any> = {},
): Promise<T> {
  return sanityClientWithToken.fetch<T>(query, params);
}

export { sanityClient as client, sanityClientWithToken as clientWithToken };
