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
 * @file Both 404 files export one metadata object: a "404" title (Next adds the noindex itself).
 *
 * Next takes a 404's metadata from the deepest not-found module, so src/app/(routes)/not-found.tsx
 * replaces the root's. Without an export of its own, a notFound() thrown under (routes) during a
 * server render got the site's default title and description instead of "404".
 */

import { describe, expect, it, vi } from 'vitest';

// The root not-found imports the shell; none of it renders here.
vi.mock('next/navigation', () => ({ usePathname: () => '/no-such-page' }));
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
vi.mock('@/components/layout/nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/nav')>();
  return { ...actual, NavBar: () => null };
});
vi.mock('@/components/layout/mobile-nav', () => ({ MobileNavBar: () => null }));
vi.mock('@/components/layout/footer', () => ({ Footer: () => null }));

import { metadata as routeGroupMetadata } from '@/app/(routes)/not-found';
import { metadata as rootMetadata } from '@/app/not-found';

describe('404 metadata', () => {
  it('src/app/(routes)/not-found.tsx exports the "404" title and description', () => {
    expect(routeGroupMetadata.title).toEqual(expect.objectContaining({ default: '404' }));
    expect(routeGroupMetadata.description).toBe('This page does not exist');
  });

  // Next writes <meta name="robots" content="noindex"> on every 404 itself; a robots field here
  // gave each 404 a second tag (tests/unit/seo/not-found-robots.test.ts).
  it('asks for no robots tag of its own: Next keeps every 404 out of search indexes', () => {
    expect(routeGroupMetadata).not.toHaveProperty('robots');
  });

  it('is the same object the root not-found exports', () => {
    expect(routeGroupMetadata).toBe(rootMetadata);
  });
});
