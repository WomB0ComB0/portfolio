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
 * @file The photos view's fixed shuffle: the same order on every load (a seeded mulberry32 with
 * Fisher-Yates), never newest first, and a true permutation of what it is given.
 */

import { describe, expect, it } from 'vitest';

import {
  PHOTO_SHUFFLE_SEED,
  shuffled,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/photo-order';

const ITEMS = Array.from({ length: 40 }, (_, index) => `photo-${index}`);

describe('shuffled', () => {
  it('uses the fixed seed', () => {
    expect(PHOTO_SHUFFLE_SEED).toBe(0x5eed_2026);
  });

  it('gives the same order every time', () => {
    expect(shuffled(ITEMS)).toEqual(shuffled(ITEMS));
  });

  it('is a permutation: every item once, none added', () => {
    const order = shuffled(ITEMS);

    expect(order).toHaveLength(ITEMS.length);
    expect([...order].sort()).toEqual([...ITEMS].sort());
    expect(order).not.toEqual(ITEMS);
  });

  it('leaves its input alone', () => {
    const input = [...ITEMS];
    shuffled(input);

    expect(input).toEqual(ITEMS);
  });

  it('handles no items and one item', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled(['only'])).toEqual(['only']);
  });
});
