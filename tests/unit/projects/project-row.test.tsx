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
 * @file One /projects row in style 2 (the open index): five cells by priority (the project,
 * then Kind and Started from 40rem, Technology from 48rem, and Links always); the title is the
 * row's one link, a next/link to the encoded detail page with its pending spinner; a summary
 * line from 40rem and a meta line on a phone; Code and Live open a new tab and say for which
 * project; the row carries its preview id, never the Ledger's row marker. Synthetic entries.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectRow } from '@/app/(routes)/(main)/(professioal)/projects/_components/project-row';
import type { ProjectEntry } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-index';
import { FEATURED_GROUP } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-order';

/** Every next/link rendered, by its props: the real link still renders. */
const nextLinks = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('next/link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/link')>();
  const RealLink = actual.default;
  return {
    ...actual,
    default: (props: Parameters<typeof RealLink>[0]) => {
      nextLinks.props.push(props as unknown as Record<string, unknown>);
      return <RealLink {...props} />;
    },
  };
});

afterEach(() => {
  cleanup();
  nextLinks.props.length = 0;
});

/** A synthetic entry. */
const entry = (extra: Partial<ProjectEntry> = {}): ProjectEntry => ({
  id: 'proj a/b',
  group: '2024',
  groupLabel: '2024',
  title: 'Alpha',
  summary: 'Finds things fast.',
  kindSlugs: ['web-development', 'full-stack'],
  kindLabels: ['Web Development', 'Full-Stack'],
  techKeys: ['react', 'go', 'bun', 'vite', 'zod'],
  techLabels: ['React', 'Go', 'Bun', 'Vite', 'Zod'],
  started: { iso: '2024-03', name: 'Mar', year: '2024' },
  githubUrl: 'https://github.com/example/alpha',
  liveUrl: 'https://alpha.example',
  haystack: 'alpha',
  preview: { title: 'Alpha', kind: 'Web Development', cover: null },
  ...extra,
});

/** Renders one row in a table body. */
function renderRow(value: ProjectEntry): HTMLTableRowElement {
  render(
    <table>
      <tbody>
        <ProjectRow entry={value} />
      </tbody>
    </table>,
  );
  const row = document.querySelector<HTMLTableRowElement>('tr');
  if (!row) throw new Error('no row rendered');
  return row;
}

const classesOf = (element: Element | null | undefined): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

describe('a project row', () => {
  it('is five cells: the project and Links always, Kind and Started from 40rem, Tech from 48rem', () => {
    const cells = Array.from(renderRow(entry()).querySelectorAll('td'));
    const [project, kind, tech, started, links] = cells;

    expect(cells).toHaveLength(5);
    expect(classesOf(project)).not.toContain('hidden');
    expect(classesOf(kind)).toEqual(
      expect.arrayContaining(['hidden', '@min-[40rem]/page:table-cell']),
    );
    expect(classesOf(tech)).toEqual(
      expect.arrayContaining(['hidden', '@min-[48rem]/page:table-cell']),
    );
    expect(classesOf(started)).toEqual(
      expect.arrayContaining(['hidden', '@min-[40rem]/page:table-cell', 'text-right']),
    );
    expect(classesOf(links)).toEqual(expect.arrayContaining(['text-right']));
    expect(classesOf(links)).not.toContain('hidden');
  });

  it('links the title to the encoded detail page through next/link, with its spinner', () => {
    renderRow(entry());
    const link = screen.getByRole('link', { name: 'Alpha' });

    expect(link).toHaveAttribute('href', '/projects/proj%20a%2Fb');
    expect(link).not.toHaveAttribute('target');
    expect(nextLinks.props).toEqual([expect.objectContaining({ prefetch: false })]);
    expect(link.querySelector('.border-t-transparent[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the summary from 40rem and a "Kind · Mon" meta line on a phone', () => {
    renderRow(entry());

    expect(classesOf(screen.getByText('Finds things fast.'))).toEqual(
      expect.arrayContaining(['hidden', '@min-[40rem]/page:block']),
    );
    expect(classesOf(screen.getByText('Web Development · Mar'))).toEqual(
      expect.arrayContaining(['@min-[40rem]/page:hidden']),
    );
  });

  it('gives the year with the month in the Featured group, whose heading is no year', () => {
    const row = renderRow(entry({ group: FEATURED_GROUP, groupLabel: 'Featured' }));

    expect(screen.getByText('Web Development · Mar 2024')).toBeInTheDocument();
    expect(row.querySelector('time')).toHaveTextContent('Mar 2024');
    expect(row.querySelector('time')).toHaveAttribute('dateTime', '2024-03');
  });

  it('names an undated project as such', () => {
    const row = renderRow(entry({ started: null }));

    expect(
      screen.getByText('Web Development', { selector: '[class*="page:hidden"]' }),
    ).toBeInTheDocument();
    expect(row.querySelector('time')).toBeNull();
    expect(within(row).getByText('No start date')).toHaveClass('sr-only');
  });

  it('shows the first kind, and three technologies with how many more', () => {
    const [, kind, tech] = Array.from(renderRow(entry()).querySelectorAll('td'));

    expect(kind).toHaveTextContent('Web Development');
    expect(tech).toHaveTextContent('React · Go · Bun');
    expect(within(tech as HTMLElement).getByText('+2')).toHaveAttribute('aria-hidden', 'true');
    expect(within(tech as HTMLElement).getByText(/and 2 more: Vite, Zod/)).toHaveClass('sr-only');
  });

  it('opens Code and Live in a new tab, saying for which project', () => {
    renderRow(entry());
    const code = screen.getByRole('link', { name: 'Code for Alpha (opens in a new tab)' });
    const live = screen.getByRole('link', { name: 'Live for Alpha (opens in a new tab)' });

    for (const link of [code, live]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(classesOf(link)).toEqual(expect.arrayContaining(['relative', 'z-[1]']));
    }
    expect(code).toHaveAttribute('href', 'https://github.com/example/alpha');
  });

  it('keeps an empty, hidden slot for a missing link so the columns line up', () => {
    const row = renderRow(entry({ liveUrl: null }));

    expect(screen.queryByRole('link', { name: /^Live/ })).not.toBeInTheDocument();
    expect(row.querySelectorAll('[data-link-slot][aria-hidden="true"]')).toHaveLength(1);
  });

  it('carries its preview id and its own row marker, never the Ledger’s', () => {
    const row = renderRow(entry());

    expect(row).toHaveAttribute('data-preview-id', 'proj a/b');
    expect(row).toHaveAttribute('data-project-row', '');
    expect(row).not.toHaveAttribute('data-cert-row');
  });

  it('renders on the server', () => {
    const html = renderToString(
      <table>
        <tbody>
          <ProjectRow entry={entry()} />
        </tbody>
      </table>,
    );

    expect(html).toContain('href="/projects/proj%20a%2Fb"');
  });
});
