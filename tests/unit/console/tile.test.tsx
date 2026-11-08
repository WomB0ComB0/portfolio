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
 * @file Tile renders its four variants as documented: plain and raised are surfaces, interactive
 * is one link (prefetch off unless asked) or, with nowhere to go, a plain tile, linked is an
 * element that rings itself for its TileLink, and only the last two carry the spotlight and the
 * hover. It renders on the server as is. tile-focus-ring.test.tsx checks the ring's compiled CSS
 * and tile-hover.test.tsx the hover's.
 *
 * jsdom applies no Tailwind CSS, so looks are checked as the classes that produce them. next/link
 * is replaced by a plain anchor that shows the prefetch it was given as data-prefetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { compile } from 'tailwindcss';
import { describe, expect, it, vi } from 'vitest';

import { Tile, type TileProps, tileVariants } from '@/components/console/tile';

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

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = join(process.cwd(), 'src/components/console/tile.tsx');

/** The hover the owner picked (Fluid UI Lab, lane B's motion with the Before colours). */
const LIFT_CLASSES = [
  'spotlight',
  // the move: translate (and the raise) only, on the spring
  'z-0',
  'hover:z-1',
  'transition-[translate,z-index]',
  'ease-[var(--ease-spring),linear]',
  'duration-[var(--motion-spring-out),0s]',
  'delay-[0s,var(--motion-slow)]',
  'hover:-translate-y-0.75',
  'hover:duration-[var(--motion-spring-in),0s]',
  'hover:delay-0',
  'active:translate-y-0',
  'active:duration-(--motion-instant)',
  'motion-reduce:hover:translate-y-0',
  // the light: one ::after layer, opacity only
  'after:shadow-lift',
  'after:opacity-0',
  'after:transition-opacity',
  'after:ease-effect',
  'after:duration-(--motion-slow)',
  'hover:after:opacity-100',
  'hover:after:duration-(--motion-base)',
];

/** Today's hover before the owner's pick: a snap on ease-out-expo and a border-colour step. */
const OLD_LIFT_CLASSES = [
  'hover:-translate-y-0.5',
  'hover:border-hairline-strong',
  'transition-[translate,border-color]',
  'duration-(--motion-fast)',
  'ease-out-expo',
];

const LINK_RING_CLASSES = [
  'has-[[data-tile-link]:focus-visible]:outline-2',
  'has-[[data-tile-link]:focus-visible]:outline-offset-2',
  'has-[[data-tile-link]:focus-visible]:outline-focus',
];

/** The `hero` brand wash: translucent brand over the variant's own background colour. */
const HERO_WASH = 'bg-[linear-gradient(160deg,var(--brand-wash),transparent_60%)]';

/** Renders a tile whose only content is a text node, so that text's element is the tile root. */
function renderTile(props: TileProps): HTMLElement {
  render(<Tile {...props}>Tile body</Tile>);
  return screen.getByText('Tile body');
}

describe('Tile variants', () => {
  it('plain is a hairline surface-1 div with the shared tile shape', () => {
    const tile = renderTile({});

    expect(tile.tagName).toBe('DIV');
    expect(tile).toHaveClass(
      'relative',
      'isolate',
      'flex',
      'min-w-0',
      'flex-col',
      'rounded-tile',
      'border',
      'border-hairline',
      'bg-surface-1',
      'text-foreground',
      '@container',
      'group/tile',
      'p-4',
      '@md:p-5',
    );
  });

  it('raised is surface-2 with the raised shadow', () => {
    const tile = renderTile({ variant: 'raised' });

    expect(tile).toHaveClass('border-hairline', 'bg-surface-2', 'shadow-raised');
    expect(tile).not.toHaveClass('bg-surface-1');
  });

  it.each([
    ['plain', false],
    ['raised', false],
    ['interactive', true],
    ['linked', true],
  ] as const)('%s carries the spotlight and lift: %s', (variant, spotlit) => {
    const props: TileProps =
      variant === 'interactive' ? { variant, href: '/projects' } : { variant };
    const tile = renderTile(props);

    if (spotlit) {
      expect(tile).toHaveAttribute('data-spotlight', '');
      expect(tile).toHaveClass(...LIFT_CLASSES);
    } else {
      expect(tile).not.toHaveAttribute('data-spotlight');
      expect(tile).not.toHaveClass('spotlight');
      expect(tile).not.toHaveClass('hover:-translate-y-0.75');
      expect(tile).not.toHaveClass('hover:z-1');
    }
    for (const oldClass of OLD_LIFT_CLASSES) expect(tile).not.toHaveClass(oldClass);
  });

  it.each([
    ['interactive', 'focus-visible:'],
    ['linked', 'has-[[data-tile-link]:focus-visible]:'],
  ] as const)('%s shows the light and the raise at once under keyboard focus', (variant, focus) => {
    const props: TileProps =
      variant === 'interactive' ? { variant, href: '/projects' } : { variant };

    expect(renderTile(props)).toHaveClass(
      `${focus}z-1`,
      `${focus}delay-0`,
      `${focus}after:opacity-100`,
      `${focus}after:duration-0`,
    );
  });
});

describe('interactive Tile', () => {
  it('is one internal link with prefetch off by default', () => {
    render(
      <Tile variant="interactive" href="/projects">
        Projects
      </Tile>,
    );

    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link).toHaveAttribute('href', '/projects');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link).not.toHaveAttribute('target');
  });

  it('passes an explicit prefetch to next/link', () => {
    render(
      <Tile variant="interactive" href="/stats" prefetch>
        Stats
      </Tile>,
    );

    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('data-prefetch', 'true');
  });

  it('opens an external href in a new tab and says so to screen readers', () => {
    render(
      <Tile variant="interactive" href="https://github.com/WomB0ComB0" external>
        GitHub
      </Tile>,
    );

    const link = screen.getByRole('link', { name: 'GitHub (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://github.com/WomB0ComB0');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('data-spotlight', '');
    // A plain anchor, not next/link: there is nothing to prefetch on another site.
    expect(link).not.toHaveAttribute('data-prefetch');
    expect(screen.getByText('(opens in a new tab)')).toHaveClass('sr-only');
  });

  it.each([
    ['empty', '', false],
    ['blank', '  ', false],
    ['bare #', '#', false],
    ['external #', '#', true],
  ])('with an %s href is a plain tile: no link, lift or spotlight', (_case, href, external) => {
    const tile = renderTile({ variant: 'interactive', href, external, prefetch: true });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('(opens in a new tab)')).not.toBeInTheDocument();
    expect(tile.tagName).toBe('DIV');
    expect(tile).toHaveClass('border-hairline', 'bg-surface-1');
    expect(tile).not.toHaveClass('spotlight', 'hover:-translate-y-0.75');
    for (const attribute of ['href', 'target', 'external', 'prefetch', 'data-spotlight']) {
      expect(tile).not.toHaveAttribute(attribute);
    }
  });

  it('keeps its other props when it falls back to a plain tile', () => {
    const tile = renderTile({
      variant: 'interactive',
      href: '',
      tone: 'hero',
      padding: 'lg',
      id: 'projects',
      'aria-label': 'Projects',
    });

    expect(tile).toHaveClass('p-6', '@md:p-8');
    expect(tile.className).toContain('bg-[linear-gradient(160deg,');
    expect(tile).toHaveAttribute('id', 'projects');
    expect(tile).toHaveAttribute('aria-label', 'Projects');
  });

  it.each([
    ['an internal', false, '/projects'],
    ['an external', true, 'https://github.com/WomB0ComB0'],
  ])('links %s href without the spaces and nbsp around it', (_case, external, destination) => {
    render(
      <Tile variant="interactive" href={`  ${destination}  `} external={external}>
        Projects
      </Tile>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', destination);
  });
});

describe('linked Tile', () => {
  it('is not a link and rings itself while its TileLink has keyboard focus', () => {
    const tile = renderTile({ variant: 'linked' });

    expect(tile.tagName).toBe('DIV');
    expect(tile).toHaveClass(...LINK_RING_CLASSES);
    expect(tile.className).not.toContain('has-[a:focus-visible]');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('marks itself for TileLink, which then hides its own ring', () => {
    expect(renderTile({ variant: 'linked' })).toHaveAttribute('data-linked-tile', '');
  });

  it.each(['plain', 'raised'] as const)('%s is not marked as a linked tile', (variant) => {
    expect(renderTile({ variant })).not.toHaveAttribute('data-linked-tile');
  });

  it('renders as the requested element', () => {
    expect(renderTile({ variant: 'linked', as: 'article' }).tagName).toBe('ARTICLE');
  });

  it.each(['plain', 'raised'] as const)('%s has no link focus ring', (variant) => {
    const tile = renderTile({ variant });

    for (const ringClass of LINK_RING_CLASSES) expect(tile).not.toHaveClass(ringClass);
  });
});

describe('Tile options', () => {
  it('renders as an li for a TileGrid list', () => {
    render(
      <ul>
        <Tile as="li">Item</Tile>
      </ul>,
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('Item');
  });

  it('adds the span classes it is given, and none without a span', () => {
    const spanned = renderTile({ span: { base: 2, md: 3, lg: 6, rows: 2 } });
    expect(spanned).toHaveClass(
      'col-span-2',
      '@xl/tiles:col-span-3',
      '@4xl/tiles:col-span-6',
      '@4xl/tiles:row-span-2',
    );

    render(<Tile>Unspanned</Tile>);
    expect(screen.getByText('Unspanned').className).not.toMatch(/col-span/);
  });

  it('applies tone and padding', () => {
    const hero = renderTile({ tone: 'hero', padding: 'lg' });
    expect(hero.className).toContain('bg-[linear-gradient(160deg,');
    expect(hero).toHaveClass('p-6', '@md:p-8');
  });

  it.each([
    ['plain', 'surface-1'],
    ['interactive', 'surface-1'],
    ['linked', 'surface-1'],
    ['raised', 'surface-2'],
  ] as const)('the hero wash on a %s tile sits over its own %s', (variant, surface) => {
    const classes = tileVariants({ variant, tone: 'hero' }).split(' ');
    const washes = classes.filter((name) => name.startsWith('bg-[linear-gradient('));

    // One translucent wash, and the variant's own surface colour under it.
    expect(washes).toEqual([HERO_WASH]);
    expect(classes).toContain(`bg-${surface}`);
  });

  it('a raised hero tile keeps its raised surface and shadow under the wash', () => {
    const tile = renderTile({ variant: 'raised', tone: 'hero' });

    expect(tile).toHaveClass('bg-surface-2', 'shadow-raised', HERO_WASH);
    expect(tile.className).not.toContain('var(--surface-1)');
  });

  it('draws no wash for the default tone', () => {
    for (const variant of ['plain', 'raised', 'interactive', 'linked'] as const) {
      expect(tileVariants({ variant })).not.toContain('linear-gradient');
    }
  });

  it('writes the wash as one literal class that compiles to a gradient without color-mix', async () => {
    const source = readFileSync(SOURCE, 'utf8');
    const { build } = await compile('@tailwind utilities;');
    const css = build([HERO_WASH]);

    expect(source).toContain(`'${HERO_WASH}'`);
    expect(css).toContain('linear-gradient(160deg,var(--brand-wash),transparent 60%)');
    // Tailwind's no-color-mix fallback would paint full-strength brand.
    expect(css).not.toContain('color-mix');
  });

  it('padding="none" is flush at every container width', () => {
    const flush = renderTile({ padding: 'none' });

    expect(flush).toHaveClass('p-0');
    expect(flush.className).not.toMatch(/(?:^|\s)(?:@\w+:)?p-[1-9]/);
  });

  it('lets the caller className win a conflict with an unprefixed class', () => {
    const tile = renderTile({ className: 'bg-surface-2 rounded-none' });

    expect(tile).toHaveClass('bg-surface-2', 'rounded-none');
    expect(tile).not.toHaveClass('bg-surface-1');
    expect(tile).not.toHaveClass('rounded-tile');
  });

  it('does not let className replace the container-width padding: use the padding prop', () => {
    // Documented on Tile: tailwind-merge keeps `@md:p-5` beside a caller's `p-0`.
    const tile = renderTile({ className: 'p-0' });

    expect(tile).toHaveClass('p-0', '@md:p-5');
    expect(tile).not.toHaveClass('p-4');
  });

  it('passes ARIA and HTML attributes to its root', () => {
    const tile = renderTile({ as: 'section', id: 'now', 'aria-labelledby': 'now-heading' });

    expect(tile.tagName).toBe('SECTION');
    expect(tile).toHaveAttribute('id', 'now');
    expect(tile).toHaveAttribute('aria-labelledby', 'now-heading');
  });
});

describe('Tile on the server', () => {
  it('renders to a string with the link and spotlight in the HTML', () => {
    const html = renderToString(
      <Tile variant="interactive" href="/places" span={{ lg: 6 }}>
        Places
      </Tile>,
    );

    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/places"');
    expect(html).toContain('data-spotlight=""');
    expect(html).toContain('@4xl/tiles:col-span-6');
    expect(html).toContain('Places');
  });

  it('is a server component (no directive)', () => {
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});
