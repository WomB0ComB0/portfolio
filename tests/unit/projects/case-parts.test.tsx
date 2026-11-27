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
 * @file The project page's "How it fits together" section (case-parts.tsx, drawn by
 * case-study.tsx between The project and Screens): a region named by its h2, then an unordered
 * list with one h3 per part, because the parts are parallel pieces of one system, never a
 * sequence. A public repository is a new-tab link named by its owner/repo, with a link-health
 * badge; a private one is the plain words "Private repository", with nothing to focus; a part
 * with its own page on /projects links there from its name. Technologies are plain words (Built
 * with below links them), and the lead sentence and "My part" show only when Studio has them.
 * Every repository is invented.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CaseSystem,
  PartRow,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-parts';
import { expectLabelInName } from '../../utils/label-in-name';

vi.mock('@/lib/sanity/client', () => ({ urlFor: vi.fn() }));

// The badge reads the link-health store; here it only shows which link it was given.
vi.mock('@/components/link-health/link-health-badge', () => ({
  LinkHealthBadge: ({ href, scope }: { readonly href: string; readonly scope: string }) => (
    <span data-badge-href={href} data-badge-scope={scope} />
  ),
}));

// Vite cannot load the repo's PostCSS config: each class `name` is `name`, as in the page test.
vi.mock(
  '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-body.module.css',
  () => ({
    default: new Proxy({} as Record<string, string>, {
      get: (_target, name) => (typeof name === 'string' ? name : undefined),
    }),
  }),
);

import { CaseParts } from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-parts';
import { CaseStudy } from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-study';

const row = (overrides: Partial<PartRow> & Pick<PartRow, 'key' | 'name'>): PartRow => ({
  role: null,
  page: null,
  repo: null,
  isPrivate: false,
  technologies: [],
  contribution: null,
  ...overrides,
});

const WEB = row({
  key: 'web',
  name: 'Web app',
  role: 'Where people sign in and study a page.',
  repo: { href: 'https://github.com/example-org/example-web', label: 'example-org/example-web' },
  technologies: ['Next.js', 'Supabase'],
  contribution: 'The scraper and the PWA, in a team of five.',
});
const EXTENSION = row({
  key: 'extension',
  name: 'Browser extension',
  role: 'Scrapes the page you are on.',
  repo: {
    href: 'https://github.com/example-org/example-extension',
    label: 'example-org/example-extension',
  },
  technologies: ['Plasmo', 'React'],
});
const CORE = row({
  key: 'core',
  name: 'Core service',
  role: 'Runs the jobs behind both.',
  isPrivate: true,
});
const SHORTENER = row({
  key: 'shortener',
  name: 'Example Shortener',
  role: 'Short links and click analytics.',
  page: '/projects/proj-shortener',
  repo: {
    href: 'https://github.com/example-org/example-shortener',
    label: 'example-org/example-shortener',
  },
});

const SUMMARY = 'People study in the web app or the extension; both send pages to one service.';
const SYSTEM: CaseSystem = { summary: SUMMARY, parts: [WEB, EXTENSION, CORE, SHORTENER] };

/** The case study with only the parts section (no text, screens or technologies). */
const partsOnly = (system: CaseSystem | null): ReactElement => (
  <CaseStudy longDescription={null} technologies={[]} screens={[]} system={system} />
);

const region = (): HTMLElement => screen.getByRole('region', { name: 'How it fits together' });
const partNamed = (name: string): HTMLElement => {
  const heading = within(region()).getByRole('heading', { level: 3, name });
  const item = heading.closest('li');
  if (!item) throw new Error(`no list item around ${name}`);
  return item;
};

afterEach(cleanup);

describe('the case study without parts', () => {
  it('draws nothing for a null system when nothing else has text', () => {
    const { container } = render(partsOnly(null));

    expect(container).toBeEmptyDOMElement();
  });

  it('draws no parts section beside the other sections', () => {
    const { container } = render(
      <CaseStudy
        longDescription="Does a thing."
        technologies={['Go']}
        screens={[]}
        system={null}
      />,
    );

    expect(container.querySelector('[data-case-section="parts"]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'How it fits together' })).toBeNull();
  });
});

describe('How it fits together', () => {
  it('is a region named by its h2, alone when Studio has no other text', () => {
    const { container } = render(partsOnly(SYSTEM));

    expect(region()).toHaveAttribute('data-case-section', 'parts');
    expect(region()).toHaveAttribute('id', 'parts');
    expect(within(region()).getByRole('heading', { level: 2 })).toHaveTextContent(
      'How it fits together',
    );
    expect(
      Array.from(container.querySelectorAll('[data-case-section]')).map((section) =>
        section.getAttribute('data-case-section'),
      ),
    ).toEqual(['parts']);
  });

  it('lists the parts in an unordered list, one h3 each, in Studio order', () => {
    render(partsOnly(SYSTEM));
    const list = within(region()).getByRole('list');

    expect(list.tagName).toBe('UL');
    expect(region().querySelector('ol')).toBeNull();
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(
      within(region())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Web app', 'Browser extension', 'Core service', 'Example Shortener →']);
    expect(partNamed('Web app')).toHaveAttribute('data-case-part-key', 'web');
  });

  it('links a public repository in a new tab, named by its owner/repo, with a badge', () => {
    render(partsOnly(SYSTEM));
    const link = within(partNamed('Browser extension')).getByRole('link');

    expect(link).toHaveAttribute('href', 'https://github.com/example-org/example-extension');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('data-case-part-link', 'repo');
    expect(link).toHaveAccessibleName('example-org/example-extension code (opens in a new tab)');
    expectLabelInName(link);
    const badge = partNamed('Browser extension').querySelector('[data-badge-href]');
    expect(badge).toHaveAttribute(
      'data-badge-href',
      'https://github.com/example-org/example-extension',
    );
    expect(badge).toHaveAttribute('data-badge-scope', 'projects');
  });

  it('says "Private repository" for a private part, with no link or badge', () => {
    render(partsOnly(SYSTEM));
    const core = partNamed('Core service');

    expect(within(core).getByText('Private repository')).toBeInTheDocument();
    expect(core.querySelector('a')).toBeNull();
    expect(core.querySelector('[data-badge-href]')).toBeNull();
    expect(core.querySelector('[aria-disabled], [tabindex]')).toBeNull();
  });

  it('links a part with its own page from its name, and still links its repository', () => {
    render(partsOnly(SYSTEM));
    const shortener = partNamed('Example Shortener');
    const pageLink = within(shortener).getByRole('link', { name: 'Example Shortener' });

    expect(pageLink).toHaveAttribute('href', '/projects/proj-shortener');
    expect(pageLink).toHaveAttribute('data-case-part-link', 'page');
    expect(pageLink).not.toHaveAttribute('target');
    expect(pageLink.closest('h3')).not.toBeNull();
    expect(
      within(shortener).getByRole('link', { name: /^example-org\/example-shortener code/ }),
    ).toHaveAttribute('href', 'https://github.com/example-org/example-shortener');
  });

  it('writes the technologies as plain words, led by a spoken "Technologies:"', () => {
    render(partsOnly(SYSTEM));
    const techs = partNamed('Browser extension').querySelector('[data-case-part-techs]');

    expect(techs).not.toBeNull();
    expect(techs?.querySelector('a')).toBeNull();
    expect(techs?.querySelector('.sr-only')).toHaveTextContent('Technologies:');
    expect(techs).toHaveTextContent('Plasmo · React');
    for (const dot of techs?.querySelectorAll('[aria-hidden="true"]') ?? []) {
      expect(dot.textContent?.trim()).toBe('·');
    }
    expect(partNamed('Core service').querySelector('[data-case-part-techs]')).toBeNull();
  });

  it('shows "My part" only for a part that has it', () => {
    render(partsOnly(SYSTEM));

    expect(partNamed('Web app').querySelector('[data-case-part-mine]')).toHaveTextContent(
      'My part The scraper and the PWA, in a team of five.',
    );
    expect(partNamed('Browser extension').querySelector('[data-case-part-mine]')).toBeNull();
    expect(within(region()).getAllByText('My part')).toHaveLength(1);
  });

  it('leads with the summary only when Studio has one', () => {
    const { unmount } = render(partsOnly(SYSTEM));

    expect(region().querySelector('[data-case-parts-lead]')).toHaveTextContent(SUMMARY);
    unmount();
    render(partsOnly({ ...SYSTEM, summary: null }));
    expect(region().querySelector('[data-case-parts-lead]')).toBeNull();
  });

  it('never nests one link in another', () => {
    const { container } = render(partsOnly(SYSTEM));

    expect(container.querySelector('a a')).toBeNull();
  });

  it('draws a row with only a name and a role, and no meta line, without leaving gaps', () => {
    render(
      partsOnly({ summary: null, parts: [row({ key: 'a', name: 'Alpha', role: 'One.' }), CORE] }),
    );
    const alpha = partNamed('Alpha');

    expect(alpha.querySelector('[data-case-part-meta]')).toBeNull();
    expect(alpha.querySelector('a')).toBeNull();
    expect(alpha).toHaveTextContent('AlphaOne.');
  });
});

describe('CaseParts on the server', () => {
  it('escapes Studio text and starts visible: no aria-busy, nothing at opacity 0', () => {
    const html = renderToString(
      <CaseParts
        system={{
          summary: 'A <b>bold</b> claim.',
          parts: [
            row({
              key: 'x',
              name: '<script>alert(1)</script>',
              role: '<img src=x onerror=alert(1)>',
            }),
            CORE,
          ],
        }}
      />,
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/aria-busy/);
    expect(html).not.toMatch(/opacity:\s*0/);
  });
});
