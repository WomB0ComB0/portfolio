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
 * @file /projects/[id] looks its project up on the server before anything streams, so:
 * - an unknown id rejects with Next's 404 (notFound()), which answers HTTP 404 in the shell;
 * - a malformed id is a 404 too, and never reaches Sanity;
 * - a Sanity outage with nothing cached rejects with the outage itself (HTTP 500 via error.tsx);
 * - a known id renders one h1, and the gallery island gets plain image URLs.
 * The real loaders run; only the Sanity client (with the real URL builder), the env, Sentry,
 * YouTube and the gallery island are mocked.
 */

import { render, screen } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraggableGalleryProps } from '@/app/(routes)/(main)/(professioal)/projects/_components/draggable-gallery.types';
import type { Project } from '@/hooks/sanity/schemas';

const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));
const gallery = vi.hoisted(() => ({ render: vi.fn() }));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/api-integrations/youtube', () => ({
  fetchChannelVideos: vi.fn(),
  fetchYouTubeVideoMetadataBatch: vi.fn(),
}));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: sanity.sanityFetchWithToken,
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/app/(routes)/(main)/(professioal)/projects/_components/draggable-gallery', () => {
  const DraggableGallery = (props: DraggableGalleryProps) => {
    gallery.render(props);
    return <div data-testid="gallery" />;
  };
  return { default: DraggableGallery, DraggableGallery };
});

import ProjectDetailPage from '@/app/(routes)/(main)/(professioal)/projects/[id]/page';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';
import { logger } from '@/utils';

const NOT_FOUND_DIGEST = /^NEXT_HTTP_ERROR_FALLBACK;404/;

const imageOf = (name: string, alt?: string): NonNullable<Project['image']> => ({
  _type: 'image',
  asset: { _ref: `image-${name}-1600x900-png`, _type: 'reference' },
  ...(alt ? { alt } : {}),
});

const GREPO = makeProject({
  title: 'grepo',
  description: 'Search your repos.',
  image: imageOf('cover', 'grepo cover'),
  images: [imageOf('first', 'Search results'), imageOf('second')],
  githubUrl: 'https://github.com/example/grepo',
  liveUrl: 'https://grepo.example.com',
  startDate: '2025-01-01',
});

const pageFor = (id: string) => ProjectDetailPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetSanityLoaderCaches();
  sanity.sanityFetchWithToken.mockReset();
  sanity.sanityFetchWithToken.mockResolvedValue([GREPO]);
  gallery.render.mockReset();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

describe('/projects/[id] status', () => {
  it("rejects an id Sanity doesn't have with Next's 404", async () => {
    await expect(pageFor('nope')).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed id with a 404 without asking Sanity', async () => {
    await expect(pageFor('../x')).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
    expect(sanity.sanityFetchWithToken).not.toHaveBeenCalled();
  });

  it('rejects with the outage, not a 404, when Sanity fails with nothing cached', async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(new Error('Sanity answered 503'));

    const error: unknown = await pageFor(GREPO._id).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(String((error as { digest?: unknown }).digest ?? '')).not.toMatch(NOT_FOUND_DIGEST);
  });
});

describe('/projects/[id] content', () => {
  it('renders the project with exactly one h1', async () => {
    render(await pageFor(GREPO._id));

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('grepo');
    expect(screen.getByRole('link', { name: /View Live Project/ })).toHaveAttribute(
      'href',
      'https://grepo.example.com',
    );
    expect(screen.getByRole('link', { name: /View Source Code/ })).toHaveAttribute(
      'href',
      'https://github.com/example/grepo',
    );
    expect(screen.getByRole('link', { name: /Back to All Projects/ })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('hands the gallery island plain image URLs built on the server', async () => {
    render(await pageFor(GREPO._id));

    expect(screen.getByTestId('gallery')).toBeInTheDocument();
    expect(gallery.render).toHaveBeenCalledWith({
      images: [
        {
          url: 'https://cdn.sanity.io/images/test/test/first-1600x900.png?w=1200&h=675',
          alt: 'Search results',
        },
        {
          url: 'https://cdn.sanity.io/images/test/test/second-1600x900.png?w=1200&h=675',
          alt: 'Project image',
        },
      ],
    });
  });
});
