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
 * @file The history entries of a book opened in place (detail-history.ts), against a stand-in
 * for Next's patched history methods: like Next's, it takes any write that lacks Next's `__NA`
 * mark in as the router's URL (which would turn usePathname to the book's address while the
 * list still renders). A book's address is pushed over the list's with the list's query kept and
 * the state Next keeps for the list entry carried along, so the router stays on the list; another
 * book replaces it, keeping whether the entry was pushed; leaving goes Back from a pushed entry,
 * and otherwise writes the list's address plainly in its place, which the router takes in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isPushedBookEntry,
  leaveBookAddress,
  pushBookAddress,
  replaceBookAddress,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/detail-history';

/** The state Next's router keeps on its own entries: its mark and the route tree. */
const NEXT_ENTRY_STATE = {
  __NA: true,
  __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ['', { children: ['bookshelf', {}] }] },
} as const;
const LIST = '/bookshelf';
const QUERY = '?shelf=ai&status=reading';

/** The address now: path, query and hash. */
const address = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

/** Waits for the Back or Forward under way to land. */
const nextPopState = (): Promise<void> =>
  new Promise((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

/** The URLs written without Next's mark: each one a route change for Next's router. */
let routeChanges: string[];

/**
 * Stands in for Next's patch of pushState and replaceState: a write that carries Next's mark is
 * passed straight through; any other write with a URL is also taken in as a route change.
 */
function standInForNextRouter(): void {
  routeChanges = [];
  for (const method of ['pushState', 'replaceState'] as const) {
    const native = History.prototype[method];
    vi.spyOn(window.history, method).mockImplementation(function patched(
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      const isNextsOwn = (data as { readonly __NA?: unknown } | null)?.__NA === true;
      if (!isNextsOwn && url) routeChanges.push(String(url));
      native.call(window.history, data, unused, url);
    });
  }
}

beforeEach(() => {
  window.history.replaceState(NEXT_ENTRY_STATE, '', `${LIST}${QUERY}`);
  standInForNextRouter();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pushBookAddress', () => {
  it("pushes the book's page over the list's entry, keeping the list's query", async () => {
    pushBookAddress('agents-in-practice');

    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(address()).toBe(`/bookshelf/agents-in-practice${QUERY}`);
    expect(isPushedBookEntry()).toBe(true);

    // The list's entry is still there, one Back away.
    const landed = nextPopState();
    window.history.back();
    await landed;
    expect(address()).toBe(`${LIST}${QUERY}`);
  });

  it("carries the list entry's Next state, so the router stays on the list", () => {
    pushBookAddress('agents-in-practice');

    expect(routeChanges).toEqual([]);
    expect(window.history.state).toMatchObject(NEXT_ENTRY_STATE);
  });
});

describe('replaceBookAddress', () => {
  it("puts another book's page in place of the pushed one, still marked as pushed", () => {
    pushBookAddress('agents-in-practice');
    const length = window.history.length;

    replaceBookAddress('ai-book-3');

    expect(address()).toBe(`/bookshelf/ai-book-3${QUERY}`);
    expect(window.history.length).toBe(length);
    expect(isPushedBookEntry()).toBe(true);
    expect(routeChanges).toEqual([]);
  });

  it('rewrites an old #/stage/NN link to the book page, marked as not pushed', () => {
    window.history.replaceState(NEXT_ENTRY_STATE, '', `${LIST}${QUERY}#/stage/07`);
    routeChanges = [];

    replaceBookAddress('agents-in-practice');

    expect(address()).toBe(`/bookshelf/agents-in-practice${QUERY}`);
    expect(isPushedBookEntry()).toBe(false);
    expect(routeChanges).toEqual([]);
  });
});

describe('leaveBookAddress', () => {
  it("goes Back from a pushed entry to the list's, adding no entry", async () => {
    pushBookAddress('agents-in-practice');
    const length = window.history.length;
    const back = vi.spyOn(window.history, 'back');
    const landed = nextPopState();

    leaveBookAddress(LIST);
    await landed;

    expect(back).toHaveBeenCalledTimes(1);
    expect(address()).toBe(`${LIST}${QUERY}`);
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual(NEXT_ENTRY_STATE);
  });

  it("writes the list's address plainly in place of an entry it did not push", () => {
    window.history.replaceState(NEXT_ENTRY_STATE, '', `/bookshelf/shelf/ai${QUERY}#/stage/07`);
    replaceBookAddress('agents-in-practice');
    routeChanges = [];
    const back = vi.spyOn(window.history, 'back');
    const length = window.history.length;

    leaveBookAddress('/bookshelf/shelf/ai');

    expect(back).not.toHaveBeenCalled();
    expect(address()).toBe(`/bookshelf/shelf/ai${QUERY}`);
    expect(window.history.length).toBe(length);
    // Written without Next's mark: Next takes the list's address in as its route's own.
    expect(routeChanges).toEqual([`/bookshelf/shelf/ai${QUERY}`]);
  });

  it("writes nothing when the address is the list's already", () => {
    const back = vi.spyOn(window.history, 'back');

    leaveBookAddress(LIST);

    expect(back).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(address()).toBe(`${LIST}${QUERY}`);
  });
});
