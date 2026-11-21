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

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AFTERMATH_MS,
  createPauseDetector,
  HEARTBEAT_MS,
  PAUSE_MS,
} from '@/lib/observability/pause-detector';

/** A detector on a hand-driven clock, starting at 0. */
function detectorAt() {
  let now = 0;
  const detector = createPauseDetector(() => now);
  return {
    detector,
    advance: (ms: number) => {
      now += ms;
    },
    /** Ticks the heartbeat `count` times, one interval apart. */
    beat: (count = 1) => {
      for (let i = 0; i < count; i++) {
        now += HEARTBEAT_MS;
        detector.tick();
      }
    },
  };
}

describe('createPauseDetector', () => {
  it('never counts a steady heartbeat as a pause', () => {
    const { detector, beat, advance } = detectorAt();
    for (let i = 0; i < 10; i++) {
      beat();
      expect(detector.recentlyResumed()).toBe(false);
      advance(HEARTBEAT_MS - 1);
      expect(detector.recentlyResumed()).toBe(false);
      advance(-(HEARTBEAT_MS - 1));
    }
  });

  it('tolerates a late tick up to PAUSE_MS', () => {
    const { detector, beat, advance } = detectorAt();
    beat();
    advance(PAUSE_MS);
    detector.tick();
    expect(detector.recentlyResumed()).toBe(false);
  });

  it('counts the moments before the heartbeat catches up as resumed (timers due in the pause fire first)', () => {
    const { detector, beat, advance } = detectorAt();
    beat(3);
    // Frozen for two minutes: a deadline's timer fires before the heartbeat's own.
    advance(120_000);
    expect(detector.recentlyResumed()).toBe(true);
  });

  it('counts AFTERMATH_MS after the tick that saw the pause as resumed, and no longer', () => {
    const { detector, beat, advance } = detectorAt();
    beat();
    advance(120_000);
    detector.tick();
    expect(detector.recentlyResumed()).toBe(true);
    advance(AFTERMATH_MS - 1);
    expect(detector.recentlyResumed()).toBe(true);
    advance(1);
    expect(detector.recentlyResumed()).toBe(false);
  });

  it('forgets a pause once the heartbeat runs steadily again', () => {
    const { detector, beat, advance } = detectorAt();
    beat();
    advance(60_000);
    detector.tick();
    beat(5);
    expect(detector.recentlyResumed()).toBe(false);
  });
});

describe('startPauseDetector / recentlyResumed', () => {
  // The running detector is process-wide (on globalThis), so every test stops what it started:
  // one left behind would go "overdue" and make later tests here drop their timeouts.
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('answers false until the heartbeat is started (the browser, tests, the edge runtime)', async () => {
    const { recentlyResumed } = await import('@/lib/observability/pause-detector');
    expect(recentlyResumed()).toBe(false);
  });

  it('unrefs its heartbeat, so it never keeps a process alive', async () => {
    const unref = vi.fn();
    vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref } as unknown as ReturnType<
      typeof setInterval
    >);
    const { startPauseDetector } = await import('@/lib/observability/pause-detector');
    stop = startPauseDetector();
    expect(unref).toHaveBeenCalledOnce();
  });

  it('starts one heartbeat however often it is called', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setInterval');
    const { startPauseDetector, recentlyResumed } = await import(
      '@/lib/observability/pause-detector'
    );
    stop = startPauseDetector();
    expect(startPauseDetector()).toBe(stop);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1]).toBe(HEARTBEAT_MS);
    vi.advanceTimersByTime(HEARTBEAT_MS * 5);
    expect(recentlyResumed()).toBe(false);
  });

  it('shares the running detector with every bundled copy of the module', async () => {
    const first = await import('@/lib/observability/pause-detector');
    stop = first.startPauseDetector();
    vi.resetModules();
    const second = await import('@/lib/observability/pause-detector');

    expect(second).not.toBe(first);
    // The copy that did not start it reaches the same detector instead of starting another.
    expect(second.startPauseDetector()).toBe(stop);
  });

  it('forgets the detector once stopped', async () => {
    const { startPauseDetector, recentlyResumed } = await import(
      '@/lib/observability/pause-detector'
    );
    const stopIt = startPauseDetector();
    stopIt();
    expect(recentlyResumed()).toBe(false);
    stop = startPauseDetector();
    expect(stop).not.toBe(stopIt);
  });
});
