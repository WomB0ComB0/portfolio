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
 * @file StatTile shows one figure in five states without inventing numbers: ready and stale show
 * the formatted value, loading keeps the three rows in place with placeholders, idle shows words
 * (never 0), and error shows a dash next to words and the action. A live badge pulses only while
 * ready, deltas pair their colour with an arrow and a word, and the tile renders on the server.
 * StatusDot, which the live badge uses, is covered here too.
 *
 * jsdom applies no Tailwind CSS, so looks are checked as the classes that produce them. next/link
 * is a plain anchor exposing prefetch as data-prefetch; LiveNumber is a marker span that echoes
 * the value and format it was given.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { StatTile, type StatTileProps, StatTileSkeleton } from '@/components/console/stat-tile';
import { StatusDot, type StatusTone } from '@/components/console/status-dot';

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/console/live-number', () => ({
  LiveNumber: ({ value, format }: { value: number; format?: Intl.NumberFormatOptions }) => (
    <span data-testid="live-number" data-value={value} data-format={JSON.stringify(format ?? {})}>
      {`tweened ${value}`}
    </span>
  ),
}));

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = join(process.cwd(), 'src/components/console/stat-tile.tsx');

const LABEL = 'Typing time';
const MINUTE_MS = 60_000;
const PULSE_CLASS = 'motion-safe:animate-live-pulse';

/** Renders a stat tile and returns its root, found by the name its label gives it. */
function renderStat(props: Partial<StatTileProps> = {}): HTMLElement {
  render(<StatTile {...(props as StatTileProps)} label={LABEL} />);
  return screen.getByRole('article', { name: LABEL });
}

/** The three row elements of a rendered tile. */
function rowsOf(tile: HTMLElement): HTMLElement[] {
  const grid = tile.firstElementChild;
  if (!(grid instanceof HTMLElement)) throw new Error('tile has no row grid');
  return Array.from(grid.children).filter((row): row is HTMLElement => row instanceof HTMLElement);
}

/** The figure paragraph: the first <p> of row 2. */
function figureOf(tile: HTMLElement): HTMLElement {
  const figure = rowsOf(tile)[1]?.querySelector('p');
  if (!figure) throw new Error('tile has no figure');
  return figure;
}

describe('StatTile ready', () => {
  it('shows the label, the en-US formatted value and the unit', () => {
    const tile = renderStat({ value: 4159, unit: 'hours' });

    expect(tile.tagName).toBe('ARTICLE');
    expect(tile).toHaveAttribute('data-state', 'ready');
    expect(tile).not.toHaveAttribute('aria-busy');
    expect(within(tile).getByText(LABEL)).toHaveClass('label-mono', 'text-muted-foreground');
    expect(within(tile).getByText('4,159')).toBe(figureOf(tile));
    expect(within(tile).getByText('hours')).toHaveClass(
      'font-sans',
      'text-body-sm',
      'tracking-normal',
      'text-muted-foreground',
    );
  });

  it('keeps both the type-scale class and the colour on the figure and the context line', () => {
    const tile = renderStat({ value: 12 });

    expect(figureOf(tile)).toHaveClass('figure', 'text-foreground', 'text-stat');
    expect(rowsOf(tile)[2]).toHaveClass(
      'min-h-[1.125rem]',
      'font-mono',
      'text-meta',
      'text-muted-foreground',
    );
  });

  it.each([
    ['md', ['text-stat']],
    ['lg', ['text-stat', '@sm:text-display']],
    ['xl', ['text-display', '@md:text-hero']],
  ] as const)('size %s sizes the figure with %j', (size, classes) => {
    const tile = renderStat({ value: 7, size });

    expect(figureOf(tile)).toHaveClass(...classes);
  });

  it('formats with the given Intl options', () => {
    renderStat({ value: 0.42, format: { style: 'percent' } });
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('passes a string value through untouched', () => {
    renderStat({ value: 'A+' });
    expect(screen.getByText('A+')).toBeInTheDocument();
  });

  it('shows how fresh the value is, or the meta in its place', () => {
    const { unmount } = render(
      <StatTile label={LABEL} value={3} updatedAt={Date.now() - 5 * MINUTE_MS - 1000} />,
    );
    expect(screen.getByText('updated 5 min ago').tagName).toBe('TIME');
    unmount();

    renderStat({ value: 3, updatedAt: Date.now(), meta: '60 s personal best' });
    expect(screen.getByText('60 s personal best')).toBeInTheDocument();
    expect(screen.queryByText(/^updated/)).toBeNull();
  });

  it('renders children after the figure, outside its paragraph', () => {
    const tile = renderStat({ value: 5, children: <div data-testid="spark" /> });
    const spark = within(tile).getByTestId('spark');

    expect(figureOf(tile).contains(spark)).toBe(false);
    expect(rowsOf(tile)[1]?.lastElementChild).toBe(spark);
  });
});

describe('StatTile loading', () => {
  it('keeps the real label and the same three rows as ready, with no value text', () => {
    const { unmount } = render(<StatTile label={LABEL} value={4159} unit="hours" />);
    const ready = screen.getByRole('article', { name: LABEL });
    const readyRows = rowsOf(ready).map((row) => row.className);
    const readyFigureClass = figureOf(ready).className;
    unmount();

    const loading = renderStat({ value: 4159, unit: 'hours', state: 'loading' });
    const rows = rowsOf(loading);

    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading).toHaveAttribute('data-state', 'loading');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.className)).toEqual(readyRows);
    expect(figureOf(loading).className).toBe(readyFigureClass);
    expect(within(loading).getByText(LABEL)).toBeInTheDocument();
    expect(within(loading).queryByText('4,159')).toBeNull();
    expect(within(loading).queryByText('hours')).toBeNull();
    expect(within(loading).getByText('Loading')).toHaveClass('sr-only');
  });

  it('holds the figure height with a placeholder inside the figure element', () => {
    const tile = renderStat({ state: 'loading' });
    const placeholder = figureOf(tile).querySelector('[aria-hidden="true"]');

    expect(placeholder).toHaveClass('block', 'h-[1em]', 'w-[4ch]', 'bg-surface-3');
    expect(rowsOf(tile)[2]?.querySelector('[aria-hidden="true"]')).toHaveClass('w-24');
  });

  it('StatTileSkeleton is the loading state', () => {
    render(<StatTileSkeleton label={LABEL} size="lg" />);
    const tile = screen.getByRole('article', { name: LABEL });

    expect(tile).toHaveAttribute('data-state', 'loading');
    expect(tile).toHaveAttribute('aria-busy', 'true');
  });
});

describe('StatTile idle', () => {
  it.each([
    ['no value', {}],
    ['null', { value: null }],
    ['ready with null', { value: null, state: 'ready' }],
    ['NaN', { value: Number.NaN }],
    ['Infinity', { value: Number.POSITIVE_INFINITY }],
    ['an empty string', { value: '  ' }],
  ] as const)('%s shows the idle text, never 0, and no pulse', (_name, props) => {
    const tile = renderStat({ ...props, live: true });

    expect(tile).toHaveAttribute('data-state', 'idle');
    expect(within(tile).getByText('Nothing right now')).toHaveClass(
      'font-sans',
      'text-title',
      'font-medium',
      'text-muted-foreground',
    );
    expect(tile.textContent).not.toMatch(/\d/);
    expect(tile.querySelector(`.${CSS.escape(PULSE_CLASS)}`)).toBeNull();
    expect(within(tile).queryByText('Live')).toBeNull();
  });

  it('uses the given idle text', () => {
    renderStat({ value: null, idleText: 'No 60 s test yet' });
    expect(screen.getByText('No 60 s test yet')).toBeInTheDocument();
  });
});

describe('StatTile error', () => {
  it('shows the error text and the action next to an aria-hidden dash, without an alert', () => {
    const tile = renderStat({
      value: 4159,
      state: 'error',
      errorText: 'LeetCode stats unavailable',
      action: <button type="button">Retry</button>,
      live: true,
    });

    expect(tile).toHaveAttribute('data-state', 'error');
    expect(within(tile).getByText('LeetCode stats unavailable')).toBeInTheDocument();
    expect(within(tile).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(within(tile).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(tile).queryByText('4,159')).toBeNull();
    expect(within(tile).queryByRole('alert')).toBeNull();
    expect(within(tile).queryByText('Live')).toBeNull();
    expect(rowsOf(tile)[2]?.querySelector('svg')).toHaveClass('text-down', 'size-3.5');
  });

  it('defaults the error text', () => {
    renderStat({ state: 'error' });
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
  });

  it('shows the action only in the error state', () => {
    renderStat({ value: 1, action: <button type="button">Retry</button> });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('StatTile stale', () => {
  it('shows the value, then Stale and the freshness, with no pulse even when live', () => {
    const tile = renderStat({
      value: 4159,
      state: 'stale',
      live: true,
      updatedAt: Date.now() - 3 * 60 * MINUTE_MS,
    });
    const context = rowsOf(tile)[2];

    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(within(tile).getByText('4,159')).toBeInTheDocument();
    expect(within(tile).getByText('Stale ·')).toBeInTheDocument();
    expect(within(tile).getByText('updated 3 h ago')).toBeInTheDocument();
    expect(context?.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(tile.querySelector(`.${CSS.escape(PULSE_CLASS)}`)).toBeNull();
    expect(within(tile).queryByText('Live')).toBeNull();
  });

  it('says Stale alone when there is nothing to add', () => {
    renderStat({ value: 1, state: 'stale' });
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('puts meta in place of the freshness, as the ready and idle states do', () => {
    const tile = renderStat({
      value: 1,
      state: 'stale',
      meta: 'from the last sync',
      updatedAt: Date.now() - 3 * 60 * MINUTE_MS,
    });

    expect(rowsOf(tile)[2]?.textContent).toBe('Stale ·from the last sync');
    expect(tile.querySelector('time')).toBeNull();
  });

  it.each([
    ['an invalid', 'not a date'],
    ['a far-future', Date.now() + 10 * MINUTE_MS],
  ])('says Stale alone, with no dangling separator, for %s updatedAt', (_case, updatedAt) => {
    const tile = renderStat({ value: 1, state: 'stale', updatedAt });

    expect(rowsOf(tile)[2]?.textContent).toBe('Stale');
    expect(within(tile).queryByText('Stale ·')).toBeNull();
  });
});

describe('StatTile live badge', () => {
  it('live and ready shows a pulsing live dot beside the word Live', () => {
    const tile = renderStat({ value: 1, live: true });
    const dot = tile.querySelector('[data-status-dot]');
    const word = within(tile).getByText('Live');

    expect(dot).toHaveClass(PULSE_CLASS, 'bg-live');
    expect(dot).toHaveAttribute('data-tone', 'live');
    expect(word.contains(dot)).toBe(true);
    expect(word).toHaveClass('label-mono', 'text-live');
  });

  it('a tile that is not live has no dot', () => {
    const tile = renderStat({ value: 1 });
    expect(tile.querySelector('[data-status-dot]')).toBeNull();
  });
});

describe('StatTile delta', () => {
  it.each([
    ['a rise', { value: 12, period: 'this week' }, '▲', 'Up', 'text-live'],
    ['a fall', { value: -3, period: 'this week' }, '▼', 'Down', 'text-down'],
    ['an inverted rise', { value: 12, invert: true }, '▲', 'Up', 'text-down'],
    ['an inverted fall', { value: -3, invert: true }, '▼', 'Down', 'text-live'],
  ] as const)('%s shows its arrow, word and colour', (_name, delta, arrow, word, tone) => {
    const tile = renderStat({ value: 100, delta });
    const deltaText = tile.querySelector('[data-delta]');

    expect(deltaText).toHaveClass(tone);
    expect(within(tile).getByText(arrow)).toHaveAttribute('aria-hidden', 'true');
    expect(within(tile).getByText(word)).toHaveClass('sr-only');
    expect(deltaText?.textContent).toContain(String(Math.abs(delta.value)));
  });

  it('shows the absolute amount and the period', () => {
    const tile = renderStat({ value: 100, delta: { value: -1200, period: 'this week' } });
    expect(tile.querySelector('[data-delta]')?.textContent).toBe('▼Down 1,200 this week');
  });

  it('stays muted at 0', () => {
    const tile = renderStat({ value: 100, delta: { value: 0 } });
    const deltaText = tile.querySelector('[data-delta]');

    expect(deltaText).toHaveAttribute('data-delta', 'flat');
    expect(deltaText).not.toHaveClass('text-live');
    expect(deltaText).not.toHaveClass('text-down');
    expect(within(tile).getByText('±')).toBeInTheDocument();
  });
});

describe('StatTile root', () => {
  it('an interactive tile is one link, with prefetch off', () => {
    render(<StatTile label={LABEL} value={22} variant="interactive" href="/projects" />);
    const link = screen.getByRole('link');

    expect(link).toHaveAttribute('href', '/projects');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link).toHaveAttribute('data-state', 'ready');
    expect(link).not.toHaveAttribute('aria-labelledby');
    expect(within(link).getByText('22')).toBeInTheDocument();
  });

  it.each([
    ['empty', ''],
    ['bare #', '#'],
  ])('an interactive tile with an %s href is a plain labelled article', (_case, href) => {
    render(<StatTile label={LABEL} value={22} variant="interactive" href={href} external />);
    const tile = screen.getByRole('article', { name: LABEL });

    expect(screen.queryByRole('link')).toBeNull();
    expect(tile).toHaveAttribute('data-state', 'ready');
    expect(tile).toHaveClass('bg-surface-1');
    expect(tile).not.toHaveClass('spotlight');
    expect(tile).not.toHaveAttribute('data-spotlight');
    expect(tile).not.toHaveAttribute('href');
    expect(within(tile).getByText('22')).toBeInTheDocument();
  });

  it('an interactive tile links its href without the spaces and nbsp around it', () => {
    render(<StatTile label={LABEL} value={22} variant="interactive" href={'  /projects  '} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/projects');
  });

  it('an external interactive tile opens a new tab', () => {
    render(
      <StatTile
        label={LABEL}
        value={1}
        variant="interactive"
        href="https://leetcode.com"
        external
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });

  it('names the root from a heading label with the given id', () => {
    render(<StatTile label="LeetCode" value={9} labelAs="h2" id="leetcode-label" />);
    const heading = screen.getByRole('heading', { level: 2, name: 'LeetCode' });

    expect(heading).toHaveAttribute('id', 'leetcode-label');
    expect(screen.getByRole('article', { name: 'LeetCode' })).toHaveAttribute(
      'aria-labelledby',
      'leetcode-label',
    );
  });

  it('takes Tile props: another element, a variant, a span and classes', () => {
    render(
      <ul>
        <StatTile label={LABEL} value={1} as="li" variant="raised" span={{ lg: 6 }} className="x" />
      </ul>,
    );
    const tile = screen.getByRole('listitem', { name: LABEL });

    expect(tile).toHaveClass('bg-surface-2', '@4xl/tiles:col-span-6', 'x');
  });

  it('does not name a div root, which ARIA forbids', () => {
    const { container } = render(<StatTile label={LABEL} value={1} as="div" />);
    expect(container.firstElementChild).not.toHaveAttribute('aria-labelledby');
  });

  it('tween hands a number and its format to LiveNumber, but not a string', () => {
    const format = { style: 'percent', maximumFractionDigits: 1 } as const;
    const { unmount } = render(<StatTile label={LABEL} value={4159} format={format} tween />);
    const live = screen.getByTestId('live-number');
    expect(live).toHaveAttribute('data-value', '4159');
    expect(live).toHaveAttribute('data-format', JSON.stringify(format));
    expect(screen.queryByText('4,159')).toBeNull();
    unmount();

    render(<StatTile label={LABEL} value="4.2k" tween />);
    expect(screen.queryByTestId('live-number')).toBeNull();
    expect(screen.getByText('4.2k')).toBeInTheDocument();
  });

  it('renders on the server', () => {
    const html = renderToString(<StatTile label={LABEL} value={4159} unit="hours" live />);

    expect(html).toContain('<article');
    expect(html).toContain('4,159');
    expect(html).toContain(LABEL);
    expect(html).toContain('data-state="ready"');
  });

  it('has no use client directive', () => {
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});

describe('StatusDot', () => {
  it.each([
    ['live', 'bg-live'],
    ['ongoing', 'bg-ongoing'],
    ['down', 'bg-down'],
    ['info', 'bg-info'],
    ['idle', 'bg-faint'],
  ] as const)('%s is a decorative %s dot', (tone: StatusTone, colour) => {
    const { container } = render(<StatusDot tone={tone} className="ml-1" />);
    const dot = container.firstElementChild;

    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveAttribute('data-status-dot', '');
    expect(dot).toHaveAttribute('data-tone', tone);
    expect(dot).toHaveClass('size-2', 'rounded-full', colour, 'ml-1');
    expect(dot).not.toHaveClass(PULSE_CLASS);
  });

  it('only a live dot pulses', () => {
    const { container } = render(
      <>
        <StatusDot tone="live" pulse />
        <StatusDot tone="ongoing" pulse />
      </>,
    );
    const [live, ongoing] = Array.from(container.children);

    expect(live).toHaveClass(PULSE_CLASS);
    expect(ongoing).not.toHaveClass(PULSE_CLASS);
  });
});
