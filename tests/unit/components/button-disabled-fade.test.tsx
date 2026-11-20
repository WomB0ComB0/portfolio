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
 * @file Button's disabled look, checked against the CSS the repo's Tailwind compiles from each
 * variant's classes (audit 2026-11-20 leftover, WCAG 1.4.11 / 2.4.7). An aria-disabled button
 * keeps focus, and fading it whole to half opacity faded its focus ring with it (8.9:1 down to
 * 3.0:1 on the canvas). Now:
 * - while its ring is hidden it fades whole, exactly as a `disabled` one does, in every variant, so
 *   nothing changes at rest;
 * - while its ring shows (:focus-visible) the button itself is never faded: its words, its icons,
 *   (for a variant drawn by its fill) its fill and (for outline) its hairline fade instead, and the
 *   sign-out link, an outline Button repainted as text, gets no fill back;
 * - a `disabled` button, which can't take focus, still fades whole.
 */

import { cleanup, render, screen } from '@testing-library/react';
import postcss from 'postcss';
import { compile } from 'tailwindcss';
import { afterEach, describe, expect, it } from 'vitest';

import { TEXT_BUTTON_CLASS } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook-classes';
import { Button, type ButtonProps } from '@/components/ui/button';

afterEach(cleanup);

type Variant = NonNullable<ButtonProps['variant']>;

const VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
/** The variants drawn by their fill alone, whose fill fades while the ring shows. */
const FILLS: Readonly<Partial<Record<Variant, string>>> = {
  default: 'primary',
  destructive: 'destructive',
  secondary: 'surface-3',
};
/** The variants with a border of their own, whose border fades while the ring shows. */
const BORDERS: Readonly<Partial<Record<Variant, string>>> = { outline: 'hairline' };

/** Synthetic values for the theme tokens the classes name, so every colour utility compiles. */
const THEME = `@theme {
  --color-primary: #8884d5; --color-primary-foreground: #0c0c14;
  --color-destructive: #813933; --color-destructive-foreground: #eeeef5;
  --color-surface-1: #13121c; --color-surface-3: #252534; --color-hairline: #2c2b3c;
  --color-foreground: #eeeef5; --color-canvas: #0c0c14; --color-focus: #a8a4f0;
}`;

/** One compiled declaration and the selector of the rule it sits in. */
interface Declaration {
  readonly selector: string;
  readonly prop: string;
  readonly value: string;
}

/** The rule a declaration sits in, through any @media or @supports inside it. */
function ruleOf(node: postcss.Node): postcss.Rule | null {
  let at: postcss.Node | undefined = node.parent;
  while (at && at.type !== 'rule') at = at.parent;
  return at?.type === 'rule' ? (at as postcss.Rule) : null;
}

/** Every declaration the classes compile to (fallbacks under @supports included). */
async function declarationsOf(classes: readonly string[]): Promise<Declaration[]> {
  const { build } = await compile(`${THEME}\n@tailwind utilities;`);
  const found: Declaration[] = [];
  postcss.parse(build([...classes])).walkDecls((decl) => {
    const rule = ruleOf(decl);
    if (rule) found.push({ selector: rule.selector, prop: decl.prop, value: decl.value });
  });
  return found;
}

/** The classes a Button renders with. */
function classesOf(props: ButtonProps): string[] {
  render(<Button {...props}>Post message</Button>);
  return (screen.getByRole('button').getAttribute('class') ?? '').split(/\s+/);
}

const ARIA_DISABLED = '[aria-disabled="true"]';
const REST = ':not(:focus-visible)';
/** An aria-disabled rule that applies only while the ring is hidden. */
const onlyAtRest = ({ selector }: Declaration): boolean =>
  selector.includes(ARIA_DISABLED) && selector.includes(REST);
/**
 * An aria-disabled rule that applies while the ring shows: every one but those only for when it is
 * hidden. A rule on `[aria-disabled="true"]` alone counts, as it applies whatever the focus (the old
 * `aria-disabled:opacity-50` was one).
 */
const whileRingShows = (declaration: Declaration): boolean =>
  declaration.selector.includes(ARIA_DISABLED) && !onlyAtRest(declaration);
/** An aria-disabled rule that applies only while the ring shows. */
const onlyWhileRingShows = (declaration: Declaration): boolean =>
  whileRingShows(declaration) && declaration.selector.includes(':focus-visible');
/** A rule that styles the button itself, not something inside it (its icons). */
const onTheButton = ({ selector }: Declaration): boolean => !/\s/.test(selector.trim());

describe('an aria-disabled Button', () => {
  it.each(VARIANTS)(
    '%s: fades whole while its ring is hidden, as a disabled one does',
    async (variant) => {
      const declarations = await declarationsOf(classesOf({ variant, 'aria-disabled': true }));
      const atRest = declarations.filter(onlyAtRest);
      const disabled = declarations.filter(({ selector }) => selector.includes(':disabled'));

      expect(atRest.map(({ prop, value }) => [prop, value])).toEqual([['opacity', '50%']]);
      expect(disabled).toContainEqual(expect.objectContaining({ prop: 'opacity', value: '50%' }));
      // Nothing else is aria-disabled's at rest but the cursor and no transitions: the look at rest
      // is the variant's own, at half opacity, as before.
      const otherwise = declarations.filter(
        (declaration) => whileRingShows(declaration) && !onlyWhileRingShows(declaration),
      );
      expect(otherwise.map(({ prop, value }) => `${prop}: ${value}`).sort()).toEqual([
        'cursor: not-allowed',
        'transition-property: none',
      ]);
    },
  );

  it.each(VARIANTS)(
    '%s: never fades itself, and so its ring, while the ring shows',
    async (variant) => {
      const declarations = await declarationsOf(classesOf({ variant, 'aria-disabled': true }));
      // Every aria-disabled rule that is not only for when the ring is hidden, so one on the
      // attribute alone, which applies whatever the focus, is caught here too.
      const ringShown = declarations.filter(whileRingShows);

      expect(ringShown.filter(onTheButton).map(({ prop }) => prop)).not.toContain('opacity');
      expect(ringShown.map(({ prop }) => prop)).not.toContain('filter');
      // The ring itself is the one every Button has.
      expect(declarations).toContainEqual(
        expect.objectContaining({
          selector: expect.stringMatching(/:focus-visible$/),
          prop: 'outline-width',
          value: '2px',
        }),
      );
    },
  );

  it.each(VARIANTS)(
    '%s: fades its words, icons, fill and border instead while the ring shows',
    async (variant) => {
      const ringShown = (
        await declarationsOf(classesOf({ variant, 'aria-disabled': true }))
      ).filter(whileRingShows);
      const on = (prop: string) => ringShown.filter((declaration) => declaration.prop === prop);

      // Words, halfway to the canvas, by the fill colour of the text alone: the button's colour (its
      // border's and its icons') is left as it is.
      expect(on('-webkit-text-fill-color').map(({ value }) => value)).toContain(
        'color-mix(in srgb,currentColor 50%,var(--color-canvas))',
      );
      expect(on('color')).toEqual([]);
      // Icons, to half opacity.
      expect(on('opacity').filter((declaration) => !onTheButton(declaration))).toContainEqual(
        expect.objectContaining({ selector: expect.stringMatching(/ svg$/), value: '50%' }),
      );
      // A variant drawn by its fill alone: the fill to half alpha. The others keep theirs.
      const fill = FILLS[variant];
      const fills = on('background-color').map(({ value }) => value);
      if (fill) {
        expect(fills).toContain(`color-mix(in oklab, var(--color-${fill}) 50%, transparent)`);
      } else {
        expect(fills).toEqual([]);
      }
      // A variant with a border of its own (outline): its hairline to half alpha too.
      const border = BORDERS[variant];
      const borders = on('border-color').map(({ value }) => value);
      if (border) {
        expect(borders).toContain(`color-mix(in oklab, var(--color-${border}) 50%, transparent)`);
      } else {
        expect(borders).toEqual([]);
      }
    },
  );

  it('gives the sign-out link, an outline Button repainted as text, no fill back', async () => {
    const declarations = await declarationsOf(
      classesOf({ variant: 'outline', 'aria-disabled': true, className: TEXT_BUTTON_CLASS }),
    );

    // Its own repaint holds, and nothing paints a box back behind it while the ring shows.
    expect(declarations).toContainEqual(
      expect.objectContaining({ prop: 'background-color', value: 'transparent' }),
    );
    expect(declarations.filter(whileRingShows).map(({ prop }) => prop)).not.toContain(
      'background-color',
    );
  });

  it('stays focusable, so a keyboard user keeps their place', () => {
    render(<Button aria-disabled>Post message</Button>);
    const button = screen.getByRole('button', { name: 'Post message' });

    button.focus();

    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
  });
});

describe('a disabled Button', () => {
  it.each(VARIANTS)(
    '%s: still fades whole, with pointer events off, whatever its focus',
    async (variant) => {
      const disabled = (await declarationsOf(classesOf({ variant, disabled: true }))).filter(
        ({ selector }) => selector.includes(':disabled'),
      );

      expect(disabled.map(({ prop, value }) => `${prop}: ${value}`).sort()).toEqual([
        'opacity: 50%',
        'pointer-events: none',
      ]);
      expect(disabled.every(({ selector }) => !selector.includes('focus-visible'))).toBe(true);
    },
  );

  it('cannot take focus, so it never shows a ring to fade', () => {
    render(<Button disabled>Post message</Button>);
    const button = screen.getByRole('button', { name: 'Post message' });

    button.focus();

    expect(button).toBeDisabled();
    expect(button).not.toHaveFocus();
  });
});
