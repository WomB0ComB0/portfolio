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
import { app } from '@/constants/app';

const Sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  /**
   *   reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /cookies, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /licenses, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /privacy, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /sponsor, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /blog, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /_not-found, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/ib3nmtodFyARmiBwkKzTbW, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxV4j, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxUnS, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/mETyawm5busawrS3UNVOFN, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxUtD, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/ib3nmtodFyARmiBwkKzTkN, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxUbw, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxUhh, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  (node:841903) Warning: `--localstorage-file` was provided without a valid path
  (Use `node --trace-warnings ...` to show where the warning was created)
  Error: Static generation failed due to dynamic usage on /certifications, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /resume, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /spotify, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/ib3nmtodFyARmiBwkKwk4p, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/ib3nmtodFyARmiBwkKzTtE, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/t7NeVLRki3jNij3o4WvnXe, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/t7NeVLRki3jNij3o4WvnM8, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/t7NeVLRki3jNij3o4WvndP, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/mETyawm5busawrS3UNODUd, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/mETyawm5busawrS3UNODkh, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience/t7NeVLRki3jNij3o4WvnRt, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /projects/t7NeVLRki3jNij3o4WxUyy, reason: 
  headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /guestbook, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /places, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
  Error: Static generation failed due to dynamic usage on /experience, reason: headers
      at x (.next/server/chunks/ssr/_476e3b2a._.js:2:14882)
      at m (.next/server/chunks/ssr/_476e3b2a._.js:5:12734)
      at s (.next/server/chunks/ssr/_476e3b2a._.js:5:26269)
      at stringify (<anonymous>)
   ✓ Generating static pages (37/37) in 1210.6ms

  */
  const routes = [
    '',
    '/cookies',
    '/licenses',
    '/privacy',
    '/sponsor',
    '/blog',
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
