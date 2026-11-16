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
 * @file The shared viewer's rules (photo-viewer-step.ts): stepping goes round the ends, the keys
 * it answers, the caption's figure line, when an image is tall enough to scroll, and the shapes a
 * set spans, which size the open view once for the whole set.
 */

import { describe, expect, it } from 'vitest';
import {
  figureLabel,
  isTall,
  keyStep,
  ratioOf,
  setShape,
  stepIndex,
  stepTo,
  thumbLabel,
} from '@/components/console/photo/photo-viewer-step';

describe('stepIndex', () => {
  it('goes round the ends, so Previous and Next never go dead', () => {
    expect(stepIndex(0, 1, 4)).toBe(1);
    expect(stepIndex(3, 1, 4)).toBe(0);
    expect(stepIndex(0, -1, 4)).toBe(3);
  });

  it('stays at 0 with nothing to show', () => {
    expect(stepIndex(2, 1, 0)).toBe(0);
  });
});

describe('keys', () => {
  it('answers the arrows, Home and End only', () => {
    expect(keyStep('ArrowLeft')).toBe(-1);
    expect(keyStep('ArrowRight')).toBe(1);
    expect(keyStep('Home')).toBe('first');
    expect(keyStep('End')).toBe('last');
    expect(keyStep('Enter')).toBeNull();
    expect(keyStep('Escape')).toBeNull();
  });

  it('lands Home and End on the ends', () => {
    expect(stepTo('first', 2, 5)).toBe(0);
    expect(stepTo('last', 2, 5)).toBe(4);
    expect(stepTo(1, 4, 5)).toBe(0);
  });
});

describe('words', () => {
  it('writes the figure line', () => {
    expect(figureLabel(1, 4)).toBe('Fig. 2 of 4');
    expect(figureLabel(0, 1)).toBe('Fig. 1');
  });

  it('names a thumbnail by its noun', () => {
    expect(thumbLabel(1, 4, { one: 'screen', many: 'screens' })).toBe('Screen 2 of 4');
  });
});

describe('isTall', () => {
  it('scrolls only an image taller than a phone', () => {
    expect(isTall(2880, 8482)).toBe(true);
    expect(isTall(780, 1688)).toBe(false);
    expect(isTall(3200, 1800)).toBe(false);
    expect(isTall(0, 100)).toBe(false);
  });
});

describe('ratioOf', () => {
  it('reads an image as width over height, and an unknown size as 16:9', () => {
    expect(ratioOf({ width: 800, height: 400 })).toBe(2);
    expect(ratioOf({ width: 0, height: 400 })).toBeCloseTo(16 / 9);
  });
});

describe('setShape', () => {
  it('spans the widest and narrowest shapes, leaving a tall capture to its column', () => {
    expect(
      setShape([
        { width: 1600, height: 900 },
        { width: 780, height: 1688 },
        { width: 2880, height: 8482 },
      ]),
    ).toEqual({ wide: 1600 / 900, narrow: 780 / 1688, tall: true });
  });

  it('is one shape for a set of one shape', () => {
    expect(setShape([{ width: 1600, height: 900 }])).toEqual({
      wide: 1600 / 900,
      narrow: 1600 / 900,
      tall: false,
    });
  });

  it('asks for no width beyond the column when every image is a tall capture', () => {
    expect(setShape([{ width: 1000, height: 5000 }])).toEqual({ wide: 0, narrow: 1, tall: true });
    expect(setShape([])).toEqual({ wide: 0, narrow: 1, tall: false });
  });
});
