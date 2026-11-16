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
 * @file Byline: the parts are cleaned and joined with ' · ' (bylineItems, bylineText), counts are
 * written with their noun (countOf), and the component draws the same words with the separator
 * hidden from assistive tech and a status dot beside its word.
 */

import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  BYLINE_SEPARATOR,
  Byline,
  bylineItems,
  bylineText,
  countOf,
} from '@/components/console/folio';

describe('bylineItems and bylineText', () => {
  it('joins kind, month and status with " · "', () => {
    const parts = ['CLI Tool', 'Feb 2026', { text: 'In progress', tone: 'ongoing' as const }];

    expect(bylineText(parts)).toBe('CLI Tool · Feb 2026 · In progress');
    expect(BYLINE_SEPARATOR).toBe(' · ');
  });

  it('drops blanks, null, undefined and false, and tidies spaces', () => {
    expect(bylineText(['  Web  Development ', '', null, undefined, false, '   ', 'Sep 2024'])).toBe(
      'Web Development · Sep 2024',
    );
  });

  it('drops a part that repeats an earlier one, ignoring case', () => {
    expect(bylineText(['Other', 'other', 'Dec 2023', 'OTHER'])).toBe('Other · Dec 2023');
  });

  it('groups numbers in the site locale and skips ones that are not finite', () => {
    expect(bylineText([1300, Number.NaN, 'contributions'])).toBe('1,300 · contributions');
  });

  it('keeps a status tone, and its pulse only when asked', () => {
    expect(
      bylineItems([
        { text: 'Live', tone: 'live', pulse: true },
        { text: 'Now', tone: 'ongoing' },
      ]),
    ).toEqual([
      { text: 'Live', tone: 'live', pulse: true },
      { text: 'Now', tone: 'ongoing' },
    ]);
    expect(bylineItems([{ text: '  ', tone: 'down' }])).toEqual([]);
  });

  it('never changes the case of what it is given', () => {
    expect(bylineText(['AI/ML', 'In progress'])).toBe('AI/ML · In progress');
  });
});

describe('countOf', () => {
  const project = { one: 'project', many: 'projects' };

  it.each([
    [0, '0 projects'],
    [1, '1 project'],
    [7, '7 projects'],
    [1300, '1,300 projects'],
  ])('writes %i as "%s"', (count, text) => {
    expect(countOf(count, project)).toBe(text);
  });
});

describe('Byline', () => {
  it('draws the joined words, only the dots hidden from assistive tech', () => {
    const { container } = render(<Byline parts={['CLI Tool', 'Feb 2026', 'In progress']} />);
    const line = container.querySelector('[data-byline]');

    expect(line?.tagName).toBe('P');
    expect(line?.textContent?.replace(/\u00a0/g, ' ')).toBe('CLI Tool · Feb 2026 · In progress');
    const hidden = [...(line?.querySelectorAll('[aria-hidden="true"]') ?? [])];
    // The no-break space and the dot; the space after the dot stays readable.
    expect(hidden.map((node) => node.textContent)).toEqual(['\u00a0·', '\u00a0·']);
  });

  it('keeps the parts apart when read aloud (the dots alone are hidden)', () => {
    render(
      <a href="/projects/proj-resq-viz">
        <Byline
          as="span"
          parts={['Public Safety', 'Apr 2026 – now', { text: 'In progress', tone: 'ongoing' }]}
        />
      </a>,
    );

    // Chromium adds the pause's alt-text comma ('Public Safety, Apr 2026 – now, In progress',
    // measured on the lab's pages); jsdom applies no CSS, so here the parts must at least never
    // run together.
    expect(screen.getByRole('link')).toHaveAccessibleName(
      /^Public Safety,? Apr 2026 – now,? In progress$/,
    );
  });

  it('puts a pause after every part but the last, outside the hidden dot, adding no text', () => {
    const { container } = render(<Byline parts={['CLI Tool', 'Feb 2026', 'In progress']} />);
    const pauses = [...container.querySelectorAll('[data-byline-pause]')];

    expect(pauses).toHaveLength(2);
    for (const pause of pauses) {
      expect(pause.textContent).toBe('');
      expect(pause.closest('[aria-hidden="true"]')).toBeNull();
      expect(pause.className).toBe('byline-pause');
    }
  });

  it('glues each separator to the part before it, so a wrapped line never starts with a dot', () => {
    const { container } = render(<Byline parts={['Hackathon', 'Dec 2023']} />);
    const first = container.querySelector('[data-byline] > span');

    // A no-break space before the dot; the line's only break is the real space after it.
    expect(first?.textContent).toBe('Hackathon\u00a0·');
    expect(first?.nextSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect(first?.nextSibling?.textContent).toBe(' ');
  });

  it('puts the house status dot beside a status word, in sentence-case Geist (tile-meta)', () => {
    const { container } = render(
      <Byline parts={['Apr 2026', { text: 'In progress', tone: 'ongoing' }]} />,
    );
    const status = container.querySelector('[data-tone="ongoing"]');

    expect(status?.textContent).toBe('In progress');
    expect(status?.querySelector('[data-status-dot]')?.getAttribute('data-tone')).toBe('ongoing');
    expect(container.querySelector('[data-byline]')?.className).toContain('tile-meta');
  });

  it('draws nothing when no part has words', () => {
    const { container } = render(<Byline parts={['', null, false]} />);

    expect(container.innerHTML).toBe('');
  });

  it('can be a span inside a heading or a link', () => {
    const { container } = render(<Byline as="span" parts={['2 photos']} />);

    expect(container.querySelector('[data-byline]')?.tagName).toBe('SPAN');
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(<Byline parts={['Web Development', 'Sep 2024']} />);

    expect(html).toContain('data-byline');
    expect(html).toContain('Web Development');
  });
});
