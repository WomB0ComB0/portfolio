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
 * @file The ⌘K / Ctrl K hint in the rail and the phone bar survives server rendering and
 * hydration.
 *
 * The server cannot know the visitor's platform, so usePaletteShortcut renders ⌘K there and
 * during hydration (useSyncExternalStore's server snapshot), then switches to Ctrl K on other
 * platforms. Reading the platform straight in render instead would print the server's own
 * platform (Node has a navigator too) and fail hydration for every visitor whose platform
 * differs: React reports a recoverable error and re-renders the root on the client. So the server
 * render here runs on Linux and hydration runs on a different platform.
 */

import { act, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { MobileNavBar } from '@/components/layout/mobile-nav';
import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const SERVER_PLATFORM = 'Linux x86_64';

/** The two buttons that print the palette shortcut: the rail's and the phone bar's. */
const SHORTCUT_BUTTONS = ['Open command menu', 'Search pages and commands'] as const;

/** The real rail and phone bar, as the shell renders them inside kbar's provider. */
const Chrome = () => (
  <KBarProvider>
    <NavBar path="/" />
    <MobileNavBar path="/" />
  </KBarProvider>
);

let platform: MockInstance<() => string>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  platform = vi.spyOn(window.navigator, 'platform', 'get');
  consoleError = vi.spyOn(console, 'error');
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The server HTML, rendered while the platform reads as the server's own. */
const renderOnServer = (): string => {
  platform.mockReturnValue(SERVER_PLATFORM);
  return renderToString(<Chrome />);
};

/** React's hydration warnings for attributes, which are logged rather than thrown. */
const hydrationWarnings = (): unknown[][] =>
  consoleError.mock.calls.filter((args) => /hydrat/i.test(args.map(String).join(' ')));

/**
 * Hydrates `html` in place on `clientPlatform`, runs `check` against the hydrated tree and
 * unmounts it. Returns the recoverable-error spy React was given.
 */
const hydrateOn = async (
  clientPlatform: string,
  html: string,
  check: () => void,
): Promise<MockInstance> => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  platform.mockReturnValue(clientPlatform);
  const onRecoverableError = vi.fn();
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <Chrome />, { onRecoverableError });
    });
    check();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
  return onRecoverableError;
};

const shortcutButton = (name: (typeof SHORTCUT_BUTTONS)[number]) =>
  screen.getByRole('button', { name });

describe('palette shortcut hint, server render and hydration', () => {
  it('server-renders ⌘K and Meta+K in both buttons, whatever the server runs on', () => {
    const html = renderOnServer();

    expect(html.match(/aria-keyshortcuts="Meta\+K"/g)).toHaveLength(SHORTCUT_BUTTONS.length);
    expect(html.match(/⌘K/g)).toHaveLength(SHORTCUT_BUTTONS.length);
    expect(html).not.toContain('Ctrl K');
    expect(html).not.toContain('Control+K');
  });

  it('hydrates on Windows with no mismatch, then switches both buttons to Ctrl K', async () => {
    const html = renderOnServer();

    const onRecoverableError = await hydrateOn('Win32', html, () => {
      for (const name of SHORTCUT_BUTTONS) {
        expect(shortcutButton(name)).toHaveAttribute('aria-keyshortcuts', 'Control+K');
        expect(shortcutButton(name)).toHaveTextContent('Ctrl K');
        expect(shortcutButton(name)).not.toHaveTextContent('⌘K');
      }
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationWarnings()).toEqual([]);
  });

  it('hydrates on a Mac with no mismatch and keeps ⌘K', async () => {
    const html = renderOnServer();

    const onRecoverableError = await hydrateOn('MacIntel', html, () => {
      for (const name of SHORTCUT_BUTTONS) {
        expect(shortcutButton(name)).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
        expect(shortcutButton(name)).toHaveTextContent('⌘K');
      }
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationWarnings()).toEqual([]);
  });
});
