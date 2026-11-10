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
 * @file The wall's glide after a drag, as pure maths: the release speed read from the pointer's
 * last moves, and one frame of exponential decay. Written out rather than with motion's inertia,
 * which stopped dead on these values in the lab's checks. The loop that runs it is in
 * use-wall-input.ts; it writes the pan's motion values once a frame, so cards move by transform.
 */

/** The release speed is read from the pointer's moves within this window. */
export const VELOCITY_WINDOW_MS = 90;
/** A pointer held still longer than this before letting go releases with no glide. */
export const REST_BEFORE_RELEASE_MS = 100;
/** The speed decays with this time constant: a flick carries speed x 0.34 s. */
export const GLIDE_TIME_CONSTANT_S = 0.34;
/** Below this speed (px/s) the glide stops. */
export const GLIDE_REST_SPEED = 12;
/** Frames longer than this (a background tab) count as this, so the wall never jumps. */
export const GLIDE_MAX_STEP_S = 0.05;
/** Samples closer together than this give no reliable speed. */
const MIN_SPAN_MS = 8;
const MS_PER_SECOND = 1000;

export interface PointerSample {
  /** The event's timeStamp, in ms. */
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

export interface Velocity {
  readonly x: number;
  readonly y: number;
}

const STILL: Velocity = { x: 0, y: 0 };

/**
 * The release speed in px/s from the moves over the VELOCITY_WINDOW_MS before the last one (so
 * sparse move events still give a speed); still when the pointer rested longer than
 * REST_BEFORE_RELEASE_MS before `now`, or with too few samples.
 */
export function releaseVelocity(samples: readonly PointerSample[], now: number): Velocity {
  const last = samples.at(-1);
  if (!last || now - last.t > REST_BEFORE_RELEASE_MS) return STILL;
  const first = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  if (!first || last.t - first.t < MIN_SPAN_MS) return STILL;
  const span = (last.t - first.t) / MS_PER_SECOND;
  return { x: (last.x - first.x) / span, y: (last.y - first.y) / span };
}

/** Whether a glide at this speed is still moving. */
export const isGliding = (velocity: Velocity): boolean =>
  Math.hypot(velocity.x, velocity.y) > GLIDE_REST_SPEED;

/**
 * One frame of the glide: the speed decayed over `dtSeconds` (capped at GLIDE_MAX_STEP_S) and the
 * distance moved at that speed.
 *
 * @example
 * const { velocity, delta } = glideStep({ x: 900, y: 0 }, 1 / 60);
 */
export function glideStep(
  velocity: Velocity,
  dtSeconds: number,
): { readonly velocity: Velocity; readonly delta: Velocity } {
  const dt = Math.min(GLIDE_MAX_STEP_S, Math.max(0, dtSeconds));
  const decay = Math.exp(-dt / GLIDE_TIME_CONSTANT_S);
  const next = { x: velocity.x * decay, y: velocity.y * decay };
  return { velocity: next, delta: { x: next.x * dt, y: next.y * dt } };
}
