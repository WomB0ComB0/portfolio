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

import { app } from '@/constants/app';
import type { MetadataRoute } from 'next';

const Sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const routes = [
    '',
    '/cookies',
    '/licenses',
    '/privacy',
    '/sponsor',
    '/media',
    '/projects',
    '/certifications',
    '/resume',
    '/spotify',
    '/experience',
    '/experience',
    '/projects',
    '/guestbook',
    '/places',
  ].map((route) => ({
    url: `${app.url}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }));

  return [...routes];
};
export default Sitemap;
