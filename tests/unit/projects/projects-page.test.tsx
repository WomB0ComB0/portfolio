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
 * @file /projects renders on the server: every project is a link in the first HTML, with no
 * pagination, no loader and nothing hidden behind an entrance animation. The filters live in the
 * URL (?q, ?category, ?tech) and the client island reads and writes them there; an unknown
 * category or technology in the URL shows everything. Only the loaders are mocked; image URLs
 * come from the real Sanity URL builder.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { makeProject } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/hooks/sanity/schemas';

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

const categoryOf = (index: number): string => {
  if (index < 4) return 'Web';
  if (index < 8) return 'Mobile';
  return 'Machine Learning';
};

const imageOf = (index: number): Project['image'] => ({
  _type: 'image',
  asset: { _ref: `image-shot${index}-1600x900-png`, _type: 'reference' },
  alt: `Screenshot of project ${index + 1}`,
});

/**
 * Twelve projects, more than the old first page of nine: four per category, the last one alone
 * in Python, the tenth the only one about a needle, and the first without an image.
 */
const PROJECTS: readonly Project[] = Array.from({ length: 12 }, (_, index) =>
  makeProject({
    title: `Project ${index + 1}`,
    description:
      index === 9 ? 'Finds a needle in the haystack.' : `What project ${index + 1} does.`,
    category: categoryOf(index),
    technologies: index === 11 ? ['Python'] : ['TypeScript', 'React'],
    image: index === 0 ? null : imageOf(index),
  }),
);

const hrefOf = (project: Project): string => `/projects/${project._id}`;

/** The fixture at `index`, which the list above always has. */
const projectAt = (index: number): Project => {
  const project = PROJECTS[index];
  if (!project) throw new Error(`no fixture project at ${index}`);
  return project;
};

async function renderPage(
  searchParams = '',
  onUrlUpdate?: OnUrlUpdateFunction,
): Promise<ReturnType<typeof render>> {
  const page: ReactElement = await ProjectsPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      {page}
    </NuqsTestingAdapter>,
  );
}

/** The hrefs of every project card on the page, in order. */
const projectLinks = (): string[] =>
  screen
    .queryAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/projects/'));

const cardOf = (project: Project): HTMLElement => {
  const card = document.querySelector<HTMLElement>(`a[href="${hrefOf(project)}"]`);
  if (!card) throw new Error(`no card links to ${hrefOf(project)}`);
  return card;
};

beforeEach(() => {
  loaders.loadProjects.mockReset();
  loaders.loadProjects.mockResolvedValue(PROJECTS);
});

describe('/projects on the server', () => {
  it('links every project, including those past the old first page of nine', async () => {
    await renderPage();

    expect(projectLinks()).toEqual(PROJECTS.map(hrefOf));
    for (const project of PROJECTS.slice(9)) {
      expect(within(cardOf(project)).getByRole('heading', { level: 3 })).toHaveTextContent(
        project.title,
      );
    }
    expect(screen.getByRole('heading', { level: 1, name: 'My Projects' })).toBeInTheDocument();
  });

  it('puts every card in the server HTML, visible, with no loader or skeleton', async () => {
    const html = renderToString(<NuqsTestingAdapter>{await ProjectsPage()}</NuqsTestingAdapter>);

    for (const project of PROJECTS) {
      expect(html).toContain(`href="${hrefOf(project)}"`);
      expect(html).toContain(project.title);
    }
    // An entrance animation serialises opacity:0 into the HTML; a hover gradient's 0.8 is fine.
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
    expect(html).not.toContain('loader-ring-title');
    expect(html).not.toContain('Loading more projects');
    expect(html).not.toContain('Load More Projects');
  });

  it('shows a placeholder for a project without an image and the image for the others', async () => {
    await renderPage();

    const withoutImage = cardOf(projectAt(0));
    expect(withoutImage.querySelector('[data-slot="project-image-placeholder"]')).not.toBeNull();
    expect(withoutImage.querySelector('img')).toBeNull();

    const image = within(cardOf(projectAt(1))).getByRole('img', {
      name: 'Screenshot of project 2',
    });
    expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(
      'cdn.sanity.io/images/test/test/shot1-1600x900.png?w=800&h=450',
    );
  });
});

describe('/projects filters in the URL', () => {
  it('shows only the category in ?category, with the count', async () => {
    await renderPage('?category=Web');

    expect(projectLinks()).toEqual(PROJECTS.slice(0, 4).map(hrefOf));
    expect(screen.getByText('Showing 4 of 12 projects')).toBeInTheDocument();
  });

  it('server-renders the count and Clear for a filter in the URL, visible without JavaScript', async () => {
    const html = renderToString(
      <NuqsTestingAdapter searchParams="?category=Web">{await ProjectsPage()}</NuqsTestingAdapter>,
    );

    expect(html).toContain('Showing <!-- -->4<!-- --> of <!-- -->12<!-- --> <!-- -->projects');
    expect(html).toContain('Clear');
    // An entrance serialises opacity:0 into the HTML; MagicCard's hover gradient's 0.8 is fine.
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it('hydrates a filtered server render without a mismatch', async () => {
    const tree = (
      <NuqsTestingAdapter searchParams="?category=Web">{await ProjectsPage()}</NuqsTestingAdapter>
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
    expect(within(container).getAllByRole('heading', { level: 3 })).toHaveLength(4);
    act(() => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it('shows every project for a category no project has', async () => {
    await renderPage('?category=bogus&tech=COBOL');

    expect(projectLinks()).toEqual(PROJECTS.map(hrefOf));
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it('shows only the projects using ?tech', async () => {
    await renderPage('?tech=Python');

    expect(projectLinks()).toEqual([hrefOf(projectAt(11))]);
    expect(screen.getByText('Showing 1 of 12 projects')).toBeInTheDocument();
  });

  it('writes the search to ?q, replacing the history entry, and filters as it is typed', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('', onUrlUpdate);

    fireEvent.change(screen.getByPlaceholderText('Search projects...'), {
      target: { value: 'NEEDLE' },
    });

    expect(projectLinks()).toEqual([hrefOf(projectAt(9))]);
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: '?q=NEEDLE',
          options: expect.objectContaining({ history: 'replace', shallow: true }),
        }),
      ),
    );
  });

  it('offers to clear filters that match nothing, and clearing empties the URL', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('?category=Web&tech=Python', onUrlUpdate);

    expect(projectLinks()).toEqual([]);
    expect(screen.getByRole('heading', { name: 'No matches found' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ queryString: '' })),
    );
  });

  it('says there are no projects yet only when the list is empty', async () => {
    loaders.loadProjects.mockResolvedValue([]);
    await renderPage();

    expect(screen.getByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });
});

describe('/projects client island', () => {
  it.each(['_components/project-card.tsx', '_components/projects-explorer.tsx'])(
    '%s never imports the Sanity client or motion',
    (file) => {
      const source = readFileSync(path.join(PROJECTS_DIR, file), 'utf8');

      expect(source).not.toMatch(/from ['"]@\/lib\/sanity/);
      expect(source).not.toMatch(/from ['"](motion|framer-motion)/);
    },
  );
});
