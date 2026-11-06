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
 * @file The project, experience and place detail pages build their metadata through the server
 * loaders, on top of the Sanity getters, which throw when Sanity fails.
 * - With Sanity down and nothing cached, the metadata falls back to the page's defaults (with its
 *   own og:url, since the id may well exist) instead of crashing the page or claiming "Not
 *   Found", and the failure reaches Sentry as one warning.
 * - A real miss, or an id Sanity could never have issued, still says "Not Found", with no og:url
 *   and nothing sent to Sentry.
 * Only the getters, the Sanity client (with the real image URL builder), YouTube, the env and
 * Sentry are mocked; the loaders, their cache and per-document decoding are real.
 */

import { makeExperience, makePlace, makeProject } from '@tests/fixtures/sanity-docs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const sanityApi = vi.hoisted(() => ({
  getArticles: vi.fn(),
  getCertifications: vi.fn(),
  getExperiences: vi.fn(),
  getFeaturedProjects: vi.fn(),
  getPlaces: vi.fn(),
  getPresentations: vi.fn(),
  getProjects: vi.fn(),
  getResume: vi.fn(),
  getSiteSettings: vi.fn(),
  getTalks: vi.fn(),
  getYoutubeVideos: vi.fn(),
}));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/api', () => sanityApi);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/lib/api-integrations/youtube', () => ({
  fetchChannelVideos: vi.fn(),
  fetchYouTubeVideoMetadataBatch: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => sentry);

import { generateMetadata as placeMetadata } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page';
import { generateMetadata as experienceMetadata } from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import { generateMetadata as projectMetadata } from '@/app/(routes)/(main)/(professioal)/projects/[id]/page';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';
import { logger } from '@/utils';
import { constructMetadata } from '@/utils/seo/meta';

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const placeParamsFor = (placeId: string) => ({ params: Promise.resolve({ placeId }) });
const outage = () => new Error('Sanity answered 503');

/** An id Sanity never issues: the loaders answer null for it without asking Sanity. */
const MALFORMED_ID = '../admin';

const expectWarning = (context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level: 'warning', tags: { 'api.context': context } }),
  );
};

beforeEach(() => {
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  sentry.captureException.mockReset();
  for (const getter of Object.values(sanityApi)) getter.mockReset();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

describe('project detail metadata', () => {
  const grepo = makeProject({ title: 'grepo', description: 'Search your repos.' });

  it("falls back to the page's defaults and reports a warning when Sanity fails", async () => {
    sanityApi.getProjects.mockRejectedValue(outage());

    const metadata = await projectMetadata(paramsFor(grepo._id));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Project',
        description: 'View project details',
        path: `/projects/${grepo._id}`,
      }),
    );
    expectWarning('build project page metadata');
  });

  it('describes a project that exists', async () => {
    sanityApi.getProjects.mockResolvedValue([makeProject(), grepo]);

    const metadata = await projectMetadata(paramsFor(grepo._id));

    expect(metadata.openGraph).toMatchObject({
      title: 'grepo',
      description: 'Search your repos.',
      url: `https://mikeodnis.dev/projects/${grepo._id}`,
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('still says "Not Found" for an id Sanity really does not have', async () => {
    sanityApi.getProjects.mockResolvedValue([grepo]);

    const metadata = await projectMetadata(paramsFor('no-such-project'));

    expect(metadata.openGraph).toMatchObject({ title: 'Project Not Found' });
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('says "Not Found" for a malformed id without asking Sanity', async () => {
    const metadata = await projectMetadata(paramsFor(MALFORMED_ID));

    expect(metadata.openGraph).toMatchObject({ title: 'Project Not Found' });
    expect(sanityApi.getProjects).not.toHaveBeenCalled();
  });
});

describe('experience detail metadata', () => {
  const role = makeExperience({ position: 'Software Engineer', company: 'Acme' });

  it("falls back to the page's defaults and reports a warning when Sanity fails", async () => {
    sanityApi.getExperiences.mockRejectedValue(outage());

    const metadata = await experienceMetadata(paramsFor(role._id));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Experience',
        description: 'View professional experience details',
        path: `/experience/${role._id}`,
      }),
    );
    expectWarning('build experience page metadata');
  });

  it('describes an experience that exists', async () => {
    sanityApi.getExperiences.mockResolvedValue([role]);

    const metadata = await experienceMetadata(paramsFor(role._id));

    expect(metadata.openGraph).toMatchObject({
      title: 'Software Engineer at Acme',
      url: `https://mikeodnis.dev/experience/${role._id}`,
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('still says "Not Found" for an id Sanity really does not have', async () => {
    sanityApi.getExperiences.mockResolvedValue([role]);

    const metadata = await experienceMetadata(paramsFor('no-such-experience'));

    expect(metadata.openGraph).toMatchObject({ title: 'Experience Not Found' });
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('place detail metadata', () => {
  const summit = makePlace({
    name: 'Summit Hall',
    description: 'Where the conference keynote happened.',
    photos: [
      { _type: 'image', asset: { _ref: 'image-summit-3000x2000-jpg', _type: 'reference' } },
      { _type: 'image', asset: { _ref: 'image-stage-1600x1200-jpg', _type: 'reference' } },
    ],
  });

  it('names the place, with its own og:url and its first photo as the preview', async () => {
    sanityApi.getPlaces.mockResolvedValue([makePlace(), summit]);

    const metadata = await placeMetadata(placeParamsFor(summit._id));

    expect(metadata.title).toMatchObject({ default: 'Summit Hall' });
    expect(metadata.openGraph).toMatchObject({
      title: 'Summit Hall',
      description: 'Where the conference keynote happened.',
      url: `https://mikeodnis.dev/places/${summit._id}`,
    });
    // The first photo's CDN URL, cropped to the link preview's size.
    const images = JSON.stringify(metadata.openGraph?.images);
    expect(images).toContain('/summit-3000x2000.jpg?');
    expect(images).toMatch(/w=1200&h=630/);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('says "Place Not Found" without og:url, and reports nothing, for an unknown id', async () => {
    sanityApi.getPlaces.mockResolvedValue([summit]);

    const metadata = await placeMetadata(placeParamsFor('no-such-place'));

    expect(metadata.openGraph).toMatchObject({ title: 'Place Not Found' });
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('says "Place Not Found" for a malformed id without asking Sanity', async () => {
    const metadata = await placeMetadata(placeParamsFor(MALFORMED_ID));

    expect(metadata.openGraph).toMatchObject({ title: 'Place Not Found' });
    expect(sanityApi.getPlaces).not.toHaveBeenCalled();
  });

  it("falls back to the page's defaults and reports one warning when Sanity fails", async () => {
    sanityApi.getPlaces.mockRejectedValue(outage());

    const metadata = await placeMetadata(placeParamsFor(summit._id));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Places',
        description: 'A place I visited',
        path: `/places/${summit._id}`,
      }),
    );
    expectWarning('build place page metadata');
  });
});
