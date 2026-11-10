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
 * @file The open view's flight from its card, as pure FLIP maths. The card shows the whole photo
 * cropped by object-fit: cover at its focus point; the open frame shows the whole photo at its
 * real shape. So the frame starts scaled uniformly until the photo covers the card, moved so the
 * card's part sits on the card, and clipped (clip-path inset, rounded like the card) to the card's
 * box. Both transform and clip-path are compositor-friendly; equal boxes fly nowhere.
 */

import { describe, expect, it } from 'vitest';

import {
  clipPathOf,
  type FlightStart,
  flightFrom,
  identityFlight,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/photo-flight';

const CARD = { left: 100, top: 200, width: 240, height: 180 };
const close = (actual: FlightStart, expected: FlightStart) => {
  for (const key of ['x', 'y', 'scale'] as const) expect(actual[key]).toBeCloseTo(expected[key]);
  for (const key of ['top', 'right', 'bottom', 'left', 'radius'] as const) {
    expect(actual.clip[key]).toBeCloseTo(expected.clip[key]);
  }
};

describe('flightFrom', () => {
  it('flies nowhere when the boxes are equal', () => {
    close(flightFrom(CARD, CARD, null, 10, 10), identityFlight(10));
  });

  it('scales a 4:3 frame into a 4:3 card with no clip', () => {
    const frame = { left: 300, top: 100, width: 800, height: 600 };
    const start = flightFrom(CARD, frame, null, 10, 8);

    expect(start.scale).toBeCloseTo(0.3);
    expect(start.x).toBeCloseTo(100 - 300);
    expect(start.y).toBeCloseTo(200 - 100);
    expect(start.clip.top).toBeCloseTo(0);
    expect(start.clip.left).toBeCloseTo(0);
    expect(start.clip.right).toBeCloseTo(0);
    expect(start.clip.bottom).toBeCloseTo(0);
    // The card's 10 px radius, in the frame's own (unscaled) pixels.
    expect(start.clip.radius).toBeCloseTo(10 / 0.3);
  });

  it('covers the card with a portrait frame, clipping its top and bottom around the focus', () => {
    // 3:4 portrait, 450 x 600. Cover a 240 x 180 card: scale by width, 240/450.
    const frame = { left: 400, top: 50, width: 450, height: 600 };
    const scale = 240 / 450;
    const scaledH = 600 * scale; // 320
    const centred = flightFrom(CARD, frame, null, 10, 8);

    expect(centred.scale).toBeCloseTo(scale);
    // Centred: 70 px of the scaled photo above the card, 70 below.
    expect(centred.y).toBeCloseTo(200 - (scaledH - 180) / 2 - 50);
    expect(centred.clip.top).toBeCloseTo(70 / scale);
    expect(centred.clip.bottom).toBeCloseTo(70 / scale);
    expect(centred.clip.left).toBeCloseTo(0);

    const nearTop = flightFrom(CARD, frame, { x: 0.5, y: 0 }, 10, 8);
    expect(nearTop.clip.top).toBeCloseTo(0);
    expect(nearTop.clip.bottom).toBeCloseTo(140 / scale);
    expect(nearTop.y).toBeCloseTo(200 - 50);
  });

  it('covers the card with a wide frame, clipping its sides around the focus', () => {
    // 2:1, 800 x 400. Cover 240 x 180: scale by height, 180/400; scaled width 360.
    const frame = { left: 200, top: 100, width: 800, height: 400 };
    const scale = 180 / 400;
    const right = flightFrom(CARD, frame, { x: 1, y: 0.5 }, 10, 8);

    expect(right.scale).toBeCloseTo(scale);
    expect(right.clip.left).toBeCloseTo(120 / scale);
    expect(right.clip.right).toBeCloseTo(0);
    expect(right.x).toBeCloseTo(100 - 120 - 200);
  });

  it('covers a square photo in a 4:3 card', () => {
    const frame = { left: 0, top: 0, width: 500, height: 500 };
    const start = flightFrom(CARD, frame, null, 10, 8);

    expect(start.scale).toBeCloseTo(240 / 500);
    expect(start.clip.top + start.clip.bottom).toBeCloseTo((240 - 180) / (240 / 500));
  });
});

describe('clipPathOf', () => {
  it('writes the inset in px with its rounded corner', () => {
    expect(clipPathOf({ top: 1, right: 2.5, bottom: 0, left: 4, radius: 8 })).toBe(
      'inset(1px 2.5px 0px 4px round 8px)',
    );
  });
});
