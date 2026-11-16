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
 * @file /experience and the history (role-jumps.ts, attached by the cross-lighting island). A
 * row is a stop on the story's rail, and what opens on it is its "What I did". A
 * jump to a row and the list's own history entries are kept whole between the browser and the
 * router: an entry the browser made on the list's path is handed to the router, so a later Back
 * to it is never skipped; a link arrival at a row makes it the page's target; a Back or Forward
 * to an entry the list already landed on leaves the scroll where the browser put it, whether it
 * comes back from another page or from another of the list's entries (a Back between two jumps),
 * with the row's id held for two frames, or a second when no frame comes; only a row is landed
 * on, never a chapter; and the rows the visitor opened on an entry are open again on the way
 * back to it; and a link to the row the address already names goes to it each time. From any
 * other page, once the list has been on screen, a Back onto a list entry the router never stamped
 * loads the list anew (role-list-entry-guard.tsx). jsdom has no router, so its part is played
 * here: the router's state is written on an entry where it would be.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadProjects: vi.fn(),
  peekProjects: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadProjects: h.loadProjects,
  peekProjects: h.peekProjects,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import { ENTRY_NOTE } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-jumps';
import { attachListEntryGuard } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-list-entry-guard';
import ExperiencePage from '@/app/(routes)/(main)/(professioal)/experience/(list)/page';
import {
  E_DIR,
  ISLAND_FILE,
  moreOf,
  NOW,
  ROLES,
  SERVER_PARTS,
  STORY_FILE,
  sourceOf,
  stopOf,
} from './story-fixtures';

const GUARD_FILE = `${E_DIR}/_components/role-list-entry-guard.tsx`;
const DETAIL_FILE = `${E_DIR}/_interface/role-detail/role-detail.tsx`;

/** What the router writes on its own history entries (app-router's keys). */
const ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}] };

type Note = { readonly key?: string; readonly landed?: boolean; readonly open?: readonly string[] };
type Written = Record<string, unknown> | null;

/** A note without its entry's key, which is new on every entry and so is checked on its own. */
const withoutKey = ({ key: _key, ...rest }: Note): Note => rest;

/** What the island wrote on the current entry, if anything. */
const noteNow = (): Note | undefined =>
  (window.history.state as Record<string, Note> | null)?.[ENTRY_NOTE];

/** The browser's part of a jump: the address takes the fragment, and the new entry has no state. */
function jumpTo(address: string): void {
  window.history.pushState(null, '', address);
  fireEvent(window, new PopStateEvent('popstate', { state: null }));
}

/**
 * The entries handed to the router, by their address: each a replaceState with the island's
 * note and without the router's keys, the write the router follows (it patches replaceState to
 * take the address and then put its own state on the entry, keeping the note).
 */
function handedOver(): {
  readonly addresses: () => string[];
  readonly notes: () => Note[];
  readonly keys: () => (string | undefined)[];
} {
  const write = vi.spyOn(window.history, 'replaceState');
  const handovers = () =>
    write.mock.calls.filter(([state]) => {
      const written = state as Written;
      return written !== null && ENTRY_NOTE in written && !('__NA' in written);
    });
  const written = () =>
    handovers().map(([state]) => (state as Record<string, Note>)[ENTRY_NOTE] ?? {});
  return {
    addresses: () => handovers().map(([, , address]) => String(address)),
    notes: () => written().map(withoutKey),
    keys: () => written().map((note) => note.key),
  };
}

/** One turn of the event loop: the island waits one before it looks at the entry it woke on. */
const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Back one entry, resolved once the popstate it fires has been dispatched. */
function goBack(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    window.history.back();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.loadExperiences.mockReset();
  h.loadProjects.mockReset();
  h.peekProjects.mockReset();
  h.loadExperiences.mockResolvedValue(ROLES);
  h.peekProjects.mockReturnValue(undefined);
  window.history.replaceState(ROUTER_STATE, '', '/experience');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  // What the guard sets on the page before it loads the list anew (jsdom loads nothing).
  document.documentElement.style.removeProperty('overflow-anchor');
  document.documentElement.style.removeProperty('min-height');
});

describe('/experience: a jump to a row and the history', () => {
  it("hands a jump's entry to the router, so a later Back to it is not skipped", async () => {
    render(await ExperiencePage());
    await nextTurn();
    const router = handedOver();

    jumpTo('#role-elysium');

    // The router ignores an entry without its state: the address would change, the page not.
    expect(router.addresses()).toEqual([window.location.href]);
    expect(router.notes()).toEqual([{ landed: true }]);
    expect(window.location.hash).toBe('#role-elysium');
  });

  it('does the same for a second jump, and for the same jump made twice', async () => {
    render(await ExperiencePage());
    await nextTurn();
    const router = handedOver();

    jumpTo('#role-elysium');
    jumpTo('#role-handshake');
    expect(router.addresses().map((address) => new URL(address).hash)).toEqual([
      '#role-elysium',
      '#role-handshake',
    ]);

    // The same link again makes the entry anew, without its state: it is handed over again.
    window.history.replaceState(null, '', '#role-handshake');
    fireEvent(window, new PopStateEvent('popstate', { state: null }));
    expect(router.addresses()).toHaveLength(3);
    // Each entry it hands over has a key of its own.
    const keys = router.keys();
    expect(keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(3);
  });

  it('leaves an entry the router wrote alone', async () => {
    render(await ExperiencePage());
    await nextTurn();
    const router = handedOver();

    // Back or Forward to an entry with the router's state: nothing to hand over.
    window.history.pushState(ROUTER_STATE, '', '#role-elysium');
    fireEvent(window, new PopStateEvent('popstate', { state: ROUTER_STATE }));

    expect(router.addresses()).toEqual([]);
  });

  it("hands over any entry the browser made on the list's own path, and none on another", async () => {
    render(await ExperiencePage());
    await nextTurn();
    const router = handedOver();

    // A fragment that names no row is still an entry the router would skip.
    jumpTo('#main-content');
    jumpTo('#%');
    expect(router.notes()).toEqual([{ landed: false }, { landed: false }]);

    // Another page's entry, whatever its fragment names, is not the list's to take.
    jumpTo('/elsewhere#role-elysium');
    expect(router.addresses()).toHaveLength(2);
  });

  it('notes the row a jump made before the page was ready, on the entry the router stamped', async () => {
    window.history.pushState(ROUTER_STATE, '', '/experience#role-elysium');
    const router = handedOver();

    render(await ExperiencePage());
    await nextTurn();

    // The router has the entry already (it stamps the current one as the page hydrates): the
    // island only notes that its row was landed on, and keeps the router's keys.
    expect(router.addresses()).toEqual([]);
    expect(window.history.state).toMatchObject({ ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } });
  });

  it("adopts the list's first entry when Back reaches it, after a jump made before the page was ready", async () => {
    // The page's first entry keeps no state: the router stamped only the jump's, as it hydrated.
    window.history.replaceState(null, '', '/experience');
    window.history.pushState(ROUTER_STATE, '', '/experience#role-elysium');
    render(await ExperiencePage());
    await nextTurn();
    const router = handedOver();

    await goBack();

    expect(window.location.hash).toBe('');
    expect(router.addresses()).toEqual([window.location.href]);
    expect(router.notes()).toEqual([{ landed: false }]);
  });

  it('stops when the page is left', async () => {
    window.history.pushState(null, '', '/experience#role-elysium');
    const { unmount } = render(await ExperiencePage());
    unmount();
    await nextTurn();
    const router = handedOver();

    jumpTo('#role-handshake');

    expect(router.addresses()).toEqual([]);
  });
});

describe('/experience: coming back to a row', () => {
  /** window.scrollTo, which jsdom does not implement: the calls the island makes to it. */
  const scrollCalls = () => vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

  /**
   * jsdom matches :target from the address alone; a browser does not after the router's
   * pushState, which is the case here: no row is the target until the island says so.
   */
  function noTargetYet(): void {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selectors: string,
    ) {
      return selectors === ':target' ? false : matches.call(this, selectors);
    });
  }

  beforeEach(() => {
    noTargetYet();
  });

  it('tells the browser of the fragment on a link arrival at a row, and notes it landed there', async () => {
    const scrolled = scrollCalls();
    // What "All experience" leaves: the router's entry at the row, the row not the target yet.
    window.history.pushState(ROUTER_STATE, '', '/experience#role-curve');

    render(await ExperiencePage());

    // The browser moves to the row itself (going to the fragment in place makes it the target);
    // the note makes a later Back to this entry a traversal.
    expect(noteNow()).toEqual({ key: expect.any(String), landed: true });
    expect(window.location.hash).toBe('#role-curve');
    expect(scrolled).not.toHaveBeenCalled();
  });

  it('leaves the page alone on a Back or Forward to an entry it landed on: no jump, no scroll', async () => {
    const scrolled = scrollCalls();
    const landed = { ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } };
    window.history.pushState(landed, '', '/experience#role-curve');
    const written = vi.spyOn(window.history, 'replaceState');

    render(await ExperiencePage());
    await nextTurn();

    // The browser puts the scroll back where the visitor left it, after the list is drawn: a
    // fragment navigation here would cancel that and move the page to the row.
    expect(window.history.state).toEqual(landed);
    expect(written).not.toHaveBeenCalled();
    expect(scrolled).not.toHaveBeenCalled();
  });

  it('keeps the fragment from naming its row for the first frames back, then gives the row its id again', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    window.history.pushState(
      { ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } },
      '',
      '/experience#role-curve',
    );

    const { container } = render(await ExperiencePage());
    const row = stopOf(container, 'curve');

    // A browser scrolls to the row the fragment names as the list is first laid out, instead of
    // putting the scroll back: for that frame the fragment names nothing.
    expect(row.id).toBe('');
    frames.shift()?.(0);
    expect(row.id).toBe('');
    frames.shift()?.(16);
    expect(row.id).toBe('role-curve');
  });

  it('gives the row its id back even when no frame comes: a hidden tab pauses frames, not timers', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    window.history.pushState(
      { ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } },
      '',
      '/experience#role-curve',
    );
    const page = await ExperiencePage();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);

    const row = stopOf(render(page).container, 'curve');

    expect(row.id).toBe('');
    vi.advanceTimersByTime(1000);
    expect(row.id).toBe('role-curve');
  });

  it('lets the browser put the scroll back on a Back between two jumps on the page', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const runFrames = (): void => {
      for (let callback = frames.shift(); callback; callback = frames.shift()) callback(0);
    };
    const scrolled = scrollCalls();
    window.history.pushState(
      { ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } },
      '',
      '/experience#role-curve',
    );
    const { container } = render(await ExperiencePage());
    await nextTurn();
    runFrames();

    // A jump is the browser's to make: it moves to the row, whose id stays.
    jumpTo('#role-dfg');
    expect(stopOf(container, 'dfg').id).toBe('role-dfg');

    // Back to the earlier row: the browser would scroll to it (Chrome does, after popstate), not
    // to where the visitor left the entry. Its row names nothing for the first frames, so the
    // browser puts the scroll back; nothing here moves the page.
    await goBack();
    expect(window.location.hash).toBe('#role-curve');
    expect(stopOf(container, 'curve').id).toBe('');
    runFrames();
    expect(stopOf(container, 'curve').id).toBe('role-curve');
    expect(scrolled).not.toHaveBeenCalled();
  });

  it('lets the browser go to the row each time a link names the row the address already has', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const runFrames = (): void => {
      for (let callback = frames.shift(); callback; callback = frames.shift()) callback(0);
    };
    /**
     * Chrome's part of following a link to the fragment already in the address: the entry is
     * replaced in place, keeping its state, and popstate fires. No Back or Forward: the browser
     * is to go to the row, so it must keep its id.
     */
    const followAgain = (): void => {
      window.history.replaceState(window.history.state, '', window.location.href);
      fireEvent(window, new PopStateEvent('popstate', { state: window.history.state }));
    };
    // A link arrival at the row ("All experience"): the island notes it landed there.
    window.history.pushState(ROUTER_STATE, '', '/experience#role-curve');
    const { container } = render(await ExperiencePage());
    await nextTurn();
    expect(noteNow()?.landed).toBe(true);

    followAgain();
    expect(stopOf(container, 'curve').id).toBe('role-curve');

    // The same on a jump's entry, the island's own.
    jumpTo('#role-dfg');
    followAgain();
    expect(stopOf(container, 'dfg').id).toBe('role-dfg');

    // A Back to the row's entry is still a traversal: the row names nothing for the first frames.
    await goBack();
    expect(window.location.hash).toBe('#role-curve');
    expect(stopOf(container, 'curve').id).toBe('');
    runFrames();
    expect(stopOf(container, 'curve').id).toBe('role-curve');
  });

  it("lands only on a row: a chapter's fragment is no landing, and its id is never taken", async () => {
    window.history.pushState(ROUTER_STATE, '', '/experience#y2024');
    const first = render(await ExperiencePage());
    await nextTurn();
    expect(noteNow()?.landed).not.toBe(true);
    first.unmount();

    // An entry noted as landed on by an older build: a Back to it leaves the heading whole.
    window.history.replaceState(
      { ...ROUTER_STATE, [ENTRY_NOTE]: { landed: true } },
      '',
      '/experience#y2024',
    );
    const { container } = render(await ExperiencePage());
    expect(container.querySelector('section#y2024')).not.toBeNull();
  });

  it('leaves the ids alone on a link arrival, where the browser is to move to the row', async () => {
    window.history.pushState(ROUTER_STATE, '', '/experience#role-curve');

    const { container } = render(await ExperiencePage());

    expect(stopOf(container, 'curve').id).toBe('role-curve');
  });

  it('opens again the rows that were open on the entry, and only those', async () => {
    window.history.pushState(
      { ...ROUTER_STATE, [ENTRY_NOTE]: { open: ['curve', 'nobody'] } },
      '',
      '/experience',
    );

    const { container } = render(await ExperiencePage());

    expect(moreOf(container, 'curve').open).toBe(true);
    expect(moreOf(container, 'dfg').open).toBe(false);
    // A role with nothing more to say has no "What I did" to open.
    expect(stopOf(container, 'elysium').querySelector('details')).toBeNull();
  });

  it('notes on the entry which rows are open, as the visitor opens and closes them', async () => {
    const { container } = render(await ExperiencePage());
    const curve = moreOf(container, 'curve');
    const dfg = moreOf(container, 'dfg');

    curve.open = true;
    fireEvent(curve, new Event('toggle'));
    dfg.open = true;
    fireEvent(dfg, new Event('toggle'));
    const key = noteNow()?.key;
    expect(noteNow()).toEqual({ key: expect.any(String), open: ['curve', 'dfg'] });

    curve.open = false;
    fireEvent(curve, new Event('toggle'));
    // Still the same entry, under the same key.
    expect(noteNow()).toEqual({ key, open: ['dfg'] });
    // The router's own keys stay on the entry.
    expect(window.history.state).toMatchObject(ROUTER_STATE);
  });
});

describe("another page and the list's entries the router skips", () => {
  /** The browser's part of a Back: the address and state of the entry it goes to, then popstate. */
  function traverseTo(state: Written, address: string): void {
    window.history.replaceState(state, '', address);
    fireEvent(window, new PopStateEvent('popstate', { state }));
  }
  const listHidden = (): boolean => false;
  const root = document.documentElement;

  beforeEach(() => {
    window.history.replaceState(ROUTER_STATE, '', '/experience/curve');
  });

  it('loads the list anew on a Back to an entry of it the router never stamped', () => {
    const reload = vi.fn();
    const stop = attachListEntryGuard('/experience', listHidden, reload);

    // The list's first entry after a jump made before the page was ready keeps no state, and
    // the router ignores it: the address would be the list's and the page this role's.
    traverseTo(null, '/experience');

    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });

  it("leaves every other entry to the router: its own, the role page's and another page's", () => {
    const reload = vi.fn();
    const stop = attachListEntryGuard('/experience', listHidden, reload);

    traverseTo(ROUTER_STATE, '/experience#role-curve');
    traverseTo(null, '/experience/curve#main-content');
    traverseTo(null, '/projects');

    expect(reload).not.toHaveBeenCalled();
    stop();
  });

  it('leaves such an entry to the list while the list is on screen: it hands it over itself', () => {
    const reload = vi.fn();
    const stop = attachListEntryGuard('/experience', () => true, reload);

    traverseTo(null, '/experience#role-curve');

    expect(reload).not.toHaveBeenCalled();
    stop();
  });

  it('stops when told to', () => {
    const reload = vi.fn();
    attachListEntryGuard('/experience', listHidden, reload)();

    traverseTo(null, '/experience');

    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps guarding from any page once the list has been on screen, /projects included', async () => {
    // The list on screen, then a client navigation away from it (a technology's link).
    const { unmount } = render(await ExperiencePage());
    await nextTurn();
    unmount();
    window.history.pushState(ROUTER_STATE, '', '/projects');

    // Back onto the list's first entry, which the router never stamped. The list is loaded anew,
    // and the page on screen is made ready to hand the list's own scroll to the reload: no scroll
    // anchor of its own, and room for the list's scroll (jsdom loads nothing anew).
    traverseTo(null, '/experience');

    expect(root.style.overflowAnchor).toBe('none');
    expect(Number.parseFloat(root.style.minHeight)).toBeGreaterThanOrEqual(100_000);
  });

  it('never loads the list anew while it is on screen', async () => {
    render(await ExperiencePage());
    await nextTurn();
    window.history.replaceState(ROUTER_STATE, '', '/experience');

    traverseTo(null, '/experience#role-curve');

    expect(root.style.overflowAnchor).toBe('');
    expect(root.style.minHeight).toBe('');
  });
});

describe('/experience: where the history code lives', () => {
  it('keeps it out of the server parts: one small client module beside the island', () => {
    const source = sourceOf(`${E_DIR}/_components/role-jumps.ts`);

    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toMatch(/\buse(?:State|Effect|Ref|Memo|Callback|SyncExternalStore)\b/);
    expect(sourceOf(ISLAND_FILE)).toContain("from './role-jumps'");
    // No server part imports it: only the island does.
    for (const file of [STORY_FILE, ...SERVER_PARTS]) {
      expect(sourceOf(file)).not.toMatch(/from '[^']*role-jumps'/);
    }
  });

  it('attaches the guard from the list, for every page after it, and from every role page', () => {
    const guard = sourceOf(GUARD_FILE);

    // The list's history code attaches it; the guard needs nothing of the list's, so a role
    // page's one client part does not carry the list's code.
    expect(sourceOf(`${E_DIR}/_components/role-jumps.ts`)).toMatch(
      /import \{ guardListEntries, showList \} from '\.\/role-list-entry-guard'/,
    );
    expect(guard).toMatch(/^'use client';/);
    expect(guard).not.toMatch(/from '[^']*role-jumps'/);
    expect(sourceOf(DETAIL_FILE)).toMatch(/<RoleListEntryGuard listPath=\{EXPERIENCE_PATH\} \/>/);
  });
});
