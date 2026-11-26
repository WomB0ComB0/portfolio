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
 * @file src/lib/free-books/parse.ts: EbookFoundation's Markdown read into catalog entries (the
 * index skipped, categories and subcategories tracked, authors, formats, licences and fpb-lint
 * flags read, unsafe links refused), and a security manifest applied while parsing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { resetFreeProgrammingBooksCache } from '@/lib/free-books/loader';
import {
  parseFreeProgrammingBooksMarkdown,
  parseFreeProgrammingBooksWithStats,
} from '@/lib/free-books/parse';
import { SAMPLE_LANGS_MD, SAMPLE_SUBJECTS_MD } from './free-books-fixture';

describe('parseFreeProgrammingBooksMarkdown', () => {
  beforeEach(() => {
    resetFreeProgrammingBooksCache();
  });

  it('skips ### Index, parses ### / #### hierarchy, authors, formats, licenses, and fpb-lint flags', () => {
    const langs = parseFreeProgrammingBooksMarkdown(SAMPLE_LANGS_MD, 'langs');
    const subjects = parseFreeProgrammingBooksMarkdown(SAMPLE_SUBJECTS_MD, 'subjects');

    // Unsafe javascript: link and Index anchors are ignored; inline HTML anchors in headings are stripped.
    expect(langs).toHaveLength(5);
    expect(subjects).toHaveLength(2);
    expect(langs[3]).toMatchObject({
      title: 'Learn C++',
      category: 'C++',
    });

    expect(langs[0]).toMatchObject({
      title: 'The Rust Programming Language',
      url: 'https://doc.rust-lang.org/book/',
      authors: 'Steve Klabnik, Carol Nichols',
      source: 'langs',
      category: 'Rust',
      subcategory: null,
      formats: ['PDF', 'HTML'],
      license: 'MIT',
      archived: false,
      inProcess: false,
    });

    expect(langs[1]).toMatchObject({
      title: 'Rust By Example',
      inProcess: true,
      archived: false,
    });

    expect(langs[2]).toMatchObject({
      title: 'Asynchronous Programming in Rust',
      category: 'Rust',
      subcategory: 'Async',
      formats: ['HTML'],
      archived: true,
    });

    expect(langs[4]).toMatchObject({
      title: 'TypeScript Deep Dive',
      category: 'TypeScript',
      formats: ['PDF', 'HTML', 'EPUB'],
      license: 'CC BY-NC-SA',
    });

    expect(subjects[1]).toMatchObject({
      title: 'Designing Distributed Systems',
      requiresAccount: true,
    });
  });
});

describe('parseFreeProgrammingBooksWithStats', () => {
  it('quarantines manifest-blocked hosts and executable links, and flags unavailable entries', () => {
    const md = `
### Rust
* [Safe Book](https://doc.rust-lang.org/book/) - Team
* [Hijacked Book](https://hijacked.example/book) - Old Author
* [Dead Book](https://dead.example/404) - Gone Author
* [Dropper](https://example.com/guide.pdf.exe) - Bad
`;
    const manifest = {
      generatedAt: '2026-11-25T00:00:00.000Z',
      checkedHosts: 3,
      checkedUrls: 3,
      blockedHosts: { 'hijacked.example': 'Cloudflare Security DNS (1.1.1.2): dnsbl_sinkhole' },
      quarantinedUrls: {},
      unavailableUrls: { 'https://dead.example/404': '2026-11-25T00:00:00.000Z' },
    };

    const parsed = parseFreeProgrammingBooksWithStats(md, 'langs', manifest);
    expect(parsed.quarantinedCount).toBe(2);
    expect(parsed.entries.map((e) => ({ title: e.title, unavailable: e.unavailable }))).toEqual([
      { title: 'Safe Book', unavailable: false },
      { title: 'Dead Book', unavailable: true },
    ]);
  });
});
