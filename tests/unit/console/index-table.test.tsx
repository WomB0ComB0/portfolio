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
 * @file The IndexTable kit: year groups of real tables whose columns are data ({ id, label,
 * align, priority }), a fixed layout from one <colgroup> so every year lines up, a sticky year
 * bar (the h2, then the column labels, which slide under it at a year's end) painted on the
 * canvas while stuck, above the edge haze and under the filter bar, one row height, focused
 * controls that scroll clear of the sticky bars, a stretched title link with secondary actions
 * above it, and the
 * tint row hover (surface-1 in over --motion-instant, out over --motion-base on --ease-effect,
 * nothing moves). Style 1 (ledger) and style 2 (open) are the same markup.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INDEX_ACTION_CLASS,
  INDEX_SUB_CLASS,
  IndexAnnouncer,
  type IndexColumn,
  IndexCopyButton,
  IndexGroup,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';

/** Every next/link the kit renders, by its props: the real link still renders. */
const nextLinks = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('next/link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/link')>();
  const RealLink = actual.default;
  return {
    ...actual,
    default: (props: Parameters<typeof RealLink>[0]) => {
      nextLinks.props.push(props as unknown as Record<string, unknown>);
      return <RealLink {...props} />;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const [TITLE, ISSUER, ISSUED, VERIFY] = [
  { id: 'title', label: 'Certificate' },
  { id: 'issuer', label: 'Issuer', priority: 1, width: 'w-[9.5rem]' },
  { id: 'issued', label: 'Issued', align: 'end', priority: 1, width: 'w-[5.5rem]' },
  { id: 'verify', label: 'Verify', align: 'end', priority: 2, width: 'w-[11rem]' },
] as const satisfies readonly IndexColumn[];
const COLUMNS: readonly IndexColumn[] = [TITLE, ISSUER, ISSUED, VERIFY];

function Table({ variant }: { readonly variant?: 'ledger' | 'open' }): ReactElement {
  return (
    <IndexGroup
      id="certificates-2024"
      year="2024"
      count="2 certificates"
      columns={COLUMNS}
      variant={variant}
    >
      <IndexRow data-cert-row="">
        <td className={indexCellClass(TITLE)}>
          <IndexTitleLink href="https://example.com/a" external>
            Alpha
          </IndexTitleLink>
        </td>
        <td className={indexCellClass(ISSUER)}>Google</td>
        <td className={indexCellClass(ISSUED)}>Jun</td>
        <td className={indexCellClass(VERIFY)}>
          <IndexCopyButton value="ABC-123" label="the credential ID for Alpha" />
        </td>
      </IndexRow>
    </IndexGroup>
  );
}

/** An element's class tokens; none for a missing element or class attribute. */
const classesOf = (element: Element | null | undefined): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

describe('a year group', () => {
  it('is a section with its h2, and a real table named by it', () => {
    render(<Table />);
    const heading = screen.getByRole('heading', { level: 2 });
    const table = screen.getByRole('table');

    expect(heading).toHaveAccessibleName('2024, 2 certificates');
    expect(table).toHaveAccessibleName('2024, 2 certificates');
    expect(table).toHaveAttribute('data-variant', 'ledger');
    expect(table.getAttribute('role')).toBeNull();
    expect(heading.closest('section')).toBe(table.closest('section'));
  });

  it('lays the columns out from data: one <col> each, labels, alignment and priority', () => {
    render(<Table />);
    const cols = Array.from(document.querySelectorAll('col'));
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader');

    expect(classesOf(screen.getByRole('table'))).toEqual(
      expect.arrayContaining(['table-fixed', 'w-full']),
    );
    expect(cols).toHaveLength(4);
    expect(classesOf(cols[1])).toEqual(
      expect.arrayContaining(['w-[9.5rem]', 'hidden', '@min-[40rem]/page:table-column']),
    );
    expect(classesOf(cols[3])).toContain('@min-[48rem]/page:table-column');
    expect(headers.map((th) => th.textContent)).toEqual([
      'Certificate',
      'Issuer',
      'Issued',
      'Verify',
    ]);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(classesOf(headers[2])).toContain('text-right');
    expect(classesOf(headers[0])).not.toContain('text-right');
  });

  it('sticks its year bar under the filter bar, above the haze, painted while stuck', () => {
    render(<Table />);
    const heading = classesOf(screen.getByRole('heading', { level: 2 }));
    const header = classesOf(screen.getAllByRole('columnheader')[0]);

    // The canvas only while stuck (globals.css stuck-canvas): at rest the page's glow shows.
    for (const part of [heading, header]) {
      expect(part).toEqual(expect.arrayContaining(['sticky', 'stuck-canvas']));
      expect(part).not.toContain('bg-canvas');
    }
    // Both above the haze (z-20) and under the filter bar (z-30); the labels one lower, so at a
    // year's end they slide under the year bar instead of over its year.
    expect(heading).toContain('z-[25]');
    expect(header).toContain('z-[24]');
    expect(heading).toContain('top-[calc(env(safe-area-inset-top,0px)+var(--filter-bar-h,0px))]');
    // The labels stick right under the year: the heading's own height (h-10, 2.5rem) lower.
    expect(heading).toContain('h-10');
    expect(header).toContain(
      'top-[calc(env(safe-area-inset-top,0px)+var(--filter-bar-h,0px)+2.5rem)]',
    );
    expect(header).toContain('border-hairline-strong');
  });

  it('draws style 2 from the same markup', () => {
    render(<Table variant="open" />);

    expect(screen.getByRole('table')).toHaveAttribute('data-variant', 'open');
  });
});

describe('a row', () => {
  it('tints on hover and never moves: surface-1 in fast, out slow, on the effect curve', () => {
    render(<Table />);
    const row = document.querySelector('tr[data-index-row]');
    const classes = classesOf(row);

    expect(row).toHaveAttribute('data-cert-row', '');
    expect(classes).toEqual(
      expect.arrayContaining([
        'hover:bg-surface-1',
        'transition-[background-color]',
        'duration-(--motion-base)',
        'hover:duration-(--motion-instant)',
        'ease-effect',
        'focus-within:bg-surface-1',
      ]),
    );
    expect(classes.join(' ')).not.toMatch(/hover:(?:-?translate|scale|shadow|border-l)/);
  });

  it('scrolls a focused link or button clear of the sticky bars, not just the row', () => {
    render(<Table />);
    const row = classesOf(document.querySelector('tr[data-index-row]'));
    const clearance =
      'scroll-mt-[max(0px,calc(var(--filter-bar-h,0px)+4.5rem-var(--edge-haze-top,0px)))]';

    // Focus scrolling reads the focused element's own scroll-margin, never its row's.
    expect(row).toContain(clearance);
    expect(row).toContain(`[&_:is(a,button)]:${clearance}`);
  });

  it('is the stretched title link’s box, with secondary actions above it', () => {
    render(<Table />);
    const row = document.querySelector('tr[data-index-row]');
    const link = screen.getByRole('link', { name: 'Alpha (opens in a new tab)' });

    // Safari ignores position: relative on <tr>; a transform makes it the overlay's box anyway.
    expect(classesOf(row)).toEqual(
      expect.arrayContaining(['relative', '[transform:translate(0)]']),
    );
    expect(classesOf(link)).toEqual(expect.arrayContaining(['after:absolute', 'after:inset-0']));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(INDEX_ACTION_CLASS.split(' ')).toEqual(expect.arrayContaining(['relative', 'z-[1]']));
    expect(classesOf(screen.getByRole('button'))).toEqual(
      expect.arrayContaining(['relative', 'z-[1]']),
    );
  });
});

/** One row whose title is an internal link, beside an external one for comparison. */
function InternalRow(): ReactElement {
  return (
    <table>
      <tbody>
        <IndexRow data-project-row="">
          <td>
            <IndexTitleLink href="/projects/a%20b" internal data-project-title="">
              Alpha
            </IndexTitleLink>
          </td>
          <td>
            <IndexTitleLink href="https://example.com/b" external>
              Beta
            </IndexTitleLink>
          </td>
        </IndexRow>
      </tbody>
    </table>
  );
}

describe('an internal title link (style 2 on /projects)', () => {
  it('is a next/link (soft navigation, never prefetched) with the same class and data', () => {
    nextLinks.props.length = 0;
    render(<InternalRow />);
    const internal = screen.getByRole('link', { name: 'Alpha' });
    const external = screen.getByRole('link', { name: 'Beta (opens in a new tab)' });

    expect(nextLinks.props).toHaveLength(1);
    expect(nextLinks.props[0]).toMatchObject({ href: '/projects/a%20b', prefetch: false });
    expect(internal).toHaveAttribute('href', '/projects/a%20b');
    expect(internal).not.toHaveAttribute('target');
    expect(internal).not.toHaveAttribute('rel');
    expect(internal).toHaveAttribute('data-index-link', '');
    expect(internal).toHaveAttribute('data-project-title', '');
    expect(classesOf(internal)).toEqual(classesOf(external));
  });

  it('keeps an external or plain title link a plain <a>, as the Ledger has it', () => {
    nextLinks.props.length = 0;
    render(<Table />);

    expect(nextLinks.props).toHaveLength(0);
  });

  it('cannot be internal and external at once', () => {
    const both = (
      // @ts-expect-error internal and external are exclusive
      <IndexTitleLink href="/x" internal external>
        X
      </IndexTitleLink>
    );

    expect(both).toBeDefined();
  });

  it('has a second line for an open row: hidden on a phone, one truncated quiet line', () => {
    const tokens = INDEX_SUB_CLASS.split(' ');

    expect(tokens).toEqual(
      expect.arrayContaining([
        'hidden',
        'truncate',
        'text-muted-foreground',
        '@min-[40rem]/page:block',
      ]),
    );
  });
});

describe('the Copy ID action', () => {
  it('copies the value, marks itself done and says so politely', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(
      <>
        <Table />
        <IndexAnnouncer />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Copy the credential ID for Alpha' });

    expect(button).toHaveAttribute('title', 'ABC-123');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith('ABC-123');
    expect(button).toHaveAttribute('data-done', '');
    expect(document.querySelector('[data-index-announcer]')).toHaveTextContent(
      'Copied the credential ID for Alpha',
    );
  });

  it('says the value itself when the clipboard is blocked', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error('blocked')) },
    });
    render(
      <>
        <Table />
        <IndexAnnouncer />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(document.querySelector('[data-index-announcer]')).toHaveTextContent(
      'The credential ID for Alpha is ABC-123',
    );
  });

  describe('the check after a copy', () => {
    /** Clicks the button and lets the clipboard promise settle. */
    const copy = async (button: HTMLElement): Promise<void> => {
      await act(async () => {
        fireEvent.click(button);
      });
    };
    /** Moves the fake clock on by `ms`. */
    const wait = async (ms: number): Promise<void> => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    };
    /** A lone Copy button whose clipboard always accepts, on a fake clock. */
    const renderButton = (): HTMLElement => {
      vi.useFakeTimers();
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: { writeText: () => Promise.resolve() },
      });
      render(<IndexCopyButton value="ABC-123" label="the credential ID for Alpha" />);
      return screen.getByRole('button');
    };

    it('returns to the word 1.6s after one copy', async () => {
      const button = renderButton();
      await copy(button);
      await wait(1599);
      expect(button).toHaveAttribute('data-done', '');
      await wait(1);
      expect(button).not.toHaveAttribute('data-done');
      expect(button).toHaveTextContent('ID');
    });

    it('keeps the check a full 1.6s after a second copy made while it shows', async () => {
      const button = renderButton();
      await copy(button);
      await wait(1500);
      await copy(button);
      await wait(200);
      expect(button).toHaveAttribute('data-done', '');
      await wait(1400);
      expect(button).not.toHaveAttribute('data-done');
    });

    it('leaves no timer behind once it unmounts', async () => {
      const button = renderButton();
      await copy(button);
      await copy(button);
      cleanup();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

describe('server-safe and on the palette', () => {
  it('renders on the server with no client code but the copy button', () => {
    const html = renderToString(<Table />);
    const source = readFileSync(
      join(process.cwd(), 'src/components/console/index-table/index-table.tsx'),
      'utf8',
    );

    expect(html).toContain('<table');
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('uses palette tokens and refined type only', () => {
    const { container } = render(<Table />);
    const classes = Array.from(container.querySelectorAll('[class]'))
      .flatMap((element) => classesOf(element))
      .join(' ');

    expect(classes).not.toMatch(/#[0-9a-f]{3,8}\b|white\/|backdrop-blur|destructive/i);
    expect(classes).not.toMatch(/(?:^|\s)(?:uppercase|font-bold|font-extrabold|text-xs)(?:\s|$)/);
    expect(classes).not.toMatch(
      /(?:bg|text|border)-(?:red|green|blue|emerald|amber|violet|zinc)-\d/,
    );
  });
});
