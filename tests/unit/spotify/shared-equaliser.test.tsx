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
 * @file /spotify draws the home now-playing tile's own equaliser, not a copy of it. The home tile
 * exports it from a server-safe module beside its stylesheet (no directive), so the Spotify server
 * components render it on the server, and both pages' bars come from one component.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/_components/home/live/equaliser.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? `eq-${name}` : undefined) },
  ),
}));

import { Equaliser } from '@/app/_components/home/live/equaliser';
import { ArtGlyph } from '@/app/(routes)/(main)/(personal)/spotify/_components/equaliser';

const source = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

describe('the shared equaliser', () => {
  it('is the home module the home tile itself uses, with no client directive', () => {
    const shared = source('src/app/_components/home/live/equaliser.tsx');
    const tile = source('src/app/_components/home/live/now-playing-tile.tsx');

    expect(shared).not.toMatch(/^\s*['"]use client['"]/m);
    expect(tile).toMatch(/import \{[^}]*\bEqualiser\b[^}]*\} from '\.\/equaliser';/);
    expect(tile).not.toMatch(/function Equaliser\(/);
  });

  it('is drawn by the Spotify art glyph, with no copy of its own', () => {
    const glyph = document.createElement('div');
    glyph.innerHTML = renderToString(<ArtGlyph className="size-10" live />);
    const bars = document.createElement('div');
    bars.innerHTML = renderToString(<Equaliser size="glyph" live />);

    expect(glyph.querySelector('[data-art-glyph]')?.innerHTML).toBe(bars.innerHTML);
    expect(
      source('src/app/(routes)/(main)/(personal)/spotify/_components/equaliser.tsx'),
    ).not.toMatch(/BAR_POSES|function Equaliser\(/);
  });

  it('keeps the bars the home tile drew: three, still and faint unless live', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(<Equaliser size="inline" live={false} />);
    const equaliser = root.querySelector('[data-equaliser]');

    expect(equaliser).toHaveAttribute('data-equaliser', 'still');
    expect(equaliser).toHaveAttribute('aria-hidden', 'true');
    expect(equaliser?.className).toBe('eq-bars');
    expect(Array.from(equaliser?.children ?? [], (bar) => bar.className)).toEqual([
      'eq-bar eq-still eq-low',
      'eq-bar eq-still eq-high',
      'eq-bar eq-still eq-mid',
    ]);
  });
});
