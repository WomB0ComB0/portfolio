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
 * @file The wall's glide after a drag, as pure maths: the release speed from the pointer's last
 * 90 ms (none after a 100 ms rest), and an exponential decay (time constant 0.34 s) that stops
 * below 12 px/s and never takes a step longer than 50 ms (a background tab never jumps the wall).
 */

import { describe, expect, it } from 'vitest';

import {
  GLIDE_MAX_STEP_S,
  GLIDE_REST_SPEED,
  GLIDE_TIME_CONSTANT_S,
  glideStep,
  isGliding,
  releaseVelocity,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/wall-glide';

describe('releaseVelocity', () => {
  it('reads px/s over the last 90 ms of moves', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 100, x: 10, y: 0 },
      { t: 150, x: 60, y: 20 },
      { t: 190, x: 100, y: 40 },
    ];

    // From t=100 (within 90 ms of 190) to t=190: 90 px and 40 px over 0.09 s.
    const v = releaseVelocity(samples, 195);
    expect(v.x).toBeCloseTo(1000);
    expect(v.y).toBeCloseTo(444.44, 1);
  });

  it('is still after a rest of more than 100 ms before release', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 80, y: 0 },
    ];

    expect(releaseVelocity(samples, 151)).toEqual({ x: 0, y: 0 });
    expect(releaseVelocity(samples, 140).x).toBeGreaterThan(0);
  });

  it('is still with one sample, or none', () => {
    expect(releaseVelocity([], 10)).toEqual({ x: 0, y: 0 });
    expect(releaseVelocity([{ t: 5, x: 1, y: 1 }], 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('glideStep', () => {
  it('decays the speed by exp(-dt / 0.34 s) and moves by the decayed speed', () => {
    const step = glideStep({ x: 1000, y: 0 }, 0.016);
    const decay = Math.exp(-0.016 / GLIDE_TIME_CONSTANT_S);

    expect(step.velocity.x).toBeCloseTo(1000 * decay);
    expect(step.delta.x).toBeCloseTo(1000 * decay * 0.016);
    expect(step.delta.y).toBe(0);
  });

  it('caps a long frame at 50 ms', () => {
    const long = glideStep({ x: 1000, y: 0 }, 2);
    const capped = glideStep({ x: 1000, y: 0 }, GLIDE_MAX_STEP_S);

    expect(long).toEqual(capped);
  });

  it('stops below 12 px/s', () => {
    expect(GLIDE_REST_SPEED).toBe(12);
    expect(isGliding({ x: 11, y: 0 })).toBe(false);
    expect(isGliding({ x: 9, y: 9 })).toBe(true);
    let velocity = { x: 2000, y: -800 };
    let frames = 0;
    while (isGliding(velocity) && frames < 1000) {
      velocity = glideStep(velocity, 1 / 60).velocity;
      frames += 1;
    }
    expect(frames).toBeLessThan(200);
  });
});
