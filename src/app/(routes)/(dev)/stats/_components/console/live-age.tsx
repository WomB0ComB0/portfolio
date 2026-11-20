'use client';

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
 * @file The live age in the /stats header strip, '22.65753424 years old': eight decimals, so the
 * last digit visibly ticks (1e-8 of a year is about 0.316 s), without what the first site's
 * dashboard counter cost.
 *
 * - The first render prints the age at `at`, the moment the server rendered the page, on the
 *   server and in the hydrating browser alike, so the two agree to the character and there is no
 *   mismatch to suppress. The clock starts after mount.
 * - Each tick writes through refs, and only text that changed: React never renders again. (The
 *   first site set state every 10 ms, a hundred renders a second.)
 * - A tick is an animation frame, a tenth of a second after the last, so a write lands with a
 *   paint and an idle page is not woken every frame. The eighth decimal steps every 315.36 ms
 *   (316.224 ms in a 366-day year), so about every third tick writes, each step lands within a
 *   tenth of a second of happening, and none is skipped. A hidden tab stops the clock, and it
 *   catches up the moment the tab shows again.
 * - Moving content must be stoppable (WCAG 2.2.2). A Pause toggle (LiveAgePause, aria-pressed)
 *   stops the clock where it is; pressed again, the age catches up at once and ticks on. It sits
 *   at the end of the strip's label row, under the digits, in a cell of its own, so the figure's
 *   line never holds it; the two share their state through LiveAgeProvider, which holds the moment
 *   the age was paused, so a figure mounted while paused (the loaded strip replacing its skeleton
 *   on /stats) shows the same digits, and a toggle that had focus when it was replaced hands it to
 *   the toggle replacing it. Under reduced motion the age holds still: shown once as of mount (and
 *   when the tab shows again), never ticking, and the toggle, with nothing to pause, is hidden.
 *   The setting is followed live.
 * - A skeleton's toggle (LiveAgePause `skeleton`) works only where React renders it in the
 *   browser: React never hydrates the server's HTML for a Suspense fallback (it waits for the
 *   content that replaces it), so a button sent there would take focus and presses and do nothing.
 *   The server sends an inert placeholder of the key cap's size instead. Nothing there needs
 *   pausing: the skeleton's figure, never hydrated either, does not tick.
 * - The digits on screen are hidden from screen readers and never live. A twin gives the whole
 *   years, which the strip's label completes ('years old, 22'), and changes once a year.
 * - Tabular figures in a box held at the figure's width by an unseen '00.00000000' (a zero for
 *   each of AGE_DECIMALS), so a ticking digit never moves anything. The digits on top take no
 *   width of their own: tabular figures are not always equal once hinted (at 12 px on a 2x Linux
 *   screen '.66054044' came out a pixel wider than '.66054028'), and the box would follow them.
 *
 * The decimals are muted, as a unit is: the whole years stay the figure. On a phone they are also
 * smaller (FRACTION_SIZE_CLASS), so the strip keeps its three items on one row.
 */

import {
  createContext,
  type ReactElement,
  type ReactNode,
  type RefCallback,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiPause } from 'react-icons/fi';

import { StatStripAction } from '@/components/console/stat-strip';
import { AGE_DECIMALS, exactAgeParts } from '@/constants/age';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';
import { cn } from '@/lib/utils';

/**
 * Ten updates a second: the last digit, which steps about every 0.316 s, is never more than a tenth
 * of a second late.
 */
export const TICK_MS = 100;

/**
 * The decimals' size on a narrow page. At the strip's figure size the age is about 180 px wide, and
 * the strip's three items stop fitting on one row below a page about 394 px wide (measured with
 * four- and three-digit neighbours). So the decimals shrink there and the whole years keep the size
 * of the strip's other figures: 18 px under 25rem (a 390 px phone, about 130 px wide), 12 px under
 * 22rem (a 320 px phone, about 97 px). The unseen template takes the same sizes, so the box shrinks
 * with the digits and still never moves.
 */
const FRACTION_SIZE_CLASS =
  '@max-[25rem]/page:text-[length:1.125rem] @max-[22rem]/page:text-[length:0.75rem]';

/**
 * The Pause toggle: a key cap in Geist Mono (mono-token), 24 px tall to meet the target size,
 * centred on the label's 20 px line by its cell (StatStripAction), which it overhangs evenly.
 */
const PAUSE_CLASS =
  'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 mono-token transition-colors duration-(--motion-fast) ease-standard';

/**
 * The toggle's cell is hidden with it: under reduced motion, where the age never ticks, and without
 * scripting, where it never starts. Hiding the cell, not only the button, leaves no empty dd.
 */
const PAUSE_CELL_CLASS = 'motion-reduce:hidden [@media(scripting:none)]:hidden';

/** Running: a hairline key cap in the muted tier, firming up under the pointer. */
const PAUSE_IDLE_CLASS =
  'border-hairline text-muted-foreground hover:border-hairline-strong hover:text-foreground';

/**
 * Pressed (paused): pushed in, on the raised surface with the strong hairline, in the foreground
 * tier, and its bars drawn solid rather than outlined: a change of shape, not only of colour.
 */
const PAUSE_PRESSED_CLASS = 'border-hairline-strong bg-surface-3 text-foreground';

/**
 * The word, on screen from 25rem. The toggle shares the label's row with 'years old', inside the
 * age's column, which is the digits' width. Under 25rem the digits shrink (FRACTION_SIZE_CLASS) to
 * about 123 px, too narrow for the label and the word (measured in Chromium), so only the icon
 * shows there; under 22rem (about 91 px) the label wraps beside it, as its neighbours' labels do at
 * that width. The name keeps the word.
 */
const PAUSE_WORD_CLASS = '@max-[25rem]/page:sr-only';

/**
 * The skeleton's placeholder for the toggle, where the server sent it: the key cap's box (its
 * classes, its contents unseen, so the same size at every width) drawn as the strip's other
 * placeholder bars are, on the raised surface and pulsing where motion is welcome. Not a control:
 * no button, no focus, hidden from screen readers with its cell.
 */
const PAUSE_PLACEHOLDER_CLASS =
  'border-transparent bg-surface-3 motion-safe:animate-pulse forced-colors:outline';

/** The toggle's accessible name: the word shown, and what it pauses. */
const PAUSE_LABEL = 'Pause age counter';

/** Writes `text` into `node` only when it differs, so a tick that changes nothing touches nothing. */
function writeText(node: HTMLElement | null, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}

/**
 * What the figure and its toggle share: when the age was paused (epoch ms; null while it runs), the
 * toggle's press, and the hand-off of focus from a toggle being replaced to its replacement.
 */
interface PauseState {
  readonly pausedAt: number | null;
  readonly togglePaused: () => void;
  /**
   * True from the moment a toggle that has focus is removed until the end of that commit: the
   * toggle mounted in the same commit (the loaded strip's, replacing the skeleton's) takes focus.
   */
  readonly focusHandoff: RefObject<boolean>;
}

const PauseContext = createContext<PauseState | null>(null);

export interface LiveAgeProviderProps {
  readonly children: ReactNode;
}

/**
 * Holds the Pause state LiveAge (the figure) and LiveAgePause (its toggle) share. The strip sets
 * them in different cells, the figure on its own line and the toggle on the label's row, so the
 * state sits around the strip: on /stats around the strip's slot, outside the Suspense boundary in
 * which the loaded strip replaces its skeleton, so a pause made on the skeleton holds, and focus on
 * the skeleton's toggle moves to the loaded one.
 *
 * @example
 * <LiveAgeProvider>
 *   <StatStrip items={stripItems(data, now, <LiveAge at={at} />, <LiveAgePause />)} />
 * </LiveAgeProvider>
 */
export function LiveAgeProvider({ children }: LiveAgeProviderProps): ReactElement {
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const focusHandoff = useRef(false);
  const state = useMemo<PauseState>(
    () => ({
      pausedAt,
      togglePaused: () => setPausedAt(pausedAt === null ? Date.now() : null),
      focusHandoff,
    }),
    [pausedAt],
  );
  return <PauseContext.Provider value={state}>{children}</PauseContext.Provider>;
}

export interface LiveAgeProps {
  /** When the server rendered the page (epoch ms): the age the first render shows. */
  readonly at: number;
  readonly className?: string;
}

/**
 * The owner's age to AGE_DECIMALS (eight) places, kept current while the page is visible and not
 * paused (by LiveAgePause, through a LiveAgeProvider; outside one it never pauses); still under
 * reduced motion. Renders nothing for an invalid `at`.
 *
 * @example
 * <LiveAge at={now} />
 */
export function LiveAge({ at, className }: LiveAgeProps): ReactElement | null {
  const pausedAt = useContext(PauseContext)?.pausedAt ?? null;
  const spokenRef = useRef<HTMLSpanElement>(null);
  const wholeRef = useRef<HTMLSpanElement>(null);
  const fractionRef = useRef<HTMLSpanElement>(null);
  const initial = exactAgeParts(new Date(at));

  useEffect(() => {
    /** Writes the age at `moment` (the browser's now by default) into the digits and their twin. */
    const show = (moment = new Date()): void => {
      const parts = exactAgeParts(moment);
      if (!parts) return;
      writeText(spokenRef.current, parts.whole);
      writeText(wholeRef.current, parts.whole);
      writeText(fractionRef.current, parts.fraction);
    };

    // Paused, the digits show the age at the moment of the pause, and nothing ticks. React renders
    // them only from `at`, so this also covers a figure mounted while paused.
    if (pausedAt !== null) {
      show(new Date(pausedAt));
      return;
    }
    const reducedMotion =
      typeof globalThis.matchMedia === 'function'
        ? globalThis.matchMedia(REDUCED_MOTION_QUERY)
        : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;

    const stop = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      timer = undefined;
      frame = undefined;
    };

    // Under reduced motion the age holds still: start shows it, and nothing ticks after.
    const schedule = (): void => {
      if (reducedMotion?.matches) return;
      timer = setTimeout(() => {
        timer = undefined;
        frame = requestAnimationFrame(() => {
          frame = undefined;
          show();
          schedule();
        });
      }, TICK_MS);
    };

    const start = (): void => {
      stop();
      if (document.hidden) return;
      show();
      schedule();
    };

    const onVisibilityChange = (): void => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    // A change of the setting mid-visit restarts the clock: still from now on, or ticking again.
    reducedMotion?.addEventListener('change', start);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion?.removeEventListener('change', start);
      stop();
    };
  }, [pausedAt]);

  if (!initial) return null;

  // '00.00000000': laid in the digits' grid cell, unseen, it holds the box at the figure's width in
  // the font as rendered (`ch` measures Geist's proportional zero, wider than its tabular digits).
  const templateWhole = '0'.repeat(initial.whole.length);
  const templateFraction = `.${'0'.repeat(AGE_DECIMALS)}`;

  return (
    <span aria-live="off" className={cn('tabular-nums', className)}>
      <span ref={spokenRef} className="sr-only">
        {initial.whole}
      </span>
      <span aria-hidden="true" className="inline-grid">
        <span className="invisible col-start-1 row-start-1">
          {templateWhole}
          <span className={FRACTION_SIZE_CLASS}>{templateFraction}</span>
        </span>
        <span data-digits="" className="col-start-1 row-start-1 w-0 whitespace-nowrap">
          <span ref={wholeRef}>{initial.whole}</span>
          <span className={cn('text-muted-foreground', FRACTION_SIZE_CLASS)}>
            .<span ref={fractionRef}>{initial.fraction}</span>
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * The toggle's ref: a toggle that has focus as it is removed marks the hand-off, and the toggle
 * mounted in that same commit takes focus. React detaches the old one's ref (while it is still in
 * the page) before it attaches the new one's, and the mark is cleared once the commit is over, so
 * a toggle mounted later never takes focus it was not handed.
 */
function useFocusHandoff(focusHandoff: RefObject<boolean>): RefCallback<HTMLButtonElement> {
  return useCallback(
    (button: HTMLButtonElement | null) => {
      if (!button) return undefined;
      if (focusHandoff.current) {
        focusHandoff.current = false;
        button.focus();
      }
      return () => {
        if (button.ownerDocument.activeElement !== button) return;
        focusHandoff.current = true;
        queueMicrotask(() => {
          focusHandoff.current = false;
        });
      };
    },
    [focusHandoff],
  );
}

export interface LiveAgePauseProps {
  /**
   * The toggle stands in a skeleton (a Suspense fallback, which React never hydrates): the server
   * sends an inert placeholder of its size, and it is a working toggle wherever React renders it in
   * the browser (a fallback on a client navigation, or once hydrated).
   */
  readonly skeleton?: boolean;
}

/** The skeleton's stand-in for the toggle: its key cap's box, unseen inside, not a control. */
function PausePlaceholder(): ReactElement {
  return (
    <StatStripAction className={PAUSE_CELL_CLASS} aria-hidden>
      <span data-pause-placeholder="" className={cn(PAUSE_CLASS, PAUSE_PLACEHOLDER_CLASS)}>
        <FiPause aria-hidden="true" className="invisible size-3" />
        <span className={cn('invisible', PAUSE_WORD_CLASS)}>Pause</span>
      </span>
    </StatStripAction>
  );
}

/**
 * The age's Pause toggle, in its strip cell (StatStripAction, the age item's action): pressed, the
 * figure stops where it is; pressed again, it catches up at once and ticks on. Renders inside a
 * LiveAgeProvider, with the LiveAge it pauses, and throws outside one. A toggle that replaces one
 * with focus (the loaded strip's, replacing the skeleton's) takes that focus.
 *
 * @example
 * <LiveAgePause />
 * <LiveAgePause skeleton />
 */
export function LiveAgePause({ skeleton = false }: LiveAgePauseProps): ReactElement {
  const state = useContext(PauseContext);
  if (!state) throw new Error('LiveAgePause renders inside <LiveAgeProvider>, with its LiveAge');
  const { pausedAt, togglePaused, focusHandoff } = state;
  const paused = pausedAt !== null;
  const keepFocus = useFocusHandoff(focusHandoff);
  const fromServer = useIsServerHtmlRender();

  if (skeleton && fromServer) return <PausePlaceholder />;
  return (
    <StatStripAction className={PAUSE_CELL_CLASS}>
      {/* The name starts with the word shown, so a voice user saying "Pause" reaches it; it stays
          the same when pressed, as a toggle's must, and aria-pressed says it is paused. */}
      <button
        ref={keepFocus}
        type="button"
        aria-label={PAUSE_LABEL}
        aria-pressed={paused}
        onClick={togglePaused}
        className={cn(PAUSE_CLASS, paused ? PAUSE_PRESSED_CLASS : PAUSE_IDLE_CLASS)}
      >
        <FiPause aria-hidden="true" className="size-3" fill={paused ? 'currentColor' : 'none'} />
        <span className={PAUSE_WORD_CLASS}>Pause</span>
      </button>
    </StatStripAction>
  );
}
