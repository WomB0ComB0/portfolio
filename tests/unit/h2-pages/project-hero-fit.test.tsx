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
 * @file /projects/[id]'s screenshot fits its hero and the summary card does not cover it. In H2's
 * 1200 px column the old `w-[80%] max-w-4xl` frame grew to 896x504, taller than the 450 px hero
 * on a 1280x720 laptop (cropped top and bottom by overflow-hidden), and the now-opaque summary
 * card, pulled up by -mt-24, hid its bottom 96 px. The test reads the hero height, the frame's
 * width formula and the body's overlap from the rendered classes and evaluates them at real
 * viewport sizes with the shell's geometry; the browser checks measure the same in Playwright.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraggableGalleryProps } from '@/app/(routes)/(main)/(professioal)/projects/_components/draggable-gallery.types';
import type { Project } from '@/hooks/sanity/schemas';

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/app/(routes)/(main)/(professioal)/projects/_components/draggable-gallery', () => {
  const DraggableGallery = (_props: DraggableGalleryProps) => <div data-testid="gallery" />;
  return { default: DraggableGallery, DraggableGallery };
});

import { ProjectDetail } from '@/app/(routes)/(main)/(professioal)/projects/_interface/project-detail/project-detail';

const REM_PX = 16;
/** Tailwind's spacing step: -mt-8 is 8 x 0.25rem. */
const SPACING_PX = 4;
/** The shell (layout.tsx): a 64 px rail and a max-w-shell (75rem) main from lg, full width below. */
const LG_PX = 1024;
const RAIL_PX = 64;
const SHELL_PX = 1200;
/** Room the summary card must leave between itself and the screenshot's bottom edge. */
const MIN_CLEARANCE_PX = 8;

/** Laptops, tablets and phones, both orientations where they differ. */
const VIEWPORTS: readonly (readonly [number, number])[] = [
  [375, 667],
  [667, 375],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];

const PROJECT: Project = makeProject({
  title: 'grepo',
  image: {
    _type: 'image',
    asset: { _ref: 'image-cover-1600x900-png', _type: 'reference' },
    alt: 'grepo cover',
  },
});

interface HeroGeometry {
  heroMinPx: number;
  heroVh: number;
  heroMaxPx: number;
  frameWidthPercent: number;
  frameMaxRem: number;
  frameRoomRem: number;
  overlapPx: number;
}

const match = (classes: string, pattern: RegExp, what: string): RegExpMatchArray => {
  const found = classes.match(pattern);
  if (!found) throw new Error(`no ${what} in "${classes}"`);
  return found;
};

/** The numbers the hero, the screenshot frame and the body carry in their classes. */
function readGeometry(): HeroGeometry {
  const frame = screen.getByRole('img', { name: PROJECT.title }).closest('.aspect-video');
  const hero = frame?.parentElement;
  const body = screen.getByRole('heading', { level: 1 }).closest('.container');
  if (!frame || !hero || !body) throw new Error('the hero, its frame or the body is missing');

  const [, min, vh, max] = match(
    hero.className,
    /\[--hero-h:clamp\((\d+)px,(\d+)vh,(\d+)px\)\]/,
    'hero height variable',
  );
  match(hero.className, /(?:^|\s)h-\(--hero-h\)(?:\s|$)/, 'height from the variable');
  const [, percent, maxRem, roomRem] = match(
    frame.className,
    /w-\[min\((\d+)%,(\d+)rem,\(var\(--hero-h\)-(\d+(?:\.\d+)?)rem\)\*16\/9\)\]/,
    'height-bound frame width',
  );
  const overlap = body.className.match(/(?:^|\s)-mt-(\d+)(?:\s|$)/);

  return {
    heroMinPx: Number(min),
    heroVh: Number(vh),
    heroMaxPx: Number(max),
    frameWidthPercent: Number(percent),
    frameMaxRem: Number(maxRem),
    frameRoomRem: Number(roomRem),
    overlapPx: overlap ? Number(overlap[1]) * SPACING_PX : 0,
  };
}

/** The hero's width: main's, which is the viewport below lg and beside the rail from lg. */
const heroWidth = (viewportWidth: number): number =>
  viewportWidth < LG_PX ? viewportWidth : Math.min(SHELL_PX, viewportWidth - RAIL_PX);

function layout(geometry: HeroGeometry, [width, height]: readonly [number, number]) {
  const heroHeight = Math.min(
    geometry.heroMaxPx,
    Math.max(geometry.heroMinPx, (geometry.heroVh / 100) * height),
  );
  const frameWidth = Math.min(
    (geometry.frameWidthPercent / 100) * heroWidth(width),
    geometry.frameMaxRem * REM_PX,
    ((heroHeight - geometry.frameRoomRem * REM_PX) * 16) / 9,
  );
  const frameHeight = (frameWidth * 9) / 16;
  return { heroHeight, frameHeight, spaceBelow: (heroHeight - frameHeight) / 2 };
}

afterEach(cleanup);

describe('/projects/[id] hero', () => {
  it('keeps the same hero height as before: 60vh between 450 and 650 px', () => {
    render(<ProjectDetail project={PROJECT} />);

    expect(readGeometry()).toMatchObject({ heroMinPx: 450, heroVh: 60, heroMaxPx: 650 });
  });

  it.each(VIEWPORTS)('shows the whole screenshot at %ix%i', (width, height) => {
    render(<ProjectDetail project={PROJECT} />);

    const { heroHeight, frameHeight } = layout(readGeometry(), [width, height]);

    expect(frameHeight).toBeLessThanOrEqual(heroHeight);
  });

  it.each(VIEWPORTS)('keeps the summary card off the screenshot at %ix%i', (width, height) => {
    render(<ProjectDetail project={PROJECT} />);
    const geometry = readGeometry();

    const { spaceBelow } = layout(geometry, [width, height]);

    expect(spaceBelow - geometry.overlapPx).toBeGreaterThanOrEqual(MIN_CLEARANCE_PX);
  });

  it('still lets the cards rise into the faded hero a little', () => {
    render(<ProjectDetail project={PROJECT} />);

    expect(readGeometry().overlapPx).toBeGreaterThan(0);
  });
});
