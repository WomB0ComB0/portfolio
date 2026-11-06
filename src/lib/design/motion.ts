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
 * @file The Live Console motion tokens for JavaScript: the one source that motion/react users and
 * LiveNumber read. CSS reads the same values from src/styles/globals.css (`--motion-*` in the
 * first `:root` block, `--ease-out-expo` and `--ease-standard` in `@theme static`), and
 * tests/unit/styles/motion-tokens.test.ts keeps the two in step.
 */

/** Durations in milliseconds, equal to the CSS `--motion-*` tokens of the same name. */
export const DURATION_MS = {
  instant: 100,
  fast: 150,
  base: 240,
  slow: 400,
  tween: 600,
} as const;

/** Cubic-bezier control points, equal to the CSS `--ease-out-expo` and `--ease-standard`. */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1],
  standard: [0.2, 0, 0, 1],
} as const;

const MS_PER_SECOND = 1000;

/** The media query a visitor matches when they asked the OS for less motion. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Converts milliseconds to seconds, the unit motion/react's `duration` takes. */
export const seconds = (ms: number): number => ms / MS_PER_SECOND;

/**
 * Whether the visitor asked for reduced motion. False where `matchMedia` does not exist (the
 * server, some test environments), so callers animate only when the browser can tell.
 */
export const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;
