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
 * @file axe on a project page with "How it fits together": three parts, one public (a new-tab
 * repository link), one private (plain words, nothing to focus) and one with its own page on
 * /projects (its name a link). The section adds one h2 and an h3 per part under the page's one
 * h1, and every link's name starts with the words it shows. Rendered as the page renders it,
 * from ProjectDetail with the project list beside it; every repository is invented.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { makeProject, makeProjectPart } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../utils/axe';
import { expectLabelInName } from '../../utils/label-in-name';

vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'production' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/components/link-health/link-health-badge', () => ({ LinkHealthBadge: () => null }));

// Vite cannot load the repo's PostCSS config: each class `name` is `name`, as in the page test.
const cssNames = vi.hoisted(() => () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? name : undefined),
  }),
}));
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-hero.module.css',
  cssNames,
);
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-body.module.css',
  cssNames,
);
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/where-it-sits.module.css',
  cssNames,
);
vi.mock('@/components/console/photo/photo-viewer.module.css', cssNames);

import { ProjectDetail } from '@/app/(routes)/(main)/(professioal)/projects/_interface/project-detail/project-detail';

afterEach(cleanup);

const SHORTENER = makeProject({
  title: 'Example Shortener - Short links',
  startDate: '2024-02-01',
});
const SYSTEM = makeProject({
  title: 'Example Platform - Several services',
  longDescription: 'One platform made of several services. Each has its own repository.',
  technologies: ['Next.js', 'TypeScript'],
  githubUrl: 'https://github.com/example-org/example-web',
  startDate: '2025-01-01',
  systemSummary: 'Visitors use the website; the core service and the shortener sit behind it.',
  systemParts: [
    makeProjectPart({
      _key: 'web',
      name: 'Website',
      role: 'The pages people read.',
      repoUrl: 'https://github.com/example-org/example-web',
      technologies: ['Next.js', 'Bun'],
      contribution: 'Sole author.',
    }),
    makeProjectPart({
      _key: 'core',
      name: 'Core service',
      role: 'Runs the jobs behind the website.',
      repoUrl: undefined,
      technologies: [],
    }),
    makeProjectPart({
      _key: 'shortener',
      name: 'Example Shortener',
      role: 'Short links and click analytics.',
      repoUrl: 'https://github.com/example-org/example-shortener',
      projectId: SHORTENER._id,
      technologies: [],
    }),
  ],
});

describe('a project page with its parts under axe', () => {
  it('finds nothing to fix, with one h1, an h2 for the section and an h3 per part', async () => {
    const { container } = render(<ProjectDetail project={SYSTEM} projects={[SYSTEM, SHORTENER]} />);
    const parts = screen.getByRole('region', { name: 'How it fits together' });

    await expectNoAxeViolations(container, { label: 'a project page with parts' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(parts).getAllByRole('heading', { level: 3 })).toHaveLength(3);
    for (const link of within(parts).getAllByRole('link')) expectLabelInName(link);
  });
});
