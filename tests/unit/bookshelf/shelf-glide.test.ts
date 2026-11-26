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
 * @file The stage's drag maths (shelf-glide.ts), pure: a press becomes a drag past 6 px sideways
 * (unless it heads 1.4 times as far down) and stays a tap within 8 px; one step per scrub unit
 * (70 px, or 0.24 of the book height); the shelf follows at 0.65 of the leftover travel, up to
 * 0.55 of a unit; a release over 0.4 px/ms flicks 1-3 steps, and a slow one settles a step 0.3 of
 * a unit in when the drag made none.
 */

import { describe, expect, it } from 'vitest';
import {
  dragOffset,
  dragVelocity,
  flickSteps,
  isSidewaysDrag,
  isTap,
  scrubSteps,
  scrubUnit,
  settleStep,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/shelf-glide';

describe('isSidewaysDrag', () => {
  it('starts a drag 6 px across, unless the press heads more than 1.4 times as far down', () => {
    expect(isSidewaysDrag(5, 0)).toBe(false);
    expect(isSidewaysDrag(-6, 0)).toBe(true);
    expect(isSidewaysDrag(10, 14)).toBe(true);
    expect(isSidewaysDrag(10, 15)).toBe(false);
  });
});

describe('isTap', () => {
  it('counts a press that ends within 8 px of its start', () => {
    expect(isTap(8, 0)).toBe(true);
    expect(isTap(6, 6)).toBe(false);
  });
});

describe('scrubUnit', () => {
  it('is 70 px, or 0.24 of the book height when that is more', () => {
    expect(scrubUnit(220)).toBe(70);
    expect(scrubUnit(360)).toBeCloseTo(86.4);
  });
});

describe('dragVelocity', () => {
  it('averages the newest move half and half with the speed before it', () => {
    expect(dragVelocity(0, 10, 5)).toBe(1);
    expect(dragVelocity(1, -10, 5)).toBe(-0.5);
  });
});

describe('scrubSteps', () => {
  it('steps forward for travel to the left and back for travel to the right', () => {
    expect(scrubSteps(-200, 70)).toEqual({ steps: 2, residual: -60 });
    expect(scrubSteps(150, 70)).toEqual({ steps: -2, residual: 10 });
    expect(scrubSteps(70, 70)).toEqual({ steps: -1, residual: 0 });
    expect(scrubSteps(69, 70)).toEqual({ steps: 0, residual: 69 });
  });
});

describe('dragOffset', () => {
  it('follows at 0.65 of the leftover travel, up to 0.55 of a unit', () => {
    expect(dragOffset(-10, 70)).toBeCloseTo(-6.5);
    expect(dragOffset(100, 70)).toBeCloseTo(38.5);
    expect(dragOffset(-100, 70)).toBeCloseTo(-38.5);
  });
});

describe('flickSteps', () => {
  it('adds no steps at 0.4 px/ms or slower', () => {
    expect(flickSteps(0.4)).toBe(0);
    expect(flickSteps(-0.2)).toBe(0);
  });

  it('adds 1-3 steps against the flick', () => {
    expect(flickSteps(0.5)).toBe(-1);
    expect(flickSteps(-1)).toBe(2);
    expect(flickSteps(-3)).toBe(3);
  });
});

describe('settleStep', () => {
  it('settles one step 0.3 of a unit in, only when the drag made none', () => {
    expect(settleStep(-30, 86.4, false)).toBe(1);
    expect(settleStep(30, 86.4, false)).toBe(-1);
    expect(settleStep(20, 86.4, false)).toBe(0);
    expect(settleStep(-30, 86.4, true)).toBe(0);
  });
});
