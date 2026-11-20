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

/**
 * @file The place viewer without a drag (audit 2026-11-20, moderate 4 and 5).
 *
 * - A zoomed photo pans with the arrow keys and with a click (or tap) that centres the spot, not
 *   only by dragging, and stops at the photo's edges as the drag does. Its surface is a focusable,
 *   named widget with visible instructions only while zoomed.
 * - Previous, Next, Zoom in and Zoom out stay focusable at their limits (aria-disabled, activation
 *   ignored): a button that turns `disabled` drops keyboard focus to <body>.
 *
 * Verification round 2: zooming out re-clamps the pan (a photo panned to an edge at 300% was left
 * off in a corner at 140% until the next pan), a button at its limit fades its icon but not its
 * focus ring, and the hint fits touch screens too ('click or tap a spot').
 *
 * jsdom lays nothing out, so the stage is given an 800 x 600 box (the photo fills it at 100%, so
 * at 120% it overhangs 80 px each side and 60 px top and bottom). The pan is read from the
 * photo's transform, which motion writes on an animation frame.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAN_STEP_PX,
  PlacePhotoViewer,
} from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import styles from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer.module.css';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const VIEWER_CSS = readFileSync(
  join(
    process.cwd(),
    'src/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer.module.css',
  ),
  'utf8',
);

/** The declarations of `selector`'s rule in the viewer's stylesheet, by property. */
function declarationsOf(selector: string): Record<string, string> {
  const at = VIEWER_CSS.indexOf(`${selector} {`);
  if (at === -1) throw new Error(`no rule for ${selector}`);
  const body = VIEWER_CSS.slice(VIEWER_CSS.indexOf('{', at) + 1, VIEWER_CSS.indexOf('}', at));
  return Object.fromEntries(
    body
      .split(';')
      .map((declaration) => declaration.split(':').map((part) => part.trim()))
      .filter(([property, value]) => property && value)
      .map(([property, ...value]) => [property, value.join(':')]),
  );
}

const PLACE = 'Photographed Place';
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
/** How far the photo overhangs the stage on each side at `zoom`: as far as it may pan. */
const overhang = (zoom: number): { x: number; y: number } => ({
  x: (STAGE_WIDTH * zoom - STAGE_WIDTH) / 2,
  y: (STAGE_HEIGHT * zoom - STAGE_HEIGHT) / 2,
});
/** At 120% the photo overhangs the stage by a tenth of it on each side. */
const MAX_X = overhang(1.2).x;
const MAX_Y = overhang(1.2).y;

const photo = (n: number): ViewerPhoto => ({
  url: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=1600&fit=max`,
  thumb: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=320&h=240&fit=crop&auto=format`,
  alt: `Photo of ${PLACE}`,
});

const PHOTOS: readonly ViewerPhoto[] = [photo(1), photo(2), photo(3)];

const renderViewer = () =>
  render(<PlacePhotoViewer photos={PHOTOS} placeName={PLACE} summary={<h2>{PLACE}</h2>} />);

const button = (name: string): HTMLElement => screen.getByRole('button', { name });

const preferReducedMotion = (): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

/** The photo's pan, as motion last wrote it into its transform (0 where it wrote none). */
const panOf = (): { x: number; y: number } => {
  const transform = screen.getByRole('img', { name: `Photo of ${PLACE}` }).style.transform;
  const x = /translateX\((-?[\d.]+)px\)/.exec(transform)?.[1];
  const y = /translateY\((-?[\d.]+)px\)/.exec(transform)?.[1];
  return { x: Number(x ?? 0), y: Number(y ?? 0) };
};

const expectPan = async (x: number, y: number): Promise<void> => {
  await waitFor(() => expect(panOf()).toEqual({ x, y }));
};

/** As expectPan, to the pixel's fraction: twenty-percent zoom steps add up in floating point. */
const expectPanNear = async (x: number, y: number): Promise<void> => {
  await waitFor(() => {
    const pan = panOf();
    expect(pan.x).toBeCloseTo(x, 6);
    expect(pan.y).toBeCloseTo(y, 6);
  });
};

/** Presses a zoom button `times` times; returns the zoom read out beside them. */
const pressZoom = (name: 'Zoom in' | 'Zoom out', times: number): string => {
  for (let count = 0; count < times; count += 1) fireEvent.click(button(name));
  return screen.getByText(/^\d+%$/).textContent ?? '';
};

/** The surface a zoomed photo pans on. */
const panSurface = (): HTMLElement =>
  screen.getByRole('application', { name: `Zoomed photo: Photo of ${PLACE}` });

/** Dispatches a keydown on `target`; returns false when a listener cancelled it. */
const press = (target: HTMLElement, init: KeyboardEventInit): boolean => {
  let notCancelled = true;
  act(() => {
    notCancelled = fireEvent.keyDown(target, init);
  });
  return notCancelled;
};

const zoomIn = (): HTMLElement => {
  fireEvent.click(button('Zoom in'));
  return panSurface();
};

beforeEach(() => {
  for (const [property, size] of [
    ['offsetWidth', STAGE_WIDTH],
    ['offsetHeight', STAGE_HEIGHT],
  ] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockReturnValue(size);
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: STAGE_WIDTH,
    bottom: STAGE_HEIGHT,
    x: 0,
    y: 0,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the place viewer’s buttons at their limits', () => {
  it('mark Previous unavailable on the first photo without disabling it, and ignore it', () => {
    renderViewer();
    const previous = button('Previous photo');

    expect(previous).not.toBeDisabled();
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(previous);

    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('keep focus on Next as it reaches the last photo, where it does nothing', () => {
    renderViewer();
    const next = button('Next photo');
    act(() => next.focus());

    fireEvent.click(next);
    fireEvent.click(next);

    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
    expect(next).toHaveFocus();
    expect(next).not.toBeDisabled();
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(button('Previous photo')).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(next);
    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
  });

  it('keep focus on Zoom in at 300% and on Zoom out back at 100%', () => {
    renderViewer();
    const zoomInButton = button('Zoom in');
    const zoomOutButton = button('Zoom out');
    expect(zoomOutButton).toHaveAttribute('aria-disabled', 'true');
    expect(zoomOutButton).not.toBeDisabled();

    act(() => zoomInButton.focus());
    for (let press = 0; press < 10; press += 1) fireEvent.click(zoomInButton);
    expect(screen.getByText('300%')).toBeInTheDocument();
    expect(zoomInButton).toHaveFocus();
    expect(zoomInButton).toHaveAttribute('aria-disabled', 'true');
    expect(zoomInButton).not.toBeDisabled();
    fireEvent.click(zoomInButton);
    expect(screen.getByText('300%')).toBeInTheDocument();

    act(() => zoomOutButton.focus());
    for (let press = 0; press < 10; press += 1) fireEvent.click(zoomOutButton);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(zoomOutButton).toHaveFocus();
    expect(zoomOutButton).toHaveAttribute('aria-disabled', 'true');
  });

  // Button fades the whole of an aria-disabled button, its focus ring with it: the ring came out
  // at 3.01:1, just over the 3:1 it needs. A button at its limit keeps focus, so its ring matters.
  it('fade only their icon at a limit, never the focus ring around them', () => {
    renderViewer();

    expect(declarationsOf('.buttons button[aria-disabled="true"]').opacity).toBe('1');
    expect(declarationsOf('.buttons button[aria-disabled="true"] > svg').opacity).toBe('0.5');
    // The icon is all a viewer button shows, so it is what reads as unavailable.
    for (const name of ['Previous photo', 'Next photo', 'Zoom in', 'Zoom out']) {
      const icon = button(name).querySelector(':scope > svg');
      expect(icon).not.toBeNull();
      expect(button(name)).toHaveTextContent(/^$/);
    }
  });
});

describe('a zoomed place photo', () => {
  it('is neither a Tab stop nor a widget at 100%', () => {
    renderViewer();

    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    const surface = screen.getByRole('img', { name: `Photo of ${PLACE}` }).parentElement;
    expect(surface?.tabIndex).toBe(-1);
    expect(screen.queryByText(/arrow keys/)).not.toBeInTheDocument();
  });

  it('becomes a named Tab stop with visible instructions once zoomed', () => {
    renderViewer();

    const surface = zoomIn();

    expect(surface.tabIndex).toBe(0);
    expect(surface).toHaveAccessibleDescription(/arrow keys/);
    const hint = document.getElementById(surface.getAttribute('aria-describedby') ?? '');
    expect(hint).not.toHaveClass('sr-only');
    expect(hint).toHaveTextContent(/drag/i);
    // A tap centres a spot as a click does, so the words fit a touch screen too.
    expect(hint).toHaveTextContent(/click or tap a spot to centre it/i);
  });

  // The site's ring is drawn 2 px outside a box, and the surface is exactly the stage's padding
  // box, which clips (overflow: hidden): the whole ring was cut away, so a Tab to the surface
  // showed nothing (2.4.7). An inset outline on the surface itself is no better: the zoomed
  // photo, transformed, is a layer of its own and paints over it (checked in Chromium).
  it('draws its own focus ring inside the stage, over the photo', () => {
    renderViewer();

    const surface = zoomIn();

    expect(surface).toHaveClass(String(styles['pan-surface']));
    // The ring is a layer over the whole surface, above the photo, and takes no pointer.
    const ring = declarationsOf('.pan-surface:focus-visible::after');
    expect(ring).toMatchObject({
      position: 'absolute',
      inset: '0',
      'z-index': '1',
      'pointer-events': 'none',
    });
    // The focus colour drawn inside the edge, over a canvas line, so it holds 3:1 on any photo
    // (and the outline, unlike a shadow, stays in forced colours).
    expect(ring.outline).toBe('2px solid var(--focus)');
    expect(ring['outline-offset']).toMatch(/^-/);
    expect(ring['box-shadow']).toMatch(/^inset .*var\(--canvas\)$/);
    // Its corners follow the stage's rounded clip, inside its hairline.
    expect(ring['border-radius']).toBe('calc(var(--stage-radius) - 1px)');
    expect(declarationsOf('.stage')['border-radius']).toBe('var(--stage-radius)');
    // The clipped outer ring is not drawn as well.
    expect(declarationsOf('.pan-surface:focus-visible').outline).toBe('none');
    // In forced colours it takes Highlight, as the gallery's current thumbnail does, so it is not
    // read as the stage's CanvasText edge thickened.
    expect(VIEWER_CSS).toMatch(
      /@media \(forced-colors: active\) \{[^@]*\.pan-surface:focus-visible::after \{\s*outline-color: Highlight;/,
    );
  });

  it('pans a step a press with the arrow keys and stops at the photo’s edges', async () => {
    preferReducedMotion();
    renderViewer();
    const surface = zoomIn();
    act(() => surface.focus());

    // The page never scrolls under the keys: each press is the photo's.
    expect(press(surface, { key: 'ArrowRight' })).toBe(false);
    await expectPan(-PAN_STEP_PX, 0);
    press(surface, { key: 'ArrowRight' });
    press(surface, { key: 'ArrowRight' });
    await expectPan(-MAX_X, 0);

    press(surface, { key: 'ArrowDown' });
    await expectPan(-MAX_X, -PAN_STEP_PX);
    press(surface, { key: 'ArrowDown' });
    await expectPan(-MAX_X, -MAX_Y);

    for (let step = 0; step < 4; step += 1) press(surface, { key: 'ArrowLeft' });
    for (let step = 0; step < 3; step += 1) press(surface, { key: 'ArrowUp' });
    await expectPan(MAX_X, MAX_Y);
  });

  it('leaves Tab and modified arrows (Alt+Left is Back) to the browser', () => {
    preferReducedMotion();
    renderViewer();
    const surface = zoomIn();

    expect(press(surface, { key: 'Tab' })).toBe(true);
    expect(press(surface, { key: 'ArrowLeft', altKey: true })).toBe(true);
    expect(press(surface, { key: 'ArrowRight', metaKey: true })).toBe(true);
  });

  it('centres a clicked spot, within the edges, for a single pointer', async () => {
    preferReducedMotion();
    renderViewer();
    const surface = zoomIn();

    // 40 px right of and 30 px below the centre.
    fireEvent.click(surface, { clientX: STAGE_WIDTH / 2 + 40, clientY: STAGE_HEIGHT / 2 + 30 });
    await expectPan(-40, -30);

    // The bottom-right corner is further than the photo overhangs.
    fireEvent.click(surface, { clientX: STAGE_WIDTH, clientY: STAGE_HEIGHT });
    await expectPan(-MAX_X, -MAX_Y);
  });

  it('does not also centre where a drag ends', async () => {
    preferReducedMotion();
    renderViewer();
    const surface = zoomIn();

    fireEvent.pointerDown(surface, { clientX: 400, clientY: 300 });
    fireEvent.pointerUp(surface, { clientX: 460, clientY: 300 });
    fireEvent.click(surface, { clientX: 460, clientY: 300 });
    // A click with no press before it (as from a tap) still centres, from where the drag left it.
    fireEvent.click(surface, { clientX: STAGE_WIDTH / 2 + 40, clientY: STAGE_HEIGHT / 2 + 30 });

    await expectPan(-40, -30);
  });

  it('glides to where a key sends it when motion is allowed', async () => {
    renderViewer();
    const surface = zoomIn();

    press(surface, { key: 'ArrowRight' });

    await expectPan(-PAN_STEP_PX, 0);
  });

  it('lets a glide finish nowhere once zoomed back out: the photo returns to centre', async () => {
    renderViewer();
    const surface = zoomIn();

    press(surface, { key: 'ArrowRight' });
    fireEvent.click(button('Zoom out'));
    // Longer than the glide would take, had it been left running.
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));

    expect(panOf()).toEqual({ x: 0, y: 0 });
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('comes back to its edges when zoomed out from a pan at an edge', async () => {
    preferReducedMotion();
    renderViewer();
    expect(pressZoom('Zoom in', 10)).toBe('300%');
    // The bottom-right corner, twice: as far as the photo overhangs at 300%.
    fireEvent.click(panSurface(), { clientX: STAGE_WIDTH, clientY: STAGE_HEIGHT });
    fireEvent.click(panSurface(), { clientX: STAGE_WIDTH, clientY: STAGE_HEIGHT });
    await expectPan(-overhang(3).x, -overhang(3).y);

    expect(pressZoom('Zoom out', 8)).toBe('140%');

    // At once, not at the next pan: the photo's corner meets the stage's, with no gap.
    await expectPanNear(-overhang(1.4).x, -overhang(1.4).y);
  });

  it('stays where it was panned when zooming out leaves that spot within the edges', async () => {
    preferReducedMotion();
    renderViewer();
    pressZoom('Zoom in', 10);
    fireEvent.click(panSurface(), {
      clientX: STAGE_WIDTH / 2 + 40,
      clientY: STAGE_HEIGHT / 2 + 30,
    });
    await expectPan(-40, -30);

    pressZoom('Zoom out', 8);

    await expectPan(-40, -30);
  });
});
