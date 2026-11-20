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
 * @file axe on a project page's two closing sections (audit 2026-11-20 minor 5): the photos and
 * videos (PortfolioMedia, id "project-media") and the "See also" list after it. They shared the
 * id "project-media-title", so the "See also" landmark was named "Photos and videos"; the helper
 * fails on a duplicate id that ARIA points at. Rendered as project-media-ids.test.tsx renders
 * them, with the same mocks.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectMedia } from '@/app/(routes)/(dev)/media/_components/project-media';
import { PortfolioMedia } from '@/components/portfolio-media';
import type { PortfolioMediaItem } from '@/hooks/sanity/schemas';
import { expectNoAxeViolations } from '../../utils/axe';

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

describe('project media and "See also" under axe', () => {
  it('finds nothing to fix in the two sections, each named by its own heading', async () => {
    const { container } = render(
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

    await expectNoAxeViolations(container, { label: 'project media with "See also"' });
    expect(screen.getByRole('complementary', { name: 'See also' })).toBeInTheDocument();
  });
});
