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
 * @file A page's views in the URL: the links carry every filter and drop the parameter for the
 * default view (viewHref, viewLinks, toSearch), an unknown view falls back (parseView), and
 * ViewSwitch draws plain links with the current one marked, as Places | Photos does.
 *
 * next/link is replaced by a plain anchor.
 */

import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { parseView, toSearch, ViewSwitch, viewHref, viewLinks } from '@/components/console/folio';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a {...rest} href={href}>
      {children}
    </a>
  ),
}));

type ProjectView = 'stories' | 'index';
const OPTIONS = { defaultView: 'stories' as ProjectView };
const VIEWS = [
  { value: 'stories', label: 'Stories' },
  { value: 'index', label: 'Index' },
] as const satisfies readonly { value: ProjectView; label: string }[];

describe('viewHref', () => {
  it('adds the view after the filters, keeping their order', () => {
    expect(viewHref('/projects?kind=cli-tool&q=rust', 'index', OPTIONS)).toBe(
      '/projects?kind=cli-tool&q=rust&view=index',
    );
  });

  it('drops the parameter for the default view, so the canonical URL stays bare', () => {
    expect(viewHref('/projects?view=index', 'stories', OPTIONS)).toBe('/projects');
    expect(viewHref('/projects?kind=ai-ml&view=index', 'stories', OPTIONS)).toBe(
      '/projects?kind=ai-ml',
    );
  });

  it('replaces a view already in the URL rather than repeating it', () => {
    expect(viewHref('/projects?view=index&tech=rust', 'index', OPTIONS)).toBe(
      '/projects?tech=rust&view=index',
    );
  });

  it('keeps repeated filter keys (a multi-select facet)', () => {
    expect(viewHref('/projects?tech=rust&tech=go', 'index', OPTIONS)).toBe(
      '/projects?tech=rust&tech=go&view=index',
    );
  });

  it('drops a #hash, since a chapter in one view may not exist in the other', () => {
    expect(viewHref('/projects?q=ai#y2026', 'index', OPTIONS)).toBe('/projects?q=ai&view=index');
  });

  it('takes another parameter name', () => {
    expect(viewHref('/certifications', 'list', { defaultView: 'record', param: 'as' })).toBe(
      '/certifications?as=list',
    );
  });
});

describe('toSearch', () => {
  it("writes Next's searchParams as a query, repeated keys kept and undefined left out", () => {
    expect(toSearch({ q: 'vector search', tech: ['rust', 'go'], kind: undefined })).toBe(
      '?q=vector+search&tech=rust&tech=go',
    );
  });

  it('is empty with no parameters, and takes URLSearchParams', () => {
    expect(toSearch({})).toBe('');
    expect(toSearch(new URLSearchParams('view=index'))).toBe('?view=index');
  });
});

describe('parseView', () => {
  const views = ['stories', 'index'] as const;

  it('reads a known view, the first of repeated values', () => {
    expect(parseView('index', views, 'stories')).toBe('index');
    expect(parseView(['index', 'stories'], views, 'stories')).toBe('index');
  });

  it('falls back to the default for a missing, unknown or differently cased view', () => {
    expect(parseView(undefined, views, 'stories')).toBe('stories');
    expect(parseView('photos', views, 'stories')).toBe('stories');
    expect(parseView('Index', views, 'stories')).toBe('stories');
  });
});

describe('viewLinks', () => {
  it("builds every view's link from the page's href", () => {
    expect(viewLinks('/projects?kind=cli-tool&view=index', VIEWS, OPTIONS)).toEqual([
      { value: 'stories', label: 'Stories', href: '/projects?kind=cli-tool' },
      { value: 'index', label: 'Index', href: '/projects?kind=cli-tool&view=index' },
    ]);
  });
});

describe('ViewSwitch', () => {
  const links = viewLinks('/projects?q=rust', VIEWS, OPTIONS);

  it('is a named navigation of plain links, the current view marked aria-current="page"', () => {
    render(<ViewSwitch label="Project views" current="index" views={links} />);
    const nav = screen.getByRole('navigation', { name: 'Project views' });
    const [stories, index] = within(nav).getAllByRole('link');

    expect(stories?.getAttribute('href')).toBe('/projects?q=rust');
    expect(stories?.hasAttribute('aria-current')).toBe(false);
    expect(index?.getAttribute('href')).toBe('/projects?q=rust&view=index');
    expect(index?.getAttribute('aria-current')).toBe('page');
  });

  it('marks every view link rel="nofollow", which robots.txt backs by closing ?view=', () => {
    render(<ViewSwitch label="Project views" current="stories" views={links} />);
    const nav = screen.getByRole('navigation', { name: 'Project views' });
    const all = within(nav).getAllByRole('link');

    expect(all).toHaveLength(links.length);
    for (const link of all) expect(link).toHaveAttribute('rel', 'nofollow');
  });

  it('styles the current view from aria-current alone: every view link shares one look', () => {
    render(<ViewSwitch label="Project views" current="stories" views={links} />);
    const views = screen.getAllByRole('link');

    // No per-view class: the current view's look can only come from its aria-current.
    expect(new Set(views.map((link) => link.className)).size).toBe(1);
    expect(views.filter((link) => link.hasAttribute('aria-current'))).toEqual([
      screen.getByRole('link', { name: 'Stories' }),
    ]);
  });

  it('gives every view a larger target under a finger than under a mouse', () => {
    render(<ViewSwitch label="Project views" current="stories" views={links} />);

    // jsdom matches no media query, so only the rule's presence is checked here; the 36px and
    // 44px heights are measured in a browser.
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/(?:^|\s)pointer-coarse:min-h-/);
    }
  });

  it('draws nothing with fewer than two views', () => {
    const { container } = render(
      <ViewSwitch label="Project views" current="stories" views={links.slice(0, 1)} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(
      <ViewSwitch label="Project views" current="stories" views={links} />,
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/projects?q=rust&amp;view=index"');
  });
});
