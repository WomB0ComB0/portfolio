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

import type { CSSProperties, ReactElement } from 'react';

/** One ray: where it hangs, how wide it is, how it swings and how bright it gets. */
export interface LightRay {
  /** Where it hangs from, in percent of the page's width. */
  readonly left: number;
  /** Its width, in px. */
  readonly width: number;
  /** Its resting angle, in degrees. */
  readonly rotate: number;
  /** How far it swings either side of that angle, in degrees. */
  readonly swing: number;
  /** One fade in and out, in seconds; it then rests a tenth of that. */
  readonly duration: number;
  /**
   * When its first full fade in begins, in seconds; less than one cycle (its duration and a
   * tenth). light-rays.css starts it a cycle earlier, so before then it is already part way
   * through one.
   */
  readonly delay: number;
  /** Its opacity at the height of its fade, 0 to 1. */
  readonly peak: number;
}

/**
 * The five rays `<LightRays count={5} blur={20} />` drew before #603: createRays' draws in their
 * order from seed 603 (mulberry32) instead of Math.random(), so every render, on the server and
 * the client, draws the same rays (tests/unit/layout/light-rays.test.tsx draws them again).
 */
export const LIGHT_RAYS: readonly LightRay[] = [
  { left: 90.5, width: 221, rotate: -7.9, swing: 2.5, duration: 12, delay: 12.2, peak: 0.84 },
  { left: 21.7, width: 272, rotate: -24, swing: 2, duration: 17.2, delay: 4.7, peak: 0.72 },
  { left: 38.8, width: 307, rotate: 10.6, swing: 1.1, duration: 16.5, delay: 11.6, peak: 0.73 },
  { left: 53.5, width: 271, rotate: 16, swing: 1.9, duration: 15, delay: 2.9, peak: 0.86 },
  { left: 20.6, width: 258, rotate: 12.4, swing: 1.9, duration: 15.1, delay: 1.3, peak: 0.81 },
];

/** A ray's values as the custom properties src/styles/light-rays.css draws and animates it with. */
const rayStyle = (ray: LightRay): CSSProperties =>
  ({
    '--ray-left': `${ray.left}%`,
    '--ray-width': `${ray.width}px`,
    '--ray-rotate': `${ray.rotate}deg`,
    '--ray-swing': `${ray.swing}deg`,
    '--ray-duration': `${ray.duration}s`,
    '--ray-delay': `${ray.delay}s`,
    '--ray-peak': ray.peak,
  }) as CSSProperties;

/**
 * The light rays behind every page, restored after #603: faint beams of LightRays' violet that
 * hang from above the top of the page, each fading in and out while it swings. The shell renders
 * them first inside its root, which paints the two glows around them (`light-glows`).
 *
 * Plain markup, no client code: light-rays.css lays them under the content, clipped to the page,
 * and animates them by opacity and rotate alone; under reduced motion they hold still, and forced
 * colours and print draw none. aria-hidden, and pointer-events none, so they never take a click,
 * focus or a screen reader's attention. A ray under a band of the edge haze that shows pauses
 * there (pause-under-edge.ts), as the pulses do.
 */
export function LightRays(): ReactElement {
  return (
    <div className="light-rays" aria-hidden="true">
      {LIGHT_RAYS.map((ray) => (
        <i key={ray.left} style={rayStyle(ray)} />
      ))}
    </div>
  );
}
