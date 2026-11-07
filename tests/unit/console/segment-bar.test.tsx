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
 * literal bg-chart-n or bg-leet-* classes; parts at zero or without a real number draw nothing,
 * so a whole of zero is an empty track with no NaN width. The legend is a <dl> of name and en-US
 * amount in tabular figures, with a swatch per name, that stacks in narrow tiles. Its skeleton
 * holds each amount's place with '000' drawn in the legend's own type as invisible generated
 * content, so it is exactly as wide as a loaded three-digit amount (a ch width was 2px wider in
 * Geist) and no colour mode ever paints the zeros.
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

/** The same split in LeetCode's own difficulty colours, as the home tile draws it. */
const LEETCODE_TONED: readonly SegmentBarSegment[] = [
  { key: 'easy', label: 'Easy', value: 215, tone: 'leet-easy' },
  { key: 'medium', label: 'Medium', value: 379, tone: 'leet-medium' },
  { key: 'hard', label: 'Hard', value: 98, tone: 'leet-hard' },
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

  it('paints the named LeetCode tones with their own literal classes, parts and swatches', () => {
    const { parts, legend } = renderBar(LEETCODE_TONED);
    const swatches = Array.from(legend.querySelectorAll('dt > span'));
    const expected = ['bg-leet-easy', 'bg-leet-medium', 'bg-leet-hard'];

    expect(parts.map((part) => part.className)).toEqual(expected);
    expect(swatches).toHaveLength(3);
    for (const [index, swatch] of swatches.entries()) {
      expect(swatch).toHaveClass(expected[index] as string);
    }
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

  it("sets names and amounts in the tile's meta style (Geist, tabular), not a fourth mono style", () => {
    const { legend } = renderBar();

    // tile-meta: Geist 13/18 with tabular figures (globals.css), the stat tile's own meta line.
    expect(legend).toHaveClass('tile-meta', 'text-muted-foreground', 'gap-x-3.5');
    expect(legend).not.toHaveClass('font-mono');
    expect(legend).not.toHaveClass('text-label');
  });

  it('lets the amounts take the muted meta colour, with no colour of their own', () => {
    const { legend } = renderBar();

    for (const amount of legend.querySelectorAll('dd')) {
      expect(amount.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)text-/);
    }
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
    for (const level of ['easy', 'medium', 'hard']) expect(SOURCE).toContain(`'bg-leet-${level}'`);
    expect(SOURCE).not.toMatch(/`[^`]*bg-(?:chart|leet)-\$\{/);
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
      // The amounts have no type of their own in either: both take the legend's tile-meta.
      amounts: [...legend.querySelectorAll('dd')].map((amount) => amount.className),
    };
  };
  const skeletonOf = () => render(<SegmentBarSkeleton segments={LEETCODE} />).container;
  const shapesOf = (container: Element) => [...container.querySelectorAll('dd > [data-shape]')];

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

  it('keeps the names, with a placeholder for each amount', () => {
    const container = skeletonOf();

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect([...container.querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
    expect(shapesOf(container)).toHaveLength(3);
  });

  // In Geist tile-meta a ch is 9px and a tabular digit about 8.3px, so a 3ch bar was 2px wider
  // than '120' per amount and the skeleton legend wrapped where the loaded one did not.
  it("draws each amount's place as '000' in the legend's own type, never a ch width", () => {
    const shapes = shapesOf(skeletonOf());
    expect(shapes).toHaveLength(LEETCODE.length);
    for (const shape of shapes) {
      expect(shape).toHaveAttribute('data-shape', '000');
      expect(shape).toHaveClass(
        'before:content-[attr(data-shape)]',
        'bg-surface-3',
        'motion-safe:animate-pulse',
      );
      // No width, size or face of its own: the zeros' advance in the inherited tile-meta is it.
      expect(shape.className).not.toMatch(
        /(?:^|\s)(?:[\w-]*:)?(?:w|min-w|max-w|h|text|font|tile)-/,
      );
      expect(shape.tagName).toBe('SPAN');
    }
    expect(SOURCE).not.toMatch(/\[[\d.]+ch\]/);
  });

  it('holds no digit in the document: the zeros are generated content only', () => {
    const container = skeletonOf();

    for (const amount of container.querySelectorAll('dd')) expect(amount.textContent).toBe('');
    expect(container.textContent).not.toMatch(/\d/);
    expect(renderToString(<SegmentBarSkeleton segments={LEETCODE} />)).not.toMatch(/>[^<]*\d/);
  });

  // Forced colours (Windows Contrast themes) replace a transparent colour with the system text
  // colour and the bar's fill with Canvas: transparent zeros would read as real amounts.
  it('hides the zeros with visibility, never colour, and outlines the bar under forced colours', async () => {
    const shapes = shapesOf(skeletonOf());
    expect(shapes).toHaveLength(LEETCODE.length);
    for (const shape of shapes) {
      expect(shape).toHaveClass('before:invisible', 'forced-colors:outline');
      expect(shape.className).not.toMatch(/transparent|opacity-0|text-\[/);
    }

    const { build } = await compile('@tailwind utilities;');
    const css = build(['before:invisible', 'forced-colors:outline']);
    expect(css).toMatch(/::before\s*\{[^}]*visibility:\s*hidden/);
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{[^}]*outline-width:\s*1px/);
  });

  it('outlines the track placeholder under forced colours too, so every bar shows as a box', () => {
    const track = skeletonOf().querySelector('[data-segment-bar-placeholder] > span');

    expect(track).toHaveClass('h-2', 'w-full', 'bg-surface-3', 'forced-colors:outline');
  });

  // A console primitive: /stats may use it, so it never reaches into the home tiles.
  it('imports nothing from the app (the home tiles included)', () => {
    expect(SOURCE).not.toMatch(/from ['"]@\/app\//);
    expect(SOURCE).not.toMatch(/_components/);
  });
});
