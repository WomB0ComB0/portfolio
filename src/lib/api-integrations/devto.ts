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

import { get } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

/**
 * @readonly
 * @description
 * Schema definition for a blog object returned from DevTo API.
 * Used for type validation and transformation of article data.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://developers.forem.com/api
 */
export const DevToBlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String),
  source: Schema.Literal('devto'),
  url: Schema.String,
});

/**
 * TypeScript type representing a blog/article fetched from DevTo.
 * @see DevToBlogSchema
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export type DevToBlog = Schema.Schema.Type<typeof DevToBlogSchema>;

/**
 * Fetches published articles for a given DevTo username.
 *
 * This function retrieves articles written by a user on DevTo
 * using the DevTo REST API.
 *
 * @async
 * @function
 * @public
 * @param {string} username - DevTo username to retrieve articles for.
 * @param {number} [perPage=30] - Number of articles to fetch per request.
 * @returns {Promise<DevToBlog[]>} Resolves to an array of {@link DevToBlog} objects containing article metadata.
 * @throws {Error} Throws if API request fails.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developers.forem.com/api
 * @example
 * const articles = await getDevToBlogs('mikeodnis', 10);
 * articles.forEach(article => console.log(article.title, article.slug, article.excerpt));
 */
export async function getDevToBlogs(username: string, perPage = 30): Promise<DevToBlog[]> {
  const effect = pipe(
    get(
      `https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=${perPage}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        retries: 2,
        timeout: 10_000,
      },
    ),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const result = await Effect.runPromise(effect);
    const data = result as any[];

    if (!Array.isArray(data)) {
      logger.warn('DevTo API returned non-array response:', data);
      return [];
    }

    return data.map((article: any) => ({
      title: article.title,
      slug: article.slug,
      publishedAt: article.published_at,
      excerpt: article.description || '',
      imageUrl: article.cover_image || article.social_image,
      source: 'devto' as const,
      url: article.url,
    }));
  } catch (error) {
    logger.error('Error fetching DevTo articles:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}
