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
 * @file What the /experience story tests share: the fixture roles in Studio order, the projects
 * a role page's technologies link to, small readers of the rendered page, and the files the
 * page is drawn from. No test lives here; each role-story-*.test.tsx file mocks the loaders
 * itself (vi.mock is per file) and imports these.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeExperience, makeProject } from '@tests/fixtures/sanity-docs';
import { vi } from 'vitest';

import type { Experience } from '@/hooks/sanity/schemas';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';

export const E_DIR = 'src/app/(routes)/(main)/(professioal)/experience';
/** The story's interface, the route's one view. */
export const STORY_FILE = `${E_DIR}/_interface/role-story/role-story.tsx`;
/** The server parts the story is drawn with. */
export const SERVER_PARTS = [
  ...['role-chapter', 'role-stop', 'role-path', 'linked-prose'].map(
    (name) => `${E_DIR}/_components/story/${name}.tsx`,
  ),
  `${E_DIR}/_components/role-lane.tsx`,
  `${E_DIR}/_components/role-parts.tsx`,
];
export const ISLAND_FILE = `${E_DIR}/_components/role-crosslight.tsx`;

/** An inline opacity of exactly 0 (not 0.8): what a motion entrance leaves in server HTML. */
export const ZERO_OPACITY = /opacity:\s*0(?![.\d])/;
/** A Suspense boundary's streamed segment: what loading.tsx leaves hidden without JavaScript. */
export const STREAMED_SEGMENT = /<div hidden id="S:/;
/** Noon in New York on 12 November 2026. */
export const NOW = new Date('2026-11-12T17:00:00Z');

export const LOGO = {
  _type: 'image' as const,
  asset: { _ref: 'image-logo-200x200-png', _type: 'reference' as const },
};

/** One experience; current exactly when it has no end date. */
export const exp = (
  id: string,
  order: number,
  startDate: string,
  endDate: string | null,
  extra: Partial<Experience> = {},
): Experience =>
  makeExperience({ _id: id, order, startDate, endDate, current: endDate === null, ...extra });

/** Studio order: the lead, an ended role, two more current ones and another ended one. */
export const ROLES: readonly Experience[] = [
  exp('lead', 1, '2026-03-01', null, {
    company: 'Platform Co, Inc.',
    position: 'Founder & CEO',
    logo: LOGO,
    location: 'New York, NY',
    description:
      'Platform Co builds the platform (https://platform.example/docs) for teams. Pre-revenue, with a demo.',
    responsibilities: ['Founded the company'],
    technologies: ['TypeScript', 'Rust'],
  }),
  exp('curve', 2, '2026-03-01', '2026-09-30', {
    company: 'Curve',
    position: 'Software Engineer',
    location: 'Remote',
    description:
      'Built the blog (https://blog.curve.example) from scratch as lead developer. Then moved the app.',
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
    technologies: [],
  }),
  exp('dfg', 4, '2024-04-01', '2026-02-28', {
    company: 'Develop for Good',
    position: 'Program Lead',
    description: 'Rose from engineer to lead over 5 projects.',
    responsibilities: ['Led a student team through each client project'],
  }),
  exp('handshake', 5, '2025-11-01', null, {
    company: 'Handshake',
    position: 'AI Fellow',
    description: 'Contract position working on AI training.',
  }),
];

export const PROJECTS = [
  makeProject({ technologies: ['TypeScript', 'React'] }),
  makeProject({ technologies: ['TypeScript'] }),
];

export const sourceOf = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

/** What a reader's eye skips: words for screen readers, a monogram, the new-tab arrow. */
const NOT_READ = '.sr-only, [data-role-monogram], [data-new-tab-arrow]';

/** An element's text as read on screen, whitespace collapsed. */
export function visibleText(element: Element | null | undefined): string {
  if (!element) return '';
  const copy = element.cloneNode(true) as Element;
  for (const hidden of Array.from(copy.querySelectorAll(NOT_READ))) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A role's stop on the rail; throws when the page has none for it. */
export function stopOf(container: HTMLElement, id: string): HTMLElement {
  const stop = container.querySelector<HTMLElement>(`li[data-role-row][data-id="${id}"]`);
  if (!stop) throw new Error(`no stop for ${id}`);
  return stop;
}

/** A role's "What I did"; throws when its stop has none. */
export function moreOf(container: HTMLElement, id: string): HTMLDetailsElement {
  const more = stopOf(container, id).querySelector<HTMLDetailsElement>('details[data-role-more]');
  if (!more) throw new Error(`no "What I did" for ${id}`);
  return more;
}

/** A role's capsule on "The path so far"; throws when the path has none for it. */
export function capsuleOf(container: HTMLElement, id: string): HTMLAnchorElement {
  const capsule = container.querySelector<HTMLAnchorElement>(`[data-role-path] a[data-r="${id}"]`);
  if (!capsule) throw new Error(`no capsule for ${id}`);
  return capsule;
}

/** Answers the island's media questions: a fine pointer or not, reduced motion or not. */
export function stubMedia(fine: boolean, reduced = false): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === FINE_POINTER ? fine : query === REDUCED_MOTION_QUERY && reduced,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}
