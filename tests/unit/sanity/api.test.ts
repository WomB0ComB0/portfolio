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
 * @file The server-side Sanity getters fail loudly: a failed query throws a BaseError that keeps
 * the client's error as its cause, instead of answering [] or null. That is what lets callers
 * tell an outage from real content: [] still means "no such documents", and null from a
 * single-document getter still means "that document does not exist".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));
vi.mock('@/lib/sanity/client', () => sanity);

import { BaseError } from '@/classes/error';
import {
  getArticles,
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getPlaces,
  getPresentations,
  getProjectBySlug,
  getProjects,
  getResume,
  getSiteSettings,
  getTalks,
  getYoutubeVideos,
} from '@/lib/sanity/api';
import { siteSettingsQuery } from '@/lib/sanity/queries';

const LIST_GETTERS = [
  ['experiences', getExperiences],
  ['projects', getProjects],
  ['featured-projects', getFeaturedProjects],
  ['certifications', getCertifications],
  ['places', getPlaces],
  ['presentations', getPresentations],
  ['talks', getTalks],
  ['articles', getArticles],
  ['youtube-videos', getYoutubeVideos],
] as const;

const outage = new Error('getaddrinfo ENOTFOUND abc123.api.sanity.io');

beforeEach(() => {
  sanity.sanityFetchWithToken.mockReset();
});

describe('list getters', () => {
  it.each(LIST_GETTERS)('%s throws a BaseError carrying the cause', async (name, getter) => {
    sanity.sanityFetchWithToken.mockRejectedValue(outage);

    const failure = await getter().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BaseError);
    expect(failure).toMatchObject({ command: `sanity:${name}`, cause: outage });
  });

  it.each(LIST_GETTERS)('%s answers a real empty list as []', async (_name, getter) => {
    sanity.sanityFetchWithToken.mockResolvedValue([]);

    await expect(getter()).resolves.toEqual([]);
  });

  it.each(LIST_GETTERS)(
    '%s treats a reply that is not a list as a failure',
    async (name, getter) => {
      sanity.sanityFetchWithToken.mockResolvedValue(null);

      await expect(getter()).rejects.toMatchObject({ command: `sanity:${name}` });
    },
  );
});

describe('getProjectBySlug', () => {
  it('answers null for a slug that matches no project', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);

    await expect(getProjectBySlug('no-such-project')).resolves.toBeNull();
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledWith(expect.any(String), {
      slug: 'no-such-project',
    });
  });

  it('throws, with the slug in its metadata, when the query fails', async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(outage);

    await expect(getProjectBySlug('grepo')).rejects.toMatchObject({
      command: 'sanity:project-by-slug',
      cause: outage,
      metadata: { params: { slug: 'grepo' } },
    });
  });
});

describe('getSiteSettings', () => {
  it('asks for the singleton by its fixed id and answers it undecoded', async () => {
    const raw = { _id: 'siteSettings', _type: 'siteSettings', tagline: '  Hi.  ', email: null };
    sanity.sanityFetchWithToken.mockResolvedValue(raw);

    await expect(getSiteSettings()).resolves.toBe(raw);
    expect(sanity.sanityFetchWithToken.mock.calls[0]?.[0]).toBe(siteSettingsQuery);
  });

  it('answers null before the document is created', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);

    await expect(getSiteSettings()).resolves.toBeNull();
  });

  it('throws when the query fails', async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(outage);

    await expect(getSiteSettings()).rejects.toMatchObject({
      command: 'sanity:site-settings',
      cause: outage,
    });
  });
});

describe('getResume', () => {
  it('answers null when no resume is active', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);

    await expect(getResume()).resolves.toBeNull();
  });

  it('throws when the query fails', async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(outage);

    await expect(getResume()).rejects.toMatchObject({ command: 'sanity:resume', cause: outage });
  });
});
