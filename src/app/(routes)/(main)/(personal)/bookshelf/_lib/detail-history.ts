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
 * @file The history entry of a book opened in place on the stage (use-in-page-detail.ts). Opening
 * a book from the stage pushes its own page's address, /bookshelf/<slug>, over the list's entry,
 * keeping the list's query (its filters, so the stage's order and place hold still under the
 * detail); another book opened from the detail replaces it, so one Back returns to the list.
 * Leaving goes Back when the entry was pushed over the list's, so no second list entry piles up,
 * and otherwise (a page entered on a book's address) writes the list's address in its place.
 *
 * Next's App Router patches pushState and replaceState: a plain write with a new URL is taken in
 * as the router's URL, so usePathname() would turn to /bookshelf/<slug> while the list is still
 * what renders (the site's nav reads that pathname for its active state). A book's entry is
 * therefore written with the state Next keeps on the list's entry (its `__NA` mark and route
 * tree) plus our own mark. Next passes a write that carries its mark straight through, so its
 * URL and route stay the list's; and a Back or Forward still finds the list's route tree on the
 * entry, so Next renders the stage, which opens the book its address names. The page itself does
 * not remount either way: the site's PageEnter restarts only when the rendered route segments
 * change. A list's address is written plainly, and Next takes it in. Client only; guarded by
 * tests/unit/bookshelf/detail-history.test.ts.
 */

import { bookPath, legacyStageLabel, slugFromBookPath } from './book-address';

/** Our mark on a book's entry, in its history state. */
const BOOK_ENTRY_KEY = 'bookshelfBook';

type HistoryState = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is HistoryState =>
  typeof value === 'object' && value !== null;

/** The current entry's state, Next's fields (and anyone else's) kept, with our mark set. */
function markedState(pushed: boolean): HistoryState {
  const current = isRecord(window.history.state) ? window.history.state : {};
  return { ...current, [BOOK_ENTRY_KEY]: { pushed } };
}

/** `slug`'s page with the current query (the list's filters) kept. */
const bookHref = (slug: string): string => `${bookPath(slug)}${window.location.search}`;

/** Whether the current entry is a book's that was pushed over the list's entry. */
export function isPushedBookEntry(): boolean {
  const state: unknown = window.history.state;
  const mark = isRecord(state) ? state[BOOK_ENTRY_KEY] : undefined;
  return isRecord(mark) && mark.pushed === true;
}

/** Whether the address names a book: its page's path, or an old #/stage/NN link. */
function isBookAddress(): boolean {
  return (
    slugFromBookPath(window.location.pathname) !== null ||
    legacyStageLabel(window.location.hash) !== null
  );
}

/** Pushes `slug`'s page over the list's entry. */
export function pushBookAddress(slug: string): void {
  window.history.pushState(markedState(true), '', bookHref(slug));
}

/** Puts `slug`'s page in place of the current address, keeping whether the entry was pushed. */
export function replaceBookAddress(slug: string): void {
  window.history.replaceState(markedState(isPushedBookEntry()), '', bookHref(slug));
}

/**
 * Returns the address to the list at `listPath`, query kept: Back from an entry pushed over the
 * list's, else the list's address in this entry's place. Writes nothing when the address is the
 * list's already (Back or Forward moved it first).
 */
export function leaveBookAddress(listPath: string): void {
  if (!isBookAddress()) return;
  if (isPushedBookEntry()) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, '', `${listPath}${window.location.search}`);
}
