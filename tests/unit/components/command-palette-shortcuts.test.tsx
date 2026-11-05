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
 * @file Page shortcuts never fire as bare letters (WCAG 2.1.4) and never reload the page.
 *
 * The palette is mounted the way the site mounts it: inside a KBarProvider given no actions, as
 * global-provider.tsx does, so the palette registers its own. A fake `location` stands in for the browser's so
 * a full-page navigation (assigning `location.pathname`) is visible to the test.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { Palette } from '@/components/cmd';
import { createNavigationActions } from '@/lib/navigation/actions';

// A page with no shortcut, so a stray navigation to any shortcut target shows up.
const START_PATH = '/licenses';

const fakeLocation = (): Location => {
  const location = { pathname: START_PATH, href: `http://localhost${START_PATH}` };
  return location as unknown as Location;
};

let location: Location;

/** jsdom has no Web Animations API; KBarAnimator only starts and forgets its animations. */
const stubAnimate = (): (() => void) => {
  const original = Element.prototype.animate;
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
  return () => {
    Element.prototype.animate = original;
  };
};

let restoreAnimate: () => void;

const LAID_OUT_PX = 400;

/**
 * jsdom lays nothing out, so the virtualised results list measures 0 px and renders no rows.
 * Giving every element a size lets the rows render for the tests that pick one.
 */
const stubLayout = () => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockReturnValue(LAID_OUT_PX);
  }
};

beforeEach(() => {
  push.mockReset();
  location = fakeLocation();
  vi.stubGlobal('location', location);
  restoreAnimate = stubAnimate();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreAnimate();
});

const renderPalette = () =>
  render(
    <KBarProvider>
      <Palette />
    </KBarProvider>,
  );

/** Dispatches a keydown; returns false when a listener called preventDefault on it. */
const press = (init: KeyboardEventInit): boolean => {
  let notCancelled = true;
  act(() => {
    notCancelled = fireEvent.keyDown(document.activeElement ?? document.body, init);
  });
  return notCancelled;
};

/** Opens the palette with Ctrl+K, which stays the way in. */
const openPalette = async () => {
  press({ key: 'k', code: 'KeyK', ctrlKey: true });
  return screen.findByRole('combobox');
};

/** Every letter the old palette bound as a bare, page-wide shortcut. */
const FORMER_BARE_LETTERS = ['h', 'p', 'x', 'c', 'r', 'm', 'l', 's', 'g', 'd', '$'] as const;

describe('Page shortcuts with the palette closed', () => {
  it.each(FORMER_BARE_LETTERS)('ignore a bare "%s" anywhere on the page', (key) => {
    renderPalette();

    press({ key });

    expect(push).not.toHaveBeenCalled();
    expect(location.pathname).toBe(START_PATH);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('ignore Alt+G too, so nothing jumps while the palette is closed', () => {
    renderPalette();

    press({ key: 'g', code: 'KeyG', altKey: true });

    expect(push).not.toHaveBeenCalled();
    expect(location.pathname).toBe(START_PATH);
  });

  it('still open the palette with Ctrl+K', async () => {
    renderPalette();

    expect(await openPalette()).toHaveFocus();
  });
});

describe('Page shortcuts with the palette open', () => {
  it('navigate with the client router on Alt+G and close the palette', async () => {
    renderPalette();
    await openPalette();

    press({ key: 'g', code: 'KeyG', altKey: true });

    expect(push).toHaveBeenCalledExactlyOnceWith('/guestbook');
    expect(location.pathname).toBe(START_PATH);
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('match the physical key, so Option+G on a Mac (which types "©") still works', async () => {
    renderPalette();
    await openPalette();

    press({ key: '©', code: 'KeyG', altKey: true });

    expect(push).toHaveBeenCalledExactlyOnceWith('/guestbook');
  });

  it.each([
    ['Alt+P on QWERTY', { key: 'p', code: 'KeyP' }, '/projects'],
    ['Alt+D on Dvorak, where D is the QWERTY H key', { key: 'd', code: 'KeyH' }, '/stats'],
    ['Alt+L on Dvorak, where L is the QWERTY P key', { key: 'l', code: 'KeyP' }, '/places'],
    ['Option+P on a US Mac, which types "π"', { key: 'π', code: 'KeyP' }, '/projects'],
  ])('open the page the hint names for %s', async (_, keys, href) => {
    renderPalette();
    await openPalette();

    press({ ...keys, altKey: true });

    expect(push).toHaveBeenCalledExactlyOnceWith(href);
  });

  it('leave Option+L to the search box on a Polish Mac, where it types "ł"', async () => {
    renderPalette();
    const search = await openPalette();

    const typed = press({ key: 'ł', code: 'KeyL', altKey: true });

    expect(typed).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(search).toBeInTheDocument();
  });

  it('leave a bare letter to the search box instead of navigating', async () => {
    renderPalette();
    const search = await openPalette();

    press({ key: 'g', code: 'KeyG' });
    fireEvent.change(search, { target: { value: 'g' } });

    expect(push).not.toHaveBeenCalled();
    expect(location.pathname).toBe(START_PATH);
    expect(search).toHaveValue('g');
  });

  it('ignore Ctrl+Alt (AltGr) combinations, which type characters on many layouts', async () => {
    renderPalette();
    await openPalette();

    press({ key: 'g', code: 'KeyG', altKey: true, ctrlKey: true });

    expect(push).not.toHaveBeenCalled();
  });

  it('show each page shortcut with its modifier beside the result', async () => {
    stubLayout();
    renderPalette();
    const search = await openPalette();

    fireEvent.change(search, { target: { value: 'guestbook' } });

    const option = await screen.findByRole('option', { name: /Guestbook/ });
    expect(option).toHaveTextContent(/Guestbook\s*AltG/);
  });

  it('navigate with the client router when a result is chosen with Enter', async () => {
    stubLayout();
    renderPalette();
    const search = await openPalette();
    fireEvent.change(search, { target: { value: 'guestbook' } });
    await screen.findByRole('option', { name: /Guestbook/ });

    press({ key: 'Enter', code: 'Enter' });

    expect(push).toHaveBeenCalledExactlyOnceWith('/guestbook');
    expect(location.pathname).toBe(START_PATH);
  });

  it('name the search box', async () => {
    renderPalette();

    expect(await openPalette()).toHaveAccessibleName();
  });
});

describe('Palette actions', () => {
  it('carry no kbar shortcut, so kbar binds no page-wide keys for them', () => {
    const navigation = createNavigationActions(push);

    expect(navigation.length).toBeGreaterThan(0);
    for (const action of navigation) expect(action.shortcut ?? []).toEqual([]);
  });

  it('navigate through the given router when performed', () => {
    const navigation = createNavigationActions(push);

    for (const action of navigation) action.perform?.(undefined as never);

    expect(push.mock.calls.map(([href]) => href)).toEqual([
      '/',
      '/projects',
      '/experience',
      '/certifications',
      '/resume',
      '/media',
      '/places',
      '/spotify',
      '/guestbook',
      '/stats',
      '/sponsor',
    ]);
    expect(location.pathname).toBe(START_PATH);
  });
});
