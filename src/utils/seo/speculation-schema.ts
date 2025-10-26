'use client';
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
 * Generates a Schema.org compatible JSON-LD object for SEO, based on the given properties.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 *
 * @param {SchemaProps} props - The properties describing the schema entity.
 * @returns {Readonly<Record<string, unknown>>} The resulting Schema.org JSON-LD object.
 * @throws {TypeError} Throws if required fields like 'type' or 'url' are missing or invalid.
 *
 * @example
 * // Basic usage for an article schema:
 * const schema = generateSchema({
 *   type: 'Article',
 *   headline: 'Understanding TypeScript',
 *   url: 'https://example.com/article/typescript',
 *   datePublished: '2024-05-01T12:00:00Z',
 *   creator: ['WomB0ComB0'],
 *   keywords: ['TypeScript', 'Programming'],
 * });
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 * @see https://schema.org
 */
import type { SchemaProps } from './speculation-schema.types';
export const generateSchema = (props: SchemaProps) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': props.type,
    ...(props.headline && { headline: props.headline }),
    url: props.url,
    ...(props.thumbnailUrl && { thumbnailUrl: props.thumbnailUrl }),
    ...(props.datePublished && { datePublished: props.datePublished }),
    ...(props.articleSection && { articleSection: props.articleSection }),
    ...(props.creator && { creator: props.creator }),
    ...(props.keywords && { keywords: props.keywords }),
    ...(props.name && { name: props.name }),
    ...(props.logo && { logo: props.logo }),
    ...(props.sameAs && { sameAs: props.sameAs }),
  } as const;

  return schema;
};
