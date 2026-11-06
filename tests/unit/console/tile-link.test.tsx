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
 * @file TileLink is the stretched link of a `linked` Tile: an internal next/link (prefetch off by
 * default) or a new-tab anchor that says so, never a link to nowhere, and its accessible name can
 * carry a screen-reader-only suffix. It marks itself for the tile's focus ring and hides its own
 * ring only inside a linked tile (tile-focus-ring.test.tsx checks the compiled CSS).
 * hasDestination, which decides "nowhere", is shared with Tile and StatStrip.
 *
 * jsdom applies no Tailwind CSS, so the overlay is checked as the classes that draw it. next/link
 * is replaced by a plain anchor that shows the prefetch it was given as data-prefetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Tile } from '@/components/console/tile';
import { hasDestination, TileLink } from '@/components/console/tile-link';

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
const SOURCE = join(process.cwd(), 'src/components/console/tile-link.tsx');

const STRETCHED_CLASSES = [
  'after:absolute',
  'after:inset-0',
  "after:content-['']",
  'after:rounded-[inherit]',
  '[[data-linked-tile]_&]:focus-visible:outline-none',
];

/** The stretched link classes, and the attribute the tile's focus ring keys on. */
function expectStretched(link: HTMLElement): void {
  expect(link).toHaveClass(...STRETCHED_CLASSES);
  // An unscoped outline-none would hide focus wherever TileLink is used outside a linked tile.
  expect(link).not.toHaveClass('focus-visible:outline-none');
  expect(link).toHaveAttribute('data-tile-link', '');
}

describe('TileLink', () => {
  it('stretches an internal link over the tile, with prefetch off by default', () => {
    render(<TileLink href="/places">Places</TileLink>);

    const link = screen.getByRole('link', { name: 'Places' });
    expect(link).toHaveAttribute('href', '/places');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link).not.toHaveAttribute('target');
    expectStretched(link);
  });

  it('passes an explicit prefetch and extra classes', () => {
    render(
      <TileLink href="/stats" prefetch className="font-semibold">
        Stats
      </TileLink>,
    );

    const link = screen.getByRole('link', { name: 'Stats' });
    expect(link).toHaveAttribute('data-prefetch', 'true');
    expect(link).toHaveClass('font-semibold', 'after:inset-0');
  });

  it('opens an external link in a new tab with a hidden arrow and spoken notice', () => {
    render(
      <TileLink href="https://www.leetcode.com/u/WomB0ComB0" external>
        LeetCode
      </TileLink>,
    );

    const link = screen.getByRole('link', { name: 'LeetCode (opens in a new tab)' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('data-prefetch');
    expectStretched(link);
    expect(screen.getByText('(opens in a new tab)')).toHaveClass('sr-only');

    const arrow = link.querySelector('svg');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveClass('size-3.5');
  });

  it.each(['', '#', '  '])('renders %j as text with no link', (href) => {
    render(<TileLink href={href}>Coming soon</TileLink>);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const text = screen.getByText('Coming soon');
    expect(text.tagName).toBe('SPAN');
    // Not marked, so a linked tile around it draws no ring for a link that is not there.
    expect(text).not.toHaveAttribute('data-tile-link');
  });

  it('adds the screen-reader suffix to the accessible name only', () => {
    render(
      <TileLink href="/projects/fraud-guard" srSuffix="about Fraud Guard">
        Read more
      </TileLink>,
    );

    expect(screen.getByRole('link', { name: 'Read more about Fraud Guard' })).toBeInTheDocument();
    expect(screen.getByText('about Fraud Guard')).toHaveClass('sr-only');
  });

  it('adds the suffix before the new-tab notice on an external link', () => {
    render(
      <TileLink href="https://github.com/WomB0ComB0/portfolio" external srSuffix="portfolio repo">
        Source
      </TileLink>,
    );

    expect(
      screen.getByRole('link', { name: 'Source portfolio repo (opens in a new tab)' }),
    ).toBeInTheDocument();
  });

  it('is the one link of a linked tile, which rings itself for it', () => {
    render(
      <Tile variant="linked" as="article">
        <h3>
          <TileLink href="/experience">Experience</TileLink>
        </h3>
      </Tile>,
    );

    const tile = screen.getByRole('article');
    expect(tile).toContainElement(screen.getByRole('link', { name: 'Experience' }));
    expect(tile).toHaveAttribute('data-linked-tile', '');
    expect(tile).toHaveClass('relative', 'has-[[data-tile-link]:focus-visible]:outline-focus');
  });

  it('is server-safe (no directive)', () => {
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});

describe('hasDestination', () => {
  it.each(['/projects', 'https://github.com/WomB0ComB0', '#section', ' /places '])(
    '%j leads somewhere',
    (href) => {
      expect(hasDestination(href)).toBe(true);
    },
  );

  it.each([undefined, '', '   ', '#', ' # '])('%j leads nowhere', (href) => {
    expect(hasDestination(href)).toBe(false);
  });
});
