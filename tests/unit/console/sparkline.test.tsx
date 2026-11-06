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
 * @file sparklinePoints spaces x evenly between 4-unit insets and scales y to the largest value
 * (never below 1), with negative, NaN and infinite values on the zero line and one value drawn as
 * a level line. Sparkline is a decorative svg (aria-hidden, not focusable) of an area and a line
 * in a stretched nested viewBox, plus an unscaled dot on the latest value; an empty list renders
 * nothing. The area tint compiles without color-mix().
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import * as consoleBarrel from '@/components/console';
import { Sparkline, sparklinePoints } from '@/components/console/sparkline';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = readFileSync(join(process.cwd(), 'src/components/console/sparkline.tsx'), 'utf8');

const PAD = 4;
const W = 240;
const H = 48;
const BASELINE = H - PAD;

function renderSparkline(element: Parameters<typeof render>[0]): SVGSVGElement {
  const { container } = render(element);
  const svg = container.firstElementChild;
  if (!(svg instanceof SVGSVGElement)) throw new Error('no root svg rendered');
  return svg;
}

function pathData(svg: SVGSVGElement): { area: string; line: string } {
  const [area, line] = Array.from(svg.querySelectorAll('path'));
  if (!area || !line) throw new Error('expected an area and a line path');
  return { area: area.getAttribute('d') ?? '', line: line.getAttribute('d') ?? '' };
}

describe('sparklinePoints', () => {
  it('spaces x evenly from the left inset to the right inset', () => {
    const points = sparklinePoints([1, 2, 3, 4], 100, 50);
    const xs = points.map(({ x }) => x);
    const steps = xs.slice(1).map((x, index) => x - (xs[index] ?? 0));

    expect(xs[0]).toBe(PAD);
    expect(xs.at(-1)).toBeCloseTo(100 - PAD, 10);
    for (const step of steps) expect(step).toBeCloseTo((100 - 2 * PAD) / 3, 10);
  });

  it('puts zero on the bottom inset and the largest value on the top inset', () => {
    expect(sparklinePoints([0, 5, 10], W, H)).toEqual([
      { x: PAD, y: BASELINE },
      { x: W / 2, y: 24 },
      { x: W - PAD, y: PAD },
    ]);
  });

  it('draws all zeros as a flat baseline, never NaN', () => {
    const points = sparklinePoints([0, 0, 0], W, H);

    expect(points.map(({ y }) => y)).toEqual([BASELINE, BASELINE, BASELINE]);
    expect(points.flatMap(({ x, y }) => [x, y]).some(Number.isNaN)).toBe(false);
  });

  it('never scales below 1, so a value under 1 stays low instead of filling the height', () => {
    const [point] = sparklinePoints([0.5, 0.5], W, H);

    expect(point?.y).toBe(BASELINE - 0.5 * (H - 2 * PAD));
  });

  it('draws one value as a level line across the whole box', () => {
    expect(sparklinePoints([7], W, H)).toEqual([
      { x: PAD, y: PAD },
      { x: W - PAD, y: PAD },
    ]);
  });

  it('clamps negative, NaN and infinite values to the zero line', () => {
    const points = sparklinePoints([-5, Number.NaN, Number.POSITIVE_INFINITY, 10], W, H);

    expect(points.map(({ y }) => y)).toEqual([BASELINE, BASELINE, BASELINE, PAD]);
  });

  it('returns no points for no values', () => {
    expect(sparklinePoints([], W, H)).toEqual([]);
  });

  it('draws flat rather than upside down in a box smaller than its insets', () => {
    const points = sparklinePoints([0, 10], W, 6);

    expect(points.map(({ y }) => y)).toEqual([6 - PAD, 6 - PAD]);
  });
});

describe('Sparkline', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<Sparkline values={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('is a decorative svg with one area path, one line path and one dot', () => {
    const svg = renderSparkline(<Sparkline values={[3, 1, 4, 1, 5]} />);

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelector('title')).toBeNull();
  });

  it('draws at its height and spans the container, merging the caller class', () => {
    const svg = renderSparkline(<Sparkline values={[1, 2]} height={56} className="mt-2" />);

    expect(svg).toHaveAttribute('height', '56');
    expect(svg).not.toHaveAttribute('viewBox');
    expect(svg).toHaveClass('block', 'w-full', 'mt-2');
  });

  it('stretches the area and line in a nested viewBox of the given size', () => {
    const svg = renderSparkline(<Sparkline values={[1, 2]} width={120} height={56} />);
    const drawing = svg.querySelector('svg');

    expect(drawing).toHaveAttribute('viewBox', '0 0 120 56');
    expect(drawing).toHaveAttribute('preserveAspectRatio', 'none');
    expect(drawing).toHaveAttribute('width', '100%');
    expect(drawing).toHaveAttribute('height', '100%');
    expect(drawing?.querySelectorAll('path')).toHaveLength(2);
  });

  it('draws the line through every point and closes the area down to the zero line', () => {
    const { area, line } = pathData(renderSparkline(<Sparkline values={[0, 5, 10]} />));

    expect(line).toBe('M4 44L120 24L236 4');
    expect(area).toBe('M4 44L4 44L120 24L236 4L236 44Z');
  });

  it('keeps two decimals in the path data', () => {
    const { line } = pathData(renderSparkline(<Sparkline values={[1, 2, 3]} width={100} />));

    expect(line).toBe('M4 30.67L50 17.33L96 4');
    const { line: thirds } = pathData(
      renderSparkline(<Sparkline values={[3, 3, 3, 3]} width={100} />),
    );
    expect(thirds).toBe('M4 4L34.67 4L65.33 4L96 4');
  });

  it('strokes a 2px brand line that does not thicken when stretched', () => {
    const line = renderSparkline(<Sparkline values={[1, 2]} />).querySelectorAll('path')[1];

    expect(line).toHaveClass('fill-none', 'stroke-brand');
    expect(line).toHaveAttribute('stroke-width', '2');
    expect(line).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  });

  it('fills the area with the literal brand wash token, not an opacity modifier', () => {
    const area = renderSparkline(<Sparkline values={[1, 2]} />).querySelector('path');

    expect(area?.getAttribute('class')).toBe('fill-(--brand-wash)');
    expect(area).not.toHaveAttribute('stroke');
    // An opacity-modified colour class compiles to full strength without color-mix(). Class
    // names live in quoted strings; the doc comment may name the anti-pattern.
    const literals = SOURCE.match(/'[^'\n]*'/g) ?? [];
    expect(literals).toContain(`'fill-(--brand-wash)'`);
    expect(
      literals.filter((text) => /\b(?:fill|stroke|bg|text)-[a-z0-9-]+\/\d+/.test(text)),
    ).toEqual([]);
  });

  it('puts a round 3px dot on the latest value, outside the stretched viewBox', () => {
    const svg = renderSparkline(<Sparkline values={[10, 0]} />);
    const dot = svg.querySelector('circle');

    // Percentages of the outer svg, which has no viewBox, so the radius stays in CSS pixels.
    expect(dot?.parentElement).toBe(svg);
    expect(dot).toHaveAttribute('cx', `${Number((((W - PAD) / W) * 100).toFixed(2))}%`);
    expect(dot).toHaveAttribute('cy', `${Number(((BASELINE / H) * 100).toFixed(2))}%`);
    expect(dot).toHaveAttribute('r', '3');
    expect(dot).toHaveClass('fill-foreground');
  });

  it('server-renders without NaN for zeros, a single value and bad values', () => {
    const html = [[0, 0, 0], [5], [-1, Number.NaN, 2]]
      .map((values) => renderToString(<Sparkline values={values} />))
      .join('');

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('is exported from the console barrel', () => {
    expect(consoleBarrel.Sparkline).toBe(Sparkline);
    expect(consoleBarrel.sparklinePoints).toBe(sparklinePoints);
  });
});

describe('Sparkline token classes', () => {
  it('compile the area tint to the translucent literal, without color-mix()', async () => {
    const { build } = await compile('@tailwind utilities;');
    const css = build(['fill-(--brand-wash)']);

    expect(css).toMatch(/fill:\s*var\(--brand-wash\)/);
    expect(css).not.toContain('color-mix');
  });
});
