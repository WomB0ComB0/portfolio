/**
 * Copyright 2026 Mike Odnis
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

import { render, screen, within } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoleProgression } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-progression';
import { buildRoleIndex } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-index';
import { subRolesOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-subroles';
import { mediaSizeOf, PortfolioMedia } from '@/components/portfolio-media';
import type { PortfolioMediaItem } from '@/hooks/sanity/schemas';

vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'production' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/components/link-health/link-health-badge', () => ({ LinkHealthBadge: () => null }));

const image = {
  _type: 'image' as const,
  asset: { _type: 'reference' as const, _ref: 'image-photo-1600x900-png' },
};
const photo: PortfolioMediaItem = {
  _key: 'photo',
  _type: 'portfolioPhoto',
  image,
  alt: 'Delivery dashboard',
  caption: 'An overview of the delivery tools.',
};
const video: PortfolioMediaItem = {
  _key: 'video',
  _type: 'portfolioVideo',
  title: 'Delivery walkthrough',
  file: { url: 'https://cdn.sanity.io/files/test/production/demo.mp4', mimeType: 'video/mp4' },
  poster: image,
  // Sanity names a file asset by its SHA-1 (40 hex), the only .vtt name the caption rewrite accepts.
  captionsFile: {
    url: 'https://cdn.sanity.io/files/test/production/0123456789abcdef0123456789abcdef01234567.vtt',
    mimeType: 'text/vtt',
  },
  captionsLanguage: 'en',
  captionsLabel: 'English',
};
const external: PortfolioMediaItem = {
  _key: 'external',
  _type: 'portfolioVideo',
  title: 'Team presentation',
  externalUrl: 'https://example.com/watch',
  poster: image,
};

describe('PortfolioMedia', () => {
  it.each([undefined, null, []])('renders nothing for absent media: %j', (media) => {
    expect(renderToStaticMarkup(<PortfolioMedia id="media" media={media} />)).toBe('');
  });
  it('renders photos with alt text, captions and a link to the full CDN image in the first HTML', () => {
    const html = renderToStaticMarkup(<PortfolioMedia id="media" media={[photo]} />);
    expect(html).toContain('Delivery dashboard');
    const { container } = render(<PortfolioMedia id="media" media={[photo]} />);
    const link = screen.getByRole('link', { name: /Delivery dashboard.*full image/u });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/cdn\.sanity\.io\/images/u);
    expect(screen.getByAltText('Delivery dashboard')).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText(photo.caption ?? '')).toBeVisible();
    expect(container.querySelector('img')?.src).not.toContain('/_next/image');
  });
  it('plays an upload only on request, with accessible native controls and same-origin captions', () => {
    const { container } = render(<PortfolioMedia id="media" media={[video]} />);
    const player = screen.getByLabelText('Delivery walkthrough');
    expect(player).toHaveAttribute('controls');
    expect(player).toHaveAttribute('playsinline');
    expect(player).toHaveAttribute('preload', 'none');
    expect(player).not.toHaveAttribute('crossorigin');
    expect(player).not.toHaveAttribute('autoplay');
    expect(player).toHaveAttribute('poster', expect.stringContaining('cdn.sanity.io/images'));
    expect(container.querySelector('source')).toHaveAttribute('src', video.file?.url);
    expect(container.querySelector('track')).toHaveAttribute(
      'src',
      '/assets/sanity-files/test/production/0123456789abcdef0123456789abcdef01234567.vtt',
    );
    expect(container.querySelector('track')).toHaveAttribute('srclang', 'en');
    expect(container.querySelector('track')).toHaveAttribute('label', 'English');
    expect(screen.getByRole('link', { name: /Open video.*Delivery walkthrough/u })).toHaveAttribute(
      'href',
      video.file?.url,
    );
  });
  it('uses a named external watch link without a provider frame or native player', () => {
    const { container } = render(<PortfolioMedia id="media" media={[external]} />);
    expect(screen.getByRole('link', { name: /Watch.*Team presentation/u })).toHaveAttribute(
      'href',
      external.externalUrl,
    );
    expect(container.querySelector('iframe, video')).toBeNull();
  });
  it('sizes a phone-shaped walkthrough by its own poster, not a 16:9 box, before anything loads', () => {
    const portrait = {
      ...image,
      asset: { ...image.asset, _ref: 'image-mobileTour-390x844-png' },
    };
    const html = renderToStaticMarkup(
      <PortfolioMedia id="media" media={[{ ...video, poster: portrait }, external]} />,
    );
    expect(html).not.toContain('aspect-video');
    const { container } = render(
      <PortfolioMedia id="media" media={[{ ...video, poster: portrait }, external]} />,
    );
    const player = screen.getByLabelText('Delivery walkthrough');
    expect(player).toHaveAttribute('width', '390');
    expect(player).toHaveAttribute('height', '844');
    expect(player.style.getPropertyValue('--media-aspect')).toBe('0.4621');
    // Wide media keeps its own shape too: the external poster is 1600x900.
    const frames = Array.from(container.querySelectorAll<HTMLElement>('[data-media-frame]'));
    expect(frames.map((frame) => frame.style.getPropertyValue('--media-aspect'))).toEqual([
      '0.4621',
      '1.7778',
    ]);
    // Never taller than the cap: the width follows the shape, so a tall frame narrows instead.
    for (const frame of frames) {
      expect(frame.className).toContain('aspect-(--media-aspect)');
      expect(frame.className).toContain('w-[min(100%,calc(min(36rem,75svh)*var(--media-aspect)))]');
    }
  });
  it('falls back to 16:9 for a video without a poster or with an unreadable size', () => {
    render(<PortfolioMedia id="media" media={[{ ...video, poster: undefined }, photo]} />);
    const player = screen.getByLabelText('Delivery walkthrough');
    expect(player).toHaveAttribute('width', '1280');
    expect(player).toHaveAttribute('height', '720');
    expect(player.style.getPropertyValue('--media-aspect')).toBe('1.7778');
    expect(mediaSizeOf(undefined)).toEqual({ width: 1280, height: 720 });
    expect(mediaSizeOf({ ...image, asset: { ...image.asset, _ref: 'image-a-0x844-png' } })).toEqual(
      { width: 1280, height: 720 },
    );
    expect(mediaSizeOf(image)).toEqual({ width: 1600, height: 900 });
  });
  it('drops unsafe direct inputs and keeps valid siblings without throwing', () => {
    const { container } = render(
      <PortfolioMedia
        id="media"
        media={[
          { ...external, externalUrl: 'javascript:alert(1)' },
          photo,
          { ...photo, _key: 'bad', image: { ...image, asset: { ...image.asset, _ref: 'broken' } } },
        ]}
      />,
    );
    expect(container.querySelectorAll('figure')).toHaveLength(1);
    expect(container.querySelector('[href^="javascript:"]')).toBeNull();
  });
});

it('attaches media to the correct child, including a media-only role, without changing the clock', () => {
  const experience = makeExperience({
    startDate: '2023-01-01',
    endDate: '2024-12-31',
    subRoles: [
      {
        _key: 'junior',
        position: 'Junior Engineer',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        current: false,
      },
      {
        _key: 'senior',
        position: 'Engineer',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        current: false,
      },
    ],
  });
  const withMedia = {
    ...experience,
    media: [photo],
    subRoles: experience.subRoles?.map((role) => ({
      ...role,
      media: role._key === 'senior' ? [video] : [],
    })),
  };
  const options = { today: '2026-11-17' };
  const before = buildRoleIndex([experience], options);
  const after = buildRoleIndex([withMedia], options);
  expect(after.clock).toEqual(before.clock);
  expect(after.total).toEqual(before.total);
  const roles = subRolesOf(withMedia, options);
  const { container, rerender } = render(<RoleProgression id="roles" subRoles={roles} />);
  const senior = container.querySelector('[data-sub-role-key="senior"]') as HTMLElement;
  expect(within(senior).getByLabelText('Delivery walkthrough')).toBeInTheDocument();
  expect(container.querySelector('[data-sub-role-key="junior"] video')).toBeNull();
  rerender(<RoleProgression id="roles" subRoles={roles} variant="compact" />);
  expect(container.querySelector('video, img, [data-portfolio-media]')).toBeNull();
});
