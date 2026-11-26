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
 * @file The stage's motion: the active position, the length of the step that moves it, and the
 * three ways it moves. step slides one or more books as one step; stepBy chains single steps (a
 * flick, a click on a farther book), each 220 ms but the last; jumpTo makes ONE move however far,
 * sliding up to two books and otherwise leaving a pending jump for the stage's layout effect to
 * teleport and fade in. The refs let the stage's effects and the navigation hook
 * (use-bookshelf-navigation.ts) read the latest values without re-subscribing. It has no layout
 * effect, so the stage's pill and teleport effects keep their order. Guarded by
 * tests/unit/bookshelf/scale-budgets.test.ts (one move and at most 2 commits per jump, 400 ms
 * steps) and tests/unit/bookshelf/bookshelf-stage.test.tsx.
 */

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { prefersReducedMotion } from '@/lib/design/motion';
import { clamp, DEFAULT_BOOK_HEIGHT, jumpDelta } from '../_lib/shelf-geometry';

/** One step's transition, and a slide of up to JUMP_SLIDE_MAX books. */
const STEP_DURATION_MS = 400;
/** Each step of a chain but the last, and each step a drag scrubs through. */
export const CHAIN_STEP_DURATION_MS = 220;
/** The pause between a chain's steps. */
const CHAIN_TICK_MS = 55;
/**
 * The longest jump that slides as one step: measureShelf keeps two to three slots off screen on
 * each side (measured at stage widths of 328-1568 px), so a slide of up to two books never shows
 * a recycled slot crossing the stage.
 */
const JUMP_SLIDE_MAX = 2;

/** A jump waiting for its commit: the position it lands on, and the side it travels toward. */
export interface PendingJump {
  readonly pos: number;
  /** -1 or 1; 0 lands with no fade (reduced motion). */
  readonly dir: number;
}

export interface ShelfMotionOptions {
  /** Where the stage starts. */
  readonly initialPos: number;
  /** A shelf's page or a short shelf: the position is clamped to the books, never wrapped. */
  readonly finite: boolean;
  readonly bookCount: number;
}

export interface ShelfMotion {
  /** The active position, unwrapped on the circular shelf. */
  readonly pos: number;
  readonly setPos: Dispatch<SetStateAction<number>>;
  /** The current step's transition (--shelf-dur): 0 under reduced motion. */
  readonly stepDuration: number;
  readonly posRef: RefObject<number>;
  /** The measured book height, written by the stage: drags and the jump fade move by it. */
  readonly bookHeightRef: RefObject<number>;
  /** When the last step started: the wheel waits out a cooldown after it. */
  readonly lastStepRef: RefObject<number>;
  readonly pendingJumpRef: RefObject<PendingJump | null>;
  /** A jump's fade-in, while it runs: a drag finishes it, so it never fights --drag-x. */
  readonly jumpAnimRef: RefObject<Animation | null>;
  /** Moves `dir` books as one step of `dur` ms. */
  readonly step: (dir: number, dur?: number) => void;
  /** Moves `delta` books one step at a time. */
  readonly stepBy: (delta: number) => void;
  /** One move to a book, however far. */
  readonly jumpTo: (index: number) => void;
  /** Stops a chain of steps that is still running. */
  readonly cancelChain: () => void;
}

/** The stage's position and the steps, chains and jumps that move it. */
export function useShelfMotion({ initialPos, finite, bookCount }: ShelfMotionOptions): ShelfMotion {
  const [pos, setPos] = useState<number>(initialPos);
  const [stepDuration, setStepDuration] = useState<number>(STEP_DURATION_MS);

  const posRef = useRef<number>(pos);
  posRef.current = pos;
  const bookHeightRef = useRef<number>(DEFAULT_BOOK_HEIGHT);
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);
  const pendingJumpRef = useRef<PendingJump | null>(null);
  const jumpAnimRef = useRef<Animation | null>(null);

  const cancelChain = useCallback((): void => {
    if (chainTimerRef.current) {
      clearTimeout(chainTimerRef.current);
      chainTimerRef.current = null;
    }
  }, []);

  const step = useCallback(
    (dir: number, dur = STEP_DURATION_MS): void => {
      pendingJumpRef.current = null;
      setStepDuration(prefersReducedMotion() ? 0 : dur);
      lastStepRef.current = performance.now();
      setPos((current) => (finite ? clamp(current + dir, 0, bookCount - 1) : current + dir));
    },
    [finite, bookCount],
  );

  const stepBy = useCallback(
    (delta: number): void => {
      cancelChain();
      if (!delta) return;
      const dir = Math.sign(delta);
      let left = Math.abs(delta);
      if (left === 1) {
        step(dir, STEP_DURATION_MS);
        return;
      }
      const tick = (): void => {
        left -= 1;
        step(dir, left > 0 ? CHAIN_STEP_DURATION_MS : STEP_DURATION_MS);
        if (left > 0) {
          chainTimerRef.current = setTimeout(tick, CHAIN_TICK_MS);
        }
      };
      tick();
    },
    [step, cancelChain],
  );

  /**
   * Moves the stage to the book at `targetIndex` in ONE move, however far it is (the shorter way
   * round the circular shelf): up to JUMP_SLIDE_MAX books slide as one step; a longer jump
   * teleports every slot and the stage's layout effect fades the shelf in, instantly under reduced
   * motion. One position change, so one announcement in the live region. Shelf chips, status
   * chips, Home/End and the reading map jump; arrow keys, drags and clicks on a visible book step.
   */
  const jumpTo = useCallback(
    (targetIndex: number): void => {
      cancelChain();
      const delta = jumpDelta(targetIndex, posRef.current, bookCount, finite);
      if (delta === 0) return;
      if (Math.abs(delta) <= JUMP_SLIDE_MAX) {
        step(delta);
        return;
      }
      const reduced = prefersReducedMotion();
      const target = posRef.current + delta;
      pendingJumpRef.current = { pos: target, dir: reduced ? 0 : Math.sign(delta) };
      setStepDuration(reduced ? 0 : STEP_DURATION_MS);
      lastStepRef.current = performance.now();
      setPos(target);
    },
    [finite, bookCount, step, cancelChain],
  );

  // On unmount, no chained step or fade-in outlives the stage.
  useEffect(() => {
    return () => {
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
      jumpAnimRef.current?.cancel();
    };
  }, []);

  return {
    pos,
    setPos,
    stepDuration,
    posRef,
    bookHeightRef,
    lastStepRef,
    pendingJumpRef,
    jumpAnimRef,
    step,
    stepBy,
    jumpTo,
    cancelChain,
  };
}
