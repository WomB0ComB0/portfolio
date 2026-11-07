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
 * @file formatAge words an age in whole units ('just now', 'N min ago', 'N h ago', 'N d ago') and
 * gives up ('') on invalid or future moments. Freshness shows it in a <time> that keeps up with
 * the clock every 30 s, stops its timer on unmount, and after hydration shows the browser's age
 * rather than the server's, without a hydration error. formatAge lives in a module with no
 * directive, so server components can call it, and the console barrel exports that copy.
 *
 * Timers and the system clock are faked, so "now" is fixed until a test moves it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as consoleBarrel from '@/components/console';
import { formatAge } from '@/components/console/format-age';
import { Freshness } from '@/components/console/freshness';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const FORMAT_AGE_SOURCE = join(process.cwd(), 'src/components/console/format-age.ts');
const BARREL_SOURCE = join(process.cwd(), 'src/components/console/index.ts');
const DIRECTIVE = /^\s*['"]use (?:client|server)['"]/m;

const NOW = Date.parse('2026-11-05T15:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatAge', () => {
  it.each([
    [0, 'just now'],
    [30 * SECOND, 'just now'],
    [45 * SECOND - 1, 'just now'],
    [45 * SECOND, '1 min ago'],
    [5 * MINUTE, '5 min ago'],
    [5 * MINUTE + 59 * SECOND, '5 min ago'],
    [HOUR - 1, '59 min ago'],
    [HOUR, '1 h ago'],
    [3 * HOUR, '3 h ago'],
    [DAY - 1, '23 h ago'],
    [DAY, '1 d ago'],
    [2 * DAY, '2 d ago'],
    [400 * DAY, '400 d ago'],
  ])('%i ms ago reads %j', (age, words) => {
    expect(formatAge(NOW - age, NOW)).toBe(words);
  });

  it('accepts a Date, an ISO string and epoch milliseconds', () => {
    const at = NOW - 3 * HOUR;

    expect(formatAge(new Date(at), NOW)).toBe('3 h ago');
    expect(formatAge(new Date(at).toISOString(), NOW)).toBe('3 h ago');
    expect(formatAge(at, NOW)).toBe('3 h ago');
  });

  it.each([
    ['an unparseable string', 'not a date'],
    ['an empty string', ''],
    ['NaN', Number.NaN],
    ['an invalid Date', new Date('nope')],
  ])('is empty for %s', (_name, at) => {
    expect(formatAge(at, NOW)).toBe('');
  });

  it('tolerates a minute of clock skew into the future, then gives up', () => {
    expect(formatAge(NOW + 30 * SECOND, NOW)).toBe('just now');
    expect(formatAge(NOW + MINUTE, NOW)).toBe('just now');
    expect(formatAge(NOW + MINUTE + 1, NOW)).toBe('');
  });

  it('measures from the current time by default', () => {
    vi.useFakeTimers({ now: NOW });
    expect(formatAge(NOW - 2 * DAY)).toBe('2 d ago');
    vi.useRealTimers();
  });

  it('lives in a module with no directive, so a server component can call it', () => {
    // From a 'use client' module a server component would get a client reference that throws.
    expect(readFileSync(FORMAT_AGE_SOURCE, 'utf8')).not.toMatch(DIRECTIVE);
    expect(readFileSync(BARREL_SOURCE, 'utf8')).toMatch(
      /export \{ formatAge, type Timestamp \} from '\.\/format-age';/,
    );
    expect(consoleBarrel.formatAge).toBe(formatAge);
  });
});

describe('Freshness', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the age in a <time> with the ISO moment', () => {
    const at = NOW - 30 * SECOND;
    render(<Freshness at={at} className="text-faint" />);
    const time = screen.getByText('updated just now');

    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', new Date(at).toISOString());
    // The meta style: Geist 13/18 with tabular figures, so the age never jitters; not mono.
    expect(time).toHaveClass('tile-meta', 'text-faint');
    expect(time).not.toHaveClass('font-mono');
  });

  it('updates its text every 30 s', () => {
    render(<Freshness at={NOW - 30 * SECOND} />);

    act(() => {
      vi.advanceTimersByTime(30 * SECOND);
    });
    expect(screen.getByText('updated 1 min ago').tagName).toBe('TIME');

    act(() => {
      vi.advanceTimersByTime(4 * 30 * SECOND);
    });
    expect(screen.getByText('updated 3 min ago')).toBeInTheDocument();
  });

  it('stops its timer on unmount', () => {
    const { unmount } = render(<Freshness at={NOW} />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes another prefix, or none', () => {
    const { unmount } = render(<Freshness at={NOW - 5 * MINUTE} prefix="synced" />);
    expect(screen.getByText('synced 5 min ago')).toBeInTheDocument();
    unmount();

    render(<Freshness at={NOW - 5 * MINUTE} prefix="" />);
    expect(screen.getByText('5 min ago').textContent).toBe('5 min ago');
  });

  it('shows no dangling prefix when the age is unknown (a moment too far ahead)', () => {
    const { container } = render(<Freshness at={NOW + 2 * MINUTE} />);
    const time = container.querySelector('time');

    expect(time).toHaveAttribute('dateTime', new Date(NOW + 2 * MINUTE).toISOString());
    expect(time?.textContent).toBe('');
  });

  it('renders nothing for an invalid moment', () => {
    const { container } = render(<Freshness at="not a date" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("after hydration shows the browser's age, not the server's, without an error", async () => {
    const at = NOW - 30 * SECOND;
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Freshness at={at} />);
    document.body.append(container);
    expect(container.textContent).toBe('updated just now');

    vi.setSystemTime(NOW + 10 * MINUTE);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = await act(async () =>
      hydrateRoot(container, <Freshness at={at} />, { onRecoverableError }),
    );

    expect(container.textContent).toBe('updated 10 min ago');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
