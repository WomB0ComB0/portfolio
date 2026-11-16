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
 * @file Button in forced colours (Windows High Contrast), checked against the CSS the repo's
 * Tailwind compiles from each variant's classes. Forced colours remove backgrounds, so a variant
 * drawn by its fill alone (default, secondary, destructive) would leave bare words: those get a
 * 1px border in the system colour there, and none at the usual colours, so their size holds.
 * Outline has its border always; ghost and link read as text by design and get none.
 */

import { render, screen } from '@testing-library/react';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import { Button, type ButtonProps } from '@/components/ui/button';

type Variant = NonNullable<ButtonProps['variant']>;

const FORCED = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\}\s*\}/g;

/** The compiled CSS for one variant's classes, split into its forced-colours rules and the rest. */
async function cssOf(variant: Variant): Promise<{ forced: string; usual: string }> {
  render(<Button variant={variant}>{variant}</Button>);
  const classes = (screen.getByRole('button', { name: variant }).getAttribute('class') ?? '').split(
    /\s+/,
  );
  const { build } = await compile('@tailwind utilities;');
  const css = build(classes);
  const forced = Array.from(css.matchAll(FORCED), (match) => match[1]).join('\n');
  return { forced, usual: css.replace(FORCED, '') };
}

const BORDER_WIDTH = /border(?:-top)?-width:\s*1px/;

describe('Button in forced colours', () => {
  it.each(['default', 'secondary', 'destructive'] as const)(
    'gives the %s variant, drawn by its fill alone, a border there and none otherwise',
    async (variant) => {
      const { forced, usual } = await cssOf(variant);

      expect(forced).toMatch(BORDER_WIDTH);
      expect(usual).not.toMatch(/border(?:-top)?-width/);
    },
  );

  it('keeps the outline variant’s own border at every colour scheme', async () => {
    const { usual } = await cssOf('outline');
    expect(usual).toMatch(BORDER_WIDTH);
  });

  it.each(['ghost', 'link'] as const)(
    'leaves the %s variant text-like: no border in forced colours',
    async (variant) => {
      const { forced, usual } = await cssOf(variant);

      expect(forced).not.toMatch(/border/);
      expect(usual).not.toMatch(/border(?:-top)?-width/);
    },
  );
});
