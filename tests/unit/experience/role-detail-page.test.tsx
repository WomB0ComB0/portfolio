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
 * @file /experience/[id], rendered on the server from the loaders: "this role on the clock,
 * then what it was". The header (organization, the position as the one h1, period, length and
 * place), the clock tile (the role's months as the stack's bottom row among every other role's,
 * how many ran alongside and how many at once at its busiest), the whole description without
 * raw addresses, the duties it does not already state, the links as named chips, the
 * technologies as tokens into /projects, the roles that ran alongside with the months shared,
 * and the roles before and after it in the list's order. Everything is in the first HTML.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { makeExperience, makeProject } from '@tests/fixtures/sanity-docs';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadExperienceById: vi.fn(),
  loadProjects: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadExperienceById: h.loadExperienceById,
  loadProjects: h.loadProjects,
  // No list of projects cached in this process: a failed read leaves the technologies plain.
  peekProjects: () => undefined,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import { RoleDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/role-detail/role-detail';
import ExperienceDetailPage from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import type { Experience } from '@/hooks/sanity/schemas';
import { logger } from '@/utils';

const E_DIR = 'src/app/(routes)/(main)/(professioal)/experience';
const DETAIL_FILE = `${E_DIR}/_interface/role-detail/role-detail.tsx`;
const CONTEXT_FILE = `${E_DIR}/_components/role-context.tsx`;

/** An inline opacity of exactly 0 (not 0.8): what a motion entrance leaves in server HTML. */
const ZERO_OPACITY = /opacity:\s*0(?![.\d])/;
/** A Suspense boundary's streamed segment: what loading.tsx leaves hidden without JavaScript. */
const STREAMED_SEGMENT = /<div hidden id="S:/;
/** Noon in New York on 12 November 2026. */
const NOW = new Date('2026-11-12T17:00:00Z');

const LOGO = {
  _type: 'image' as const,
  asset: { _ref: 'image-logo-200x200-png', _type: 'reference' as const },
};

const exp = (
  id: string,
  order: number,
  startDate: string,
  endDate: string | null,
  extra: Partial<Experience>,
): Experience =>
  makeExperience({ _id: id, order, startDate, endDate, current: endDate === null, ...extra });

/** Studio order: the lead, an ended role, two more current ones and another ended one. */
const ROLES: readonly Experience[] = [
  exp('lead', 1, '2026-03-01', null, {
    company: 'Platform Co, Inc.',
    position: 'Founder & CEO',
    logo: LOGO,
    location: 'New York, NY',
    description: 'Platform Co builds the platform for teams.',
    responsibilities: ['Founded the company'],
    technologies: ['TypeScript', 'Rust'],
  }),
  exp('curve', 2, '2026-03-01', '2026-09-30', {
    company: 'Curve Labs LLC',
    companyUrl: 'https://curve.example',
    position: 'Software Engineer',
    location: 'Remote',
    description:
      'Built the blog (https://blog.curve.example) from scratch as lead developer. Then moved the app to a newer router.',
    responsibilities: [
      'Built the blog from scratch as lead developer',
      'Added 172 of its 174 tests (https://github.com/example/cms)',
      'Presented it at IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/1)',
    ],
    technologies: ['Astro', 'TypeScript', 'React.js'],
  }),
  exp('elysium', 3, '2023-01-01', null, {
    company: 'Elysium',
    position: 'Freelance Developer',
    description: 'Built a national website as a client project.',
    responsibilities: [],
    technologies: [],
  }),
  exp('dfg', 4, '2024-04-01', '2026-02-28', {
    company: 'Develop for Good',
    position: 'Program Lead',
    description: 'Rose from engineer to lead over 5 projects.',
  }),
  exp('handshake', 5, '2025-11-01', null, {
    company: 'Handshake',
    position: 'AI Fellow',
    description: 'Contract position working on AI training.',
  }),
];
const PROJECTS = [
  makeProject({ technologies: ['TypeScript', 'React'] }),
  makeProject({ technologies: ['TypeScript'] }),
];

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const sourceOf = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

/** What a reader's eye skips: words for screen readers, a monogram, the new-tab arrow. */
const NOT_READ = '.sr-only, [data-role-monogram], [data-new-tab-arrow]';

/** An element's text as read on screen, whitespace collapsed. */
function visibleText(element: Element | null | undefined): string {
  if (!element) return '';
  const copy = element.cloneNode(true) as Element;
  for (const hidden of Array.from(copy.querySelectorAll(NOT_READ))) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const classesOf = (element: Element | null | undefined): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** The page for one of the fixture's roles. */
const pageFor = async (id: string) => render(await ExperienceDetailPage(paramsFor(id)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.loadExperiences.mockReset();
  h.loadExperienceById.mockReset();
  h.loadProjects.mockReset();
  h.reportApiFailure.mockReset();
  h.loadExperiences.mockResolvedValue(ROLES);
  h.loadExperienceById.mockImplementation(
    async (id: string) => ROLES.find((role) => role._id === id) ?? null,
  );
  h.loadProjects.mockResolvedValue(PROJECTS);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/experience/[id]: the server HTML', () => {
  it('has the whole role, with no loading boundary or entrance hiding it', async () => {
    const html = renderToString(await ExperienceDetailPage(paramsFor('curve')));

    expect(html).toContain('Software Engineer');
    expect(html).toContain('Then moved the app to a newer router.');
    expect(html).toContain('Added 172 of its 174 tests');
    expect(html).toContain('href="https://github.com/example/cms"');
    expect(html).toContain('href="/projects?tech=typescript"');
    expect(html).toContain('href="/experience/handshake"');
    expect(html).toContain('href="/experience/dfg"');
    expect(html).not.toMatch(STREAMED_SEGMENT);
    expect(html).not.toMatch(ZERO_OPACITY);
  });

  it('never prints a raw address', async () => {
    const { container } = await pageFor('curve');

    expect(visibleText(container)).not.toMatch(/https?:\/\//);
  });
});

describe('/experience/[id]: the header', () => {
  it('heads the page with the position as its one h1, over the period, length and place', async () => {
    const { container } = await pageFor('curve');

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Software Engineer');
    expect(visibleText(container.querySelector('[data-role-facts]'))).toBe(
      'Mar 2026 – Sep 2026 · 7 mos · Remote',
    );
    expect(container.querySelector('[data-role-facts] time')).toHaveAttribute(
      'datetime',
      '2026-03',
    );
  });

  it('names the organization as the list does, linked to its site in a new tab', async () => {
    await pageFor('curve');

    const site = screen.getByRole('link', { name: /^Curve Labs/ });
    expect(visibleText(site)).toBe('Curve Labs');
    expect(site).toHaveAttribute('href', 'https://curve.example');
    expect(site).toHaveAttribute('target', '_blank');
    expect(site.getAttribute('rel')).toBe('noopener noreferrer');
    expect(site).toHaveAccessibleName('Curve Labs (opens in a new tab)');
  });

  it("reaches 44px around the organization's link on a touch screen, without growing its line", async () => {
    await pageFor('curve');

    const classes = classesOf(screen.getByRole('link', { name: /^Curve Labs/ }));
    // The 20px line keeps its height; an overlay 12px past it, above and below, takes the tap.
    expect(classes).toEqual(
      expect.arrayContaining([
        'relative',
        'pointer-coarse:after:absolute',
        'pointer-coarse:after:-inset-y-3',
        "pointer-coarse:after:content-['']",
      ]),
    );
    expect(classes.some((name) => /^pointer-coarse:(min-)?h-/.test(name))).toBe(false);
  });

  it('prints the organization as text when Studio has no http(s) site for it', async () => {
    const { container } = await pageFor('lead');

    const eyebrow = container.querySelector('[data-role-organization]');
    expect(visibleText(eyebrow)).toBe('Platform Co');
    expect(eyebrow?.closest('a')).toBeNull();
    expect(eyebrow?.querySelector('a')).toBeNull();
    expect(container.querySelector('header [data-role-detail-logo] img')).not.toBeNull();
  });

  it('places one whole-color detail logo above the organization without a tiny duplicate', async () => {
    const { container } = await pageFor('lead');
    const logo = container.querySelector('header [data-role-detail-logo]');
    const organization = container.querySelector('[data-role-organization]');
    expect(logo?.tagName).toBe('SPAN');
    expect(logo?.compareDocumentPosition(organization as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container.querySelectorAll('header [data-role-detail-logo]')).toHaveLength(1);
    expect(container.querySelector('header [data-role-logo]')).toBeNull();
    expect(logo?.closest('p')?.querySelector('div')).toBeNull();
    const src = decodeURIComponent(logo?.querySelector('img')?.getAttribute('src') ?? '');
    expect(src).toContain('w=336');
    expect(src).toContain('fit=max');
    expect(src).not.toContain('h=96');
    expect(`${logo?.className} ${logo?.querySelector('img')?.className}`).not.toMatch(
      /grayscale|opacity-70/,
    );
  });

  it('counts a current role to this month, and says Present', async () => {
    const { container } = await pageFor('lead');

    expect(visibleText(container.querySelector('[data-role-facts]'))).toBe(
      'Mar 2026 – Present · 9 mos · New York, NY',
    );
  });

  it("leads back to the role's own row on the list, so the visitor lands where they came from", async () => {
    await pageFor('curve');

    expect(screen.getByRole('link', { name: 'All experience' })).toHaveAttribute(
      'href',
      '/experience#role-curve',
    );
  });

  it("leads back to the lead role's own stop on the list's rail", async () => {
    await pageFor('lead');

    expect(screen.getByRole('link', { name: 'All experience' })).toHaveAttribute(
      'href',
      '/experience#role-lead',
    );
  });

  it('keeps the words only screen readers hear out of the copied facts', async () => {
    const { container } = await pageFor('curve');

    const spoken = Array.from(container.querySelectorAll('[data-role-facts] .sr-only'));
    expect(spoken.length).toBeGreaterThanOrEqual(3);
    for (const words of spoken) expect(classesOf(words)).toContain('select-none');
  });
});

describe('/experience/[id]: the role on the clock', () => {
  it('says how many roles ran alongside and how many ran at once at its busiest', async () => {
    const { container } = await pageFor('curve');

    expect(screen.getByRole('heading', { level: 2, name: 'On the clock' })).toBeInTheDocument();
    expect(visibleText(container.querySelector('[data-role-beside]'))).toBe('3 roles alongside');
    expect(visibleText(container.querySelector('[data-role-busiest]'))).toBe(
      '4 at once at its busiest Mar – Sep 2026',
    );
  });

  it("draws every role-month, with this role's months as the bottom row in their own tone", async () => {
    const { container } = await pageFor('curve');
    const stack = container.querySelector('[data-month-stack]');
    const columns = Array.from(stack?.querySelectorAll(':scope > div > span') ?? []);

    // 9 + 7 + 47 + 23 + 13 role-months, from Jan 2023 to Nov 2026.
    expect(stack).toHaveAttribute('data-focus', 'curve');
    expect(stack?.querySelectorAll('i')).toHaveLength(99);
    expect(columns).toHaveLength(47);
    expect(stack?.querySelectorAll('i[data-tone="on"]')).toHaveLength(7);
    expect(stack?.querySelectorAll('i[data-tone]')).toHaveLength(7);
    // Mar to Sep 2026 are columns 38 to 44: the role's cell comes first there, at the bottom.
    for (const column of columns.slice(38, 45)) {
      expect(column.querySelector('i')).toHaveAttribute('data-r', 'curve');
    }
    expect(columns[37]?.querySelector('i[data-r="curve"]')).toBeNull();
  });

  it('bands its months and brackets its busiest ones with their count', async () => {
    const { container } = await pageFor('curve');
    const band = container.querySelector<HTMLElement>('[data-stack-band]');
    const peaks = Array.from(container.querySelectorAll<HTMLElement>('[data-stack-peak]'));

    expect(band?.style.left).toBe('80.8511%');
    expect(band?.style.width).toBe('14.8936%');
    expect(peaks.map((peak) => [peak.textContent, peak.style.left])).toEqual([['4', '80.8511%']]);
  });

  it('marks a busiest spell of one month with a stem at its middle, not a bracket', async () => {
    const first = exp('first', 1, '2025-01-01', '2025-03-31', {});
    const second = exp('second', 2, '2025-03-01', '2025-05-31', {});
    h.loadExperiences.mockResolvedValue([first, second]);
    h.loadExperienceById.mockResolvedValue(first);

    const { container } = render(await ExperienceDetailPage(paramsFor('first')));
    const peak = container.querySelector<HTMLElement>('[data-stack-peak]');

    // Jan 2025 to Nov 2026 is 23 columns; both ran only in March, the third.
    expect(visibleText(container.querySelector('[data-role-busiest]'))).toBe(
      '2 at once at its busiest Mar 2025',
    );
    expect(peak).toHaveTextContent('2');
    expect(peak?.style.left).toBe('10.8696%');
    expect(peak?.style.width).toBe('');
    expect(classesOf(peak)).toContain('w-0');
  });

  it("marks a current role's last month as now", async () => {
    const { container } = await pageFor('handshake');
    const stack = container.querySelector('[data-month-stack]');

    expect(stack?.querySelectorAll('i[data-tone="now"]')).toHaveLength(1);
    expect(stack?.querySelector('i[data-tone="now"]')).toHaveAttribute('data-r', 'handshake');
    expect(stack?.querySelectorAll('i[data-tone="on"]')).toHaveLength(12);
  });

  it('keeps the drawing from screen readers and says the same in words', async () => {
    const { container } = await pageFor('curve');

    expect(container.querySelector('[data-month-stack]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-stack-legend]')).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByText(
        'Every role month by month from Jan 2023 to Nov 2026: this one ran from Mar 2026 to Sep 2026, 3 other roles ran alongside it, and at most 4 ran at once, from Mar 2026 to Sep 2026.',
      ),
    ).toHaveClass('sr-only');
  });

  it('says what the two tones are and where the axis starts and ends', async () => {
    const { container } = await pageFor('curve');

    expect(visibleText(container.querySelector('[data-stack-legend]'))).toBe(
      'Jan 2023 this role the others Now',
    );
  });

  it("shares the list's axis: 47 columns and the year lines", async () => {
    const { container } = await pageFor('curve');
    const clock = container.querySelector<HTMLElement>('[data-role-clock]');

    expect(clock?.style.getPropertyValue('--n')).toBe('47');
    expect(clock?.style.getPropertyValue('--year-lines')).not.toBe('');
  });
});

describe('/experience/[id]: what the role was', () => {
  it('prints the whole description, without its raw addresses', async () => {
    const { container } = await pageFor('curve');

    expect(container.querySelector('[data-role-description]')?.textContent).toBe(
      'Built the blog from scratch as lead developer. Then moved the app to a newer router.',
    );
  });

  it('lists the duties the description does not already state', async () => {
    const { container } = await pageFor('curve');
    const duties = Array.from(container.querySelectorAll('[data-role-duties] li'));

    expect(screen.getByRole('heading', { level: 2, name: 'What I did' })).toBeInTheDocument();
    expect(duties.map((duty) => duty.textContent)).toEqual([
      'Added 172 of its 174 tests',
      'Presented it at IEEE LISAT 2024',
    ]);
  });

  it('shows the links as named chips, each a real link in a new tab', async () => {
    const { container } = await pageFor('curve');
    const chips = Array.from(container.querySelectorAll<HTMLAnchorElement>('[data-role-links] a'));

    expect(screen.getByRole('heading', { level: 2, name: 'Links' })).toBeInTheDocument();
    expect(chips.map((chip) => [visibleText(chip), chip.getAttribute('href')])).toEqual([
      ['blog.curve.example', 'https://blog.curve.example'],
      ['example/cms github.com', 'https://github.com/example/cms'],
      ['IEEE LISAT 2024 ieee.org', 'https://ieeexplore.ieee.org/document/1'],
    ]);
    for (const chip of chips) {
      expect(chip).toHaveAttribute('target', '_blank');
      expect(chip.getAttribute('rel')).toBe('noopener noreferrer');
      expect(chip.textContent).toContain('(opens in a new tab)');
    }
  });

  it('links a technology into /projects where a project has it, with the unit in words', async () => {
    const { container } = await pageFor('curve');
    const tokens = Array.from(container.querySelectorAll('[data-role-tech] li'));

    expect(screen.getByRole('heading', { level: 2, name: 'Technologies' })).toBeInTheDocument();
    expect(tokens.map((token) => visibleText(token))).toEqual([
      'Astro',
      'TypeScript 2 projects',
      'React.js 1 project',
    ]);
    expect(tokens.map((token) => token.querySelector('a')?.getAttribute('href') ?? null)).toEqual([
      null,
      '/projects?tech=typescript',
      '/projects?tech=react',
    ]);
  });

  it('leaves out the parts a role has nothing for', async () => {
    const { container } = await pageFor('elysium');

    expect(container.querySelector('[data-role-description]')).toHaveTextContent(
      'Built a national website as a client project.',
    );
    expect(container.querySelector('[data-role-duties]')).toBeNull();
    expect(container.querySelector('[data-role-links]')).toBeNull();
    expect(container.querySelector('[data-role-tech]')).toBeNull();
    for (const name of ['What I did', 'Links', 'Technologies']) {
      expect(screen.queryByRole('heading', { level: 2, name })).not.toBeInTheDocument();
    }
  });

  it('shows an entry the CMS lists twice both times, without a duplicate key', async () => {
    const repeated = exp('twice', 9, '2025-01-01', '2025-06-30', {
      responsibilities: ['Shipped releases', 'Shipped releases'],
      technologies: ['Go', 'Go'],
    });
    h.loadExperiences.mockResolvedValue([...ROLES, repeated]);
    h.loadExperienceById.mockResolvedValue(repeated);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await ExperienceDetailPage(paramsFor('twice')));

    expect(screen.getAllByText('Shipped releases')).toHaveLength(2);
    expect(screen.getAllByText('Go')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('/experience/[id]: the other roles', () => {
  it('lists the roles that ran alongside, the most months shared first, each a link', async () => {
    const { container } = await pageFor('dfg');
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-role-companion]'),
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Ran alongside' })).toBeInTheDocument();
    expect(visibleText(container.querySelector('[data-role-companions-note]'))).toBe(
      '2 roles, by months shared',
    );
    // Apr 2024 to Feb 2026: Elysium throughout, Handshake from Nov 2025.
    expect(links.map((link) => [visibleText(link), link.getAttribute('href')])).toEqual([
      ['Elysium Freelance Developer 1 yr 11 mos', '/experience/elysium'],
      ['Handshake AI Fellow 4 mos', '/experience/handshake'],
    ]);
    expect(links[0]).toHaveAccessibleName('Elysium Freelance Developer 1 year 11 months shared');
  });

  it('has no such list for a role that ran alone', async () => {
    const alone = exp('alone', 1, '2020-01-01', '2020-03-31', {});
    h.loadExperiences.mockResolvedValue([alone]);
    h.loadExperienceById.mockResolvedValue(alone);

    const { container } = render(await ExperienceDetailPage(paramsFor('alone')));

    expect(screen.queryByRole('heading', { level: 2, name: 'Ran alongside' })).toBeNull();
    expect(visibleText(container.querySelector('[data-role-beside]'))).toBe('0 roles alongside');
    expect(container.querySelector('[data-role-busiest]')).toBeNull();
    expect(container.querySelector('[data-role-steps]')).toBeNull();
  });

  it("steps to the roles before and after it in the list's order", async () => {
    const { container } = await pageFor('curve');
    const steps = within(screen.getByRole('navigation', { name: 'Other roles' }));
    const [previous, next] = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-role-step]'),
    );

    // The rail reads: the lead, Handshake (Nov 2025) and Elysium (Jan 2023) under Now, then
    // Curve in 2026 and Develop for Good in 2024.
    expect(steps.getAllByRole('link')).toHaveLength(2);
    expect(previous).toHaveAttribute('href', '/experience/elysium');
    expect(visibleText(previous)).toBe('Previous Elysium Freelance Developer · Jan 2023 – Present');
    expect(next).toHaveAttribute('href', '/experience/dfg');
    expect(visibleText(next)).toBe('Next Develop for Good Program Lead · Apr 2024 – Feb 2026');
  });

  it("lets a step's dates wrap where enlarged text leaves them no line, so they stay in the tile", async () => {
    const { container } = await pageFor('curve');
    const periods = Array.from(container.querySelectorAll('[data-role-step] time')).map(
      (time) => time.parentElement,
    );

    expect(periods.length).toBeGreaterThan(0);
    // One line everywhere but under an 18rem page, as the list's dates.
    for (const period of periods) {
      expect(classesOf(period)).toEqual(
        expect.arrayContaining(['whitespace-nowrap', '@max-[18rem]/page:whitespace-normal']),
      );
    }
  });

  it('has no step before the first role or after the last', async () => {
    const first = await pageFor('lead');
    const firstSteps = Array.from(first.container.querySelectorAll('[data-role-step]'));
    expect(firstSteps.map((step) => step.getAttribute('data-role-step'))).toEqual(['next']);
    expect(firstSteps[0]).toHaveAttribute('href', '/experience/handshake');
    first.unmount();

    const last = await pageFor('dfg');
    const lastSteps = Array.from(last.container.querySelectorAll('[data-role-step]'));
    expect(lastSteps.map((step) => step.getAttribute('data-role-step'))).toEqual(['previous']);
    expect(lastSteps[0]).toHaveAttribute('href', '/experience/curve');
  });
});

describe('/experience/[id]: loading and the clock', () => {
  it("takes the day from New York's clock, not the server's", async () => {
    // 10 pm on 30 November in New York is already 1 December in UTC.
    vi.setSystemTime(new Date('2026-12-01T03:00:00Z'));
    const before = await pageFor('lead');
    expect(visibleText(before.container.querySelector('[data-role-facts]'))).toContain('9 mos');
    before.unmount();

    vi.setSystemTime(new Date('2026-12-01T06:00:00Z'));
    const after = await pageFor('lead');
    expect(visibleText(after.container.querySelector('[data-role-facts]'))).toContain('10 mos');
  });

  it('still renders the role when the projects fail, with plain technologies and a warning', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadProjects.mockRejectedValue(outage);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const { container } = await pageFor('curve');

    expect(container.querySelector('a[href^="/projects"]')).toBeNull();
    const tokens = Array.from(container.querySelectorAll('[data-role-tech] li'));
    expect(tokens.map((token) => visibleText(token))).toEqual(['Astro', 'TypeScript', 'React.js']);
    expect(h.reportApiFailure).toHaveBeenCalledWith(outage, {
      context: 'load projects for experience technology links',
      level: 'warning',
    });
  });

  it('renders a role the list does not hold yet, on a clock that includes it', async () => {
    const fresh = exp('fresh', 9, '2026-10-01', null, { position: 'Advisor', company: 'New Co' });
    h.loadExperienceById.mockResolvedValue(fresh);

    const { container } = render(await ExperienceDetailPage(paramsFor('fresh')));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Advisor');
    expect(container.querySelectorAll('[data-month-stack] i[data-r="fresh"]')).toHaveLength(2);
    expect(visibleText(container.querySelector('[data-role-beside]'))).toBe('3 roles alongside');
  });

  it('draws quarters once the history passes five years', () => {
    const [, curve] = ROLES;
    if (!curve) throw new Error('the fixtures have no second role');
    const { container } = render(
      <RoleDetail experience={curve} experiences={ROLES} projects={PROJECTS} today="2028-01-20" />,
    );

    // Jan 2023 to Jan 2028 is 61 months: 21 calendar quarters.
    expect(
      container.querySelector<HTMLElement>('[data-role-clock]')?.style.getPropertyValue('--n'),
    ).toBe('21');
    expect(container.querySelectorAll('[data-month-stack] > div > span')).toHaveLength(21);
  });
});

describe('the role page modules', () => {
  it('renders the page from a server module with no client data hooks or motion', () => {
    const source = sourceOf(DETAIL_FILE);

    expect(source).toMatch(/^import 'server-only';/);
    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toContain('motion/react');
    expect(source).not.toContain('useSanity');
    expect(source).not.toMatch(/from '@\/components';/);
  });

  it('keeps its parts server-safe: no directive and no hooks', () => {
    const source = sourceOf(CONTEXT_FILE);

    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toMatch(/\buse(?:State|Effect|Ref|Memo|Callback|SyncExternalStore)\b/);
  });

  it('never reads the clock below the page: the day is passed in', () => {
    for (const file of [DETAIL_FILE, CONTEXT_FILE]) {
      const code = sourceOf(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code).not.toMatch(/new Date\(|Date\.now\(|nyToday\(/);
    }
  });
});
