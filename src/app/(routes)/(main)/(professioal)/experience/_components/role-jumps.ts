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
 * @file The list's history entries, kept whole between the browser and the router. Browser
 * only: the page's one client part (role-crosslight.tsx) attaches it. A row (a stop on the
 * story's rail) marks itself while it is the page's target (:target, role-stop.tsx). Each entry
 * of the list carries a note beside the router's own state (ENTRY_NOTE): whether a row was
 * landed on there, and which rows were open. The router keeps another script's keys on its
 * entries, so the note lasts as long as the entry does.
 *
 * - The browser makes an entry the router does not know: a jump inside the page (the "Jump to"
 *   line, a capsule on "The path so far", plain #links), and the page's first entry when a jump
 *   came before hydration. Its state is empty, and the router skips such an entry: a later Back
 *   to it would change the address and leave the page as it was. While the list is on screen,
 *   any such entry on its own path is handed to the router (it follows a replaceState made
 *   outside it, takes the address and adds its own state). Another page's entry is not the
 *   list's to take.
 * - A link arrival at a row (a role page's "All experience") is the router's move: its entry has
 *   no note yet and the browser was never told of the fragment, so no row is the target. Going
 *   to the same fragment once more, in place, tells it, and the row takes the visitor there.
 * - A Back or Forward to an entry whose note says its row was landed on is a traversal: the
 *   browser puts the scroll back where the visitor left it, so nothing here moves the page. The
 *   one thing in the way is the browser itself, which would scroll to the fragment's row instead:
 *   as the list is laid out when it comes back from another page (prepareEntry), and right after
 *   popstate between two of the list's own entries (Chrome does, on a Back between two jumps).
 *   Either way that row has no id for the first two frames (holdId). It is not made the target
 *   again either; that would move the page. The rows open on that entry are opened again before
 *   the first layout, which the browser cannot do: the router draws the list anew.
 * - Following a link to the fragment the address already has (a "Jump to" name a second time,
 *   after scrolling away) is no traversal, though Chrome fires popstate for it too: it replaces
 *   the entry in place, keeping its state, and goes to the row. Each noted entry carries a key of
 *   its own (EntryNote.key), so a popstate that leaves the list on the entry it was on keeps the
 *   row's id, and the browser goes to the row and makes it the target, as without JavaScript.
 * - Only a row is landed on (ROWS): a fragment naming anything else in the list, such as a
 *   chapter, is left to the browser, and its id is never taken.
 * - From any other page the list is not mounted, so a Back two steps at once onto an entry the
 *   router never stamped is role-list-entry-guard.tsx's, which this attaches once the list is on
 *   screen and which then lasts the rest of the document (a role page attaches it too).
 *
 * Without JavaScript all of it is the browser's own and nothing here is needed (a Back between
 * two jumps then lands on the earlier row, as the browser has it).
 */

import { guardListEntries, showList } from './role-list-entry-guard';

/** The key of the list's note on a history entry, beside the router's own. */
export const ENTRY_NOTE = 'experienceList';

/** What the list notes on one of its history entries. */
interface EntryNote {
  /**
   * This entry's own key, written with its first note: a popstate onto another key is a Back or
   * Forward, one that keeps it is a link to the fragment the address already has.
   */
  readonly key?: string;
  /** The fragment's row was the page's target there: a Back to the entry is a traversal. */
  readonly landed?: boolean;
  /** The ids of the rows open there, in the list's order. */
  readonly open?: readonly string[];
}

/** A row: a stop on the story's rail (role-stop.tsx). */
const ROWS = '[data-role-row]';
/** What opens on a row: its "What I did". */
const OPENERS = '[data-role-row] details[data-role-more]';
const OPEN_NOW = '[data-role-row] details[data-role-more][open]';

/** The id of the row a "What I did" opens on. */
const rowIdOf = (details: HTMLDetailsElement): string | undefined =>
  details.closest<HTMLElement>(ROWS)?.dataset.id;

/** The row inside `root` that the address's fragment names, if any; anything else is no row. */
function rowNamedBy(root: HTMLElement, hash: string): HTMLElement | null {
  if (hash.length < 2) return null;
  try {
    const named = document.getElementById(decodeURIComponent(hash.slice(1)));
    return named && root.contains(named) && named.matches(ROWS) ? named : null;
  } catch {
    // A fragment that is not valid percent-encoding names nothing.
    return null;
  }
}

/** Whether `element` is the page's target. An engine that cannot answer is taken to say yes. */
function isTarget(element: HTMLElement): boolean {
  try {
    return element.matches(':target');
  } catch {
    return true;
  }
}

/** The current entry's state as an object, or null when it has none. */
function stateNow(): Record<string, unknown> | null {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : null;
}

/** The list's note on the current entry; empty when there is none. */
function noteNow(): EntryNote {
  const note = stateNow()?.[ENTRY_NOTE];
  return typeof note === 'object' && note !== null ? (note as EntryNote) : {};
}

/** A key no other entry of the tab carries: the time, and chance for two in one millisecond. */
function newEntryKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Writes `change` into the current entry's note, keeping the rest of its state, and gives the
 * entry its key if it has none; returns the key. On an entry without the router's state this is
 * also the hand-over: the router follows the write.
 */
function writeNote(change: Omit<EntryNote, 'key'>): string {
  const state = stateNow();
  const before = noteNow();
  const key = before.key ?? newEntryKey();
  const note: EntryNote = { ...before, ...change, key };
  window.history.replaceState({ ...state, [ENTRY_NOTE]: note }, '', window.location.href);
  return key;
}

/** Opens the rows named in `ids` (or their "What I did"); the others are left as they are. */
function reopen(root: HTMLElement, ids: readonly string[] | undefined): void {
  if (!ids || ids.length === 0) return;
  for (const details of root.querySelectorAll<HTMLDetailsElement>(OPENERS)) {
    const id = rowIdOf(details);
    if (id && ids.includes(id)) details.open = true;
  }
}

/** Frames to wait before the row takes its id back: one is laid out, the next follows it. */
const HELD_FRAMES = 2;
/**
 * The longest a row's id is held when no frame comes: a hidden tab pauses frames, not timers.
 * Far past two frames, so a visible tab's frames always come first.
 */
const HOLD_LIMIT_MS = 1000;

/**
 * Takes `row`'s id away for the first two frames, or HOLD_LIMIT_MS if no frame comes: the
 * browser then finds no element for the fragment as it lays the list out, and keeps the scroll
 * it restores. Returns how to give it back early.
 */
function holdId(row: HTMLElement): () => void {
  const { id } = row;
  let frame = 0;
  let timer = 0;
  const giveBack = (): void => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    if (!row.id) row.id = id;
  };
  const wait = (left: number): void => {
    frame = window.requestAnimationFrame(() => (left > 1 ? wait(left - 1) : giveBack()));
  };
  row.removeAttribute('id');
  wait(HELD_FRAMES);
  timer = window.setTimeout(giveBack, HOLD_LIMIT_MS);
  return giveBack;
}

/**
 * Readies the list for the entry it was drawn for, before the browser lays it out (call from a
 * layout effect); returns how to undo it. The rows that were open on the entry open again. On a
 * Back or Forward to an entry the list landed on, the browser would scroll to the fragment's
 * row instead of putting the scroll back where the visitor left it (Chrome does, once the list
 * is drawn): its row loses its id until that first layout is done.
 */
export function prepareEntry(root: HTMLElement): () => void {
  const note = noteNow();
  reopen(root, note.open);
  return holdLanded(root);
}

/** Holds the id of the row the current entry landed on (holdId); nothing on any other entry. */
function holdLanded(root: HTMLElement): () => void {
  const row = noteNow().landed ? rowNamedBy(root, window.location.hash) : null;
  return row ? holdId(row) : () => undefined;
}

/**
 * The row the address names, once the page is mounted. A traversal back to an entry the list
 * landed on is left alone (prepareEntry kept the scroll). Otherwise the row is already the
 * target (a hard load, a jump before hydration) or this is a link arrival, and the browser is
 * told: it moves to the row. Either way the entry is noted as landed on.
 */
function landOn(root: HTMLElement): void {
  const { hash } = window.location;
  const row = rowNamedBy(root, hash);
  if (!row || noteNow().landed) return;
  if (!isTarget(row)) window.location.replace(hash);
  writeNote({ landed: true });
}

/**
 * Keeps the list's history entries whole under `root`; returns how to stop. Call once the page
 * is mounted, in the browser.
 */
export function attachJumps(root: HTMLElement): () => void {
  // The list's own path, wherever it is mounted.
  const path = window.location.pathname;
  let release: () => void = () => undefined;
  // From here on, whatever page the visitor goes on to, a Back onto an entry of the list the
  // router skips loads the list anew (role-list-entry-guard.tsx); while the list is on screen
  // it hands such an entry over itself.
  const hideList = showList();
  guardListEntries(path);
  landOn(root);
  // The key of the entry the list is on, once it has one.
  let onEntry = noteNow().key;
  /** Hands the current entry to the router when the browser made it on the list's path. */
  const adopt = (): void => {
    if (stateNow() !== null || window.location.pathname !== path) return;
    onEntry = writeNote({ landed: rowNamedBy(root, window.location.hash) !== null });
  };
  /**
   * A popstate on the list: a Back or Forward between its own entries (the browser would then
   * scroll to a landed entry's row, so its id is held first), a jump the browser just made,
   * whose entry has no state yet and is handed over, or a link to the fragment the address
   * already has, on the entry the list is on: the browser goes to the row then, so its id stays.
   */
  const onPopState = (): void => {
    const { key } = noteNow();
    const traversal = key === undefined || key !== onEntry;
    onEntry = key;
    if (window.location.pathname === path) {
      release();
      release = traversal ? holdLanded(root) : () => undefined;
    }
    adopt();
  };
  /** Notes which rows are open now; a row's toggle event does not bubble, so it is caught. */
  const noteOpen = (event: Event): void => {
    if (!(event.target instanceof HTMLDetailsElement) || !event.target.matches(OPENERS)) return;
    const open = Array.from(root.querySelectorAll<HTMLDetailsElement>(OPEN_NOW));
    const ids = [...new Set(open.flatMap((details) => rowIdOf(details) ?? []))];
    onEntry = writeNote({ open: ids });
  };

  // A jump made before the router followed the history (a slow hydration) may have left its
  // entry without state. Wait a turn: on the first load the router starts after these effects.
  const late = window.setTimeout(adopt, 0);
  // A fragment navigation fires popstate, with no state; so does Back or Forward to its entry.
  window.addEventListener('popstate', onPopState);
  root.addEventListener('toggle', noteOpen, true);
  return () => {
    hideList();
    window.clearTimeout(late);
    window.removeEventListener('popstate', onPopState);
    root.removeEventListener('toggle', noteOpen, true);
    release();
  };
}
