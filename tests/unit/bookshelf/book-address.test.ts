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
 * @file A book's address (book-address.ts): its page's path, /bookshelf/<slug>; the list a book
 * opens over (the whole shelf or one shelf's page); the slug a page's path names, and none for
 * the free library, a shelf's page or any other path; and the stage number an old #/stage/NN
 * link names, which is only ever read.
 */

import { describe, expect, it } from 'vitest';

import {
  bookPath,
  legacyStageLabel,
  listPath,
  slugFromBookPath,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-address';

describe('bookPath', () => {
  it("is the book's own page under /bookshelf", () => {
    expect(bookPath('job-ready-python')).toBe('/bookshelf/job-ready-python');
  });

  it('escapes a slug that is not URL-safe, and reads back as the same slug', () => {
    expect(bookPath('a b/c')).toBe('/bookshelf/a%20b%2Fc');
    expect(slugFromBookPath(bookPath('a b/c'))).toBe('a b/c');
  });
});

describe('listPath', () => {
  it("is /bookshelf for the whole shelf, and the shelf's page for one shelf", () => {
    expect(listPath()).toBe('/bookshelf');
    expect(listPath('web-and-languages')).toBe('/bookshelf/shelf/web-and-languages');
  });
});

describe('slugFromBookPath', () => {
  it("reads the slug of a book's page, with or without a trailing slash", () => {
    expect(slugFromBookPath('/bookshelf/job-ready-python')).toBe('job-ready-python');
    expect(slugFromBookPath('/bookshelf/job-ready-python/')).toBe('job-ready-python');
  });

  it.each([
    ['the whole shelf', '/bookshelf'],
    ['the whole shelf with a trailing slash', '/bookshelf/'],
    ["a shelf's page", '/bookshelf/shelf/web-and-languages'],
    ['the free library', '/bookshelf/free'],
    ["the shelves' folder", '/bookshelf/shelf'],
    ['a page outside the bookshelf', '/projects/job-ready-python'],
    ['a malformed escape', '/bookshelf/%E0%A4%A'],
  ])('names no book on %s', (_label, pathname) => {
    expect(slugFromBookPath(pathname)).toBeNull();
  });
});

describe('legacyStageLabel', () => {
  it('reads the stage number an old #/stage/NN link names, two digits wide', () => {
    expect(legacyStageLabel('#/stage/28')).toBe('28');
    expect(legacyStageLabel('#/stage/7')).toBe('07');
    expect(legacyStageLabel('#/stage/01/notes')).toBe('01');
  });

  it.each([
    ['no hash', ''],
    ['a hash with no number', '#/stage/'],
    ['any other hash', '#top'],
  ])('names no stage with %s', (_label, hash) => {
    expect(legacyStageLabel(hash)).toBeNull();
  });
});
