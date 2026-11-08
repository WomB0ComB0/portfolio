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
 * first `:root` block; `--ease-out-expo`, `--ease-standard`, `--ease-effect` and `--ease-spring`
 * in `@theme static`), and tests/unit/styles/motion-tokens.test.ts keeps the two in step.
 *
 * Movement and effects are separate (Material 3): position moves on the no-bounce SPRING
 * (`--ease-spring` in CSS), while colour, light and opacity fade on EASE.effect, which never
 * overshoots. ease-out-expo stays for entrances; hover and press do not use it.
 */

/**
 * Durations in milliseconds, equal to the CSS `--motion-*` tokens of the same name in kebab case
 * (`springIn` is `--motion-spring-in`). springIn and springOut time the CSS spring: a hover
 * springs in quickly and settles back more slowly, leaving a short wake across the bento.
 */
export const DURATION_MS = {
  instant: 100,
  fast: 150,
  base: 240,
  slow: 400,
  tween: 600,
  springIn: 300,
  springOut: 500,
} as const;

/**
 * Cubic-bezier control points, equal to the CSS `--ease-out-expo`, `--ease-standard` and
 * `--ease-effect`. `effect` is Material 3's default effects curve, for fades and colour.
 */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1],
  standard: [0.2, 0, 0, 1],
  effect: [0.34, 0.8, 0.34, 1],
} as const;

/**
 * The no-bounce spring for motion/react: motion's `spring(0.25, 0)`, which the CSS
 * `--ease-spring` writes out as `linear()`, so CSS and JS move alike. It feels like about 250 ms.
 */
export const SPRING = { type: 'spring', visualDuration: 0.25, bounce: 0 } as const;

/**
 * motion stretches a spring's visualDuration by this factor to get its natural period
 * (motion-dom's getSpringOptions), so SPRING's 0.25 s is a 0.3 s period.
 */
const MOTION_PERIOD_PER_VISUAL_DURATION = 1.2;

/** SPRING's natural angular frequency in rad/s, as motion derives it: 2 pi / 0.3 s, about 20.94. */
const SPRING_ANGULAR_FREQUENCY =
  (2 * Math.PI) / (SPRING.visualDuration * MOTION_PERIOD_PER_VISUAL_DURATION);

/**
 * A physics spring for drags and flicks: the same curve as SPRING from rest (stiffness about
 * 438.6, damping about 41.9, critically damped, unit mass), but it carries the release speed into
 * the settle, which motion drops for a visualDuration spring.
 */
export const SPRING_PHYSICS = {
  type: 'spring',
  stiffness: SPRING_ANGULAR_FREQUENCY * SPRING_ANGULAR_FREQUENCY,
  damping: 2 * SPRING_ANGULAR_FREQUENCY,
  mass: 1,
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
