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
 * @file /places/photos' fixed shuffle: every photo in the same order on every load, never newest
 * first, so the wall and the grid never read as a timeline. Pure: a seeded mulberry32 generator
 * drives a Fisher-Yates shuffle of a copy.
 */

/** The shuffle's seed: change it and every visitor sees a new order. */
export const PHOTO_SHUFFLE_SEED = 0x5eed_2026;

/** mulberry32: a small seeded generator of numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * A copy of `items` in a fixed Fisher-Yates order; the input is left as it was.
 *
 * @example
 * shuffled(['a', 'b', 'c']) // the same permutation on every call
 */
export function shuffled<T>(items: readonly T[], seed: number = PHOTO_SHUFFLE_SEED): T[] {
  const random = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
