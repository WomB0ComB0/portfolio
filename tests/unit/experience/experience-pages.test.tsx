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
 * @file /experience and /experience/[id] render on the server from the D1 loaders. The list has
 * every experience in its HTML (no pagination, nothing hidden at opacity 0), each linking to its
 * page with a pending spinner inside the link. The detail page calls notFound() itself, so an
 * unknown id answers a real 404 instead of a 200 that a client component turns into one, and a
 * Sanity failure reaches the error boundary instead of an empty page.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadExperienceById: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadExperienceById: h.loadExperienceById,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// client.ts require()s '@/env' at load; the pages only need the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ExperienceLoading from '@/app/(routes)/(main)/(professioal)/experience/(list)/loading';
import ExperiencePage from '@/app/(routes)/(main)/(professioal)/experience/(list)/page';
import ExperienceDetailPage, {
  generateMetadata,
} from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import { logger } from '@/utils';
import { constructMetadata } from '@/utils/seo/meta';

const E_DIR = 'src/app/(routes)/(main)/(professioal)/experience';
const LIST_FILE = `${E_DIR}/_interface/experience-list/experience-list.tsx`;
const DETAIL_FILE = `${E_DIR}/_interface/experience-detail/experience-detail.tsx`;

const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
/** An inline opacity of exactly 0 (not 0.8): what a motion entrance leaves in server HTML. */
const ZERO_OPACITY = /opacity:\s*0(?![.\d])/;

const LOGO = {
  _type: 'image' as const,
  asset: { _ref: 'image-logo-200x200-png', _type: 'reference' as const },
};
const LOGO_URL = 'https://cdn.sanity.io/images/test/test/logo-200x200.png?w=56&h=56';

/** 15 experiences, as many as Sanity holds: more than the old first page of 10. */
const EXPERIENCES = Array.from({ length: 15 }, (_, index) =>
  index === 0
    ? makeExperience({
        logo: LOGO,
        current: true,
        endDate: null,
        location: 'New York, NY',
        responsibilities: ['Ran the platform team'],
        technologies: ['Go', 'Kubernetes'],
      })
    : makeExperience(),
);

const FIRST = EXPERIENCES[0];
if (!FIRST) throw new Error('the fixtures have no experiences');

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const detailHrefs = (): string[] =>
  screen
    .getAllByRole('link', { name: 'View Details' })
    .map((link) => link.getAttribute('href') ?? '');
const sourceOf = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

beforeEach(() => {
  h.loadExperiences.mockReset();
  h.loadExperienceById.mockReset();
  h.reportApiFailure.mockReset();
  h.loadExperiences.mockResolvedValue(EXPERIENCES);
  h.loadExperienceById.mockImplementation(
    async (id: string) => EXPERIENCES.find((experience) => experience._id === id) ?? null,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('/experience', () => {
  it('links every experience to its page, with no pagination', async () => {
    render(await ExperiencePage());

    const expected = EXPERIENCES.map(({ _id }) => `/experience/${encodeURIComponent(_id)}`);
    expect([...new Set(detailHrefs())].sort()).toEqual([...expected].sort());
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('puts a pending spinner inside every detail link', async () => {
    render(await ExperiencePage());

    for (const link of screen.getAllByRole('link', { name: 'View Details' })) {
      const spinners = Array.from(link.querySelectorAll('span[aria-hidden="true"]')).filter(
        (span) => span.className.includes('data-[pending]'),
      );
      expect(spinners).toHaveLength(1);
    }
  });

  it('has every experience in the server HTML, with no entrance hiding it', async () => {
    const html = renderToString(await ExperiencePage());

    for (const experience of EXPERIENCES) {
      expect(html).toContain(experience.position);
      expect(html).toContain(`href="/experience/${experience._id}"`);
    }
    expect(html).not.toMatch(ZERO_OPACITY);
    expect(html).not.toContain('scale(0)');
  });

  it("builds a logo on the server from Sanity's image CDN", async () => {
    render(await ExperiencePage());

    const [logo] = screen.getAllByRole('img', { name: `${FIRST.company} logo` });
    expect(decodeURIComponent(logo?.getAttribute('src') ?? '')).toContain(LOGO_URL);
  });

  it('shows the empty state when Sanity has no experiences', async () => {
    h.loadExperiences.mockResolvedValue([]);

    render(await ExperiencePage());

    expect(screen.getByRole('heading', { level: 1, name: 'Work Experience' })).toBeInTheDocument();
    expect(screen.getByText('No work experience listed at the moment.')).toBeInTheDocument();
  });

  it('lets a Sanity failure reach the error boundary instead of showing an empty timeline', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperiences.mockRejectedValue(outage);

    await expect(ExperiencePage()).rejects.toBe(outage);
  });

  it('shows a skeleton under the real page header while the list loads', () => {
    render(<ExperienceLoading />);

    expect(screen.getByRole('heading', { level: 1, name: 'Work Experience' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading work experience');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('/experience/[id]', () => {
  it('answers 404 for an id Sanity does not have', async () => {
    await expect(ExperienceDetailPage(paramsFor('__nope__'))).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
    expect(h.loadExperienceById).toHaveBeenCalledWith('__nope__');
  });

  it('renders a known experience with exactly one h1', async () => {
    render(await ExperienceDetailPage(paramsFor(FIRST._id)));

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(FIRST.position);
    expect(screen.getByRole('heading', { level: 2, name: FIRST.company })).toBeInTheDocument();
    expect(screen.getByText('Ran the platform team')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Experience' })).toHaveAttribute(
      'href',
      '/experience',
    );
  });

  it('lets a Sanity failure reach the error boundary instead of answering 404', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperienceById.mockRejectedValue(outage);

    await expect(ExperienceDetailPage(paramsFor(FIRST._id))).rejects.toBe(outage);
  });

  it('shows an entry the CMS lists twice both times, without a duplicate key', async () => {
    const repeated = makeExperience({
      responsibilities: ['Shipped releases', 'Shipped releases'],
      technologies: ['Go', 'Go'],
    });
    h.loadExperienceById.mockResolvedValue(repeated);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await ExperienceDetailPage(paramsFor(repeated._id)));

    expect(screen.getAllByText('Shipped releases')).toHaveLength(2);
    expect(screen.getAllByText('Go')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('/experience/[id] metadata', () => {
  it('names an unknown id "Experience Not Found", without og:url', async () => {
    const metadata = await generateMetadata(paramsFor('__nope__'));

    expect(metadata.openGraph).toMatchObject({ title: 'Experience Not Found' });
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });

  it('describes a known experience with its own og:url', async () => {
    const metadata = await generateMetadata(paramsFor(FIRST._id));

    expect(metadata.openGraph).toMatchObject({
      title: `${FIRST.position} at ${FIRST.company}`,
      description: FIRST.description,
      url: `https://mikeodnis.dev/experience/${FIRST._id}`,
    });
  });

  it("keeps the page's defaults and reports a warning when Sanity fails", async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperienceById.mockRejectedValue(outage);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const metadata = await generateMetadata(paramsFor('exp-1'));

    expect(metadata).toEqual(
      constructMetadata({
        title: 'Experience',
        description: 'View professional experience details',
        path: '/experience/exp-1',
      }),
    );
    expect(h.reportApiFailure).toHaveBeenCalledWith(outage, {
      context: 'build experience page metadata',
      level: 'warning',
    });
  });
});

describe('experience modules', () => {
  it.each([LIST_FILE, DETAIL_FILE])(
    '%s is a server module with no client data hooks or motion',
    (file) => {
      const source = sourceOf(file);

      expect(source).toMatch(/^import 'server-only';/);
      expect(source).not.toMatch(/['"]use client['"]/);
      expect(source).not.toContain('motion/react');
      expect(source).not.toContain('useSanity');
      expect(source).not.toMatch(/from '@\/components';/);
    },
  );

  it('has no loading boundary above /experience/[id]', () => {
    expect(existsSync(join(process.cwd(), E_DIR, 'loading.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), E_DIR, '[id]', 'loading.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), E_DIR, '(list)', 'loading.tsx'))).toBe(true);
  });
});
