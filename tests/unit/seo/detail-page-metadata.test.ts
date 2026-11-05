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
 * @file The project and experience detail pages build their metadata from the Sanity getters,
 * which now throw when Sanity fails. The metadata then falls back to the page's defaults (with
 * its own og:url, since the id may well exist) instead of crashing the page or claiming "Not
 * Found", and the failure reaches Sentry as a warning. A real miss still says "Not Found".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const sanityApi = vi.hoisted(() => ({ getProjects: vi.fn(), getExperiences: vi.fn() }));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

// The pages wrap their client bodies in next/dynamic; metadata never renders them.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/sanity/api', () => sanityApi);
vi.mock('@/lib/sanity/client', () => ({
  urlFor: () => ({ width: () => ({ height: () => ({ url: () => 'https://cdn.example/p.png' }) }) }),
}));
vi.mock('@sentry/nextjs', () => sentry);

import { generateMetadata as experienceMetadata } from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import { generateMetadata as projectMetadata } from '@/app/(routes)/(main)/(professioal)/projects/[id]/page';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { logger } from '@/utils';
import { constructMetadata } from '@/utils/seo/meta';

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const outage = () => new Error('Sanity answered 503');

const expectWarning = (context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level: 'warning', tags: { 'api.context': context } }),
  );
};

beforeEach(() => {
  resetApiReportCooldowns();
  sentry.captureException.mockReset();
  sanityApi.getProjects.mockReset();
  sanityApi.getExperiences.mockReset();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

describe('project detail metadata', () => {
  it("falls back to the page's defaults and reports a warning when Sanity fails", async () => {
    sanityApi.getProjects.mockRejectedValue(outage());

    const metadata = await projectMetadata(paramsFor('proj-grepo'));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Project',
        description: 'View project details',
        path: '/projects/proj-grepo',
      }),
    );
    expectWarning('build project page metadata');
  });

  it('describes a project that exists', async () => {
    sanityApi.getProjects.mockResolvedValue([
      { _id: 'proj-grepo', title: 'grepo', description: 'Search your repos.', image: null },
    ]);

    const metadata = await projectMetadata(paramsFor('proj-grepo'));

    expect(metadata.openGraph).toMatchObject({
      title: 'grepo',
      description: 'Search your repos.',
      url: 'https://mikeodnis.dev/projects/proj-grepo',
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('still says "Not Found" for an id Sanity really does not have', async () => {
    sanityApi.getProjects.mockResolvedValue([]);

    const metadata = await projectMetadata(paramsFor('no-such-project'));

    expect(metadata.openGraph).toMatchObject({ title: 'Project Not Found' });
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('experience detail metadata', () => {
  it("falls back to the page's defaults and reports a warning when Sanity fails", async () => {
    sanityApi.getExperiences.mockRejectedValue(outage());

    const metadata = await experienceMetadata(paramsFor('exp-1'));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Experience',
        description: 'View professional experience details',
        path: '/experience/exp-1',
      }),
    );
    expectWarning('build experience page metadata');
  });

  it('still says "Not Found" for an id Sanity really does not have', async () => {
    sanityApi.getExperiences.mockResolvedValue([]);

    const metadata = await experienceMetadata(paramsFor('no-such-experience'));

    expect(metadata.openGraph).toMatchObject({ title: 'Experience Not Found' });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
