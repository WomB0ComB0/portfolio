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
 * @file A project page with photos and a "See also" names each landmark by its own heading
 * (audit 2026-11-20 minor 5; WCAG 1.3.1, 4.1.2). The project's media section (PortfolioMedia,
 * id "project-media") titled itself "project-media-title", the id "See also" used too, so the
 * "See also" landmark was read as "Photos and videos".
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectMedia } from '@/app/(routes)/(dev)/media/_components/project-media';
import { PortfolioMedia } from '@/components/portfolio-media';
import type { PortfolioMediaItem } from '@/hooks/sanity/schemas';

vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'production' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/components/link-health/link-health-badge', () => ({ LinkHealthBadge: () => null }));

afterEach(cleanup);

const PHOTO: PortfolioMediaItem = {
  _key: 'photo',
  _type: 'portfolioPhoto',
  image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-photo-1600x900-png' } },
  alt: 'Delivery dashboard',
};

/** The project page's two sections, as project-detail.tsx and the page render them. */
function renderProjectSections() {
  return render(
    <>
      <PortfolioMedia id="project-media" media={[PHOTO]} />
      <ProjectMedia
        items={[
          {
            id: 'video-1',
            kind: 'video',
            title: 'Demo',
            href: 'https://www.youtube.com/watch?v=example1234',
          },
          { id: 'post-1', kind: 'post', title: 'Building it', href: 'https://example.com/post' },
        ]}
      />
    </>,
  );
}

describe('a project page with photos and a "See also"', () => {
  it('names each landmark by its own heading', () => {
    renderProjectSections();

    expect(screen.getByRole('region', { name: 'Photos and videos' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'See also' })).toBeInTheDocument();
  });

  it('gives no two elements the same id', () => {
    const { container } = renderProjectSections();
    const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });
});
