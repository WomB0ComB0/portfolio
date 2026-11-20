/**
 * Copyright 2025 Mike Odnis
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
 * @file The ⌘K palette is a modal dialog (audit 2026-11-20, moderate 1 and minor 1).
 *
 * kbar draws a full-screen overlay but none of a modal's semantics: no dialog role or name, the
 * page behind stays in the accessibility tree, Tab leaves the palette (to the browser, or with
 * Shift+Tab to a control behind the backdrop), section names are exposed as options and the results
 * scroller is an unnamed Tab stop. With no matches nothing says so, and aria-activedescendant
 * points at an option that is not there.
 *
 * Round 2 (verification): taking the scroller out of the Tab order failed axe's
 * scrollable-region-focusable, so it is a named region and the palette's second Tab stop instead;
 * aria-activedescendant was set before the virtualised row existed when results came back; and
 * the combobox stayed expanded over an empty listbox.
 *
 * jsdom implements neither `inert` nor keyboard-focusable scrollers, so these tests check the
 * attributes a browser acts on, and that focus is never sent to an inert element. KBarAnimator
 * starts at an inline opacity of 0 that only its (stubbed) entrance animation lifts, so nothing in
 * the palette passes toBeVisible here; what is shown is checked by its classes instead.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type Action, KBarProvider } from 'kbar';
import { compile } from 'tailwindcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { Palette } from '@/components/cmd';

/** jsdom has no Web Animations API; KBarAnimator only starts and forgets its animations. */
const originalAnimate = Element.prototype.animate;

const LAID_OUT_PX = 400;

/**
 * jsdom lays nothing out, so the virtualised results list measures 0 px and renders no rows.
 * Giving every element a size lets the rows render.
 */
const stubLayout = (): void => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockReturnValue(LAID_OUT_PX);
  }
};

beforeEach(() => {
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
  stubLayout();
});

/** The setup's ResizeObserver, which never calls back (writable, but not configurable). */
const originalResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.ResizeObserver = originalResizeObserver;
  Element.prototype.animate = originalAnimate;
});

/**
 * A ResizeObserver whose callbacks run only when the test says the boxes it watches have resized,
 * as a browser runs them a frame or more after layout. The virtualised list reads its scroller's
 * height on mount and then only from these callbacks.
 */
class ControlledResizeObserver {
  static readonly watching = new Set<ControlledResizeObserver>();

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    ControlledResizeObserver.watching.add(this);
  }

  unobserve(): void {
    ControlledResizeObserver.watching.delete(this);
  }

  disconnect(): void {
    ControlledResizeObserver.watching.delete(this);
  }

  /** Runs every live observer's callback, as the browser does after a layout that resized. */
  static resizeAll(): void {
    act(() => {
      for (const observer of ControlledResizeObserver.watching) {
        observer.callback([], observer as unknown as ResizeObserver);
      }
    });
  }
}

/**
 * The scroller's height as a browser lays it out: none while it is hidden (no results), else its
 * listbox's (kbar sets it inline, the rows' total), up to its 400 px cap. Every other box keeps
 * stubLayout's size.
 */
const layOutScrollerByContent = (): void => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    const listbox = this.querySelector<HTMLElement>(':scope > [role="listbox"]');
    if (!listbox) return LAID_OUT_PX;
    if (this.hidden) return 0;
    return Math.min(LAID_OUT_PX, Number.parseFloat(listbox.style.height) || 0);
  });
};

/** An action outside every section, so it lists first and with no section name above it. */
const UNSECTIONED: Action = { id: 'copy-link', name: 'Copy link', perform: () => {} };

/** The palette as the site mounts it, after a control on the page behind it. */
const renderPalette = (actions: Action[] = []) =>
  render(
    <>
      <button type="button">Behind the palette</button>
      <KBarProvider actions={actions}>
        <Palette />
      </KBarProvider>
    </>,
  );

/** Dispatches a keydown on the focused element; returns false when a listener cancelled it. */
const press = (init: KeyboardEventInit): boolean => {
  let notCancelled = true;
  act(() => {
    notCancelled = fireEvent.keyDown(document.activeElement ?? document.body, init);
  });
  return notCancelled;
};

/** Opens the palette with Ctrl+K from the focused element and returns its search box. */
const openPalette = async (): Promise<HTMLElement> => {
  press({ key: 'k', code: 'KeyK', ctrlKey: true });
  const search = await screen.findByRole('combobox');
  // Mount happens during animatingIn; wait until KBar's opening timer has settled.
  await waitFor(() => expect(search).toHaveAttribute('aria-expanded', 'true'));
  return search;
};

const closePalette = async (): Promise<void> => {
  press({ key: 'Escape', code: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
};

/** kbar's box around one result row, which carries the row's role. */
const rowOf = (text: string): HTMLElement | null =>
  screen.getByText(text).closest<HTMLElement>('[id^="kbar-listbox-item-"]');

const search = (box: HTMLElement, value: string): void => {
  fireEvent.change(box, { target: { value } });
};

/** The row the search box points screen readers at, or null when it points at none. */
const activeRowOf = (box: HTMLElement): HTMLElement | null => {
  const id = box.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

/** kbar's results scroller, as the palette names it. */
const resultsRegion = (): HTMLElement => screen.getByRole('region', { name: 'Search results' });

/** The scroller's focus ring, drawn inside its box: the panel clips anything outside its edge. */
const RESULTS_RING_INSET = '[&>[role=region]:focus-visible]:-outline-offset-2';

describe('the command palette as a modal dialog', () => {
  it('is a dialog named "Command menu", marked modal, around the search box', async () => {
    renderPalette();
    const box = await openPalette();

    const dialog = screen.getByRole('dialog', { name: 'Command menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(box);
  });

  it('makes the rest of the page inert while open, and live again as it closes', async () => {
    const alreadyInert = document.createElement('div');
    alreadyInert.setAttribute('inert', '');
    document.body.append(alreadyInert);
    const { container } = renderPalette();

    await openPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command menu' });
    expect(container).toHaveAttribute('inert');
    expect(dialog.closest('[inert]')).toBeNull();

    // Live again the moment the palette starts closing, not after its exit animation.
    press({ key: 'Escape', code: 'Escape' });
    expect(container).not.toHaveAttribute('inert');
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    // What was inert before the palette opened is left as it was.
    expect(alreadyInert).toHaveAttribute('inert');
    alreadyInert.remove();
  });

  it('returns focus to the control that opened it, never to an inert one', async () => {
    const focus = HTMLElement.prototype.focus;
    const focusedWhileInert: Element[] = [];
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (this.closest('[inert]')) focusedWhileInert.push(this);
      focus.call(this, options);
    });
    renderPalette();
    const opener = screen.getByRole('button', { name: 'Behind the palette' });
    act(() => opener.focus());

    await openPalette();
    await closePalette();

    expect(opener).toHaveFocus();
    expect(focusedWhileInert).toEqual([]);
  });

  it('cycles Tab and Shift+Tab between the search box and the results, never out', async () => {
    renderPalette();
    const box = await openPalette();
    const results = resultsRegion();

    expect(press({ key: 'Tab', code: 'Tab' })).toBe(false);
    expect(results).toHaveFocus();
    expect(press({ key: 'Tab', code: 'Tab' })).toBe(false);
    expect(box).toHaveFocus();
    expect(press({ key: 'Tab', code: 'Tab', shiftKey: true })).toBe(false);
    expect(results).toHaveFocus();
    expect(press({ key: 'Tab', code: 'Tab', shiftKey: true })).toBe(false);
    expect(box).toHaveFocus();
  });

  it('goes back from the results to the search box on Shift+Tab as a keyboard sends it', async () => {
    renderPalette();
    const box = await openPalette();
    const results = resultsRegion();
    press({ key: 'Tab', code: 'Tab' });
    expect(results).toHaveFocus();

    // A keyboard sends Shift on its own first. kbar sends focus to the search box on any key
    // pressed elsewhere in the palette, which made Shift+Tab start from there and wrap back here.
    press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(results).toHaveFocus();
    expect(press({ key: 'Tab', code: 'Tab', shiftKey: true })).toBe(false);
    expect(box).toHaveFocus();
  });

  it('brings Tab back to the search box from anywhere else in the palette', async () => {
    renderPalette();
    const box = await openPalette();
    // A press on the palette's padding, say, leaves focus on nothing in it.
    act(() => box.blur());
    expect(document.body).toHaveFocus();

    expect(press({ key: 'Tab', code: 'Tab' })).toBe(false);

    expect(box).toHaveFocus();
  });

  it('leaves Tab alone once the palette is closed', async () => {
    renderPalette();
    await openPalette();
    await closePalette();

    expect(press({ key: 'Tab', code: 'Tab' })).toBe(true);
  });

  // Taken out of the Tab order (round 1), the scroller failed axe's scrollable-region-focusable:
  // its options are never focused (the search box drives them), so nothing in it was reachable.
  it('makes the results scroller a named region in the Tab order, around the listbox', async () => {
    renderPalette();
    await openPalette();

    const results = resultsRegion();
    expect(results).toHaveAttribute('tabindex', '0');
    expect(results.firstElementChild).toBe(screen.getByRole('listbox'));
    // The palette clips the site's outer ring at its sides, so the region draws it inside.
    expect(results.parentElement).toHaveClass(RESULTS_RING_INSET);
    const theme = readFileSync(join(process.cwd(), 'node_modules/tailwindcss/theme.css'), 'utf8');
    const { build } = await compile(`${theme}\n@tailwind utilities;`);
    const css = build([RESULTS_RING_INSET]).replace(/\s+/g, ' ');
    expect(css).toMatch(/> \[role=region\]:focus-visible \{ outline-offset: calc\(2px \* -1\);/);
  });
});

describe('the command palette’s section names', () => {
  it('are shown as plain text, never as options', async () => {
    renderPalette();
    await openPalette();

    expect(screen.getByText('Navigation')).not.toHaveClass('sr-only');
    expect(screen.queryByRole('option', { name: 'Navigation' })).not.toBeInTheDocument();
    const row = rowOf('Navigation');
    expect(row).toHaveAttribute('role', 'none');
    expect(row).not.toHaveAttribute('aria-selected');
    // Every option left is an action.
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(option).not.toHaveTextContent(/^Navigation$/);
  });

  it('hand a row back as an option when a new search lists an action in its place', async () => {
    // kbar keys its rows by position, so the box that held a section name holds an action next.
    renderPalette([UNSECTIONED]);
    const box = await openPalette();
    // Unsectioned actions list first: the copy link action, then the Navigation section.
    expect(rowOf('Copy link')).toHaveAttribute('id', 'kbar-listbox-item-0');
    expect(rowOf('Copy link')).toHaveAttribute('role', 'option');

    search(box, 'guestbook');
    const guestbook = await screen.findByRole('option', { name: /Guestbook/ });
    expect(rowOf('Navigation')).toHaveAttribute('id', 'kbar-listbox-item-0');
    expect(rowOf('Navigation')).toHaveAttribute('role', 'none');
    // The search box never points at the section name, even before kbar moves off it.
    expect(activeRowOf(box)).not.toBe(rowOf('Navigation'));
    // kbar moves the active row off the section name an effect after the new results land.
    await waitFor(() => expect(guestbook).toHaveAttribute('aria-selected', 'true'));
    expect(activeRowOf(box)).toBe(guestbook);

    search(box, '');
    await screen.findByRole('option', { name: 'Copy link' });
    expect(rowOf('Copy link')).toHaveAttribute('id', 'kbar-listbox-item-0');
    expect(rowOf('Navigation')).toHaveAttribute('role', 'none');
  });
});

describe('the command palette with no matches', () => {
  it('says "No results" in a polite status line that is there before it is needed', async () => {
    renderPalette();
    const box = await openPalette();
    // A live region announces changes, so it is in the page, empty, from the start.
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^$/);

    search(box, 'zzqxj');

    await waitFor(() => expect(status).toHaveTextContent('No results'));
    // A visible line, not words for screen readers only.
    expect(status).not.toHaveClass('sr-only');
    expect(status).not.toHaveClass('hidden');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('points the search box at no option while the list is empty, and back at one after', async () => {
    renderPalette();
    const box = await openPalette();

    search(box, 'zzqxj');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No results'));
    expect(box).not.toHaveAttribute('aria-activedescendant');

    search(box, 'guest');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^$/));
    // Once kbar has moved the active row off the section name, onto the first action.
    await waitFor(() => expect(activeRowOf(box)).toHaveAttribute('role', 'option'));
    expect(activeRowOf(box)).toHaveTextContent(/Guestbook/);
  });

  it('collapses the combobox while the list is empty, and expands it again after', async () => {
    renderPalette();
    const box = await openPalette();

    search(box, 'zzqxj');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No results'));
    expect(box).toHaveAttribute('aria-expanded', 'false');

    search(box, 'guest');
    await waitFor(() => expect(box).toHaveAttribute('aria-expanded', 'true'));
  });

  it('hides the empty results region, so Tab stays on the search box until results return', async () => {
    renderPalette();
    const box = await openPalette();

    search(box, 'zzqxj');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No results'));
    // No empty listbox, and no empty Tab stop, for a screen reader or the keyboard to land on.
    expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(press({ key: 'Tab', code: 'Tab' })).toBe(false);
    expect(box).toHaveFocus();

    search(box, 'guest');
    await waitFor(() => expect(resultsRegion()).toBeInTheDocument());
    press({ key: 'Tab', code: 'Tab' });
    expect(resultsRegion()).toHaveFocus();
  });

  // The virtualised list draws its rows only once it has measured its scroller, which a browser
  // reports a frame or more after the results come back (15 to 41 ms in Chromium); the search
  // box pointed at the first option's id all that time.
  it('points the search box at an option only once that option is on the page', async () => {
    globalThis.ResizeObserver = ControlledResizeObserver as unknown as typeof ResizeObserver;
    layOutScrollerByContent();
    renderPalette();
    const box = await openPalette();
    search(box, 'zzqxj');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No results'));
    // The browser reports the emptied (hidden) scroller's height: none.
    ControlledResizeObserver.resizeAll();

    search(box, 'guest');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^$/));
    // kbar has moved the active row to the first action, which is not drawn yet.
    await waitFor(() => expect(screen.getByRole('listbox').style.height).not.toBe('0px'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(box).not.toHaveAttribute('aria-activedescendant');

    // The browser reports the scroller's new height, and the list draws its rows.
    ControlledResizeObserver.resizeAll();

    const guestbook = await screen.findByRole('option', { name: /Guestbook/ });
    await waitFor(() => expect(activeRowOf(box)).toBe(guestbook));
  });
});
