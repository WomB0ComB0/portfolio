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

import { cleanup, fireEvent, render } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import { RoleDetailLogo } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-detail-logo';
import { roleLogoOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-logo';

const experience = makeExperience({
  logo: {
    _type: 'image',
    asset: { _type: 'reference', _ref: 'image-logo-600x200-png' },
    crop: { top: 0.1, bottom: 0.1, left: 0.2, right: 0.2 },
  },
});
afterEach(cleanup);

describe('the detail logo source', () => {
  it('requests the whole asset at 336px without a square crop or Studio crop', () => {
    const href = roleLogoOf(experience, { variant: 'detail' });
    expect(href).not.toBeNull();
    const url = new URL(href as string);
    expect(url.searchParams.get('w')).toBe('336');
    expect(url.searchParams.get('fit')).toBe('max');
    for (const key of ['h', 'rect', 'crop']) expect(url.searchParams.has(key)).toBe(false);
  });
  it('keeps the existing 96px square list source unchanged', () => {
    const url = new URL(roleLogoOf(experience) as string);
    expect(url.searchParams.get('w')).toBe('96');
    expect(url.searchParams.get('h')).toBe('96');
    expect(url.searchParams.get('fit')).toBe('crop');
  });
  it('allows a monogram when a detail logo is missing or its asset cannot be read', () => {
    expect(roleLogoOf(makeExperience(), { variant: 'detail' })).toBeNull();
    expect(
      roleLogoOf(
        makeExperience({
          logo: { _type: 'image', asset: { _type: 'reference', _ref: 'invalid' } },
        }),
        { variant: 'detail' },
      ),
    ).toBeNull();
  });
});

describe('RoleDetailLogo', () => {
  it('is a decorative full-color image in an 80/112px phrasing-content frame', () => {
    const { container } = render(
      <p>
        <RoleDetailLogo src="/logo.png" monogram="AC" />
        Acme
      </p>,
    );
    const frame = container.querySelector('[data-role-detail-logo]');
    const image = frame?.querySelector('img');
    expect(frame?.tagName).toBe('SPAN');
    expect(frame?.getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(frame?.classList ?? [])).toEqual(
      expect.arrayContaining(['size-20', '@min-[40rem]/page:size-28']),
    );
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.classList.contains('object-contain')).toBe(true);
    expect(`${frame?.className} ${image?.className}`).not.toMatch(/grayscale|invert|opacity-/);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('p div, p h1, p a')).toBeNull();
  });
  it('keeps the same frame and uses the monogram when an image fails', () => {
    const { container } = render(<RoleDetailLogo src="/logo.png" monogram="AC" />);
    const frame = container.querySelector('[data-role-detail-logo]');
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);
    expect(container.querySelector('[data-role-detail-logo]')).toBe(frame);
    expect(container.querySelector('img')).toBeNull();
    expect(frame).toHaveTextContent('AC');
  });
  it('shows a replacement source after the previous image failed', () => {
    const { container, rerender } = render(<RoleDetailLogo src="/first.png" monogram="AC" />);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);
    rerender(<RoleDetailLogo src="/second.png" monogram="BC" />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('[data-role-detail-logo]')).not.toHaveTextContent('AC');
  });
  it('renders the monogram immediately when there is no logo', () => {
    const { container } = render(<RoleDetailLogo src={null} monogram="AC" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-role-detail-logo]')).toHaveTextContent('AC');
  });
});
