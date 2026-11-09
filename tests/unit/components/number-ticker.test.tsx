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
 * @file NumberTicker, the counting numbers on the /stats cards.
 *
 * The value a ticker rests on must be real text from the first render (server HTML, screen
 * readers, crawlers), never counted with reduced motion, and counted once, in about a second,
 * when it scrolls into view. jsdom has no IntersectionObserver or media queries, so `useInView`
 * is stubbed and `matchMedia` is a fake OS setting that can change while a ticker is mounted;
 * `animate` is the real one, watched by a spy.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { animate, useInView } from 'motion/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    animate: vi.fn(actual.animate),
    useInView: vi.fn(() => false),
  };
});

import { NumberTicker } from '@/components/ui/number-ticker';

/** The fake OS setting: every reduced-motion query reads it and hears its changes. */
const os = { reduced: false, listeners: new Set<() => void>() };

/** A MediaQueryList for `query`; only the literal reduced-motion query follows the fake setting. */
const fakeMatchMedia = (query: string) => {
  const isMotionQuery = query === '(prefers-reduced-motion: reduce)';
  const listen = (_type: string, listener: () => void) => {
    if (isMotionQuery) os.listeners.add(listener);
  };
  const unlisten = (_type: string, listener: () => void) => os.listeners.delete(listener);
  return {
    get matches() {
      return isMotionQuery && os.reduced;
    },
    media: query,
    onchange: null,
    addListener: (listener: () => void) => listen('change', listener),
    removeListener: (listener: () => void) => unlisten('change', listener),
    addEventListener: listen,
    removeEventListener: unlisten,
    dispatchEvent: () => false,
  };
};

/** The count drawn while counting; hidden from assistive tech, null once the ticker rests. */
const countingCopy = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('[aria-hidden="true"]');

const setMotion = ({ inView, reduced }: { inView: boolean; reduced: boolean }) => {
  vi.mocked(useInView).mockReturnValue(inView);
  os.reduced = reduced;
};

/** Turns the OS setting on or off and fires 'change' at every listener, as the browser does. */
const changeReducedMotion = (reduced: boolean) => {
  act(() => {
    os.reduced = reduced;
    for (const listener of [...os.listeners]) listener();
  });
};

const COUNT_TIMEOUT = { timeout: 2000 };

beforeEach(() => {
  vi.stubGlobal('matchMedia', fakeMatchMedia);
  setMotion({ inView: false, reduced: false });
  vi.mocked(animate).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NumberTicker server HTML', () => {
  it('contains the formatted value, including 0', () => {
    expect(renderToString(<NumberTicker value={0} />)).toMatch(/>0<\/span>$/);
    expect(renderToString(<NumberTicker value={1234.5} decimalPlaces={1} />)).toContain(
      '>1,234.5<',
    );
  });

  it('keeps the server-rendered value when hydrating, instead of counting it again', () => {
    setMotion({ inView: true, reduced: false });
    const container = document.createElement('div');
    container.innerHTML = renderToString(<NumberTicker value={1234} />);
    document.body.append(container);

    render(<NumberTicker value={1234} />, { container, hydrate: true });

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(countingCopy(container)).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('NumberTicker before it scrolls into view', () => {
  it('has the final value as text from the first render, including 0', () => {
    const { unmount } = render(<NumberTicker value={1234} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    unmount();

    render(<NumberTicker value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('gives assistive tech the final value once, not the counting copy', () => {
    const { container } = render(
      <h2>
        <NumberTicker value={1234} />
      </h2>,
    );

    expect(screen.getByRole('heading', { name: '1,234' })).toBeInTheDocument();
    expect(countingCopy(container)).toHaveTextContent('');
    expect(screen.getAllByText('1,234')).toHaveLength(1);
  });

  it('follows a new value from a data refresh', () => {
    const { rerender } = render(<NumberTicker value={1234} />);
    rerender(<NumberTicker value={5678} />);

    expect(screen.getByText('5,678')).toBeInTheDocument();
    expect(screen.queryByText('1,234')).not.toBeInTheDocument();
  });
});

describe('NumberTicker with reduced motion', () => {
  it('shows the final value at once and never counts', () => {
    setMotion({ inView: true, reduced: true });
    const { container } = render(<NumberTicker value={1234} />);

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(countingCopy(container)).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it('formats a fixed number of decimal places', () => {
    setMotion({ inView: false, reduced: true });
    render(
      <>
        <NumberTicker value={1234.5} decimalPlaces={1} />
        <NumberTicker value={3} decimalPlaces={2} />
      </>,
    );

    expect(screen.getByText('1,234.5')).toBeInTheDocument();
    expect(screen.getByText('3.00')).toBeInTheDocument();
  });

  it('shows a new value at once', () => {
    setMotion({ inView: true, reduced: true });
    const { rerender } = render(<NumberTicker value={10} />);
    rerender(<NumberTicker value={20} />);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  it('ends a running count when reduced motion turns on', () => {
    setMotion({ inView: true, reduced: false });
    const { container } = render(<NumberTicker value={1234} delay={5} />);
    expect(countingCopy(container)).not.toBeNull();

    changeReducedMotion(true);

    expect(countingCopy(container)).toBeNull();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('does not start counting when reduced motion turns on before the ticker scrolls into view', () => {
    const { container, rerender } = render(<NumberTicker value={1234} />);
    expect(countingCopy(container)).not.toBeNull();

    changeReducedMotion(true);
    vi.mocked(useInView).mockReturnValue(true);
    rerender(<NumberTicker value={1234} />);

    expect(animate).not.toHaveBeenCalled();
    expect(countingCopy(container)).toBeNull();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});

describe('NumberTicker counting', () => {
  it('starts from 0 before the first paint, then settles on the value within about a second', async () => {
    setMotion({ inView: true, reduced: false });
    const { container } = render(<NumberTicker value={1234} />);

    expect(countingCopy(container)).toHaveAttribute('data-count', '0');
    expect(screen.getAllByText('1,234')).toHaveLength(1);

    await waitFor(() => {
      expect(countingCopy(container)).toBeNull();
      expect(screen.getByText('1,234')).toBeInTheDocument();
    }, COUNT_TIMEOUT);
  });

  it('builds its number format once, not on every frame', async () => {
    setMotion({ inView: true, reduced: false });
    const numberFormat = vi.spyOn(Intl, 'NumberFormat');

    try {
      const { container } = render(<NumberTicker value={500} decimalPlaces={1} />);
      await waitFor(() => expect(countingCopy(container)).toBeNull(), COUNT_TIMEOUT);

      expect(screen.getByText('500.0')).toBeInTheDocument();
      expect(numberFormat).toHaveBeenCalledTimes(1);
    } finally {
      numberFormat.mockRestore();
    }
  });

  it('counts down from the value to 0 after the delay', () => {
    setMotion({ inView: true, reduced: false });
    const { container } = render(<NumberTicker value={50} direction="down" delay={0.25} />);

    expect(countingCopy(container)).toHaveAttribute('data-count', '50');
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(animate).toHaveBeenCalledWith(50, 0, expect.objectContaining({ delay: 0.25 }));
  });

  it('shows a new value at once after the count has finished', async () => {
    setMotion({ inView: true, reduced: false });
    const { container, rerender } = render(<NumberTicker value={12} />);
    await waitFor(() => expect(countingCopy(container)).toBeNull(), COUNT_TIMEOUT);

    rerender(<NumberTicker value={34} />);

    expect(screen.getByText('34')).toBeInTheDocument();
    expect(countingCopy(container)).toBeNull();
  });
});
