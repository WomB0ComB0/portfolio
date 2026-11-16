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
 * @file /projects rendered on the server, in its three views:
 * - Stories (the default): Folio chapters (Featured, the years newest first, Undated), each with
 *   a lead story (a wide cover, the lowest Studio order in a year), and every project one link,
 *   a type cover standing in for a missing image.
 * - Index (?view=index): every project under the year it started, in words.
 * - Screens (?view=screens): every image as a link to its project.
 * Every project is in the first HTML, with no loading.tsx and nothing hidden behind an entrance.
 * The filters live in the URL (?q, ?category, repeated ?tech) and apply to every view, so a
 * shared link is filtered in the server HTML and hydrates without a mismatch; the view switch and
 * the chips keep each other. Only the loaders are mocked; image URLs come from the real Sanity
 * URL builder.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/hooks/sanity/schemas';
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
 * Twelve projects: two switched to Featured (no rank yet), years from 2022 to 2025 and one
 * undated, the tenth the only one about a needle, the first without an image (a type cover), the
 * fifth in progress; every other cover a wide 16:9 shot.
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
      status: index === 4 ? 'In Progress' : 'Completed',
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
/** Each Stories chapter's lead: Featured's first wide cover, a year's lowest Studio order. */
const LEADS = [1, 2, 3, 8, 11, 7];

const hrefOf = (project: Project): string => `/projects/${encodeURIComponent(project._id)}`;
const hrefsAt = (indexes: readonly number[]): string[] =>
  indexes.map((index) => {
    const project = PROJECTS[index];
    if (!project) throw new Error(`no fixture project at ${index}`);
    return hrefOf(project);
  });

/** The page for a query string, with the search params handed over the way Next does. */
async function pageFor(query = ''): Promise<ReactElement> {
  const params = Object.fromEntries(new URLSearchParams(query));
  return ProjectsPage({ searchParams: Promise.resolve(params) });
}

async function renderPage(
  query = '',
  onUrlUpdate?: OnUrlUpdateFunction,
): Promise<ReturnType<typeof render>> {
  const page = await pageFor(query);
  return render(
    <NuqsTestingAdapter searchParams={query} onUrlUpdate={onUrlUpdate} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

/** Every project's link to its page, in the order the page shows them. */
const storyLinks = (root: ParentNode = document): string[] =>
  Array.from(root.querySelectorAll('a[data-story-link]')).map(
    (link) => link.getAttribute('href') ?? '',
  );

/** The same links, sorted: which projects are shown, whatever the layout. */
const shown = (): string[] => [...storyLinks()].sort();
const projectsAt = (indexes: readonly number[]): string[] => [...hrefsAt(indexes)].sort();

/** The count as a screen reader reads it (the animated copy left out). */
const countText = (): string => {
  const count = document.querySelector('[data-filter-part="count"]')?.cloneNode(true);
  if (!(count instanceof HTMLElement)) return '';
  for (const hidden of count.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (count.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
};

const headings = (level: number): string[] =>
  screen.getAllByRole('heading', { level }).map((heading) => heading.textContent ?? '');

beforeEach(() => {
  loaders.loadProjects.mockReset();
  loaders.loadProjects.mockResolvedValue(PROJECTS);
});

describe('/projects Stories on the server', () => {
  it('links every project once, under Folio chapters in page order', async () => {
    await renderPage();

    expect(storyLinks()).toHaveLength(PROJECTS.length);
    expect(shown()).toEqual(projectsAt(PAGE_ORDER));
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(headings(2)).toEqual(['Featured', '2025', '2024', '2023', '2022', 'Undated']);
  });

  it('says the count once: the header’s byline, with no results line until a filter narrows', async () => {
    await renderPage();

    expect(document.querySelector('header [data-byline]')).toHaveTextContent('12 projects');
    expect(document.querySelector('[data-filter-part="count"]')).toBeNull();
    // The status line screen readers hear after a change is always there.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('leads each chapter with a wide cover: Featured by rank, a year by Studio order', async () => {
    await renderPage();
    const leads = Array.from(document.querySelectorAll('[data-project-story="lead"]'));

    expect(leads.map((lead) => storyLinks(lead)[0])).toEqual(hrefsAt(LEADS));
  });

  it('opens with Featured as a small heading, so the work leads; years keep their numerals', async () => {
    await renderPage();
    const sizes = Array.from(document.querySelectorAll('section[data-chapter]')).map((section) =>
      section.getAttribute('data-chapter'),
    );
    const featured = screen.getByRole('region', { name: 'Featured' });

    expect(sizes).toEqual(['inline', 'step', 'step', 'inline', 'inline', 'inline']);
    // Its names are the stories right under it, and its count is the first jump link.
    expect(featured.querySelector('header [data-byline]')).toBeNull();
    expect(featured.querySelector('header p')).toBeNull();
  });

  it('names in a year the Featured projects that started in it, each a link to its story', async () => {
    await renderPage();
    const chapter = screen.getByRole('region', { name: '2025' });
    const also = chapter.querySelector('[data-also-featured]');
    const link = within(also as HTMLElement).getByRole('link', { name: 'Project 2' });
    const target = (link.getAttribute('href') ?? '').slice(1);

    expect(also).toHaveTextContent('Also in Featured: Project 2.');
    expect(document.getElementById(target)?.closest('section')).toBe(
      screen.getByRole('region', { name: 'Featured' }),
    );
    expect(document.getElementById(target)).toContainElement(
      document.querySelector(`a[data-story-link][href="${hrefsAt([1])[0]}"]`) as HTMLElement,
    );
  });

  it('gives a year whose projects are all Featured no chapter of its own', async () => {
    const onlyFeatured = PROJECTS.map((project, index) =>
      index === 11 ? { ...project, featured: true } : project,
    );
    loaders.loadProjects.mockResolvedValue(onlyFeatured);
    await renderPage();
    const featured = screen.getByRole('region', { name: 'Featured' });

    expect(document.getElementById('y2022')).toBeNull();
    expect(featured).toContainElement(
      document.querySelector(`a[data-story-link][href="${hrefsAt([11])[0]}"]`) as HTMLElement,
    );
    expect(headings(2)).toEqual(['Featured', '2025', '2024', '2023', 'Undated']);
  });

  it('ends a search that keeps only a Featured project at Featured, with no empty year after it', async () => {
    await renderPage('?q=Project%202');

    expect(headings(2)).toEqual(['Featured']);
    expect(document.querySelector('[data-also-featured]')).toBeNull();
    expect(storyLinks()).toEqual(hrefsAt([1]));
  });

  it('ends Featured with no brief alone on a line: a wide brief, then rows in pairs', async () => {
    const ranked = PROJECTS.map((project, index) =>
      index < 6 ? { ...project, featuredRank: index + 1 } : project,
    );
    loaders.loadProjects.mockResolvedValue(ranked);
    await renderPage();
    const featured = screen.getByRole('region', { name: 'Featured' });
    const layouts = Array.from(featured.querySelectorAll('[data-project-story]')).map((story) =>
      story.getAttribute('data-project-story'),
    );

    expect(layouts).toEqual(['lead', 'feature', 'feature', 'wide', 'row', 'row']);
  });

  it('counts each chapter in its byline, with what is still in progress', async () => {
    await renderPage();
    const chapter = screen.getByRole('region', { name: '2025' });
    const byline = chapter.querySelector('header [data-byline]');

    expect(byline).toHaveTextContent('3 projects · 1 in progress');
  });

  it('draws a type cover for the project with no image, and loads one cover at once', async () => {
    await renderPage();
    const first = document.querySelector(`[data-project-id="${PROJECTS[0]?._id}"]`);
    const eager = Array.from(document.querySelectorAll('img')).filter(
      (image) => image.getAttribute('loading') !== 'lazy',
    );

    expect(first?.querySelector('[data-type-cover]')).toHaveTextContent('Project');
    expect(first?.querySelector('img')).toBeNull();
    expect(eager).toHaveLength(1);
  });

  it('puts every project in the server HTML, visible, with no loader or skeleton', async () => {
    const html = renderToString(<NuqsTestingAdapter>{await pageFor()}</NuqsTestingAdapter>);

    for (const href of hrefsAt(PAGE_ORDER)) expect(html).toContain(`href="${href}"`);
    // An entrance animation serialises opacity:0 into the HTML.
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
    expect(html).not.toContain('Loading projects');
    expect(html).not.toContain('Load More Projects');
  });

  it('keeps no loading.tsx above the list or the detail page', () => {
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

  it('jumps to every chapter from "In this issue"', async () => {
    await renderPage();
    const jumps = screen.getByRole('navigation', { name: 'In this issue' });
    const hrefs = within(jumps)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['#featured', '#y2025', '#y2024', '#y2023', '#y2022', '#undated']);
  });
});

describe('/projects views', () => {
  it('switches between Stories, Index and Screens, the current one marked', async () => {
    await renderPage('?view=index');
    const nav = screen.getByRole('navigation', { name: 'Project views' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Stories', '/projects'],
      ['Index', '/projects?view=index'],
      ['Screens', '/projects?view=screens'],
    ]);
    expect(within(nav).getByRole('link', { name: 'Index' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('Index: every project under the year it started, Featured ones included', async () => {
    await renderPage('?view=index');

    expect(headings(2)).toEqual(['2025', '2024', '2023', '2022', 'Undated']);
    expect(storyLinks()).toEqual(hrefsAt([2, 1, 9, 4, 6, 5, 3, 10, 8, 0, 11, 7]));
    expect(document.querySelector('[data-project-story="lead"]')).toBeNull();
  });

  it('Screens: every image as a link to its project, with a unique name', async () => {
    await renderPage('?view=screens');
    const grid = screen.getByRole('list', { name: 'Images' });
    const links = within(grid).getAllByRole('link');

    expect(links).toHaveLength(11);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      hrefsAt(PAGE_ORDER.filter((index) => index !== 0)),
    );
    // The places grid's own card: the project's name and byline shown, its number heard.
    expect(links[0]).toHaveAccessibleName('Project 2 Web Development Jun 2025, image 1 of 1');
    expect(screen.getByText('11 images from 11 projects')).toBeInTheDocument();
    // Every image is listed: no 'Show all' step.
    expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
  });

  /** The Screens view as the server sends it. */
  async function serverScreens(): Promise<Element | null> {
    const html = renderToString(
      <NuqsTestingAdapter searchParams="?view=screens">
        {await pageFor('?view=screens')}
      </NuqsTestingAdapter>,
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.querySelector('[data-projects-view="screens"][data-start]');
  }

  it('Screens: the /places Wall / Grid switch and wall frame, sent before the pointer is known', async () => {
    const more = [11, 12].map((at) =>
      makeProject({
        title: `Project ${at + 2}`,
        order: at + 2,
        startDate: '2021-01-01',
        image: {
          _type: 'image',
          asset: { _ref: `image-more${at}-1600x900-png`, _type: 'reference' },
        },
      }),
    );
    loaders.loadProjects.mockResolvedValue([...PROJECTS, ...more]);
    const view = await serverScreens();

    expect(view?.getAttribute('data-start')).toBe('either');
    expect(view?.querySelector('[role="group"][aria-label="View"]')).not.toBeNull();
    expect(view?.querySelector('[data-wall-frame]')).not.toBeNull();
    expect(view?.querySelector('[data-grid-block]')).not.toBeNull();
  });

  it('Screens: the grid alone, with no switch, below twelve images', async () => {
    const view = await serverScreens();

    expect(view?.getAttribute('data-start')).toBe('grid');
    expect(view?.querySelector('[role="group"]')).toBeNull();
    expect(view?.querySelector('[data-wall-frame]')).toBeNull();
  });

  it('Screens: its own first row carries the view switch, with no row of its own above it', async () => {
    await renderPage('?view=screens');
    const row = document.querySelector('[data-screens-bar]') as HTMLElement;

    expect(within(row).getByText('11 images from 11 projects')).toBeInTheDocument();
    expect(within(row).getByRole('navigation', { name: 'Project views' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Project views' })).toHaveLength(1);
    expect(document.querySelector('[data-projects-part="views"]')).toBeNull();
  });

  it('Screens: names a project once per run of its images, the rest by their figure number', async () => {
    const gallery = PROJECTS.map((project, index) =>
      index === 1
        ? {
            ...project,
            images: [2, 3].map((at) => ({
              _type: 'image' as const,
              asset: { _ref: `image-gallery${at}-1600x1000-png`, _type: 'reference' as const },
            })),
          }
        : project,
    );
    loaders.loadProjects.mockResolvedValue(gallery);
    await renderPage('?view=screens');
    const links = within(screen.getByRole('list', { name: 'Images' })).getAllByRole('link');

    expect(links.slice(0, 3).map((link) => link.getAttribute('href'))).toEqual(hrefsAt([1, 1, 1]));
    expect(within(links[0] as HTMLElement).getByText('Project 2')).toBeVisible();
    const shown = (link: HTMLElement) =>
      Array.from(link.querySelectorAll(':scope > span:not(.sr-only)'), (part) => part.textContent)
        .filter(Boolean)
        .join(' ');
    expect(links.slice(1, 3).map((link) => shown(link as HTMLElement))).toEqual([
      'Fig. 2',
      'Fig. 3',
    ]);
    // Its link's name starts with the number it shows, as a voice user says it (WCAG 2.5.3).
    expect(links[2]).toHaveAccessibleName(
      /^Fig\. 3 ?, Project 2 Web Development .*, image 3 of 3$/,
    );
  });

  it('keeps the view in the chips and the search form, and the filters in the switch', async () => {
    const restore = wideLayout();
    try {
      await renderPage('?view=index&category=web-development');
      const chips = screen.getByRole('list', { name: 'Filter by kind' });
      const nav = screen.getByRole('navigation', { name: 'Project views' });
      const form = document.querySelector('[data-filter-part="bar"] form');

      expect(within(chips).getByRole('link', { name: /^Machine Learning/ })).toHaveAttribute(
        'href',
        '/projects?view=index&category=machine-learning',
      );
      expect(within(nav).getByRole('link', { name: 'Screens' })).toHaveAttribute(
        'href',
        '/projects?category=web-development&view=screens',
      );
      expect(form?.querySelector('input[type="hidden"][name="view"]')).toHaveAttribute(
        'value',
        'index',
      );
      expect(shown()).toEqual(projectsAt([0, 1, 2, 3]));
    } finally {
      restore();
    }
  });

  it('says so when no project the filters keep has an image, and points to Stories', async () => {
    loaders.loadProjects.mockResolvedValue(PROJECTS.slice(0, 1));
    await renderPage('?view=screens');

    expect(screen.getByRole('heading', { name: 'No images match' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'the stories' })).toHaveAttribute('href', '/projects');
  });
});

describe('/projects filters in the URL', () => {
  it('reads an old ?category link as its kind, with the count', async () => {
    await renderPage('?category=Web%20Development');

    expect(shown()).toEqual(projectsAt([0, 1, 2, 3]));
    expect(countText()).toBe('4 of 12 projects');
  });

  it('server-renders a shared ?category link already filtered, with its token', async () => {
    const html = renderToString(
      <NuqsTestingAdapter searchParams="?category=web-development">
        {await pageFor('?category=web-development')}
      </NuqsTestingAdapter>,
    );

    expect(html).toContain(`href="${hrefsAt([3])[0]}"`);
    expect(html).not.toContain(`href="${hrefsAt([4])[0]}"`);
    expect(html).toContain('Clear all');
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it.each([
    '?category=web-development&tech=react',
    '?view=index&category=web-development',
    '?view=screens&tech=python',
  ])('hydrates %s without a mismatch', async (query) => {
    const tree = (
      <NuqsTestingAdapter searchParams={query}>{await pageFor(query)}</NuqsTestingAdapter>
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
    act(() => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it('shows every project, with nothing applied, for values no project has', async () => {
    await renderPage('?category=bogus&tech=COBOL');

    expect(shown()).toEqual(projectsAt(PAGE_ORDER));
    expect(document.querySelector('[data-filter-part="count"]')).toBeNull();
    expect(document.querySelector('[data-filter-part="applied"]')).toBeNull();
  });

  it('reads an old single ?tech=Python, and ORs repeated ?tech keys', async () => {
    const single = await renderPage('?tech=Python');

    expect(shown()).toEqual(projectsAt([9, 10, 8]));
    expect(countText()).toBe('3 of 12 projects');
    single.unmount();

    await renderPage('?tech=python&tech=go');
    expect(shown()).toEqual(projectsAt([9, 10, 8, 11]));
  });

  it('writes the search to ?q as it is typed: replace, shallow, no scroll', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('', onUrlUpdate);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'NEEDLE' } });

    await waitFor(() => expect(storyLinks()).toEqual(hrefsAt([9])));
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
    const restore = wideLayout();
    try {
      const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
      await renderPage('', onUrlUpdate);
      const chips = screen.getByRole('list', { name: 'Filter by kind' });

      fireEvent.click(within(chips).getByRole('link', { name: /^Machine Learning/ }));

      await waitFor(() => expect(storyLinks()).toEqual(hrefsAt([9, 10, 8, 11])));
      await waitFor(() =>
        expect(onUrlUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ queryString: '?category=machine-learning' }),
        ),
      );
    } finally {
      restore();
    }
  });

  it('shows the designed empty state for filters that match nothing, and clears them', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('?category=web-development&tech=python', onUrlUpdate);

    expect(storyLinks()).toEqual([]);
    expect(screen.getByRole('heading', { name: 'No projects match' })).toBeInTheDocument();
    const clear = screen.getByRole('link', { name: 'Clear filters' });
    expect(clear).toHaveAttribute('href', '/projects');

    fireEvent.click(clear);

    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ queryString: '' })),
    );
  });
});

describe('/projects module boundaries', () => {
  const CLIENT_FILES = [
    '_lib/project-text.ts',
    '_lib/project-words.ts',
    '_lib/project-order.ts',
    '_lib/project-index.ts',
    '_lib/project-images.ts',
    '_lib/project-chapters.ts',
    '_lib/project-screens.ts',
    '_lib/project-views.ts',
    '_lib/project-links.ts',
    '_components/story-parts.tsx',
    '_components/lead-story.tsx',
    '_components/project-brief.tsx',
    '_components/project-stories.tsx',
    '_components/project-contents.tsx',
    '_components/project-header.tsx',
    '_components/projects-index.tsx',
    '_components/project-screens.tsx',
  ];

  const source = (file: string): string => readFileSync(path.join(PROJECTS_DIR, file), 'utf8');

  it.each(CLIENT_FILES)('%s never imports the Sanity client', (file) => {
    expect(source(file)).not.toMatch(/from ['"]@\/lib\/sanity/);
  });

  it.each(CLIENT_FILES)('%s leaves motion to the lazily loaded wall and dialog', (file) => {
    expect(source(file)).not.toMatch(/from ['"](motion|framer-motion)/);
  });

  it.each(CLIENT_FILES)(
    '%s draws no places stylesheet itself: it goes through the parts',
    (file) => {
      expect(source(file)).not.toMatch(/from ['"][^'"]*places[^'"]*\.module\.css['"]/);
    },
  );

  /** A static value import of a lazily loaded half (not `import type`, which is erased). */
  const STATIC_LIVE_IMPORT = /^import (?!type\b)[^;]*from ['"][^'"]*-live['"]/m;

  it('shows Screens with the /places parts, whose wall and open view load lazily', () => {
    const screens = source('_components/project-screens.tsx');

    for (const part of ['photo-wall', 'photo-grid', 'photo-dialog']) {
      expect(screens).toMatch(
        new RegExp(`from ['"]@/[^'"]*/places/photos/_components/${part}['"]`),
      );
    }
    for (const file of CLIENT_FILES) expect(source(file), file).not.toMatch(STATIC_LIVE_IMPORT);
    expect(existsSync(path.join(PROJECTS_DIR, '_components/screen-dialog-live.tsx'))).toBe(false);
    expect(existsSync(path.join(PROJECTS_DIR, '_components/screens-wall-live.tsx'))).toBe(false);
  });

  it('builds image URLs on the server only', () => {
    const body = source('_interface/projects-index/projects-index.tsx');

    expect(body).toMatch(/^import 'server-only';/m);
    expect(body).toMatch(/from ['"]@\/lib\/sanity\/client['"]/);
  });
});
