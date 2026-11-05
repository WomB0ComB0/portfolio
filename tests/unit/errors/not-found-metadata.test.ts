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
 * @file Both 404 files export one metadata object: a "404" title, kept out of search indexes.
 *
 * Next takes a 404's metadata from the deepest not-found module, so src/app/(routes)/not-found.tsx
 * replaces the root's. Without an export of its own, a notFound() thrown under (routes) during a
 * server render got the site's default title and description instead of "404".
 */

import { describe, expect, it, vi } from 'vitest';

// The root not-found imports the shell; none of it renders here.
vi.mock('next/navigation', () => ({ usePathname: () => '/no-such-page' }));
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/magicui/light-rays', () => ({ LightRays: () => null }));
vi.mock('@/components/layout', () => ({
  NavBar: () => null,
  MobileNavBar: () => null,
  Footer: () => null,
}));

import { metadata as routeGroupMetadata } from '@/app/(routes)/not-found';
import { metadata as rootMetadata } from '@/app/not-found';

describe('404 metadata', () => {
  it('src/app/(routes)/not-found.tsx exports the "404" title and description', () => {
    expect(routeGroupMetadata.title).toEqual(expect.objectContaining({ default: '404' }));
    expect(routeGroupMetadata.description).toBe('This page does not exist');
  });

  it('keeps the 404 out of search indexes', () => {
    expect(routeGroupMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('is the same object the root not-found exports', () => {
    expect(routeGroupMetadata).toBe(rootMetadata);
  });
});
