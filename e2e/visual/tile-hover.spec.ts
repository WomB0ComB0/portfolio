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
 * @file The home tiles' hover, frame by frame, in a real browser at 1280 x 800: the hover the owner
 * picked in the Fluid UI Lab (lane B's motion with the Before (#601) colours). The probe is the
 * GitHub tile, or the first hovering tile when GitHub shows its error state (no API keys).
 * A recorder in the page samples the tile on every animation frame while the real mouse enters and
 * leaves it:
 * - lift, light and glow start on the same frame, within 100 ms of the pointer arriving, and their
 *   transitions share one start time;
 * - no snap: every frame of the lift sits on the lab's spring, timed from the transition's own
 *   start (so a slow machine's late frames still compare), which is about 12 % one frame in where
 *   ease-out-expo was 53 %; it lands on 3 px within 300 ms and never passes it; the light is in
 *   within 240 ms;
 * - the way out is slower: 500 ms for the lift, 400 ms for the light, so the bento keeps a wake;
 * - the tile is raised (z-index 1) on the first hovered frame and stays raised until its light
 *   has faded;
 * - under reduced motion the tile never moves, and the light still reaches its end state;
 * - keyboard focus shows the light at once, with no transition and no lift.
 * tests/unit/console/tile-hover.test.tsx checks the compiled CSS behind this.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { MAIN, settleBento } from '../fixtures/home-bento';

const LAPTOP = { width: 1280, height: 800 } as const;

/** The GitHub tile, else the first tile with a hover (one with somewhere to go). */
const PREFERRED_TILE = '[data-bento-slot="gh"] [data-spotlight]';
const ANY_TILE = `${MAIN} [data-spotlight]`;

/** One 60 Hz frame, and two of them: the slack a frame-sampled time is allowed. */
const FRAME_MS = 1000 / 60;
const TWO_FRAMES_MS = 2 * FRAME_MS;

const LIFT_PX = 3;
const SPRING_IN_MS = 300;
const SPRING_OUT_MS = 500;
const LIGHT_IN_MS = 240;
const LIGHT_OUT_MS = 400;
/** Feedback within about 100 ms reads as instant (NN/g). */
const RESPONSE_MS = 100;

/** The lab's spring (motion's spring(0.25, 0)): 16 equal segments, the --ease-spring stops. */
const SPRING_STOPS = [
  0, 0.1402, 0.3764, 0.584, 0.7361, 0.838, 0.9029, 0.9428, 0.9668, 0.9809, 0.9892, 0.9939, 0.9966,
  0.9981, 0.9989, 0.9994, 1,
];
/** How far a sampled lift may sit from the curve, as a fraction of the lift (0.06 px). */
const SPRING_TOLERANCE = 0.02;

/** The spring's progress at `x` (0..1 of its duration), as CSS linear() interpolates its stops. */
function springAt(x: number): number {
  const segments = SPRING_STOPS.length - 1;
  const position = Math.min(Math.max(x, 0), 1) * segments;
  const index = Math.min(Math.floor(position), segments - 1);
  const from = SPRING_STOPS[index] ?? 0;
  const to = SPRING_STOPS[index + 1] ?? 1;
  return from + (to - from) * (position - index);
}

/** One animation frame's sample of the probe tile. */
interface Frame {
  /** ms since the recorder started. */
  readonly t: number;
  /** The frame's rAF timestamp: the document timeline's time, as transitions' startTime is. */
  readonly now: number;
  readonly hovered: boolean;
  /** px above its resting place. */
  readonly lift: number;
  /** ::after opacity, 0..1. */
  readonly light: number;
  /** ::before opacity, 0..1. */
  readonly glow: number;
  readonly z: string;
}

/** A CSS transition on the tile or one of its pseudo-elements, as the browser timed it. */
interface TransitionTiming {
  readonly phase: 'in' | 'out';
  /** `tile`, `::after` or `::before`. */
  readonly part: string;
  readonly property: string;
  readonly duration: number;
  readonly delay: number;
  readonly easing: string;
  readonly startTime: number;
}

interface Recording {
  readonly frames: Frame[];
  readonly transitions: TransitionTiming[];
}

interface Recorder extends Recording {
  stop: boolean;
}

type RecorderWindow = Window & { tileHoverRecorder?: Recorder };

/**
 * Starts sampling `selector`'s tile every frame until stopRecording(). Resolves once two frames
 * are in, so the recording always opens at rest, before the pointer moves.
 */
async function startRecording(page: Page, selector: string): Promise<void> {
  await page.evaluate((tileSelector) => {
    const tile = document.querySelector(tileSelector);
    if (!(tile instanceof HTMLElement)) throw new Error(`no ${tileSelector}`);
    const FRAMES_BEFORE_READY = 2;
    let ready: () => void = () => undefined;
    const isReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const recorder: Recorder = { frames: [], transitions: [], stop: false };
    (window as RecorderWindow).tileHoverRecorder = recorder;
    const seen = new Set<string>();
    const liftOf = (translate: string): number => {
      if (translate === 'none') return 0;
      const [, y = '0px'] = translate.split(' ');
      return -Number.parseFloat(y);
    };
    const recordTransitions = (phase: 'in' | 'out'): void => {
      for (const animation of document.getAnimations()) {
        if (!(animation instanceof CSSTransition) || animation.startTime === null) continue;
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect) || effect.target !== tile) continue;
        const part = effect.pseudoElement ?? 'tile';
        const key = `${phase}|${part}|${animation.transitionProperty}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const timing = effect.getComputedTiming();
        const keyframeEasing = effect.getKeyframes()[0]?.easing ?? 'linear';
        recorder.transitions.push({
          phase,
          part,
          property: animation.transitionProperty,
          duration: Number(timing.duration),
          delay: Number(timing.delay),
          // Browsers put a transition's timing function on the effect or on its keyframes.
          easing: timing.easing === 'linear' ? keyframeEasing : (timing.easing ?? 'linear'),
          startTime: Number(animation.startTime),
        });
      }
    };
    const start = performance.now();
    const tick = (now: number): void => {
      const own = getComputedStyle(tile);
      const hovered = tile.matches(':hover');
      recorder.frames.push({
        t: now - start,
        now,
        hovered,
        lift: liftOf(own.translate),
        light: Number(getComputedStyle(tile, '::after').opacity),
        glow: Number(getComputedStyle(tile, '::before').opacity),
        z: own.zIndex,
      });
      recordTransitions(hovered ? 'in' : 'out');
      if (recorder.frames.length === FRAMES_BEFORE_READY) ready();
      if (!recorder.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return isReady;
  }, selector);
}

/**
 * Waits until the last `count` frames all satisfy `state`: 'in' is fully lit and lifted by exactly
 * `lift` px (a transition reversed before it ends is shortened, so leaving early would time the
 * way out short); 'out' is at rest.
 */
async function waitForFrames(
  page: Page,
  state: 'in' | 'out',
  lift: number,
  count = 3,
): Promise<void> {
  await page.waitForFunction(
    ({ wanted, liftPx, frames }) => {
      const recorder = (window as RecorderWindow).tileHoverRecorder;
      const last = recorder?.frames.slice(-frames) ?? [];
      if (last.length < frames) return false;
      return last.every((frame) =>
        wanted === 'in'
          ? frame.hovered && frame.light === 1 && frame.glow === 1 && frame.lift === liftPx
          : !frame.hovered && frame.lift === 0 && frame.light === 0 && frame.z === '0',
      );
    },
    { wanted: state, liftPx: lift, frames: count },
  );
}

async function stopRecording(page: Page): Promise<Recording> {
  return page.evaluate(() => {
    const recorder = (window as RecorderWindow).tileHoverRecorder;
    if (!recorder) throw new Error('the recorder never started');
    recorder.stop = true;
    return { frames: recorder.frames, transitions: recorder.transitions };
  });
}

interface Probe {
  readonly selector: string;
  readonly tile: Locator;
  /** Where the pointer rests off every tile, and where it hovers (80 %, 75 % of the tile). */
  readonly away: { x: number; y: number };
  readonly inside: { x: number; y: number };
}

/** Loads the home page and finds the tile to hover, with a resting point clear of every tile. */
async function openProbe(page: Page): Promise<Probe | null> {
  await page.setViewportSize(LAPTOP);
  await page.goto(`${getTargetUrl()}/`);
  const main = page.locator(MAIN);
  await settleBento(page, main);
  const selector = (await page.locator(PREFERRED_TILE).count()) > 0 ? PREFERRED_TILE : ANY_TILE;
  const tile = page.locator(selector).first();
  if ((await tile.count()) === 0) return null;
  await tile.scrollIntoViewIfNeeded();
  const box = await tile.boundingBox();
  if (!box) return null;
  const candidates = [
    { x: box.x + box.width / 2, y: box.y - 6 },
    { x: box.x + box.width / 2, y: box.y + box.height + 6 },
    { x: box.x - 6, y: box.y + box.height / 2 },
    { x: box.x + box.width + 6, y: box.y + box.height / 2 },
  ];
  const away = await page.evaluate(
    (points) =>
      points.find(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && hit.closest('[data-spotlight]') === null;
      }) ?? null,
    candidates,
  );
  if (!away) throw new Error('no resting point beside the probe tile is clear of every tile');
  const inside = { x: box.x + box.width * 0.8, y: box.y + box.height * 0.75 };
  await page.mouse.move(away.x, away.y);
  return { selector, tile, away, inside };
}

/**
 * Hovers the probe tile until it is fully lit and lifted by `lift` px (0 under reduced motion),
 * then leaves until it is at rest again.
 */
async function recordHover(page: Page, probe: Probe, lift = LIFT_PX): Promise<Recording> {
  await startRecording(page, probe.selector);
  await page.mouse.move(probe.inside.x, probe.inside.y);
  await waitForFrames(page, 'in', lift);
  await page.mouse.move(probe.away.x, probe.away.y);
  await waitForFrames(page, 'out', 0);
  return stopRecording(page);
}

const firstIndex = (frames: readonly Frame[], from: number, test: (frame: Frame) => boolean) =>
  frames.findIndex((frame, index) => index >= from && test(frame));

/** The frame index where the hover starts, and where it ends. */
function phases(frames: readonly Frame[]): { enter: number; leave: number } {
  const enter = firstIndex(frames, 0, (frame) => frame.hovered);
  const leave = firstIndex(frames, enter, (frame) => !frame.hovered);
  expect(enter, 'the pointer never hovered the tile').toBeGreaterThan(0);
  expect(leave, 'the pointer never left the tile').toBeGreaterThan(enter);
  return { enter, leave };
}

/** ms from frame `from` until the first frame at or after it that satisfies `test`. */
function timeUntil(frames: readonly Frame[], from: number, test: (frame: Frame) => boolean) {
  const index = firstIndex(frames, from, test);
  expect(index, 'the state was never reached').toBeGreaterThanOrEqual(0);
  return (frames[index]?.t ?? Number.NaN) - (frames[from]?.t ?? Number.NaN);
}

const timing = (recording: Recording, phase: 'in' | 'out', part: string, property: string) => {
  const found = recording.transitions.find(
    (transition) =>
      transition.phase === phase && transition.part === part && transition.property === property,
  );
  expect(found, `${phase}: no ${property} transition on ${part}`).toBeDefined();
  return found as TransitionTiming;
};

test.describe('the home tile hover, frame by frame', () => {
  test.skip(({ isMobile }) => isMobile, 'a touch screen has no hover');

  test('lift, light and glow start together, spring in within 300 ms and leave slower', async ({
    page,
  }, testInfo) => {
    const probe = await openProbe(page);
    test.skip(probe === null, 'no tile has a hover: every linked tile is in an error state');
    if (!probe) return;
    testInfo.annotations.push({ type: 'probe', description: probe.selector });

    const recording = await recordHover(page, probe);
    const { frames } = recording;
    const { enter, leave } = phases(frames);

    // One gesture: all three move from the same frame, and share one start time.
    const liftStart = firstIndex(frames, enter, (frame) => frame.lift > 0.001);
    const lightStart = firstIndex(frames, enter, (frame) => frame.light > 0.001);
    const glowStart = firstIndex(frames, enter, (frame) => frame.glow > 0.001);
    expect(lightStart).toBe(liftStart);
    expect(glowStart).toBe(liftStart);
    expect((frames[liftStart]?.t ?? Number.NaN) - (frames[enter]?.t ?? 0)).toBeLessThanOrEqual(
      RESPONSE_MS,
    );
    const starts = ['translate', 'opacity', 'opacity'].map((property, index) =>
      timing(recording, 'in', ['tile', '::after', '::before'][index] ?? '', property),
    );
    expect(new Set(starts.map((transition) => transition.startTime)).size).toBe(1);

    // No snap, no bounce: each frame of the way in on the spring, 3 px at the end, never past it.
    const springStart = starts[0]?.startTime ?? Number.NaN;
    const hoveredFrames = frames.slice(enter, leave);
    const onTheWay = hoveredFrames.filter(
      (frame) => frame.now > springStart && frame.now < springStart + SPRING_IN_MS,
    );
    expect(onTheWay.length, 'no frame sampled the spring on its way').toBeGreaterThan(3);
    for (const frame of onTheWay) {
      const expected = springAt((frame.now - springStart) / SPRING_IN_MS);
      expect(Math.abs(frame.lift / LIFT_PX - expected)).toBeLessThanOrEqual(SPRING_TOLERANCE);
    }
    expect(Math.max(...hoveredFrames.map((frame) => frame.lift))).toBeLessThanOrEqual(
      LIFT_PX + 0.01,
    );
    const liftIn = timeUntil(frames, enter, (frame) => frame.lift >= LIFT_PX - 0.01);
    const lightIn = timeUntil(frames, enter, (frame) => frame.light >= 0.999);
    expect(liftIn).toBeLessThanOrEqual(SPRING_IN_MS + TWO_FRAMES_MS);
    expect(lightIn).toBeLessThanOrEqual(LIGHT_IN_MS + TWO_FRAMES_MS);

    // The way out trails: slower than the way in, for the lift and for the light.
    const liftOut = timeUntil(frames, leave, (frame) => frame.lift <= 0.01);
    const lightOut = timeUntil(frames, leave, (frame) => frame.light <= 0.001);
    expect(liftOut).toBeGreaterThan(liftIn);
    expect(lightOut).toBeGreaterThan(lightIn);
    expect(lightOut).toBeLessThanOrEqual(LIGHT_OUT_MS + TWO_FRAMES_MS);

    // The browser's own timing of each transition.
    expect(timing(recording, 'in', 'tile', 'translate')).toMatchObject({ duration: SPRING_IN_MS });
    // Chromium serialises each stop with its input ("0.1402 6.25%"); the curve is the same.
    expect(timing(recording, 'in', 'tile', 'translate').easing).toMatch(
      /^linear\(0(?: 0%)?, 0\.1402(?: 6\.25%)?, 0\.3764/,
    );
    expect(timing(recording, 'out', 'tile', 'translate')).toMatchObject({
      duration: SPRING_OUT_MS,
    });
    for (const part of ['::after', '::before']) {
      expect(timing(recording, 'in', part, 'opacity')).toMatchObject({
        duration: LIGHT_IN_MS,
        easing: 'cubic-bezier(0.34, 0.8, 0.34, 1)',
      });
      expect(timing(recording, 'out', part, 'opacity')).toMatchObject({ duration: LIGHT_OUT_MS });
    }
    // Nothing else transitions: no shadow, no border colour.
    const properties = new Set(recording.transitions.map((transition) => transition.property));
    expect([...properties].sort()).toEqual(['opacity', 'translate', 'z-index']);
  });

  test('raises the hovered tile at once and keeps it raised until its light has faded', async ({
    page,
  }) => {
    const probe = await openProbe(page);
    test.skip(probe === null, 'no tile has a hover: every linked tile is in an error state');
    if (!probe) return;

    const recording = await recordHover(page, probe);
    const { frames } = recording;
    const { enter, leave } = phases(frames);

    expect(frames[enter]?.z).toBe('1');
    const leftAt = frames[leave]?.t ?? 0;
    const stillRaised = frames.filter(
      (frame, index) => index >= leave && frame.t - leftAt < LIGHT_OUT_MS - FRAME_MS,
    );
    expect(stillRaised.every((frame) => frame.z === '1')).toBe(true);
    const lowered = timeUntil(frames, leave, (frame) => frame.z === '0');
    expect(lowered).toBeGreaterThanOrEqual(LIGHT_OUT_MS - FRAME_MS);
    expect(lowered).toBeLessThanOrEqual(LIGHT_OUT_MS + TWO_FRAMES_MS);
    expect(timing(recording, 'out', 'tile', 'z-index')).toMatchObject({
      duration: 0,
      delay: LIGHT_OUT_MS,
    });
  });

  test('never moves under reduced motion, and the light still reaches its end state', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const probe = await openProbe(page);
    test.skip(probe === null, 'no tile has a hover: every linked tile is in an error state');
    if (!probe) return;

    const { frames } = await recordHover(page, probe, 0);
    const { enter, leave } = phases(frames);

    expect(Math.max(...frames.map((frame) => Math.abs(frame.lift)))).toBe(0);
    expect(frames.slice(enter, leave).some((frame) => frame.light === 1)).toBe(true);
  });

  test('keyboard focus shows the light at once, with no transition and no lift', async ({
    page,
  }) => {
    const probe = await openProbe(page);
    test.skip(probe === null, 'no tile has a hover: every linked tile is in an error state');
    if (!probe) return;
    const link = probe.tile.locator('[data-tile-link]').first();
    test.skip((await link.count()) === 0, 'the probe tile is itself the link');

    await link.focus();

    expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    const state = await probe.tile.evaluate(
      (tile) =>
        new Promise<{ light: number; z: string; translate: string; transitions: number }>(
          (resolve) => {
            requestAnimationFrame(() => {
              const transitions = document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation instanceof CSSTransition &&
                    animation.effect instanceof KeyframeEffect &&
                    animation.effect.target === tile &&
                    animation.effect.pseudoElement === '::after',
                ).length;
              const own = getComputedStyle(tile);
              resolve({
                light: Number(getComputedStyle(tile, '::after').opacity),
                z: own.zIndex,
                translate: own.translate,
                transitions,
              });
            });
          },
        ),
    );
    expect(state).toEqual({ light: 1, z: '1', translate: 'none', transitions: 0 });
  });
});
