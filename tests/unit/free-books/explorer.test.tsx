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
 * @file The /bookshelf/free explorer island (free/_components) with its query hook and URL
 * contract: the server-rendered first page needs no fetch, every other page, sort, filter and
 * search is fetched from `GET /api/v1/books/free` (stubbed here) and written to the URL, a URL
 * that is not the default view fetches at once, and typing is debounced into one normalised
 * request.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  buildFreeBooksPageResponse,
  buildFreeProgrammingBooksCatalog,
} from '@/lib/free-books/catalog';
import { parseFreeProgrammingBooksMarkdown } from '@/lib/free-books/parse';
import {
  makeQueryClient,
  renderExplorer,
  SAMPLE_LANGS_MD,
  SAMPLE_SUBJECTS_MD,
  stubFreeBooksApi,
} from './free-books-fixture';

describe('FreeBooksExplorer', () => {
  it('hydrates SSR page 1 with zero initial fetch, then fetches incrementally via TanStack Query + nuqs', async () => {
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs'),
      parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects'),
    );
    const initialPage = buildFreeBooksPageResponse(catalog, {
      hideArchived: true,
      hideUnavailable: true,
      sort: 'title',
      dir: 'asc',
      limit: 50,
      offset: 0,
    });
    const updates: UrlUpdateEvent[] = [];
    const fetchSpy = stubFreeBooksApi(catalog, (sp) => ({
      source: (sp.get('source') as 'all' | 'langs' | 'subjects' | null) ?? 'all',
      category: sp.get('category') ?? 'all',
      format: (sp.get('format') as 'all' | 'PDF' | null) ?? 'all',
      q: sp.get('q') ?? '',
      sort: (sp.get('sort') as 'title' | 'category' | 'host' | null) ?? 'title',
      dir: (sp.get('dir') as 'asc' | 'desc' | null) ?? 'asc',
      hideArchived: sp.get('hideArchived') === 'true',
      hideUnavailable: sp.get('hideUnavailable') === 'true',
      hideInProcess: sp.get('hideInProcess') === 'true',
      httpsOnly: sp.get('httpsOnly') === 'true',
      verifiedHostsOnly: sp.get('verifiedHostsOnly') === 'true',
      limit: Number.parseInt(sp.get('limit') ?? '50', 10),
      offset: Number.parseInt(sp.get('offset') ?? '0', 10),
    }));

    const queryClient = makeQueryClient();

    try {
      renderExplorer(queryClient, initialPage, {
        hasMemory: true,
        onUrlUpdate: (event) => updates.push(event),
      });

      expect(
        screen.getByRole('heading', { level: 1, name: 'Free Programming Books' }),
      ).toBeInTheDocument();
      // SSR initialData prevents redundant initial client fetch
      expect(fetchSpy).not.toHaveBeenCalled();

      // Renders as a semantic data table with sortable column headers
      const table = screen.getByRole('table', { name: /Free programming books catalog/i });
      const bookHeader = within(table).getByRole('columnheader', { name: /Book/i });
      expect(bookHeader).toHaveAttribute('aria-sort', 'ascending');

      // Clicking Book header flips sort direction and triggers incremental API fetch
      fireEvent.click(within(bookHeader).getByRole('button'));
      expect(bookHeader).toHaveAttribute('aria-sort', 'descending');

      // Archived book is hidden by default
      expect(screen.queryByText('Asynchronous Programming in Rust')).not.toBeInTheDocument();
      expect(screen.getByText('The Rust Programming Language')).toBeInTheDocument();

      // Unchecking Hide archived incrementally fetches including archived entries
      fireEvent.click(screen.getByLabelText('Hide archived'));
      expect(await screen.findByText('Asynchronous Programming in Rust')).toBeInTheDocument();

      // Search incrementally fetches matching books
      fireEvent.change(screen.getByRole('searchbox', { name: /Search free programming books/i }), {
        target: { value: 'Basarat' },
      });
      expect(await screen.findByText('TypeScript Deep Dive')).toBeInTheDocument();
      await vi.waitFor(() => {
        expect(screen.queryByText('The Rust Programming Language')).not.toBeInTheDocument();
      });

      // nuqs flushes URL query updates cleanly
      await vi.waitFor(() => {
        const qs = updates.at(-1)?.queryString ?? '';
        expect(qs).toContain('q=Basarat');
        expect(qs).toContain('archived=true');
        expect(qs).toContain('dir=desc');
      });
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });

  it('hydrates non-default URL pagination directly via incremental /api/v1/books/free fetch', async () => {
    const manyLines = [
      '### Rust',
      ...Array.from(
        { length: 30 },
        (_, i) =>
          `* [Rust Book ${String(i + 1).padStart(2, '0')}](https://doc.rust-lang.org/book-${i + 1}/) - Author ${i + 1} (PDF)`,
      ),
    ].join('\n');
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(manyLines, 'langs'),
      [],
    );
    const initialPage = buildFreeBooksPageResponse(catalog, { limit: 50, offset: 0 });

    const fetchSpy = stubFreeBooksApi(catalog, (sp) => ({
      format: (sp.get('format') as 'all' | 'PDF' | null) ?? 'all',
      limit: Number.parseInt(sp.get('limit') ?? '50', 10),
      offset: Number.parseInt(sp.get('offset') ?? '0', 10),
    }));

    const queryClient = makeQueryClient();

    try {
      renderExplorer(queryClient, initialPage, {
        hasMemory: true,
        searchParams: '?perPage=25&page=2&format=PDF',
      });

      expect(await screen.findByText('Rust Book 26')).toBeInTheDocument();
      expect(screen.queryByText('Rust Book 01')).not.toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/books/free?'),
        expect.anything(),
      );
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });

  it('debounces rapid typing into a single sanitized incremental API fetch', async () => {
    const catalog = buildFreeProgrammingBooksCatalog(
      parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs'),
      parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects'),
    );
    const initialPage = buildFreeBooksPageResponse(catalog, {
      hideArchived: true,
      hideUnavailable: true,
      limit: 50,
      offset: 0,
    });

    const fetchSpy = stubFreeBooksApi(catalog, (sp) => ({
      q: sp.get('q') ?? '',
      hideArchived: sp.get('hideArchived') === 'true',
      hideUnavailable: sp.get('hideUnavailable') === 'true',
      limit: Number.parseInt(sp.get('limit') ?? '50', 10),
      offset: Number.parseInt(sp.get('offset') ?? '0', 10),
    }));

    const queryClient = makeQueryClient();

    try {
      renderExplorer(queryClient, initialPage, { hasMemory: true });

      const input = screen.getByRole('searchbox', { name: /Search free programming books/i });
      fireEvent.change(input, { target: { value: 'B' } });
      fireEvent.change(input, { target: { value: 'Ba' } });
      fireEvent.change(input, { target: { value: 'Bas' } });
      fireEvent.change(input, { target: { value: '<img src=x onerror=alert(1)>Basarat​' } });

      // Debounce prevents firing before 250ms
      expect(fetchSpy).not.toHaveBeenCalled();

      // After debounce settles, exactly one sanitized request fires
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('q=Basarat');
      expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain('onerror');
    } finally {
      fetchSpy.mockRestore();
      queryClient.clear();
    }
  });
});
