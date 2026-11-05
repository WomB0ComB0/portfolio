// @vitest-environment node
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
 * @file Every static page exports metadata whose og:url is its own absolute URL, the homepage
 * included: the root layout sets no path, so a page that exports no metadata (as the old
 * 'use client' homepage could not) has no og:url at all. The page modules are imported for real;
 * only their client bodies are stubbed, since metadata never renders them.
 */

import type { Metadata } from 'next';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// Each page wraps its body in next/dynamic, and the homepage renders a client component.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/app/_components/home', () => ({ HomePage: () => null }));

import Sitemap from '@/app/sitemap';
import { app } from '@/constants';
import { constructMetadata } from '@/utils/seo/meta';

afterAll(() => {
  vi.unstubAllEnvs();
});

interface PageModule {
  readonly metadata: Metadata;
}

const STATIC_PAGES: Readonly<Record<string, () => Promise<PageModule>>> = {
  '/': () => import('@/app/page'),
  '/cookies': () => import('@/app/(routes)/(legal)/cookies/page'),
  '/licenses': () => import('@/app/(routes)/(legal)/licenses/page'),
  '/privacy': () => import('@/app/(routes)/(legal)/privacy/page'),
  '/sponsor': () => import('@/app/(routes)/(dev)/sponsor/page'),
  '/media': () => import('@/app/(routes)/(dev)/media/page'),
  '/stats': () => import('@/app/(routes)/(dev)/stats/page'),
  '/projects': () => import('@/app/(routes)/(main)/(professioal)/projects/page'),
  '/certifications': () => import('@/app/(routes)/(main)/(professioal)/certifications/page'),
  '/resume': () => import('@/app/(routes)/(main)/(professioal)/resume/page'),
  '/experience': () => import('@/app/(routes)/(main)/(professioal)/experience/page'),
  '/spotify': () => import('@/app/(routes)/(main)/(personal)/spotify/page'),
  '/guestbook': () => import('@/app/(routes)/(main)/(personal)/guestbook/page'),
  '/places': () => import('@/app/(routes)/(main)/(personal)/places/page'),
};

const STATS_DESCRIPTION =
  "What I'm up to on Discord right now, plus GitHub, LeetCode, coding-time and typing stats that refresh every few hours.";

const metadataOf = async (route: string): Promise<Metadata> => {
  const load = STATIC_PAGES[route];
  if (!load) throw new Error(`no page module listed for ${route}`);
  return (await load()).metadata;
};

describe('static page og:url', () => {
  it('lists a page module for every route in the sitemap', async () => {
    const sitemapRoutes = (await Sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(Object.keys(STATIC_PAGES).sort()).toEqual([...sitemapRoutes].sort());
  });

  it.each(Object.keys(STATIC_PAGES))('%s exports its own absolute og:url', async (route) => {
    const metadata = await metadataOf(route);

    expect(metadata.openGraph?.url).toBe(new URL(route, app.url).href);
  });

  it("gives the homepage the site root's og:url", async () => {
    const metadata = await metadataOf('/');

    expect(metadata.openGraph?.url).toBe('https://mikeodnis.dev/');
  });

  it("keeps the homepage's other tags as the root layout's constructMetadata() defaults", async () => {
    const { openGraph, ...rest } = await metadataOf('/');
    const { openGraph: layoutOpenGraph, ...layoutRest } = constructMetadata();

    expect(rest).toEqual(layoutRest);
    expect(openGraph).toEqual({ ...layoutOpenGraph, url: 'https://mikeodnis.dev/' });
    expect(rest.description).toBe(app.description);
    expect(openGraph).toMatchObject({ title: app.name });
  });

  it('describes /stats with the same sentence as its page header, keeping the title', async () => {
    const metadata = await metadataOf('/stats');

    expect(metadata.description).toBe(STATS_DESCRIPTION);
    expect(metadata.openGraph).toMatchObject({ title: 'Stats', description: STATS_DESCRIPTION });
    expect(metadata.twitter).toMatchObject({ title: 'Stats', description: STATS_DESCRIPTION });
  });
});
