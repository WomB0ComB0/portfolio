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
 * @file /experience as the story, rendered by the route on mocked loaders: what the server HTML
 * holds (every role, its words and links, with no loading boundary), the chapters and their jump
 * links, the weights and logos, "What I did", "The path so far" and the empty state.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadProjects: vi.fn(),
  peekProjects: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadProjects: h.loadProjects,
  peekProjects: h.peekProjects,
}));
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ExperiencePage from '@/app/(routes)/(main)/(professioal)/experience/(list)/page';
import {
  E_DIR,
  NOW,
  ROLES,
  STREAMED_SEGMENT,
  sourceOf,
  stopOf,
  visibleText,
  ZERO_OPACITY,
} from './story-fixtures';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.loadExperiences.mockReset();
  h.loadProjects.mockReset();
  h.loadExperiences.mockResolvedValue(ROLES);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/experience: the server HTML', () => {
  it('has every role, its words and its links, with no loading boundary or entrance hiding it', async () => {
    const html = renderToString(await ExperiencePage());

    expect(html).not.toMatch(STREAMED_SEGMENT);
    expect(html).not.toMatch(ZERO_OPACITY);
    for (const role of ROLES) expect(html).toContain(`href="/experience/${role._id}"`);
    expect(html).toContain('Platform Co builds the platform');
    expect(html).toContain('Presented it at');
  });

  it('heads the page with one h1, its eyebrow and the sentence written from the figures', async () => {
    render(await ExperiencePage());

    expect(screen.getAllByRole('heading', { level: 1 }).map((h1) => h1.textContent)).toEqual([
      'Experience',
    ]);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Five roles since 2023, three of them still going. Current roles and the work that led here, by the year each role began.',
      ),
    ).toBeInTheDocument();
  });

  it('loads the roles only: the technologies are quiet words here, linked on each role page', async () => {
    await ExperiencePage();

    expect(h.loadExperiences).toHaveBeenCalledOnce();
    expect(h.loadProjects).not.toHaveBeenCalled();
  });
});

describe('/experience: the chapters', () => {
  it('runs Now, then each year a role began, each a section a jump lands on', async () => {
    const { container } = render(await ExperiencePage());
    const sections = Array.from(container.querySelectorAll<HTMLElement>('section[data-chapter]'));

    expect(sections.map((section) => section.id)).toEqual(['now', 'y2026', 'y2024']);
    // Now is a small heading whatever its count; a one-role year is one too.
    expect(sections.map((section) => section.getAttribute('data-chapter'))).toEqual([
      'inline',
      'inline',
      'inline',
    ]);
    const first = sections[0];
    if (!first) throw new Error('no chapters');
    expect(within(first).getByRole('heading', { level: 2 })).toHaveTextContent('Now');
  });

  it('lists the chapters on "Jump to" as real links, the years with their counts in words', async () => {
    render(await ExperiencePage());
    const jumps = within(screen.getByRole('navigation', { name: 'Jump to' }));

    expect(jumps.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '#now',
      '#y2026',
      '#y2024',
    ]);
    // Now's count is the opening sentence's ('three of them still going'), said once.
    expect(jumps.getByRole('link', { name: 'Now' })).toHaveTextContent(/^Now$/);
    expect(jumps.getByRole('link', { name: '2026, 1 role' })).toBeInTheDocument();
  });

  it('says how many roles run now once, in the opening sentence', async () => {
    const { container } = render(await ExperiencePage());
    const now = container.querySelector<HTMLElement>('#now header');
    const jumps = screen.getByRole('navigation', { name: 'Jump to' });

    expect(screen.getByText(/three of them still going/)).toBeInTheDocument();
    expect(visibleText(now)).not.toMatch(/\b3\b|three/i);
    expect(within(jumps).getByRole('link', { name: 'Now' }).textContent).not.toMatch(/\d/);
  });

  it('sets Now as a small heading that says it is still going, so the lead role is the display line', async () => {
    const { container } = render(await ExperiencePage());
    const now = container.querySelector<HTMLElement>('#now header');

    expect(now?.querySelector('h2')).toHaveTextContent(/^Now$/);
    expect(visibleText(now?.querySelector('[data-byline]'))).toBe('Still going');
    // No summary line repeating the names the stops below already lead with.
    expect(visibleText(now)).not.toContain('Handshake');
    expect(now?.querySelector('h2')?.className).toContain('folio-numeral-inline');
  });
});

describe('/experience: the roles on the rail', () => {
  it('hangs every role off the rail once, each at the id the way back from its page lands on', async () => {
    const { container } = render(await ExperiencePage());
    const stops = Array.from(container.querySelectorAll<HTMLElement>('li[data-role-row]'));

    expect(stops.map((stop) => stop.id)).toEqual([
      'role-lead',
      'role-handshake',
      'role-elysium',
      'role-curve',
      'role-dfg',
    ]);
  });

  it('sets the lead large and the rest compact, and links each title to the role page', async () => {
    const { container } = render(await ExperiencePage());
    const weights = Array.from(container.querySelectorAll('li[data-role-row]')).map((stop) =>
      stop.getAttribute('data-weight'),
    );
    const lead = stopOf(container, 'lead');

    expect(weights).toEqual(['lead', 'compact', 'compact', 'compact', 'compact']);
    expect(
      within(lead).getByRole('link', { name: 'Founder & CEO at Platform Co' }),
    ).toHaveAttribute('href', '/experience/lead');
  });

  it('marks each stop with its month and gives the byline since when and how long in words', async () => {
    const { container } = render(await ExperiencePage());
    const lead = stopOf(container, 'lead');
    const curve = stopOf(container, 'curve');

    expect(lead.querySelector('[data-stop-month]')).toHaveTextContent('Mar 2026');
    expect(curve.querySelector('[data-stop-month]')).toHaveTextContent('Mar');
    expect(visibleText(lead.querySelector('[data-role-meta]'))).toBe('Since Mar 2026 · 9 months');
    expect(visibleText(curve.querySelector('[data-role-meta]'))).toBe(
      'Mar 2026 – Sep 2026 · 7 months',
    );
    // A screen reader hears "to", not a dash.
    expect(curve.querySelector('[data-role-meta] .sr-only')).toHaveTextContent('to');
  });

  it('prints no raw address: each link is named in its sentence and opens in a new tab', async () => {
    const { container } = render(await ExperiencePage());
    const lead = stopOf(container, 'lead');
    const link = within(lead).getByRole('link', { name: /platform\.example/ });

    expect(visibleText(container.querySelector('[data-role-story]'))).not.toContain('https://');
    expect(link).toHaveAttribute('href', 'https://platform.example/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.querySelector('.sr-only')).toHaveTextContent('opens in a new tab');
  });

  it('lists the technologies as quiet words, not links', async () => {
    const { container } = render(await ExperiencePage());
    const tech = within(stopOf(container, 'curve')).getByRole('list', { name: 'Built with' });

    expect(
      within(tech)
        .getAllByRole('listitem')
        .map((item) => visibleText(item)),
    ).toEqual(['Astro ·', 'TypeScript ·', 'React.js']);
    expect(within(tech).queryAllByRole('link')).toHaveLength(0);
  });
});

describe('/experience: "What I did"', () => {
  it("keeps a compact role's duties behind a closed native disclosure, named by its role", async () => {
    const { container } = render(await ExperiencePage());
    const more = stopOf(container, 'curve').querySelector<HTMLDetailsElement>(
      'details[data-role-more]',
    );
    if (!more) throw new Error('no disclosure');

    expect(more.open).toBe(false);
    expect(visibleText(more.querySelector('summary'))).toBe('What I did');
    expect(more.querySelector('summary')).toHaveTextContent(
      'What I did as Software Engineer at Curve',
    );
    // Both sentences fit the opening (240 characters), so they stay in view and the disclosure
    // holds the duties the description does not state, their links named.
    const sentence = stopOf(container, 'curve').querySelector('article p:not([data-role-meta])');
    expect(visibleText(more)).not.toContain('Then moved the app.');
    expect(stopOf(container, 'curve').textContent).toContain('Then moved the app.');
    expect(sentence).not.toBeNull();
    expect(within(more).getByRole('link', { name: /IEEE LISAT 2024/ })).toHaveAttribute(
      'href',
      'https://ieeexplore.ieee.org/document/1',
    );
    expect(visibleText(more)).not.toContain('Built the blog from scratch as lead developer');
  });

  it("shows the lead's duties outright, and gives a role with nothing more no disclosure", async () => {
    const { container } = render(await ExperiencePage());
    const lead = stopOf(container, 'lead');

    expect(lead.querySelector('details')).toBeNull();
    expect(visibleText(lead.querySelector('[data-role-duties]'))).toBe('Founded the company');
    expect(stopOf(container, 'elysium').querySelector('details')).toBeNull();
  });
});

describe('/experience: logos', () => {
  it("sets a role's logo small before its organization, and no tile without one", async () => {
    const { container } = render(await ExperiencePage());
    const lead = stopOf(container, 'lead');

    const logo = lead.querySelector('[data-role-organization] [data-role-logo]');
    expect(logo).not.toBeNull();
    expect(logo?.querySelector('img')).toHaveAttribute('alt', '');
    expect(stopOf(container, 'curve').querySelector('[data-role-logo]')).toBeNull();
    expect(container.querySelector('[data-role-story] [data-role-monogram]')).toBeNull();
  });
});

describe('/experience: "The path so far"', () => {
  const pathOf = (container: HTMLElement): HTMLElement => {
    const figure = container.querySelector<HTMLElement>('figure[data-role-path]');
    if (!figure) throw new Error('no path');
    return figure;
  };

  it.each([true, false])(
    'comes directly after the page header and before chapter jumps and cards (current roles: %s)',
    async (hasCurrent) => {
      if (!hasCurrent) {
        h.loadExperiences.mockResolvedValue(
          ROLES.map((role) => ({ ...role, current: false, endDate: '2026-09-30' })),
        );
      }
      const { container } = render(await ExperiencePage());
      const figure = pathOf(container);
      const story = container.querySelector('[data-role-story]');
      const jumps = screen.getByRole('navigation', { name: 'Jump to' });
      const firstChapter = container.querySelector('section[data-chapter]');

      expect(story?.previousElementSibling).toBe(container.querySelector('header'));
      expect(story?.firstElementChild).toBe(figure);
      expect(figure.closest('section')).toBeNull();
      expect(figure.nextElementSibling).toBe(jumps);
      expect(firstChapter).not.toBeNull();
      expect(jumps.compareDocumentPosition(firstChapter as Element)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    },
  );

  it('links every role, oldest first, to its stop, named by organization, role and months', async () => {
    const { container } = render(await ExperiencePage());
    const links = within(pathOf(container)).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#role-elysium',
      '#role-dfg',
      '#role-handshake',
      '#role-lead',
      '#role-curve',
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      'Elysium, Freelance Developer, since Jan 2023',
      'Develop for Good, Program Lead, Apr 2024 to Feb 2026',
      'Handshake, AI Fellow, since Nov 2025',
      'Platform Co, Founder & CEO, since Mar 2026',
      'Curve, Software Engineer, Mar 2026 to Sep 2026',
    ]);
    for (const link of links) {
      expect(container.querySelector(link.getAttribute('href') ?? '')).not.toBeNull();
    }
  });

  it('says what the lines are and the peak once, in words, and keeps the drawing decorative', async () => {
    const { container } = render(await ExperiencePage());
    const figure = pathOf(container);

    expect(visibleText(figure.querySelector('figcaption'))).toBe(
      'The path so far. Each line is a role, from its first month to its last; the lines that reach Now are still going. Four ran at once at the peak, Mar – Sep 2026.',
    );
    expect(figure.querySelector('figcaption .sr-only')).toHaveTextContent(
      'from Mar 2026 to Sep 2026',
    );
    expect(figure.querySelector('[data-path-years]')).toHaveAttribute('aria-hidden', 'true');
    for (const line of Array.from(figure.querySelectorAll('[data-path-line]'))) {
      expect(line).toHaveAttribute('aria-hidden', 'true');
    }
    // Said once: the old "Roles at once" stack is gone from the list.
    expect(container.querySelector('[data-month-stack]')).toBeNull();
  });

  it("marks the roles that still run, which reach the axis's end", async () => {
    const { container } = render(await ExperiencePage());
    const current = Array.from(
      pathOf(container).querySelectorAll<HTMLElement>('li[data-current] a'),
    ).map((link) => link.dataset.r);

    expect(current).toEqual(['elysium', 'handshake', 'lead']);
  });
});

describe('/experience: no roles', () => {
  it('shows the empty state and no chapters', async () => {
    h.loadExperiences.mockResolvedValue([]);
    const { container } = render(await ExperiencePage());

    expect(screen.getByText('No roles listed yet')).toBeInTheDocument();
    expect(container.querySelector('section[data-chapter]')).toBeNull();
  });
});

describe('the story modules', () => {
  it('draws the story from server modules with no client directive, hooks or motion', () => {
    const files = [
      `${E_DIR}/_interface/role-story/role-story.tsx`,
      ...['role-chapter', 'role-stop', 'role-path', 'linked-prose'].map(
        (name) => `${E_DIR}/_components/story/${name}.tsx`,
      ),
    ];
    for (const file of files) {
      const source = sourceOf(file);
      expect(source, file).not.toMatch(/['"]use client['"]/);
      expect(source, file).not.toMatch(/\buse(State|Effect|LayoutEffect|Ref)\(/);
      expect(source, file).not.toMatch(/from 'motion/);
    }
  });
});
