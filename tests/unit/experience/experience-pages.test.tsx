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
 * @file How /experience/[id] answers as a route (the list is role-story-page.test.tsx's). The
 * detail route calls notFound() itself, so an unknown id answers a real 404 before anything else
 * is loaded, a Sanity failure reaches the error boundary instead of an empty page, and its
 * metadata names the role as the list does, without raw addresses. What the page shows is
 * covered in role-detail-page.test.tsx.
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
  loadProjects: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadExperienceById: h.loadExperienceById,
  loadProjects: h.loadProjects,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// client.ts require()s '@/env' at load; the pages only need the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ExperienceDetailPage, {
  generateMetadata,
} from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { logger } from '@/utils';
import { constructMetadata } from '@/utils/seo/meta';

const E_DIR = 'src/app/(routes)/(main)/(professioal)/experience';
const STORY_FILE = `${E_DIR}/_interface/role-story/role-story.tsx`;
const DETAIL_FILE = `${E_DIR}/_interface/role-detail/role-detail.tsx`;

const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
/** An inline opacity of exactly 0 (not 0.8): what a motion entrance leaves in server HTML. */
const ZERO_OPACITY = /opacity:\s*0(?![.\d])/;
/** A Suspense boundary's streamed segment: what loading.tsx leaves hidden without JavaScript. */
const STREAMED_SEGMENT = /<div hidden id="S:/;

const LOGO = {
  _type: 'image' as const,
  asset: { _ref: 'image-logo-200x200-png', _type: 'reference' as const },
};

/** 15 experiences, as many as Sanity holds: the first current, the second current by no end date. */
const EXPERIENCES = Array.from({ length: 15 }, (_, index) => {
  if (index === 0) {
    return makeExperience({
      logo: LOGO,
      current: true,
      endDate: null,
      company: 'Platform Co, Inc.',
      companyUrl: 'https://platform.example',
      location: 'New York, NY',
      description: 'Ran the platform (https://platform.example/docs) for a while. Then more.',
      responsibilities: ['Ran the platform team'],
      technologies: ['Go', 'Kubernetes'],
    });
  }
  if (index === 1) return makeExperience({ current: false, endDate: null });
  return makeExperience();
});

const FIRST = EXPERIENCES[0];
if (!FIRST) throw new Error('the fixtures have no experiences');

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const sourceOf = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

beforeEach(() => {
  h.loadExperiences.mockReset();
  h.loadExperienceById.mockReset();
  h.loadProjects.mockReset();
  h.reportApiFailure.mockReset();
  h.loadExperiences.mockResolvedValue(EXPERIENCES);
  h.loadProjects.mockResolvedValue([]);
  h.loadExperienceById.mockImplementation(
    async (id: string) => EXPERIENCES.find((experience) => experience._id === id) ?? null,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/experience/[id]', () => {
  it('answers 404 for an id Sanity does not have, before loading anything else', async () => {
    await expect(ExperienceDetailPage(paramsFor('__nope__'))).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
    expect(h.loadExperienceById).toHaveBeenCalledWith('__nope__');
    expect(h.loadExperiences).not.toHaveBeenCalled();
    expect(h.loadProjects).not.toHaveBeenCalled();
  });

  it('renders a known experience with its position as the one h1', async () => {
    render(await ExperienceDetailPage(paramsFor(FIRST._id)));

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(FIRST.position);
    // Every role, the lead included, leads back to its own stop on the list's rail.
    expect(screen.getByRole('link', { name: /All experience/ })).toHaveAttribute(
      'href',
      `/experience#role-${FIRST._id}`,
    );
  });

  it('renders on the server with no entrance or loading boundary hiding it', async () => {
    const html = renderToString(await ExperienceDetailPage(paramsFor(FIRST._id)));

    expect(html).toContain(FIRST.position);
    expect(html).not.toMatch(ZERO_OPACITY);
    expect(html).not.toMatch(STREAMED_SEGMENT);
  });

  it('answers 404 for a role that has not begun: the list leaves it out until its first month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Noon in New York on 13 November 2026; the role begins in December.
    vi.setSystemTime(new Date('2026-11-13T17:00:00Z'));
    const upcoming = makeExperience({ startDate: '2026-12-01', endDate: null, current: true });
    h.loadExperienceById.mockResolvedValue(upcoming);

    await expect(ExperienceDetailPage(paramsFor(upcoming._id))).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
    const metadata = await generateMetadata(paramsFor(upcoming._id));
    expect(metadata).toEqual(NOT_FOUND_METADATA);
    expect(metadata.openGraph?.url).toBeUndefined();
  });

  it('lets a Sanity failure reach the error boundary instead of answering 404', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperienceById.mockRejectedValue(outage);

    await expect(ExperienceDetailPage(paramsFor(FIRST._id))).rejects.toBe(outage);
  });

  it('lets a failure of the list reach the error boundary too', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperiences.mockRejectedValue(outage);

    await expect(ExperienceDetailPage(paramsFor(FIRST._id))).rejects.toBe(outage);
  });
});

describe('/experience/[id] metadata', () => {
  it("gives an unknown id the site's own 404 title, without og:url", async () => {
    const result = await generateMetadata(paramsFor('__nope__'));

    // The title the server sends with the 404 ("404"), so hydration never swaps it for another.
    expect(result).toEqual(NOT_FOUND_METADATA);
    expect(result.title).toMatchObject({ default: '404' });
    expect(result.openGraph?.url).toBeUndefined();
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });

  it('describes a known experience with its own og:url', async () => {
    const result = await generateMetadata(paramsFor(FIRST._id));

    expect(result.openGraph).toMatchObject({
      title: `${FIRST.position} at Platform Co`,
      url: `https://mikeodnis.dev/experience/${FIRST._id}`,
    });
  });

  it('names the organization as the list does, and leaves raw addresses out of the description', async () => {
    const result = await generateMetadata(paramsFor(FIRST._id));

    expect(String(result.title)).not.toContain('Inc.');
    expect(result.description).toBe('Ran the platform for a while. Then more.');
    expect(result.openGraph?.description).toBe('Ran the platform for a while. Then more.');
  });

  it("keeps the page's defaults and reports a warning when Sanity fails", async () => {
    const outage = new Error('Sanity answered 503');
    h.loadExperienceById.mockRejectedValue(outage);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const result = await generateMetadata(paramsFor('exp-1'));

    expect(result).toEqual(
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
  it.each([STORY_FILE, DETAIL_FILE])(
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

  it('has no loading boundary anywhere on /experience, so rows render without JavaScript', () => {
    expect(existsSync(join(process.cwd(), E_DIR, 'loading.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), E_DIR, '[id]', 'loading.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), E_DIR, '(list)', 'loading.tsx'))).toBe(false);
  });
});
