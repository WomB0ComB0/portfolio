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
 * @file Notices when this server process was just paused: frozen by the platform (Vercel
 * suspends an instance once its responses are sent) or blocked by long synchronous work.
 *
 * The clock keeps running while a process is paused, so every timer that came due meanwhile
 * fires together the moment it resumes. A deadline that fires then measured the pause, not the
 * work it guarded. A HEAD request is the usual case: Next.js answers it with headers alone once
 * the shell renders and never reads the rest of the render, which keeps running; the instance is
 * frozen with the page's loads still pending, and when the next request wakes it, minutes later,
 * every one of their deadlines "times out" at once.
 *
 * A heartbeat ticks every {@link HEARTBEAT_MS}. A gap longer than {@link PAUSE_MS} between two
 * ticks is a pause. A timeout reported while the heartbeat is overdue, or within
 * {@link AFTERMATH_MS} of the tick that saw the gap, came due during that pause.
 *
 * Isomorphic on purpose (the reporter that asks is shared with the browser): only the Node.js
 * server starts the heartbeat, and until something starts it no moment counts as just resumed.
 * The running detector lives in {@link processGlobal}: Next bundles instrumentation apart from
 * pages and route handlers, so the copy of this module that starts it is not the copy the
 * reporter asks.
 */

import { processGlobal } from '@/lib/cache/process-global';

/** How often the heartbeat ticks. */
export const HEARTBEAT_MS = 1_000;

/**
 * The gap between two ticks that counts as a pause: the heartbeat's own interval plus 2 s the
 * process could not run. Garbage collection and ordinary renders stay well under it.
 */
export const PAUSE_MS = 3_000;

/**
 * How long after the tick that saw a pause a timeout still counts as having come due during it.
 * Timers that came due in a pause fire within milliseconds of resuming, so the window is short: a
 * timer due after the resume fires on schedule and, past this window, is reported as usual. It
 * must stay below every budget whose timeout reaches the reporter, so that a deadline started
 * after the pause can't run out inside it; the shortest is 1.5 s (the experience pages' project
 * links, experience/_lib/tech-projects.ts). The API guard's 300 ms Redis budget reports through
 * Sentry directly and is not filtered.
 */
export const AFTERMATH_MS = 500;

export interface PauseDetector {
  /** Called by the heartbeat. Notes a pause when the gap since the last tick is over PAUSE_MS. */
  readonly tick: () => void;
  /** Whether the process is resuming from a pause right now, or resumed under AFTERMATH_MS ago. */
  readonly recentlyResumed: () => boolean;
}

/** A detector reading `now` (milliseconds, monotonic); the heartbeat that ticks it is separate. */
export function createPauseDetector(now: () => number = () => performance.now()): PauseDetector {
  let lastTick = now();
  let resumedAt = Number.NEGATIVE_INFINITY;
  return {
    tick: () => {
      const at = now();
      if (at - lastTick > PAUSE_MS) resumedAt = at;
      lastTick = at;
    },
    recentlyResumed: () => {
      const at = now();
      // Overdue: the timers that came due in the pause can fire before the heartbeat's own does.
      return at - lastTick > PAUSE_MS || at - resumedAt < AFTERMATH_MS;
    },
  };
}

interface RunningDetector {
  detector?: PauseDetector;
  stop?: () => void;
}

/** The detector this process runs, shared by every bundled copy of this module. */
const running = (): RunningDetector =>
  processGlobal<RunningDetector>('observability.pause-detector', () => ({}));

/**
 * Starts the process-wide heartbeat, once; later calls change nothing. Its timer is unref'd, so
 * it never keeps a process alive, and a tick costs a subtraction and a comparison.
 *
 * @returns Stops the heartbeat and forgets the detector (for tests).
 */
export function startPauseDetector(): () => void {
  const state = running();
  if (state.detector && state.stop) return state.stop;
  const detector = createPauseDetector();
  const heartbeat = setInterval(detector.tick, HEARTBEAT_MS);
  (heartbeat as { unref?: () => void }).unref?.();
  const stop = (): void => {
    clearInterval(heartbeat);
    if (state.detector === detector) {
      state.detector = undefined;
      state.stop = undefined;
    }
  };
  state.detector = detector;
  state.stop = stop;
  return stop;
}

/** Whether this process just resumed from a pause. Always false until the heartbeat starts. */
export function recentlyResumed(): boolean {
  return running().detector?.recentlyResumed() ?? false;
}
