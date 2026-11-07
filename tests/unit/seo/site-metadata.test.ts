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
 * @file The site's metadata names a place only when Location in Studio has one, as this server
 * last loaded it (peekSiteLocation, mocked here): geo.placename, and on the home page a keyword.
 * Settings not loaded yet, a cleared location or a failure to read them name no place anywhere,
 * and metadata never throws or waits for Sanity.
 */

import type { Metadata } from 'next';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const loaders = vi.hoisted(() => ({ peekSiteLocation: vi.fn<() => string | null>() }));
const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));

vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/lib/observability/report', () => report);
// t3-env validates every variable on import; metadata needs none of them.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The home page's body is not under test.
vi.mock('@/app/_components/home', () => ({ HomePage: () => null }));

import { generateMetadata as homeMetadata } from '@/app/(routes)/page';
import { app } from '@/constants';
import { siteLocationNow, siteMetadata } from '@/lib/seo/site-metadata';
import { constructMetadata } from '@/utils/seo/meta';

/** Any spelling of the city the site's metadata used to name on its own. */
const CITY = /new york|\bnyc\b|\bny\b/i;

const unreadable = () => {
  throw new Error('the settings cache could not be read');
};

beforeEach(() => {
  loaders.peekSiteLocation.mockReset();
  report.reportApiFailure.mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('siteLocationNow', () => {
  it('is the location the settings give', () => {
    loaders.peekSiteLocation.mockReturnValue('New York, NY');

    expect(siteLocationNow()).toBe('New York, NY');
  });

  it('is none when the settings give none or are not loaded', () => {
    loaders.peekSiteLocation.mockReturnValue(null);

    expect(siteLocationNow()).toBeNull();
  });

  it('is none, reported, when the settings cannot be read', () => {
    loaders.peekSiteLocation.mockImplementation(unreadable);

    expect(siteLocationNow()).toBeNull();
    expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
    expect(report.reportApiFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ context: 'site location metadata' }),
    );
  });
});

describe.each([
  ['every page (the root layout)', (): Metadata => siteMetadata(), undefined],
  ['the home page', (): Metadata => homeMetadata(), 'https://mikeodnis.dev/'],
])('the metadata of %s', (_name, metadataOf, ogUrl) => {
  it('names the place Location gives as geo.placename and a keyword', () => {
    loaders.peekSiteLocation.mockReturnValue('New York, NY');

    const metadata = metadataOf();

    expect(metadata.other).toEqual({ 'geo.placename': 'New York, NY' });
    expect(metadata.keywords).toEqual([...app.keywords, 'New York, NY']);
    expect(metadata.openGraph?.url).toBe(ogUrl);
  });

  it.each([
    ['the settings not loaded, or the location cleared', () => null],
    ['the settings unreadable', unreadable],
  ])('names no place anywhere with %s', (_case, peek) => {
    loaders.peekSiteLocation.mockImplementation(peek);

    const metadata = metadataOf();

    expect(metadata).not.toHaveProperty('other');
    expect(metadata.keywords).toEqual([...app.keywords]);
    expect(JSON.stringify(metadata)).not.toMatch(CITY);
  });
});

it("gives the home page the root layout's metadata plus its og:url, and nothing else", () => {
  loaders.peekSiteLocation.mockReturnValue(null);

  expect(homeMetadata()).toEqual(constructMetadata({ path: '/' }));
});
