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
 * @file The place photo's `sizes` matches the frame it is drawn in, so next/image fetches a file
 * as wide as the frame. The journal layout has fluid PageShell gutters and a single stage
 * border, rather than nested card padding. Evaluate the attribute at viewport boundaries
 * against those actual boxes so a wide photograph never receives an undersized source.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';

/** The shell (layout.tsx): full-width main below lg; a 64 px rail and max-w-shell from lg. */
const LG_PX = 1024;
const RAIL_PX = 64;
const SHELL_PX = 1200;
const STAGE_BORDER_PX = 1;

const VIEWPORT_WIDTHS = [
  360, 375, 400, 401, 414, 767, 768, 900, 1023, 1024, 1180, 1199, 1200, 1263, 1264, 1280, 1366,
  1440, 1920,
] as const;

const PHOTO: ViewerPhoto = {
  url: 'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=1600',
  thumb: 'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=320&h=240&fit=crop&auto=format',
  alt: 'Photo of A',
};

/** The photo frame's width in the page at a viewport width, from the boxes around it. */
function frameWidth(viewport: number): number {
  const main = viewport < LG_PX ? viewport : Math.min(SHELL_PX, viewport - RAIL_PX);
  const gutter = Math.min(32, Math.max(16, 8 + viewport * 0.02));
  return main - 2 * (gutter + STAGE_BORDER_PX);
}

/** One `sizes` length: `Npx`, `Nvw` or `calc(-Mpx + Nvw)`, the forms the viewer uses. */
function evaluateLength(length: string, viewport: number): number {
  const px = length.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) return Number(px[1]);
  const vw = length.match(/^(\d+(?:\.\d+)?)vw$/);
  if (vw) return (Number(vw[1]) / 100) * viewport;
  const calc = length.match(/^calc\(-(\d+(?:\.\d+)?)px \+ (\d+(?:\.\d+)?)vw\)$/);
  if (calc) return (Number(calc[2]) / 100) * viewport - Number(calc[1]);
  throw new Error(`unexpected sizes length "${length}"`);
}

/** The widths next/image lists in the photo's srcset, smallest first. */
const srcsetWidths = (): number[] => {
  render(<PlacePhotoViewer photos={[PHOTO]} placeName="A place" summary={<h2>A place</h2>} />);
  const srcset = screen.getByRole('img', { name: PHOTO.alt }).getAttribute('srcset') ?? '';
  return [...srcset.matchAll(/\s(\d+)w(?:,|$)/g)]
    .map(([, width = '']) => Number(width))
    .sort((a, b) => a - b);
};

/** next.config.ts's smallest deviceSizes entry (the default 640). */
const SMALLEST_DEVICE_WIDTH = 640;

/** The slot width the browser takes from `sizes`: the first entry whose max-width matches. */
function evaluateSizes(sizes: string, viewport: number): number {
  for (const entry of sizes.split(/,\s*/)) {
    const conditional = entry.match(/^\(max-width:\s*(\d+)px\)\s+(.+)$/);
    if (!conditional) return evaluateLength(entry.trim(), viewport);
    if (viewport <= Number(conditional[1])) return evaluateLength(conditional[2] ?? '', viewport);
  }
  throw new Error(`sizes "${sizes}" has no default entry`);
}

/** The `sizes` next/image gives the photo in a one-photo viewer; throws when it has none. */
const photoSizes = (): string => {
  render(<PlacePhotoViewer photos={[PHOTO]} placeName="A place" summary={<h2>A place</h2>} />);
  const sizes = screen.getByRole('img', { name: PHOTO.alt }).getAttribute('sizes');
  if (!sizes) throw new Error('the photo has no sizes attribute');
  return sizes;
};

afterEach(cleanup);

describe("the place photo's sizes", () => {
  it.each(VIEWPORT_WIDTHS)('matches the frame width at a %i px viewport', (viewport) => {
    const slot = evaluateSizes(photoSizes(), viewport);

    expect(Math.abs(slot - frameWidth(viewport))).toBeLessThanOrEqual(1);
  });

  it('asks for the full 1134 px image area on a 1366 px laptop', () => {
    expect(evaluateSizes(photoSizes(), 1366)).toBe(1134);
  });

  it('lets next/image see its 100vw, so the srcset skips the 16-40 w icon sizes', () => {
    // next/image only reads a vw length after a space; missing it, the srcset lists every size,
    // and the longer preload selector throws in jsdom (place-details-page.test.tsx).
    const widths = srcsetWidths();

    expect(widths.length).toBeGreaterThan(0);
    expect(widths[0]).toBeGreaterThanOrEqual(SMALLEST_DEVICE_WIDTH);
  });
});
