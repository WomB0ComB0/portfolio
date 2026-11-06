'use client';

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

import { animate, useInView, useReducedMotion } from 'motion/react';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { cn } from '@/lib/utils';

/** How long a count takes, in seconds. */
const COUNT_DURATION_S = 1;

export interface NumberTickerProps {
  /** The number to show. */
  value: number;
  /** 'up' counts from 0 to `value`; 'down' counts from `value` down to 0 and rests there. */
  direction?: 'up' | 'down';
  className?: string;
  /** Wait before counting, in seconds. */
  delay?: number;
  /** Fixed number of decimal places. */
  decimalPlaces?: number;
}

interface CountOptions {
  from: number;
  to: number;
  delay: number;
  formatter: Intl.NumberFormat;
  onDone: () => void;
}

/** Shows `text` in the counting copy (its ::before draws it), skipping frames that don't change it. */
const writeCount = (element: HTMLElement, text: string): void => {
  if (element.dataset.count !== text) {
    element.dataset.count = text;
  }
};

/**
 * Counts the element in `ref` from `from` to `to` once it scrolls into view. Each frame is written
 * straight to the DOM, so the count doesn't re-render React.
 */
const useCount = (
  ref: RefObject<HTMLSpanElement | null>,
  isEnabled: boolean,
  { from, to, delay, formatter, onDone }: CountOptions,
): void => {
  const shown = useRef<number | null>(null);
  const isInView = useInView(ref, { once: true });

  // Before paint, so a ticker that is already on screen never shows its final value first.
  useLayoutEffect(() => {
    if (isEnabled && ref.current) {
      writeCount(ref.current, formatter.format(shown.current ?? from));
    }
  }, [isEnabled, ref, formatter, from]);

  useEffect(() => {
    const element = ref.current;
    if (!isEnabled || !isInView || !element) return;

    const controls = animate(shown.current ?? from, to, {
      duration: COUNT_DURATION_S,
      delay,
      ease: 'easeOut',
      onUpdate: (latest) => {
        shown.current = latest;
        writeCount(element, formatter.format(latest));
      },
      onComplete: onDone,
    });
    return () => controls.stop();
  }, [isEnabled, isInView, ref, formatter, from, to, delay, onDone]);
};

/**
 * A number that counts to its value when it scrolls into view.
 *
 * The value it rests on is always real text: in server HTML, without JavaScript, for screen
 * readers and for tests. While counting, that text is visually hidden and an aria-hidden copy
 * shows the count. There is no count with prefers-reduced-motion, or for a ticker hydrated from
 * server HTML, which already shows its value.
 *
 * @deprecated Use `LiveNumber` from '@/components/console' instead. NumberTicker counts up from 0
 * whenever it mounts on the client (a client navigation, or a remount after a refetch), so a real
 * figure briefly reads as a smaller one. LiveNumber prints the final value on its first render
 * and only glides from one real value to the next.
 */
export const NumberTicker = ({
  value,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
}: NumberTickerProps) => {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }),
    [decimalPlaces],
  );
  const [from, to] = direction === 'down' ? [value, 0] : [0, value];
  const finalText = formatter.format(to);

  const isServerHtml = useIsServerHtmlRender();
  const prefersReducedMotion = useReducedMotion();
  // Decided once, at mount. Server HTML has already painted the final value, so counting it
  // again would flash it back to the start; later value changes show at once.
  const [isCounting, setIsCounting] = useState(
    () =>
      !isServerHtml &&
      prefersReducedMotion === false &&
      Number.isFinite(value) &&
      formatter.format(from) !== finalText,
  );
  const stopCounting = useCallback(() => setIsCounting(false), []);

  const countRef = useRef<HTMLSpanElement>(null);
  useCount(countRef, isCounting, { from, to, delay, formatter, onDone: stopCounting });

  return (
    <span
      className={cn(
        'inline-block tabular-nums text-black dark:text-white tracking-wider',
        className,
      )}
    >
      {isCounting ? (
        <>
          <span className="sr-only">{finalText}</span>
          <span aria-hidden="true" className="before:content-[attr(data-count)]" ref={countRef} />
        </>
      ) : (
        finalText
      )}
    </span>
  );
};
NumberTicker.displayName = 'NumberTicker';

export default NumberTicker;
