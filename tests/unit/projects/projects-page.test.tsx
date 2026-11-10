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
 * @file /projects as the open Index, rendered on the server: every project is a row link in
 * the first HTML (the Featured group, then the years newest first, then Undated), with no
 * loading.tsx, no loader and nothing hidden behind an entrance. The filters live in the URL
 * (?q, ?category for the Kind, repeated ?tech for the Technology) through the shared kit's
 * useUrlFilters, so a shared link is filtered in the server HTML and hydrates without a
 * mismatch, and old links (?category=Web Development, a single ?tech=Python) still work. Only
 * the loaders are mocked; cover URLs come from the real Sanity URL builder.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/hooks/sanity/schemas';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { wideLayout } from '../console/filter-bar/wide-layout';

const loaders = vi.hoisted(() => ({ loadProjects: vi.fn() }));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ProjectsPage from '@/app/(routes)/(main)/(professioal)/projects/(list)/page';

const PROJECTS_DIR = path.resolve(
  __dirname,
  '../../../src/app/(routes)/(main)/(professioal)/projects',
);

/** [category, technologies, featured, startDate] per project, synthetic. */
const SHAPES: readonly (readonly [string, readonly string[], boolean, string | null])[] = [
  ['Web Development', ['TypeScript', 'React'], true, '2023-02-01'],
  ['Web Development', ['TypeScript', 'React'], true, '2025-06-01'],
  ['Web Development', ['TypeScript', 'React'], false, '2025-09-01'],
  ['Web Development', ['TypeScript', 'React'], false, '2024-03-01'],
  ['Mobile / Full-Stack', ['TypeScript', 'React Native'], false, '2025-01-01'],
  ['Mobile / Full-Stack', ['TypeScript', 'React Native'], false, '2024-05-01'],
  ['Mobile / Full-Stack', ['TypeScript', 'React Native'], false, '2024-11-01'],
  ['Mobile / Full-Stack', ['TypeScript', 'React Native'], false, null],
  ['Machine Learning', ['Python', 'TensorFlow'], false, '2023-07-01'],
  ['Machine Learning', ['Python', 'TensorFlow'], false, '2025-03-01'],
  ['Machine Learning', ['Python', 'TensorFlow'], false, '2024-01-01'],
  ['Machine Learning', ['Go'], false, '2022-08-01'],
];

/**
 * Twelve projects, more than the old first page of nine: two switched to Featured (no rank
 * yet), years from 2022 to 2025 and one undated, the tenth the only one about a needle, the
 * first without an image.
 */
const PROJECTS: readonly Project[] = SHAPES.map(
  ([category, technologies, featured, startDate], index) =>
    makeProject({
      title: `Project ${index + 1}`,
      description:
        index === 9 ? 'Finds a needle in the haystack.' : `What project ${index + 1} does.`,
      category,
      technologies: [...technologies],
      featured,
      order: index + 1,
      startDate,
      image:
        index === 0
          ? null
          : {
              _type: 'image',
              asset: { _ref: `image-shot${index}-1600x900-png`, _type: 'reference' },
            },
    }),
);

/** Page order: Featured by display order, then 2025, 2024, 2023, 2022 (newer first), Undated. */
const PAGE_ORDER = [0, 1, 2, 9, 4, 6, 5, 3, 10, 8, 11, 7];

const hrefOf = (project: Project): string => `/projects/${encodeURIComponent(project._id)}`;
const hrefsAt = (indexes: readonly number[]): string[] =>
  indexes.map((index) => {
    const project = PROJECTS[index];
    if (!project) throw new Error(`no fixture project at ${index}`);
    return hrefOf(project);
  });

async function renderPage(
  searchParams = '',
  onUrlUpdate?: OnUrlUpdateFunction,
): Promise<ReturnType<typeof render>> {
  const page: ReactElement = await ProjectsPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

/** The hrefs of every project's title link, in order. */
const projectLinks = (root: ParentNode = document): string[] =>
  Array.from(root.querySelectorAll('a[data-project-title]')).map(
    (link) => link.getAttribute('href') ?? '',
  );

/** The count as a screen reader reads it (the animated copy left out). */
const countText = (): string => {
  const count = document.querySelector('[data-filter-part="count"]')?.cloneNode(true);
  if (!(count instanceof HTMLElement)) return '';
  for (const hidden of count.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (count.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
};

beforeEach(() => {
  loaders.loadProjects.mockReset();
  loaders.loadProjects.mockResolvedValue(PROJECTS);
});

describe('/projects on the server', () => {
  it('links every project in page order: Featured, the years newest first, then Undated', async () => {
    await renderPage();

    expect(projectLinks()).toEqual(hrefsAt(PAGE_ORDER));
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Featured, 2 projects',
      '2025, 3 projects',
      '2024, 4 projects',
      '2023, 1 project',
      '2022, 1 project',
      'Undated, 1 project',
    ]);
    for (const table of screen.getAllByRole('table')) {
      expect(table).toHaveAttribute('data-variant', 'open');
    }
    expect(countText()).toBe('12 projects');
  });

  it('puts every row in the server HTML, visible, with no loader or skeleton', async () => {
    const html = renderToString(<NuqsTestingAdapter>{await ProjectsPage()}</NuqsTestingAdapter>);

    for (const href of hrefsAt(PAGE_ORDER)) expect(html).toContain(`href="${href}"`);
    // An entrance animation serialises opacity:0 into the HTML.
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
    expect(html).not.toContain('loader-ring-title');
    expect(html).not.toContain('Loading projects');
    expect(html).not.toContain('Load More Projects');
  });

  it('keeps no loading.tsx above the list or the detail page, so rows render without JavaScript', () => {
    const present = ['', '(list)', '[id]'].flatMap((dir) =>
      ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js']
        .map((file) => path.join(dir, file))
        .filter((file) => existsSync(path.join(PROJECTS_DIR, file))),
    );

    expect(present).toEqual([]);
  });

  it('says there are no projects yet only when the list is empty, with no toolbar', async () => {
    loaders.loadProjects.mockResolvedValue([]);
    await renderPage();

    expect(screen.getByText('No projects yet.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('/projects filters in the URL', () => {
  it('reads an old ?category link as its kind, with the count', async () => {
    await renderPage('?category=Web%20Development');

    expect(projectLinks()).toEqual(hrefsAt([0, 1, 2, 3]));
    expect(countText()).toBe('4 of 12 projects');
  });

  it('server-renders a shared ?category link already filtered, with its token', async () => {
    const html = renderToString(
      <NuqsTestingAdapter searchParams="?category=web-development">
        {await ProjectsPage()}
      </NuqsTestingAdapter>,
    );

    expect(html).toContain(`href="${hrefsAt([3])[0]}"`);
    expect(html).not.toContain(`href="${hrefsAt([4])[0]}"`);
    expect(html).toContain('Clear all');
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it('hydrates a filtered server render without a mismatch', async () => {
    const tree = (
      <NuqsTestingAdapter searchParams="?category=web-development&tech=react">
        {await ProjectsPage()}
      </NuqsTestingAdapter>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRecoverableError = vi.fn();

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelectorAll('tr[data-project-row]')).toHaveLength(4);
    act(() => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it('shows every project, with nothing applied, for values no project has', async () => {
    await renderPage('?category=bogus&tech=COBOL');

    expect(projectLinks()).toEqual(hrefsAt(PAGE_ORDER));
    expect(countText()).toBe('12 projects');
    expect(document.querySelector('[data-filter-part="applied"]')).toBeNull();
  });

  it('reads an old single ?tech=Python, and ORs repeated ?tech keys', async () => {
    const single = await renderPage('?tech=Python');

    expect(projectLinks()).toEqual(hrefsAt([9, 10, 8]));
    expect(countText()).toBe('3 of 12 projects');
    single.unmount();

    await renderPage('?tech=python&tech=go');
    expect(projectLinks()).toEqual(hrefsAt([9, 10, 8, 11]));
  });

  it('writes the search to ?q as it is typed: replace, shallow, no scroll', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('', onUrlUpdate);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'NEEDLE' } });

    await waitFor(() => expect(projectLinks()).toEqual(hrefsAt([9])));
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: '?q=NEEDLE',
          options: expect.objectContaining({ history: 'replace', shallow: true, scroll: false }),
        }),
      ),
    );
  });

  it('filters in place from a Kind chip and writes its slug to ?category', async () => {
    // jsdom hides every popover; from a 48rem page the chips sit in the bar.
    const narrow = wideLayout();
    try {
      const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
      await renderPage('', onUrlUpdate);
      const chips = screen.getByRole('list', { name: 'Filter by kind' });

      fireEvent.click(within(chips).getByRole('link', { name: /^Machine Learning/ }));

      await waitFor(() => expect(projectLinks()).toEqual(hrefsAt([9, 10, 8, 11])));
      await waitFor(() =>
        expect(onUrlUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ queryString: '?category=machine-learning' }),
        ),
      );
    } finally {
      narrow();
    }
  });

  it('shows the designed empty state for filters that match nothing, and clears them', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('?category=web-development&tech=python', onUrlUpdate);

    expect(projectLinks()).toEqual([]);
    expect(screen.getByRole('heading', { name: 'No projects match' })).toBeInTheDocument();
    const clear = screen.getByRole('link', { name: 'Clear filters' });
    expect(clear).toHaveAttribute('href', '/projects');

    fireEvent.click(clear);

    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ queryString: '' })),
    );
  });
});

describe('/projects hover preview on the page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hides at once on any filter or URL change, even one that keeps every row', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === FINE_POINTER,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await renderPage();
    const card = (): Element | null => document.querySelector('[data-preview-card]');
    await waitFor(() => expect(card()).not.toBeNull());
    const title = document.querySelector('a[data-project-title]') as HTMLElement;
    fireEvent.pointerMove(title, { pointerType: 'mouse', clientX: 300, clientY: 10 });
    expect(card()?.getAttribute('data-shown')).not.toBe('');

    // Every synthetic description says "project": the same rows stay, but the URL changes.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'project' } });

    await waitFor(() => expect(card()).toHaveAttribute('data-shown', ''));
    expect(projectLinks()).toEqual(hrefsAt(PAGE_ORDER));
  });
});

describe('/projects module boundaries', () => {
  const INDEX_FILES = [
    '_lib/project-text.ts',
    '_lib/project-order.ts',
    '_lib/project-filters.ts',
    '_lib/project-index.ts',
    '_components/project-index-classes.ts',
    '_components/project-row.tsx',
    '_components/project-groups.tsx',
    '_components/project-header.tsx',
    '_components/projects-index.tsx',
    '_components/project-preview-geometry.ts',
  ];
  const PREVIEW_FILES = [
    '_components/project-preview.tsx',
    '_components/project-preview-live.tsx',
    '_components/project-preview-card.tsx',
  ];

  it.each([...INDEX_FILES, ...PREVIEW_FILES])('%s never imports the Sanity client', (file) => {
    const source = readFileSync(path.join(PROJECTS_DIR, file), 'utf8');

    expect(source).not.toMatch(/from ['"]@\/lib\/sanity/);
  });

  it.each(INDEX_FILES)('%s leaves motion to the preview files', (file) => {
    const source = readFileSync(path.join(PROJECTS_DIR, file), 'utf8');

    expect(source).not.toMatch(/from ['"](motion|framer-motion)/);
  });

  /** A static value import of the preview's live half or card (not `import type`, which is erased). */
  const STATIC_PREVIEW_IMPORT =
    /^import (?!type\b)[^;]*from ['"]\.\/project-preview-(live|card)['"]/m;

  it('loads the preview’s card, listeners and motion lazily: none of it is in the first load', () => {
    const wrapper = readFileSync(
      path.join(PROJECTS_DIR, '_components/project-preview.tsx'),
      'utf8',
    );

    expect(wrapper).not.toMatch(/from ['"](motion|framer-motion)/);
    // A value import would pull the live half into the first load; `import type` is erased.
    expect(wrapper).not.toMatch(STATIC_PREVIEW_IMPORT);
    expect(wrapper).toMatch(/import\(['"]\.\/project-preview-live['"]\)/);
    for (const file of INDEX_FILES) {
      const source = readFileSync(path.join(PROJECTS_DIR, file), 'utf8');
      expect(source, file).not.toMatch(STATIC_PREVIEW_IMPORT);
    }
  });

  it('builds covers on the server only', () => {
    const body = readFileSync(
      path.join(PROJECTS_DIR, '_interface/projects-index/projects-index.tsx'),
      'utf8',
    );

    expect(body).toMatch(/^import 'server-only';/m);
    expect(body).toMatch(/from ['"]@\/lib\/sanity\/client['"]/);
  });
});
