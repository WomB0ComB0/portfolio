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
 * @file The story's prose (linked-prose.tsx): each web name or slashed word, with the brackets
 * and punctuation glued to it, is one inline block holding its <wbr>s, so it moves whole to the
 * next line whenever it fits there and breaks at its dots or slashes only when it is wider than
 * the line. Named links and plain words stay as they were, the links keep their accessible
 * names, and no character is added or dropped. Layout itself is measured in the e2e specs.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LinkedProse } from '@/app/(routes)/(main)/(professioal)/experience/_components/story/linked-prose';
import {
  type LinkedPart,
  linkedPlain,
  linkedText,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/linked-text';

afterEach(cleanup);

/** The prose's whole runs: the inline blocks that hold a <wbr>. */
const runsOf = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-prose] span.inline-block'));

/** What the eye reads: the text without the words only a screen reader hears. */
function visible(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('.sr-only')) hidden.remove();
  return (copy.textContent ?? '').replace(/⁠/gu, '');
}

const text = (value: string): LinkedPart[] => [{ kind: 'text', text: value }];

describe('LinkedProse: a web name in running text', () => {
  it('keeps each host as one run that may break only after its dots', () => {
    const { container } = render(
      <LinkedProse parts={text('Registered on SAM.gov with a CAGE code, SBA and Grants.gov')} />,
    );
    const runs = runsOf(container);

    expect(runs.map((run) => run.textContent)).toEqual(['SAM.gov', 'Grants.gov']);
    expect(runs.map((run) => run.querySelectorAll('wbr').length)).toEqual([1, 1]);
    expect(runs.every((run) => run.className.includes('max-w-full'))).toBe(true);
    // The rest of the sentence has no break of its own and no block around it.
    expect(container.querySelectorAll('wbr')).toHaveLength(2);
  });

  it('keeps the brackets and punctuation around a host inside its run', () => {
    const { container } = render(
      <LinkedProse as="span" parts={text('A map of 31 chapters (Next.js), then WCAG 2.1.')} />,
    );

    expect(runsOf(container).map((run) => run.textContent)).toEqual(['(Next.js),', '2.1.']);
  });

  it('keeps a word joined by a slash as one run that may break only after its slash', () => {
    const { container } = render(
      <LinkedProse parts={text('Designed UI/UX improvements/revamp, creating 10+ pages')} />,
    );
    const runs = runsOf(container);

    expect(runs.map((run) => run.textContent)).toEqual(['UI/UX', 'improvements/revamp,']);
    expect(runs.map((run) => run.innerHTML)).toEqual(['UI/<wbr>UX', 'improvements/<wbr>revamp,']);
  });
});

describe('LinkedProse: a link named by its host', () => {
  const parts = linkedText(
    "Built Curvance's blog (https://blog.curvance.com) and moved the app (https://app.curvance.com).",
  );

  it('sets the link, its brackets and the stop after it as one run', () => {
    const { container } = render(<LinkedProse parts={parts} />);
    const runs = runsOf(container);

    expect(runs.map(visible)).toEqual(['(blog.curvance.com)', '(app.curvance.com).']);
    for (const run of runs) {
      expect(run.querySelectorAll('a')).toHaveLength(1);
      // The arrow stays glued inside the link, before the closing bracket.
      expect(run.querySelector('a [data-new-tab-arrow]')).not.toBeNull();
    }
    expect(runs[0]?.querySelector('a')?.querySelectorAll('wbr')).toHaveLength(2);
  });

  it('keeps each link named by its host, opening in a new tab', () => {
    render(<LinkedProse parts={parts} />);

    for (const host of ['blog.curvance.com', 'app.curvance.com']) {
      const link = screen.getByRole('link', { name: `${host}, (opens in a new tab)` });
      expect(link).toHaveAttribute('href', `https://${host}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});

describe('LinkedProse: named links and plain words', () => {
  it('leaves a link named by a proper name, and its sentence, as they were', () => {
    const parts = linkedText(
      'Published a survey in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/1).',
    );
    const { container } = render(<LinkedProse parts={parts} />);

    expect(runsOf(container)).toEqual([]);
    expect(container.querySelector('wbr')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'IEEE LISAT 2024, (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://ieeexplore.ieee.org/document/1');
  });

  it('adds and drops no character', () => {
    const sentences = [
      "Built Kappa Theta Pi's national website (https://www.kappathetapi.org/) for it.",
      'Deployed it with tests (https://github.com/a/b). Then (Flask, NGINX) — github.com',
      'Mentored students in React.js, Supabase, and UI/UX; cut 493 files (~55k lines).',
    ];
    for (const sentence of sentences) {
      const parts = linkedText(sentence);
      const { container } = render(<LinkedProse parts={parts} />);
      const prose = container.querySelector('[data-prose]');

      expect(prose && visible(prose)).toBe(linkedPlain(parts));
      cleanup();
    }
  });

  it('renders nothing for no parts', () => {
    const { container } = render(<LinkedProse parts={[]} />);

    expect(container.innerHTML).toBe('');
  });
});
