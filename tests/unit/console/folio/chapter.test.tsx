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
 * @file The chapter system: its rules (chapterSize, chapterId, chapterJumps), the ChapterOpener
 * section a jump lands on, and the ChapterJumps row with its counts.
 *
 * jsdom applies no CSS, so sizes are checked as the utility each one carries; the utilities
 * themselves are checked in folio-css.test.ts.
 */

import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ChapterJumps,
  ChapterOpener,
  chapterId,
  chapterJumps,
  chapterSize,
} from '@/components/console/folio';

const PROJECT = { one: 'project', many: 'projects' };

describe('chapterSize', () => {
  it('gives the first chapter the one display numeral', () => {
    expect(chapterSize({ index: 0, count: 6 })).toBe('lead');
  });

  it('steps every later chapter down', () => {
    expect(chapterSize({ index: 1, count: 7 })).toBe('step');
    expect(chapterSize({ index: 3, count: 26 })).toBe('step');
  });

  it('never gives a one-item chapter a full opener, even the first', () => {
    expect(chapterSize({ index: 4, count: 1 })).toBe('inline');
    expect(chapterSize({ index: 0, count: 1 })).toBe('inline');
    expect(chapterSize({ index: 2, count: 0 })).toBe('inline');
  });
});

describe('chapterId', () => {
  it.each([
    [2026, 'y2026'],
    ['2023', 'y2023'],
    ['Featured', 'featured'],
    ['Now', 'now'],
    ['Also now', 'also-now'],
    ['  Café work ', 'cafe-work'],
    ['', 'chapter'],
    ['—', 'chapter'],
  ])('%s -> %s', (key, id) => {
    expect(chapterId(key)).toBe(id);
  });
});

describe('chapterJumps', () => {
  it('links each chapter by its id, with the count as shown and as spoken', () => {
    const links = chapterJumps(
      [
        { id: 'featured', label: 'Featured', count: 6 },
        { id: 'y2026', label: '2026', count: 7 },
        { id: 'y2023', label: '2023', count: 1 },
      ],
      PROJECT,
    );

    expect(links).toEqual([
      { id: 'featured', href: '#featured', label: 'Featured', count: '6', spoken: '6 projects' },
      { id: 'y2026', href: '#y2026', label: '2026', count: '7', spoken: '7 projects' },
      { id: 'y2023', href: '#y2023', label: '2023', count: '1', spoken: '1 project' },
    ]);
  });

  it('leaves out a chapter a filter emptied, and a repeated id', () => {
    const links = chapterJumps([
      { id: 'y2025', label: '2025', count: 10 },
      { id: 'y2024', label: '2024', count: 0 },
      { id: 'y2025', label: '2025 again', count: 3 },
      { id: '', label: 'Nowhere', count: 2 },
    ]);

    expect(links.map((link) => link.id)).toEqual(['y2025']);
  });

  it('speaks the bare count without a noun, groups big counts, and allows no count', () => {
    const links = chapterJumps([
      { id: 'y2024', label: '2024', count: 1300 },
      { id: 'now', label: 'Now' },
    ]);

    expect(links[0]).toMatchObject({ count: '1,300', spoken: '1,300' });
    expect(links[1]).toEqual({ id: 'now', href: '#now', label: 'Now' });
  });
});

describe('ChapterOpener', () => {
  it('is a section named by its heading, with the id a jump link lands on', () => {
    render(
      <ChapterOpener id="y2026" title={2026} summary="Seven projects." byline={['7 projects']} />,
    );
    const section = screen.getByRole('region', { name: '2026' });

    expect(section.id).toBe('y2026');
    expect(within(section).getByRole('heading', { level: 2, name: '2026' }).id).toBe('y2026-title');
    expect(section.className).toContain('scroll-mt-');
  });

  it('sets the title by its size: lead numeral, stepped numeral or an inline heading', () => {
    const { rerender } = render(<ChapterOpener id="featured" title="Featured" size="lead" />);
    expect(screen.getByRole('heading').className).toContain('folio-numeral');
    expect(screen.getByRole('region').getAttribute('data-chapter')).toBe('lead');

    rerender(<ChapterOpener id="y2025" title={2025} size="step" />);
    expect(screen.getByRole('heading').className).toContain('folio-numeral-step');

    rerender(<ChapterOpener id="y2023" title={2023} size="inline" />);
    expect(screen.getByRole('heading').className).toContain('folio-numeral-inline');
  });

  it('defaults to a stepped h2, and takes an h3', () => {
    const { rerender } = render(<ChapterOpener id="y2024" title={2024} />);
    expect(screen.getByRole('region').getAttribute('data-chapter')).toBe('step');
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();

    rerender(<ChapterOpener id="y2024" title={2024} level={3} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
  });

  it("hands CSS the title's widest word, so it is sized to fit its cell", () => {
    render(<ChapterOpener id="featured" title="Featured" size="lead" />);

    // F 1.2 + e a u e d 5 + t r 1 = 7.2 units.
    expect(screen.getByRole('heading').style.getPropertyValue('--folio-fit')).toBe('7.2');
  });

  it('puts the words first and the counts in a small byline after them', () => {
    const { container } = render(
      <ChapterOpener
        id="y2026"
        title={2026}
        summary={
          <>
            <em>ResQ Developer Platform</em>, <em>synapse</em> and five more.
          </>
        }
        byline={['7 projects', { text: '3 in progress', tone: 'ongoing' }]}
      />,
    );
    const header = container.querySelector('header');
    const summary = header?.querySelector('p:not([data-byline])');
    const byline = header?.querySelector('[data-byline]');

    expect(summary?.textContent).toBe('ResQ Developer Platform, synapse and five more.');
    expect(byline?.textContent?.replace(/ /g, ' ')).toBe('7 projects · 3 in progress');
    expect(summary?.compareDocumentPosition(byline as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sets the lead story under the opener, then the rest of the chapter', () => {
    const { container } = render(
      <ChapterOpener id="y2026" title={2026} lead={<article>Lead story</article>}>
        <div>Briefs</div>
      </ChapterOpener>,
    );
    const [header, lead, body] = [...(container.querySelector('section')?.children ?? [])];

    expect(header?.tagName).toBe('HEADER');
    expect(lead?.getAttribute('data-chapter-lead')).toBe('');
    expect(lead?.textContent).toBe('Lead story');
    expect(body?.getAttribute('data-chapter-body')).toBe('');
    expect(body?.textContent).toBe('Briefs');
  });

  it.each([{ byline: [] }, { byline: [' ', null, false, Number.NaN] }] as const)(
    'leaves out empty byline slots: $byline',
    ({ byline }) => {
      const { container } = render(
        <ChapterOpener id="y2022" title={2022} summary="" byline={byline} />,
      );

      expect(container.querySelector('header')?.children).toHaveLength(1);
      expect(container.querySelector('[data-chapter-lead]')).toBeNull();
      expect(container.querySelector('[data-chapter-body]')).toBeNull();
    },
  );

  it('sets a word chapter small as a page opens, with no pause above it and one rule', () => {
    const { container } = render(
      <ChapterOpener
        id="featured"
        title="Featured"
        size="inline"
        className="mt-0"
        summary="ResQ Viz and five more."
        byline={['6 projects']}
        lead={<article>Lead story</article>}
      />,
    );
    const section = container.querySelector('section');
    const header = section?.querySelector('header');

    expect(screen.getByRole('heading', { level: 2, name: 'Featured' }).parentElement).toBe(header);
    expect(section?.getAttribute('data-chapter')).toBe('inline');
    // The page's mt-0 replaces the inline chapter's own pause; nothing else carries a margin.
    expect(section?.className.split(' ').filter((name) => /^mt-/.test(name))).toEqual(['mt-0']);
    // One rule: the header's; the title, the words and the lead draw none.
    const ruled = [...(section?.querySelectorAll('*') ?? [])].filter((node) =>
      /(?:^|\s)border-[bt](?:\s|$)/.test(node.getAttribute('class') ?? ''),
    );
    expect(ruled).toEqual([header]);
    expect(section?.querySelector('[data-chapter-lead]')?.textContent).toBe('Lead story');
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(
      <ChapterOpener id="now" title="Now" size="lead" summary="Five roles at once." />,
    );

    expect(html).toContain('id="now"');
    expect(html).toContain('aria-labelledby="now-title"');
    expect(html).toContain('Five roles at once.');
  });
});

describe('ChapterJumps', () => {
  const chapters = [
    { id: 'featured', label: 'Featured', count: 6 },
    { id: 'y2026', label: '2026', count: 7 },
    { id: 'y2025', label: '2025', count: 0 },
    { id: 'y2023', label: '2023', count: 1 },
  ];

  it('is a named navigation of in-page links, the emptied chapter left out', () => {
    render(<ChapterJumps chapters={chapters} noun={PROJECT} />);
    const nav = screen.getByRole('navigation', { name: 'In this issue' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#featured',
      '#y2026',
      '#y2023',
    ]);
  });

  it('names each link with its label and its count in words', () => {
    render(<ChapterJumps chapters={chapters} noun={PROJECT} />);

    expect(screen.getByRole('link', { name: '2026, 7 projects' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '2023, 1 project' })).toBeTruthy();
  });

  it('shows the count as a small figure, hidden from assistive tech in favour of the words', () => {
    render(<ChapterJumps chapters={chapters} noun={PROJECT} />);
    const link = screen.getByRole('link', { name: '2026, 7 projects' });
    const figure = link.querySelector('[aria-hidden="true"]');

    expect(figure?.textContent).toBe('7');
    expect(figure?.className).toContain('tile-meta');
  });

  it('lists every link as an item of one list, each a plain in-page link', () => {
    render(<ChapterJumps chapters={chapters} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');

    // jsdom lays nothing out: the targets' 36px (mouse) and 44px (finger) and the wrapping row are
    // measured in a browser by experience-phone.spec.ts and certifications-rows.spec.ts.
    expect(items).toHaveLength(screen.getAllByRole('link').length);
    for (const item of items) {
      const link = within(item).getByRole('link');
      expect(link.getAttribute('href')).toMatch(/^#/);
      expect(link).not.toHaveAttribute('target');
    }
  });

  it('takes its own name, and draws nothing with fewer than two chapters', () => {
    const { container, rerender } = render(
      <ChapterJumps label="By year" chapters={chapters.slice(0, 2)} />,
    );
    expect(screen.getByRole('navigation', { name: 'By year' })).toBeTruthy();

    rerender(<ChapterJumps chapters={chapters.slice(0, 1)} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(<ChapterJumps chapters={chapters} noun={PROJECT} />);

    expect(html).toContain('href="#y2026"');
    expect(html).toContain('In this issue');
  });
});
