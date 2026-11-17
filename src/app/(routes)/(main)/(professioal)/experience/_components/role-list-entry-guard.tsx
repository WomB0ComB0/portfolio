'use client';

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
 * @file The list's entries the router skips, guarded from every page. Browser only, and it draws
 * nothing. A jump made on /experience before the page was ready (role-jumps.ts) leaves the list's
 * entries before it without the router's state, and the router skips such an entry. While the
 * list is on screen it hands those entries over itself; from any other page (a role page, or
 * /projects through a technology's link) it cannot, and a Back that lands on one (two steps at
 * once, as the long-press Back menu does) would change the address to the list's and leave that
 * page on screen. So that one case loads the list anew. Every other entry stays the router's.
 * Without JavaScript all of it is the browser's own.
 *
 * - Two parts attach the guard, each once per document, for the rest of it: the list, once it is
 *   on screen (role-jumps.ts), so every page the visitor goes on to has it; and a role page
 *   (RoleListEntryGuard), for a role page the browser loads anew after the visitor left the site
 *   and came Back, whose document still counts the list's earlier entries as its own.
 * - It loads the list at most once: the list it loads is on screen (showList), so the guard
 *   there has nothing to do, and a load that cannot draw the list (an error page) has no guard.
 * - The browser saves the page on screen into the entry as it reloads: its scroll anchor, and its
 *   scroll, cut to that page's height. Chrome then brought the list back about 150px off, or at
 *   the top. So before reloading, scroll anchoring is turned off (no anchor of the wrong page is
 *   saved) and the page is made tall enough for the list's scroll, which the browser restores
 *   onto it first: that scroll is the one saved, and the list comes back where the visitor was.
 *   Until the list is drawn the visitor may see that page's empty foot for a moment.
 */

import { useEffect } from 'react';

/** Tall enough for any scroll the list can have, so the page on screen can take the list's. */
const RELOAD_HEIGHT = '1000000px';
/** The latest the reload waits for a frame: a hidden tab draws none. */
const RELOAD_LATEST_MS = 250;

/**
 * Loads the page anew, keeping the scroll the browser restores for the entry: scroll anchoring
 * off and room for that scroll, so the page on screen saves only the list's own scroll into the
 * entry, never its anchor or the limit of its height. Call while popstate is handled.
 *
 * The browser puts the entry's scroll back once the event is done, if the page is laid out, and
 * otherwise with the next frame; a reload begun before that cancels it (Chrome then brought the
 * list back at the top). So the page is laid out at its new height at once, and the reload waits
 * for the frame after the event, or RELOAD_LATEST_MS when no frame comes.
 */
function reloadKeepingScroll(): void {
  const root = document.documentElement;
  root.style.overflowAnchor = 'none';
  root.style.minHeight = RELOAD_HEIGHT;
  // Asking for a box lays the page out now, at its new height.
  root.getBoundingClientRect();
  let started = false;
  const reload = (): void => {
    if (started) return;
    started = true;
    window.location.reload();
  };
  window.requestAnimationFrame(() => window.setTimeout(reload, 0));
  window.setTimeout(reload, RELOAD_LATEST_MS);
}

/**
 * Loads the page anew (`reload`) on a Back or Forward to an entry of `listPath` that has no
 * state, unless the list is on screen (`listShown`), which hands such an entry over itself;
 * returns how to stop. In the browser.
 */
export function attachListEntryGuard(
  listPath: string,
  listShown: () => boolean,
  reload: () => void = reloadKeepingScroll,
): () => void {
  const onPopState = (event: PopStateEvent): void => {
    if (event.state === null && window.location.pathname === listPath && !listShown()) reload();
  };
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}

/** How many lists are on screen in this document. */
let listsShown = 0;

/** Notes that the list is on screen, until the returned function is called. */
export function showList(): () => void {
  listsShown += 1;
  let hidden = false;
  return () => {
    if (hidden) return;
    hidden = true;
    listsShown -= 1;
  };
}

/** The list paths guarded in this document. */
const guardedPaths = new Set<string>();

/**
 * Guards `listPath`'s entries for the rest of the document, whatever page is on screen: once per
 * path, and never taken off, since the pages the visitor goes on to must keep it. The list's
 * entries are left to the list while it is on screen (showList).
 */
export function guardListEntries(listPath: string): void {
  if (guardedPaths.has(listPath)) return;
  guardedPaths.add(listPath);
  attachListEntryGuard(listPath, () => listsShown > 0);
}

export interface RoleListEntryGuardProps {
  /** The list's own path: /experience. */
  readonly listPath: string;
}

/** Mount once on a role page; it renders nothing, so nothing shifts when it hydrates. */
export function RoleListEntryGuard({ listPath }: RoleListEntryGuardProps): null {
  useEffect(() => guardListEntries(listPath), [listPath]);
  return null;
}
