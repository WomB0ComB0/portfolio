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
 * - a known id renders the case study (the owner's pick of 2026-11-15): one h1 with the name and
 *   subtitle, the breadcrumb to its year (or to Featured for a Featured project), When / Length
 *   / Status, Visit (its address wrapping only at the dots) and Source, the cover as a link to
 *   the whole image, 'Where it sits' between named neighbours, only the sections Studio has text
 *   for, Screens holding every screen but the cover (a figure, a strip or a contact sheet)
 *   captioned with Studio's own words, and Built with as links to /projects;
 * - a project with no image gets its description as the plate and no Screens section; one with
 *   only a cover has no Screens section either;
 * The real loaders run; only the Sanity client (with the real URL builder), the env, Sentry,
 * and YouTube are mocked. Media links will be connected by the separate Media extraction.
 */

import { render, screen, within } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/hooks/sanity/schemas';

const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));

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

// Vite cannot load the repo's PostCSS config, so the page's CSS modules are stood in for, as
// tests/setup/vitest.setup.ts does for others: each class `name` is `name`.
const cssNames = vi.hoisted(() => () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? name : undefined),
  }),
}));
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-hero.module.css',
  cssNames,
);
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-body.module.css',
  cssNames,
);
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/where-it-sits.module.css',
  cssNames,
);
vi.mock('@/components/console/photo/photo-viewer.module.css', cssNames);

import { storyAnchor } from '@/app/(routes)/(main)/(professioal)/projects/_components/story-parts';
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
  title: 'grepo - Search your repos',
  description: 'Search your repos.',
  longDescription: 'A CLI that searches every repo. It runs offline.',
  category: 'CLI Tool / Developer Tools',
  status: 'Completed / Active Maintenance',
  technologies: ['TypeScript', 'Bun', 'OpenAI GPT-3.5-turbo', 'Google Speech-to-Text'],
  image: imageOf('cover', 'grepo cover'),
  images: [imageOf('first', 'Search results'), imageOf('second')],
  githubUrl: 'https://github.com/example/grepo',
  liveUrl: 'https://grepo.example.com',
  startDate: '2025-01-01',
  endDate: '2025-01-02',
});
const EARLIER = makeProject({ title: 'Older Thing - A subtitle', startDate: '2024-03-01' });
const LATER = makeProject({ title: 'Newer Thing', startDate: '2025-06-01' });
const NO_IMAGE = makeProject({
  title: 'LinkThing',
  description: 'A link shortener behind links.example.dev with click analytics.',
  startDate: '2025-04-10',
  status: 'In Progress',
});
const COVER_ONLY = makeProject({ title: 'Solo', image: imageOf('solo', 'Solo home') });
/** The only ranked project, so /projects lists it in the Featured chapter. */
const DUO = makeProject({
  title: 'Duo',
  image: imageOf('duocover', 'Duo home'),
  images: [imageOf('duosecond', 'Duo settings')],
  liveUrl: 'https://duo.example.vercel.app',
  startDate: '2023-05-01',
  featuredRank: 1,
});

const pageFor = (id: string) => ProjectDetailPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetSanityLoaderCaches();
  sanity.sanityFetchWithToken.mockReset();
  sanity.sanityFetchWithToken.mockResolvedValue([GREPO, EARLIER, LATER, NO_IMAGE, COVER_ONLY, DUO]);
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

describe('/projects/[id] header', () => {
  it('renders exactly one h1: the name, then the subtitle', async () => {
    render(await pageFor(GREPO._id));

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('grepo: Search your repos');
  });

  it('shows the kind, When / Length / Status in words, and the description', async () => {
    const { container } = render(await pageFor(GREPO._id));

    expect(screen.getByText('CLI Tool')).toBeInTheDocument();
    const facts = container.querySelector('[data-case-facts]');
    expect(facts).toHaveTextContent('WhenJan 2025');
    expect(facts).toHaveTextContent('Length2 days');
    expect(facts).toHaveTextContent('StatusCompleted / active maintenance');
    expect(screen.getByText('Search your repos.')).toBeInTheDocument();
  });

  it('links Visit (named by its address) and Source, each in a new tab', async () => {
    render(await pageFor(GREPO._id));

    const visit = screen.getByRole('link', {
      name: 'Visit grepo.example.com (opens in a new tab)',
    });
    const source = screen.getByRole('link', { name: 'Source code (opens in a new tab)' });
    // The address as Studio wrote it, the same rule /projects links with (_lib/project-links.ts).
    expect(visit).toHaveAttribute('href', 'https://grepo.example.com');
    expect(source).toHaveAttribute('href', 'https://github.com/example/grepo');
    expect(visit).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leads back to the list and to the project year on it', async () => {
    render(await pageFor(GREPO._id));

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(within(crumbs).getByRole('link', { name: '2025' })).toHaveAttribute(
      'href',
      '/projects#y2025',
    );
  });

  it('leads a Featured project back to its own story in the Featured chapter', async () => {
    render(await pageFor(DUO._id));

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // The anchor /projects gives each Featured story (story-parts.tsx), so the crumb lands on it.
    expect(within(crumbs).getByRole('link', { name: 'Featured' })).toHaveAttribute(
      'href',
      `/projects#${storyAnchor(encodeURIComponent(DUO._id))}`,
    );
    expect(within(crumbs).queryByRole('link', { name: '2023' })).toBeNull();
  });

  it('lets the Visit address wrap only after its dots', async () => {
    render(await pageFor(DUO._id));

    const visit = screen.getByRole('link', {
      name: 'Visit duo.example.vercel.app (opens in a new tab)',
    });
    const address = visit.querySelector('[data-case-address]');
    expect(address).toHaveTextContent('duo.example.vercel.app');
    expect(address?.querySelectorAll('wbr')).toHaveLength(3);
    expect(Array.from(address?.childNodes ?? [], (node) => node.textContent)).toEqual([
      'duo.',
      '',
      'example.',
      '',
      'vercel.',
      '',
      'app',
    ]);
  });

  it('makes the cover a link to the whole image, never a crop', async () => {
    render(await pageFor(GREPO._id));

    const header = screen.getByRole('banner');
    const cover = within(header).getByRole('link', { name: 'Open screen 1 of 3: grepo cover' });
    expect(cover.getAttribute('href')).toMatch(/cover-1600x900\.png\?.*fit=max/);
    expect(cover.getAttribute('href')).not.toMatch(/[?&]h=/);
    expect(screen.getByText('3 screens')).toBeInTheDocument();
  });
});

describe('/projects/[id] where it sits', () => {
  it('names the projects that started before and after, as links', async () => {
    render(await pageFor(GREPO._id));

    const band = screen.getByRole('region', { name: 'Where it sits' });
    expect(
      within(band).getByRole('link', { name: /Earlier.*Older Thing.*Mar 2024/ }),
    ).toHaveAttribute('href', `/projects/${EARLIER._id}`);
    expect(within(band).getByRole('link', { name: /Later.*LinkThing.*Apr 2025/ })).toHaveAttribute(
      'href',
      `/projects/${NO_IMAGE._id}`,
    );
  });

  it('is left out for a project with no start date', async () => {
    render(await pageFor(COVER_ONLY._id));

    expect(screen.queryByRole('region', { name: 'Where it sits' })).toBeNull();
  });
});

describe('/projects/[id] case study', () => {
  it('sets the long description, its first sentence as the lead', async () => {
    render(await pageFor(GREPO._id));

    const about = screen.getByRole('region', { name: 'The project' });
    expect(within(about).getByText('A CLI that searches every repo.')).toBeInTheDocument();
    expect(within(about).getByText('It runs offline.')).toBeInTheDocument();
  });

  it("shows every screen but the cover, numbered as the viewer numbers them, with Studio's words or none", async () => {
    render(await pageFor(GREPO._id));

    const screens = screen.getByRole('region', { name: 'Screens' });
    const figures = within(screens).getAllByRole('figure');
    expect(figures.map((figure) => figure.querySelector('figcaption')?.textContent)).toEqual([
      'Fig. 2Search results',
      'Fig. 3',
    ]);
    expect(within(screens).getByRole('list')).toHaveAttribute('data-layout', 'strip');
    expect(within(screens).getByRole('link', { name: 'Open screen 3 of 3' })).toBeInTheDocument();
    expect(within(screens).queryByRole('link', { name: /^Open screen 1 of 3/ })).toBeNull();
  });

  it('shows the one screen beyond the cover as a single figure, and the cover once', async () => {
    render(await pageFor(DUO._id));

    const screens = screen.getByRole('region', { name: 'Screens' });
    expect(within(screens).getByRole('list')).toHaveAttribute('data-layout', 'single');
    expect(
      within(screens)
        .getAllByRole('figure')
        .map((figure) => figure.querySelector('figcaption')?.textContent),
    ).toEqual(['Fig. 2Duo settings']);
    expect(screen.getAllByRole('link', { name: 'Open screen 1 of 2: Duo home' })).toHaveLength(1);
  });

  it('lists Built with as links to the projects built with each', async () => {
    render(await pageFor(GREPO._id));

    const built = screen.getByRole('region', { name: 'Built with' });
    expect(within(built).getByRole('link', { name: 'TypeScript' })).toHaveAttribute(
      'href',
      '/projects?tech=TypeScript',
    );
    // A name with a long dotted word in it reads whole, its space kept.
    expect(within(built).getByRole('link', { name: 'OpenAI GPT-3.5-turbo' })).toHaveAttribute(
      'href',
      '/projects?tech=OpenAI%20GPT-3.5-turbo',
    );
  });

  it('holds a hyphenated word of a Built with name whole, a long dotted one with its cuts', async () => {
    render(await pageFor(GREPO._id));

    const built = screen.getByRole('region', { name: 'Built with' });
    // 'Speech-to-Text' moves whole to the next line when it fits there, never 'Speech-' / 'Text'.
    const speech = within(built).getByRole('link', { name: 'Google Speech-to-Text' });
    expect(Array.from(speech.querySelectorAll('span span'), (span) => span.textContent)).toEqual([
      'Speech-to-Text',
    ]);
    // A long dotted word is held the same way and keeps its cut after the dot.
    const gpt = within(built).getByRole('link', { name: 'OpenAI GPT-3.5-turbo' });
    const held = gpt.querySelector('span span');
    expect(held?.textContent).toBe('GPT-3.5-turbo');
    expect(held?.querySelectorAll('wbr')).toHaveLength(1);
    // A one-word name needs no block: it is the whole line already.
    expect(
      within(built).getByRole('link', { name: 'TypeScript' }).querySelector('span span'),
    ).toBeNull();
  });

  it('keeps a long address in prose as one piece that may wrap only at its dots', async () => {
    const { container } = render(await pageFor(NO_IMAGE._id));

    const plate = container.querySelector('[data-case-plate]');
    expect(plate).toHaveTextContent(
      'A link shortener behind links.example.dev with click analytics.',
    );
    // The address is one element of its own (whole when it fits a line), holding its break points.
    const whole = Array.from(plate?.querySelectorAll('span') ?? []).find(
      (span) => span.textContent === 'links.example.dev',
    );
    expect(whole?.querySelectorAll('wbr')).toHaveLength(2);
    expect(plate?.querySelectorAll('wbr')).toHaveLength(2);
  });

  it('gives a project with no image its description as the plate, and no Screens', async () => {
    const { container } = render(await pageFor(NO_IMAGE._id));

    expect(container.querySelector('[data-case-plate]')).toHaveTextContent(
      'A link shortener behind links.example.dev with click analytics.',
    );
    expect(screen.queryByRole('link', { name: /^Open/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Screens' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'The project' })).toBeNull();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    // An ongoing range ends 'now', the word /projects writes in its bylines.
    expect(container.querySelector('[data-case-facts]')).toHaveTextContent('WhenApr 2025 – now');
    expect(screen.queryByText('Length')).toBeNull();
  });

  it('keeps a project with only a cover to the cover: no Screens, no screen count', async () => {
    render(await pageFor(COVER_ONLY._id));

    expect(screen.getByRole('link', { name: 'Open the cover: Solo home' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Screens' })).toBeNull();
    expect(screen.queryByText(/screens?$/)).toBeNull();
  });

  it('ends with the way back to the list', async () => {
    render(await pageFor(GREPO._id));

    expect(screen.getByRole('link', { name: 'Back to all projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });
});
