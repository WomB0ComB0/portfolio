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
 * @file PageShell gives a page one left-aligned h1 in the refined page title (Geist, weight 600,
 * sized by the page container), a header that holds the eyebrow (sentence case, never the
 * upper-case mono caption), description, actions and stats (beside the title when there are no
 * actions), the content after it, the page gutter unless turned off, and no <main> of its own.
 * The console barrel exports every primitive and stays out of the root '@/components' barrel.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as consoleBarrel from '@/components/console';
import { PageShell } from '@/components/console/page-shell';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = join(process.cwd(), 'src/components/console/page-shell.tsx');
const ROOT_BARREL = join(process.cwd(), 'src/components/index.ts');

function renderFull() {
  return render(
    <PageShell
      eyebrow="Work"
      title="Projects"
      description="Things I built."
      actions={<button type="button">Filter</button>}
      stats={<p>22 projects</p>}
      className="pb-16"
    >
      <section aria-label="Project list">content</section>
    </PageShell>,
  );
}

describe('PageShell', () => {
  it('has one h1 in the refined page title (Geist 600), and nothing centred', () => {
    const { container } = renderFull();
    const headings = screen.getAllByRole('heading', { level: 1 });

    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Projects');
    expect(headings[0]).toHaveClass('page-title', 'text-foreground');
    for (const chrome of ['text-display', 'font-extrabold', 'tracking-display']) {
      expect(headings[0]).not.toHaveClass(chrome);
    }
    expect(container.querySelector('.text-center')).toBeNull();
  });

  it('puts the eyebrow, description, actions and stats inside the header', () => {
    renderFull();
    const header = screen.getByRole('banner');
    const eyebrow = within(header).getByText('Work');

    // The eyebrow is sentence case in Geist, not the chrome's upper-case mono caption.
    expect(eyebrow).toHaveClass('tile-label', 'text-muted-foreground');
    expect(eyebrow).not.toHaveClass('label-mono');
    expect(within(header).getByText('Things I built.')).toHaveClass('text-body', 'max-w-[60ch]');
    expect(within(header).getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(within(header).getByText('22 projects').parentElement).toHaveClass('md:col-span-2');
    expect(header).toHaveClass('border-b', 'border-hairline');
  });

  it('sets the stats beside the title on wide screens when there are no actions', () => {
    render(
      <PageShell title="Certifications" stats={<p>64 certificates</p>}>
        body
      </PageShell>,
    );
    const header = screen.getByRole('banner');
    const stats = within(header).getByText('64 certificates').parentElement;

    expect(header).toHaveClass('md:grid-cols-[minmax(0,1fr)_auto]', 'md:items-end');
    expect(stats).not.toHaveClass('md:col-span-2');
    expect(header.children).toHaveLength(2);
  });

  it('renders the children after the header', () => {
    const { container } = renderFull();
    const root = container.firstElementChild;
    const content = screen.getByRole('region', { name: 'Project list' });

    expect(root?.firstElementChild?.tagName).toBe('HEADER');
    expect(root?.lastElementChild).toBe(content);
  });

  it('renders no <main>; the shell owns the landmark', () => {
    const { container } = renderFull();
    expect(container.querySelector('main')).toBeNull();
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('pads with the page gutter by default and merges classes', () => {
    const { container } = renderFull();
    expect(container.firstElementChild).toHaveClass('px-(--page-gutter)', 'flex', 'pb-16');
  });

  it('gutter={false} drops the page gutter', () => {
    const { container } = render(
      <PageShell title="Stats" gutter={false}>
        body
      </PageShell>,
    );
    expect(container.firstElementChild).not.toHaveClass('px-(--page-gutter)');
  });

  it('leaves out the optional parts when not given', () => {
    render(<PageShell title="Stats">body</PageShell>);
    const header = screen.getByRole('banner');

    expect(header.querySelectorAll('p')).toHaveLength(0);
    expect(header.children).toHaveLength(1);
  });

  it('keeps a 0 inside its slot wrapper instead of printing a bare 0', () => {
    render(
      <PageShell title="Stats" eyebrow={0} description={0} actions={0} stats={0}>
        body
      </PageShell>,
    );
    const header = screen.getByRole('banner');
    const [titleBlock, actions, stats] = Array.from(header.children);
    const hasBareText = (element: Element | undefined): boolean =>
      Array.from(element?.childNodes ?? []).some((node) => node.nodeType === Node.TEXT_NODE);

    expect(header.children).toHaveLength(3);
    expect(hasBareText(header)).toBe(false);
    expect(hasBareText(titleBlock)).toBe(false);
    expect(Array.from(titleBlock?.children ?? []).map((child) => child.textContent)).toEqual([
      '0',
      'Stats',
      '0',
    ]);
    expect(actions).toHaveClass('flex-wrap');
    expect(actions).toHaveTextContent('0');
    expect(stats).toHaveClass('md:col-span-2');
    expect(stats).toHaveTextContent('0');
  });

  it('leaves out slots given false, null or an empty string', () => {
    render(
      <PageShell title="Stats" eyebrow="" description={false} actions={null} stats="">
        body
      </PageShell>,
    );
    const header = screen.getByRole('banner');

    expect(header.querySelectorAll('p')).toHaveLength(0);
    expect(header.children).toHaveLength(1);
  });

  it('renders on the server and has no use client directive', () => {
    expect(renderToString(<PageShell title="Stats">body</PageShell>)).toContain('<h1');
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});

describe('console barrel', () => {
  it.each([
    'Tile',
    'tileVariants',
    'TileGrid',
    'tileSpanClass',
    'TileLink',
    'SpotlightRoot',
    'StatTile',
    'StatTileSkeleton',
    'StatStrip',
    'LiveNumber',
    'Freshness',
    'formatAge',
    'destinationOf',
    'hasDestination',
    'StatusDot',
    'PageShell',
  ])('exports %s', (name) => {
    expect(consoleBarrel).toHaveProperty(name);
  });

  it('is not re-exported from the root components barrel', () => {
    expect(readFileSync(ROOT_BARREL, 'utf8')).not.toMatch(/['"]\.\/console(?:\/[^'"]*)?['"]/);
  });
});
