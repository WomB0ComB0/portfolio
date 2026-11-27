// @vitest-environment node
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
 * @file A book page's og:type 'book' tags from the catalog's book: one book:author per author
 * (Studio keeps them in one field, "A, B & C"), book:isbn as bare digits when the ISBN is a real
 * one, and the shelf as its book:tag.
 */

import { describe, expect, it } from 'vitest';
import { bookOpenGraph } from '@/app/(routes)/(main)/(personal)/bookshelf/[slug]/_lib/book-open-graph';

const book = {
  authors: 'Hayden Van Der Post',
  isbn: '978-1-11-981738-3',
  track: 'Web & Languages',
};

describe("a book page's og:type book tags", () => {
  it('names the author, the ISBN as digits and the shelf as a tag', () => {
    expect(bookOpenGraph(book)).toEqual({
      authors: ['Hayden Van Der Post'],
      isbn: '9781119817383',
      tags: ['Web & Languages'],
    });
  });

  it.each([
    ['commas', 'Eric Matthes, Jane Doe, Bob Ray'],
    ['an ampersand', 'Eric Matthes, Jane Doe & Bob Ray'],
    ['"and"', 'Eric Matthes, Jane Doe and Bob Ray'],
  ])('splits several authors joined by %s, one tag each', (_case, authors) => {
    expect(bookOpenGraph({ ...book, authors }).authors).toEqual([
      'Eric Matthes',
      'Jane Doe',
      'Bob Ray',
    ]);
  });

  it('keeps a name that only contains the letters "and"', () => {
    expect(bookOpenGraph({ ...book, authors: 'Andrew Hunt & Sandra Brand' }).authors).toEqual([
      'Andrew Hunt',
      'Sandra Brand',
    ]);
  });

  it.each([
    ['no ISBN', undefined],
    ['an ISBN of the wrong length', '978-1-11'],
  ])('leaves out book:isbn for %s', (_case, isbn) => {
    expect(bookOpenGraph({ ...book, isbn })).not.toHaveProperty('isbn');
  });
});
