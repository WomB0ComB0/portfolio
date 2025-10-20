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

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

/**
 * Generates the XML sitemap for the portfolio project.
 *
 * This asynchronous function dynamically constructs the sitemap entries based on the
 * current request host, ensuring correct domain attribution for every listed route.
 *
 * The sitemap improves SEO and discoverability of the site's public pages, with frequency
 * and priority hints for search engines.
 *
 * @function
 * @async
 * @public
 * @web
 * @author Mike Odnis (GitHub: WomB0ComB0)
 * @see {@link https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap | Next.js Sitemap Documentation}
 * @version 1.0.0
 *
 * @returns {Promise<MetadataRoute.Sitemap>} A promise resolving to a MetadataRoute.Sitemap array for all portfolio site routes.
 *
 * @throws {Error} Throws if request headers are unavailable or host information is missing.
 *
 * @example
 * // In Next.js App Directory (app/sitemap.ts)
 * export default async function sitemap() {
 *   return await sitemap();
 * }
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const domain = headersList.get('host') as string;
  const protocol = 'https';

  return [
    {
      url: `${protocol}://${domain}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${protocol}://${domain}/blog`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/stats`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/guestbook`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/places`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/resume`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/spotify`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/sponsor`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/licenses`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/experience`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/projects`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${protocol}://${domain}/certifications`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
