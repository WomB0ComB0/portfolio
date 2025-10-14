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

import { createClient } from '@sanity/client';
import type { SanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import type { ImageUrlBuilder } from '@sanity/image-url/lib/types/builder';
import type { SanityImageSource } from '@sanity/image-url/lib/types/types';
import { env } from '@/env';

/**
 * Sanity client configuration
 */
export const sanityConfig = {
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-14',
  useCdn: process.env.NODE_ENV === 'production', // Use CDN in production
  perspective: 'published' as const,
} as const;

/**
 * Sanity client instance
 * Used for fetching data from Sanity CMS
 */
export const sanityClient: SanityClient = createClient(sanityConfig);

/**
 * Sanity client with token for authenticated requests
 * Used for mutations and accessing draft content
 */
export const sanityClientWithToken: SanityClient = createClient({
  ...sanityConfig,
  token: env.SANITY_API_TOKEN,
  useCdn: false, // Don't use CDN for authenticated requests
  perspective: 'previewDrafts' as const, // See draft content
});

/**
 * Image URL builder instance
 * Used for generating optimized image URLs from Sanity
 */
const builder: ImageUrlBuilder = imageUrlBuilder(sanityClient);

/**
 * Helper function to generate optimized image URLs from Sanity
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

