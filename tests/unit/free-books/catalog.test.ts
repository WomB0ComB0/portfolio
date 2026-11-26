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
 * @file src/lib/free-books/catalog.ts: the catalog's counts, and the filters a page applies
 * (source, category, format, a normalised multi-word query, the archived and in-progress flags,
 * and verified hosts only).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildFreeProgrammingBooksCatalog,
  filterFreeProgrammingBooks,
} from '@/lib/free-books/catalog';
import { resetFreeProgrammingBooksCache } from '@/lib/free-books/loader';
import { parseFreeProgrammingBooksMarkdown } from '@/lib/free-books/parse';
import { SAMPLE_LANGS_MD, SAMPLE_SUBJECTS_MD } from './free-books-fixture';

describe('filterFreeProgrammingBooks', () => {
  beforeEach(() => {
    resetFreeProgrammingBooksCache();
  });

  it('filters by source, category, format, query, and archived/inProcess flags', () => {
    const langs = parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs');
    const subjects = parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects');
    const catalog = buildFreeProgrammingBooksCatalog(langs, subjects);

    expect(catalog.totalBooks).toBe(7);
    expect(catalog.languageCategoriesCount).toBe(3);
    expect(catalog.subjectCategoriesCount).toBe(1);

    expect(
      filterFreeProgrammingBooks(catalog.books, {
        source: 'langs',
        format: 'EPUB',
      }).map((b) => b.title),
    ).toEqual(['TypeScript Deep Dive']);

    expect(
      filterFreeProgrammingBooks(catalog.books, {
        category: 'Rust',
        hideArchived: true,
        hideInProcess: true,
      }).map((b) => b.title),
    ).toEqual(['The Rust Programming Language']);

    expect(filterFreeProgrammingBooks(catalog.books, { q: 'wengrow' }).map((b) => b.title)).toEqual(
      ['A Common-Sense Guide to Data Structures & Algorithms'],
    );

    // Multi-token AND matching + XSS/bidi sanitization
    expect(
      filterFreeProgrammingBooks(catalog.books, {
        q: '  <script></script>rust‮   async  ',
      }).map((b) => b.title),
    ).toEqual(['Asynchronous Programming in Rust']);
  });

  it('keeps only the books on verified hosts with verifiedHostsOnly', () => {
    const mixed = parseFreeProgrammingBooksMarkdown(
      `### Rust\n* [GitHub Book](https://github.com/rust-lang/book)\n* [Blog Book](https://indie-blog.example/rust)`,
      'langs',
    );
    expect(filterFreeProgrammingBooks(mixed, { verifiedHostsOnly: true })).toHaveLength(1);
    expect(filterFreeProgrammingBooks(mixed, { verifiedHostsOnly: true })[0]?.host).toBe(
      'github.com',
    );
  });
});
