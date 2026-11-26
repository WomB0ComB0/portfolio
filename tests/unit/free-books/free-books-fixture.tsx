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
 * @file Shared inputs for the free-books tests: two small Markdown lists in EbookFoundation's
 * format (one per source, with an index, a subcategory, an unsafe link and fpb-lint flags), a
 * fetch stub that answers `/api/v1/books/free?…` with a page of a given catalog, and the explorer
 * rendered inside a QueryClient and a nuqs testing adapter. Not a test file.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { FreeBooksExplorer } from '@/app/(routes)/(main)/(personal)/bookshelf/free/_components/free-books-explorer';
import { buildFreeBooksPageResponse } from '@/lib/free-books/catalog';
import type { FreeBooksPageResponse, FreeProgrammingBooksCatalog } from '@/lib/free-books/types';

export const SAMPLE_LANGS_MD = `
### Index

* [Rust](#rust)
* [TypeScript](#typescript)

### Rust

* [The Rust Programming Language](https://doc.rust-lang.org/book/) - Steve Klabnik, Carol Nichols (HTML, PDF) (MIT)
* [Rust By Example](https://doc.rust-lang.org/rust-by-example/) - Rust Team ( :construction: *in process*)
* [Unsafe Link](javascript:alert(1)) - Should Be Ignored

#### Async

* [Asynchronous Programming in Rust](https://rust-lang.github.io/async-book/) - Rust Async WG (HTML) ( :card_file_box: archived)

### <a id="cpp"></a>C++

* [Learn C++](https://www.learncpp.com/) - Alex Allain (HTML)

### TypeScript

* [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - Basarat Ali Syed (HTML, PDF, EPUB) (CC BY-NC-SA)
`;

export const SAMPLE_SUBJECTS_MD = `
### Index

* [Algorithms & Data Structures](#algorithms--data-structures)

### Algorithms & Data Structures

* [A Common-Sense Guide to Data Structures & Algorithms](https://example.com/guide.pdf) - Jay Wengrow (PDF)
* [Designing Distributed Systems](https://example.com/dist) - Brendan Burns (email address *requested*)
`;

/** The page options buildFreeBooksPageResponse takes. */
type PageOptions = NonNullable<Parameters<typeof buildFreeBooksPageResponse>[1]>;

/** The URL a fetch call asked for, whatever form `input` took. */
export const requestUrl = (input: string | URL | Request): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/**
 * Stubs `fetch` to answer each `/api/v1/books/free?…` request with a page of `catalog`, built from
 * the options `readOptions` reads off the request's query. Restore it with `mockRestore()`.
 */
export function stubFreeBooksApi(
  catalog: FreeProgrammingBooksCatalog,
  readOptions: (params: URLSearchParams) => PageOptions,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const parsed = new URL(requestUrl(input), 'https://mikeodnis.dev');
    const payload = buildFreeBooksPageResponse(catalog, readOptions(parsed.searchParams));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

/** A query client that never retries, so a failed fetch fails the test at once. */
export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

/** Renders the explorer on `initialPage` with `queryClient` and the nuqs testing adapter. */
export function renderExplorer(
  queryClient: QueryClient,
  initialPage: FreeBooksPageResponse,
  adapter: Omit<ComponentProps<typeof NuqsTestingAdapter>, 'children'>,
): void {
  render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter {...adapter}>
        <FreeBooksExplorer initialPage={initialPage} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
