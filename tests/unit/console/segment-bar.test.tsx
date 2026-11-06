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
 * @file SegmentBar draws parts sized by their share of the whole on a decorative 8px track, in
 * the literal bg-chart-n classes; parts at zero or without a real number draw nothing, so a whole
 * of zero is an empty track with no NaN width. The legend is a <dl> of name and en-US amount in
 * tabular figures, with a swatch per name, that stacks in narrow tiles.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import * as consoleBarrel from '@/components/console';
import {
  SegmentBar,
  type SegmentBarSegment,
  SegmentBarSkeleton,
} from '@/components/console/segment-bar';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = readFileSync(join(process.cwd(), 'src/components/console/segment-bar.tsx'), 'utf8');

const LEETCODE: readonly SegmentBarSegment[] = [
  { key: 'easy', label: 'Easy', value: 215, tone: 1 },
  { key: 'medium', label: 'Medium', value: 379, tone: 2 },
  { key: 'hard', label: 'Hard', value: 98, tone: 3 },
];

interface RenderedBar {
  root: HTMLElement;
  track: HTMLElement;
  parts: HTMLElement[];
  legend: HTMLElement;
}

function renderBar(
  segments: readonly SegmentBarSegment[] = LEETCODE,
  className?: string,
): RenderedBar {
  const { container } = render(<SegmentBar segments={segments} className={className} />);
  const root = container.firstElementChild;
  const track = container.querySelector<HTMLElement>('[data-segment-track]');
  const legend = container.querySelector<HTMLElement>('dl');
  if (!(root instanceof HTMLElement) || !track || !legend) throw new Error('bar not rendered');
  return { root, track, parts: Array.from(track.children) as HTMLElement[], legend };
}

function widthOf(part: HTMLElement): number {
  return Number.parseFloat(part.style.width);
}

describe('SegmentBar track', () => {
  it('sizes each part by its share of the whole', () => {
    const { parts } = renderBar();
    const total = 215 + 379 + 98;

    expect(parts).toHaveLength(3);
    expect(widthOf(parts[0] as HTMLElement)).toBeCloseTo((215 / total) * 100, 2);
    expect(widthOf(parts[1] as HTMLElement)).toBeCloseTo((379 / total) * 100, 2);
    expect(widthOf(parts[2] as HTMLElement)).toBeCloseTo((98 / total) * 100, 2);
    expect(parts.reduce((sum, part) => sum + widthOf(part), 0)).toBeCloseTo(100, 2);
  });

  it('paints the parts with the chart tones in bar order', () => {
    const { parts } = renderBar();

    expect(parts.map((part) => part.className)).toEqual(['bg-chart-1', 'bg-chart-2', 'bg-chart-3']);
    expect(parts.map((part) => part.dataset.segment)).toEqual(['easy', 'medium', 'hard']);
  });

  it('is a decorative, rounded 8px track with a 2px gap between parts', () => {
    const { track } = renderBar();

    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(track).toHaveClass('flex', 'h-2', 'gap-0.5', 'overflow-hidden', 'rounded-full');
    expect(track).toHaveClass('bg-surface-2');
  });

  it('draws an empty track for a whole of zero, with no NaN width', () => {
    const zeros = LEETCODE.map((segment) => ({ ...segment, value: 0 }));
    const { track, parts } = renderBar(zeros);

    expect(parts).toHaveLength(0);
    expect(track).toBeInTheDocument();
    expect(renderToString(<SegmentBar segments={zeros} />)).not.toContain('NaN');
  });

  it('draws nothing for a part at zero, so no stray gap sits between its neighbours', () => {
    const { parts } = renderBar([
      { key: 'easy', label: 'Easy', value: 30, tone: 1 },
      { key: 'medium', label: 'Medium', value: 0, tone: 2 },
      { key: 'hard', label: 'Hard', value: 10, tone: 3 },
    ]);

    expect(parts.map((part) => part.dataset.segment)).toEqual(['easy', 'hard']);
    expect(parts.map(widthOf)).toEqual([75, 25]);
  });

  it('gives negative, NaN and infinite values no width and keeps them out of the whole', () => {
    const { parts } = renderBar([
      { key: 'a', label: 'A', value: -4, tone: 1 },
      { key: 'b', label: 'B', value: Number.NaN, tone: 2 },
      { key: 'c', label: 'C', value: Number.POSITIVE_INFINITY, tone: 3 },
      { key: 'd', label: 'D', value: 5, tone: 4 },
    ]);

    expect(parts.map((part) => part.dataset.segment)).toEqual(['d']);
    expect(parts.map(widthOf)).toEqual([100]);
  });
});

describe('SegmentBar legend', () => {
  it('lists each name then its amount, in bar order', () => {
    const { legend } = renderBar();
    const items = Array.from(legend.children);

    expect(items.map((item) => item.querySelector('dt')?.textContent)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
    expect(items.map((item) => item.querySelector('dd')?.textContent)).toEqual([
      '215',
      '379',
      '98',
    ]);
    expect(items.map((item) => item.textContent)).toEqual(['Easy 215', 'Medium 379', 'Hard 98']);
  });

  it('sets the amounts in tabular figures, in the mono label style', () => {
    const { legend } = renderBar();

    expect(legend).toHaveClass('tabular-nums', 'font-mono', 'text-label', 'text-muted-foreground');
  });

  it('formats amounts in en-US', () => {
    const { legend } = renderBar([{ key: 'all', label: 'All', value: 1234567, tone: 1 }]);

    expect(within(legend).getByText('1,234,567')).toBeInTheDocument();
  });

  it('ties each name to its part with a decorative swatch of the same tone', () => {
    const { legend } = renderBar();
    const swatches = Array.from(legend.querySelectorAll('dt > span'));

    expect(swatches).toHaveLength(3);
    for (const swatch of swatches) expect(swatch).toHaveAttribute('aria-hidden', 'true');
    expect(swatches[0]).toHaveClass('bg-chart-1');
    expect(swatches[1]).toHaveClass('bg-chart-2');
    expect(swatches[2]).toHaveClass('bg-chart-3');
  });

  it('says "unavailable" beside a dash for an amount that is not a number, never NaN', () => {
    const { legend } = renderBar([{ key: 'x', label: 'Medium', value: Number.NaN, tone: 2 }]);
    const amount = legend.querySelector('dd');

    expect(amount?.textContent).toBe('—unavailable');
    expect(within(amount as HTMLElement).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(amount as HTMLElement).getByText('unavailable')).toHaveClass('sr-only');
  });

  it('stacks its items when the bar is narrower than 12rem', () => {
    const { root, legend } = renderBar(LEETCODE, 'mt-3');

    expect(root).toHaveClass('@container', 'mt-3');
    expect(legend).toHaveClass('flex', 'flex-wrap', '@max-[12rem]:flex-col');
  });
});

describe('SegmentBar classes', () => {
  it('writes every tone as a literal class, never built from a template', () => {
    for (const tone of [1, 2, 3, 4, 5, 6]) expect(SOURCE).toContain(`'bg-chart-${tone}'`);
    expect(SOURCE).not.toMatch(/`[^`]*bg-chart-\$\{/);
  });

  it('compile with the repo Tailwind: the narrow-tile stack is a container query', async () => {
    const { build } = await compile('@tailwind utilities;');
    const css = build(['@max-[12rem]:flex-col']);

    expect(css).toMatch(/@container \(width < 12rem\)/);
    expect(css).toContain('flex-direction: column');
  });

  it('is exported from the console barrel', () => {
    expect(consoleBarrel.SegmentBar).toBe(SegmentBar);
    expect(consoleBarrel.SegmentBarSkeleton).toBe(SegmentBarSkeleton);
  });
});

describe('SegmentBarSkeleton', () => {
  /** The class names of the legend, its items and its terms, which decide where it wraps. */
  const legendClasses = (root: Element) => {
    const legend = root.querySelector('dl');
    if (!legend) throw new Error('no legend');
    return {
      legend: legend.className,
      items: [...legend.children].map((item) => item.className),
      terms: [...legend.querySelectorAll('dt')].map((term) => term.className),
    };
  };

  it('wraps where the loaded legend does: the same container and legend classes', () => {
    const loaded = render(<SegmentBar segments={LEETCODE} />).container;
    const loadedRoot = loaded.querySelector('[data-segment-bar]');
    const skeleton = render(<SegmentBarSkeleton segments={LEETCODE} />).container;
    const skeletonRoot = skeleton.querySelector('[data-segment-bar-placeholder]');
    if (!(loadedRoot && skeletonRoot)) throw new Error('a root is missing');

    expect(skeletonRoot).toHaveClass('@container');
    expect(loadedRoot).toHaveClass('@container');
    expect(legendClasses(skeletonRoot)).toEqual(legendClasses(loadedRoot));
  });

  it('keeps the names, with a three-digit bar on one label line for each amount', () => {
    const { container } = render(<SegmentBarSkeleton segments={LEETCODE} />);
    const root = container.firstElementChild;

    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect([...container.querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
    for (const amount of container.querySelectorAll('dd')) {
      expect(amount).toHaveClass('h-4');
      expect(amount.firstElementChild).toHaveClass('w-[3ch]', 'motion-safe:animate-pulse');
    }
  });
});
