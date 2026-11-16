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
 * @file The Discord tile's ordering and age line over 20,000 simulated visits per setting
 * (discord-presence-sim.ts): every server's clock right, the browser's wall clock off and stepped
 * forward or back between polls, answers 0 to 5 s after their Date, copies in random order.
 *
 * Review F1 and verify P3 (round eleven): the time between two arrivals was measured with
 * Date.now(), so a forward step let one older cached copy replace the newer status for a poll
 * (15.5% of visits with one forward step, up to 424 s older), and an answer arriving seconds
 * after its Date let a copy up to about 2 s older through. A presence kept over a step also kept
 * a moment from before it: its age line read the step's length too old, or (back) went unworded.
 */

import { describe, expect, it } from 'vitest';
import { SIM_SETTINGS, simulate } from './discord-presence-sim';

/** Visits per setting. */
const RUNS = 20_000;
/** The Date header's resolution: the age line may read up to this much older, never more. */
const HEADER_RESOLUTION_MS = 1_000;
/** The slack stated for the bound on the shown read: Date and Age are whole seconds each. */
const HEADER_SLACK_MS = 2_000;

describe.each(SIM_SETTINGS.map((setting, index) => [setting.name, setting, index] as const))(
  'the Discord presence over %s',
  (_, setting, index) => {
    const stats = simulate(setting, RUNS, 0x5eed + index);
    const facts = JSON.stringify(stats);

    it('never shows an older read over a newer one', () => {
      expect(stats.olderShownPolls, facts).toBe(0);
    });

    it('never keeps out a read made after the one shown', () => {
      expect(stats.heldBackPolls, facts).toBe(0);
    });

    it('never reads older than the true age by more than the Date’s resolution, or unworded', () => {
      expect(stats.mostAgeOverMs, facts).toBeLessThanOrEqual(HEADER_RESOLUTION_MS);
      expect(stats.unwordedPolls, facts).toBe(0);
    });

    it('never bounds the shown read more than 2 s below its own server read time', () => {
      expect(stats.mostBoundBelowReadMs, facts).toBeLessThanOrEqual(HEADER_SLACK_MS);
    });
  },
);
