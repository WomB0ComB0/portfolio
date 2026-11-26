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
 * @file The stage's drag, as pure maths: when a press becomes a sideways drag or stays a tap, the
 * steps a drag scrubs through (one per scrub unit of travel), how far the shelf follows the finger
 * between steps, and the steps a release adds (a flick's 1-3, or one to settle a half-made step).
 * Distances are in px and speeds in px/ms. The pointer handlers that run it are in
 * use-bookshelf-navigation.ts. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/shelf-glide.test.ts, bookshelf-stage.test.tsx and scale-budgets.test.ts.
 */

/** How far a press must travel sideways before it is a drag. */
const DRAG_ACTIVATION_PX = 6;
/** A press that travels more than this many times as far down as across is left to scroll. */
const VERTICAL_INTENT_RATIO = 1.4;
/** A press that ends within this distance of where it started is a tap. */
const TAP_SLOP_PX = 8;
/** One step of drag travel is at least this many px... */
const MIN_SCRUB_PX = 70;
/** ...or this share of the book height, when that is more. */
const SCRUB_PER_BOOK_HEIGHT = 0.24;
/** The drag speed is a running average: this much of it is the newest move. */
const VELOCITY_SMOOTHING = 0.5;
/** The shelf follows the finger at this share of the travel left over from the last step... */
const DRAG_FOLLOW = 0.65;
/** ...up to this share of a scrub unit either way. */
const DRAG_OFFSET_MAX_SHARE = 0.55;
/** A release faster than this is a flick. */
const FLICK_MIN_SPEED = 0.4;
/** A flick adds this many steps per unit of speed, rounded, from one up to FLICK_MAX_STEPS. */
const FLICK_STEPS_PER_SPEED = 1.6;
/** The most steps a flick adds. */
const FLICK_MAX_STEPS = 3;
/** A slow release with no step made settles one step once it is this share of a scrub unit in. */
const SETTLE_SHARE = 0.3;

/** Whether a press that moved `dx` x `dy` px has become a sideways drag. */
export const isSidewaysDrag = (dx: number, dy: number): boolean =>
  !(Math.abs(dx) < DRAG_ACTIVATION_PX || Math.abs(dy) > Math.abs(dx) * VERTICAL_INTENT_RATIO);

/** Whether a press that ended `dx` x `dy` px from its start is a tap. */
export const isTap = (dx: number, dy: number): boolean => Math.hypot(dx, dy) <= TAP_SLOP_PX;

/** The drag travel that makes one step, for a book `bookHeight` px tall. */
export const scrubUnit = (bookHeight: number): number =>
  Math.max(MIN_SCRUB_PX, bookHeight * SCRUB_PER_BOOK_HEIGHT);

/** The drag speed after a move of `dx` px over `dt` ms, from the speed before it. */
export const dragVelocity = (previous: number, dx: number, dt: number): number =>
  previous * VELOCITY_SMOOTHING + (dx / dt) * VELOCITY_SMOOTHING;

/**
 * The whole steps in `residual` px of drag travel, and the travel left over. A drag to the left
 * steps forward (a positive step), as the shelf follows the finger.
 */
export function scrubSteps(
  residual: number,
  unit: number,
): { readonly steps: number; readonly residual: number } {
  let rest = residual;
  let steps = 0;
  while (rest <= -unit) {
    rest += unit;
    steps += 1;
  }
  while (rest >= unit) {
    rest -= unit;
    steps -= 1;
  }
  return { steps, residual: rest };
}

/** The shelf's offset under the finger, in px, for `residual` px of travel since the last step. */
export const dragOffset = (residual: number, unit: number): number =>
  Math.max(
    -unit * DRAG_OFFSET_MAX_SHARE,
    Math.min(unit * DRAG_OFFSET_MAX_SHARE, residual * DRAG_FOLLOW),
  );

/** The steps a release at speed `vx` adds against its direction, or 0 when it is no flick. */
export function flickSteps(vx: number): number {
  const speed = Math.abs(vx);
  if (speed > FLICK_MIN_SPEED) {
    const extra = Math.min(FLICK_MAX_STEPS, Math.max(1, Math.round(speed * FLICK_STEPS_PER_SPEED)));
    return vx < 0 ? extra : -extra;
  }
  return 0;
}

/**
 * The one step a slow release settles, or 0: only when the drag made no step and is far enough
 * into the next one.
 */
export function settleStep(residual: number, unit: number, steppedDuringDrag: boolean): number {
  if (!steppedDuringDrag && Math.abs(residual) > unit * SETTLE_SHARE) {
    return residual < 0 ? 1 : -1;
  }
  return 0;
}
