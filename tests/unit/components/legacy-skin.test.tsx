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
 * @file The legacy MagicCard, Skeleton, Badge and Button in the Live Console tile language, and
 * the deprecation notes that point unmigrated code at the console components.
 *
 * Pages not yet redesigned keep these components, so their defaults carry the console surfaces:
 * hairline borders, surface fills, the one focus outline and translucent status tints.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MagicCard } from '@/components/magicui/magic-card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const SPOTLIGHT_SELECTOR = '[data-magic-card-spotlight]';
const STATUS_TONES = ['live', 'ongoing', 'down', 'info'] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

/** The event types added to `target` while `renderCard` runs. */
function listenersAddedTo(renderCard: () => HTMLElement): string[] {
  const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
  const target = renderCard();
  return spy.mock.calls
    .filter((_, index) => spy.mock.contexts[index] === target)
    .map(([type]) => type);
}

/**
 * Asserts that `element` has none of `names`, one assertion per class. jest-dom's
 * `.not.toHaveClass(a, b, c)` only proves the element lacks at least one of them, so a single
 * banned class coming back (rounded-tile beside a caller's rounded-3xl when tailwind-merge loses
 * its `radius: ['tile']` group) would still pass a combined check.
 */
function expectNoneOfClasses(element: HTMLElement, names: readonly string[]): void {
  for (const name of names) {
    expect(element, `still has the class ${name}`).not.toHaveClass(name);
  }
}

/** The MagicCard root around the text `text` (text > content wrapper > root). */
const cardRoot = (text: string): HTMLElement => {
  const root = screen.getByText(text).parentElement?.parentElement;
  if (!root) throw new Error(`no MagicCard root around "${text}"`);
  return root;
};

describe('MagicCard', () => {
  it('follows the pointer with a translucent brand spotlight by default', () => {
    let container: HTMLElement | undefined;
    const types = listenersAddedTo(() => {
      ({ container } = render(
        <MagicCard>
          <p>Lit card</p>
        </MagicCard>,
      ));
      return cardRoot('Lit card');
    });

    expect(types).toEqual(expect.arrayContaining(['mousemove', 'mouseleave']));
    const overlay = container?.querySelector(SPOTLIGHT_SELECTOR);
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    // A literal translucent token, never color-mix() or an off-palette rgba().
    const background = overlay?.getAttribute('style') ?? '';
    expect(background).toContain('var(--brand-wash)');
    expect(background).not.toMatch(/color-mix|rgba\(/);
  });

  it('renders no gradient overlay and adds no pointer listeners with spotlight={false}', () => {
    let container: HTMLElement | undefined;
    const types = listenersAddedTo(() => {
      ({ container } = render(
        <MagicCard spotlight={false}>
          <p>Still card</p>
        </MagicCard>,
      ));
      return cardRoot('Still card');
    });

    expect(types).not.toContain('mousemove');
    expect(types).not.toContain('mouseleave');
    expect(container?.querySelector(SPOTLIGHT_SELECTOR)).toBeNull();
    expect(cardRoot('Still card')).toHaveClass('border-hairline', 'bg-surface-1');
  });

  it("lets a legacy caller's border, radius and transition classes win", () => {
    render(
      <MagicCard className="rounded-3xl border-border/50 transition-all duration-500">
        <p>Legacy card</p>
      </MagicCard>,
    );

    const root = cardRoot('Legacy card');
    expect(root).toHaveClass('rounded-3xl', 'border-border/50', 'transition-all', 'duration-500');
    expectNoneOfClasses(root, ['rounded-tile', 'border-hairline', 'transition-colors']);
    expect(root).toHaveClass('bg-surface-1', 'hover:border-hairline-strong');
  });
});

describe('Skeleton', () => {
  it('pulses on surface-3, and not under reduced motion', () => {
    render(<Skeleton data-testid="skeleton" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('bg-surface-3', 'rounded-md');
    // `.animate-pulse` stays a plain class: loading checks across the stats, spotify and
    // guestbook tests select it. motion-reduce:animate-none stops it, as motion-safe: would.
    expect(skeleton).toHaveClass('animate-pulse', 'motion-reduce:animate-none');
    expect(skeleton.className).not.toMatch(/\bbg-primary\b/);
  });

  it("keeps a caller's own fill and radius", () => {
    render(<Skeleton data-testid="skeleton" className="h-6 w-20 rounded-full bg-muted/20" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('rounded-full', 'bg-muted/20', 'animate-pulse');
    expectNoneOfClasses(skeleton, ['bg-surface-3', 'rounded-md']);
  });
});

describe('Badge', () => {
  it.each(STATUS_TONES)(
    'the %s badge pairs its status text with a translucent tint token',
    (tone) => {
      render(<Badge variant={tone}>{tone} word</Badge>);

      const badge = screen.getByText(`${tone} word`);
      expect(badge.tagName).toBe('DIV');
      expect(badge).toHaveClass(`text-${tone}`, `bg-${tone}-tint`, 'border-transparent');
      // No opacity modifier: Tailwind's no-color-mix fallback for bg-<tone>/12 is full strength.
      expect(badgeVariants({ variant: tone })).not.toMatch(/\/\d/);
    },
  );

  it('outline is a hairline with muted text', () => {
    render(<Badge variant="outline">Outline</Badge>);

    expect(screen.getByText('Outline')).toHaveClass('border-hairline', 'text-muted-foreground');
  });

  it('default is the brand selected fill, secondary a surface, and neither is solid primary', () => {
    render(
      <>
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
      </>,
    );

    const primary = screen.getByText('Default');
    expect(primary).toHaveClass('bg-brand-subtle', 'text-brand-ink');
    expect(primary.className).not.toMatch(/\bbg-primary\b/);
    expect(screen.getByText('Secondary')).toHaveClass('bg-surface-3', 'text-foreground');
  });

  it('drops the focus ring for the global focus outline', () => {
    expect(badgeVariants()).not.toMatch(/\bfocus:ring|\bfocus:outline-none\b/);
  });
});

describe('Button', () => {
  it('focuses with the 2px console outline, not a 1px ring', () => {
    render(<Button>Send</Button>);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-focus',
    );
    expectNoneOfClasses(button, ['focus-visible:ring-1', 'focus-visible:outline-none']);
  });

  it('ghost and outline hover onto surface-3 with foreground text', () => {
    render(
      <>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </>,
    );

    const ghost = screen.getByRole('button', { name: 'Ghost' });
    expect(ghost).toHaveClass('hover:bg-surface-3', 'hover:text-foreground');
    expect(ghost).not.toHaveClass('hover:bg-accent');
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveClass(
      'border-hairline',
      'bg-surface-1',
      'hover:bg-surface-3',
    );
  });

  it('secondary is a surface-3 fill, and links styled as buttons get the same focus outline', () => {
    expect(buttonVariants({ variant: 'secondary' })).toMatch(/\bbg-surface-3\b/);
    expect(buttonVariants({ size: 'lg', variant: 'outline' })).toContain(
      'focus-visible:outline-focus',
    );
  });
});

describe('deprecations', () => {
  const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

  it.each([
    ['src/components/magicui/magic-card.tsx', 'Tile'],
    ['src/components/custom/page-header.tsx', 'PageShell'],
    ['src/components/ui/number-ticker.tsx', 'LiveNumber'],
    ['src/components/magicui/border-beam.tsx', 'Tile'],
  ])('%s is @deprecated in favour of the console %s', (path, replacement) => {
    const note = /@deprecated([\s\S]*?)\*\//.exec(read(path))?.[1] ?? '';
    expect(note).toContain(replacement);
    expect(note).toContain("'@/components/console'");
  });
});
