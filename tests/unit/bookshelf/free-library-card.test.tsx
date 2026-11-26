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
 * @file The Free Library's promo copy, written in words so it can never drift from the catalog:
 * the card under the shelf cards (free-library-card.tsx) and the /bookshelf/free page's meta
 * description carry no figures, and the card makes no claim that the books are verified.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The page's catalog loader reads GitHub and Redis; only its metadata is read here.
vi.mock('@/lib/free-books/loader', () => ({ loadFreeProgrammingBooks: vi.fn() }));

import { FreeLibraryDirectoryCard } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/free-library-card';
import { metadata } from '@/app/(routes)/(main)/(personal)/bookshelf/free/page';

describe('the Free Library promo copy', () => {
  it('describes the library on its card in words: no figures, no claim it is verified', () => {
    const { container } = render(<FreeLibraryDirectoryCard />);
    const text = container.textContent ?? '';

    expect(text).toContain('Free Programming Books Directory');
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/verified/i);
  });

  it('gives /bookshelf/free a meta description with no figures', () => {
    const { description } = metadata;

    expect(description).toEqual(expect.any(String));
    expect(description).not.toMatch(/\d/);
  });
});
