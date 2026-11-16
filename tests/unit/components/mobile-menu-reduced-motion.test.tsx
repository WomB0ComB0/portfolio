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
 * @file Under reduced motion the phone menu appears whole on its first frame, as the flyouts,
 * the filter sheets and the palette do. motion animates its backdrop and sheet in JavaScript,
 * which the CSS reduced-motion rule cannot reach, and the app's MotionConfig reducedMotion="user"
 * drops only the sheet's rise, not the fades. With motion allowed the menu still fades and rises
 * in. The setting is read at each opening, so changing it between two openings takes effect.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MobileMenuOverlay } from '@/components/layout/mobile-menu-overlay';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * The visitor's reduced-motion setting. motion asks '(prefers-reduced-motion)' once and then
 * listens for changes, so the fake keeps its listeners and always answers from the current value.
 */
const motionSetting = (() => {
  const state = { reduced: false };
  const listeners = new Set<() => void>();
  const isMotionQuery = (query: string): boolean => query.includes('prefers-reduced-motion');
  const matchMedia = (query: string) => ({
    get matches() {
      return isMotionQuery(query) && state.reduced;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: () => void) => {
      if (isMotionQuery(query)) listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  });
  const set = (reduced: boolean): void => {
    state.reduced = reduced;
    for (const listener of listeners) listener();
  };
  return { matchMedia, set };
})();

vi.stubGlobal('matchMedia', motionSetting.matchMedia);

afterEach(() => {
  motionSetting.set(false);
});

type OverlayQuery = Parameters<typeof MobileMenuOverlay>[0]['query'];
const QUERY = { toggle: vi.fn() } as unknown as OverlayQuery;

const overlay = (isOpen: boolean) => (
  <MobileMenuOverlay isOpen={isOpen} onClose={() => {}} pathname="/" query={QUERY} />
);

const sheet = (): HTMLElement => screen.getByRole('dialog', { name: 'Site menu' });
const backdrop = (): HTMLElement => sheet().previousElementSibling as HTMLElement;

/** Where the sheet and its backdrop are drawn now: motion writes both as inline styles. */
const drawn = () => ({
  sheet: sheet().style.opacity,
  rise: sheet().style.transform,
  backdrop: backdrop().style.opacity,
});

describe('MobileMenuOverlay and reduced motion', () => {
  it('shows the sheet and its backdrop whole on the first frame when motion is reduced', async () => {
    motionSetting.set(true);
    render(overlay(true));

    expect(drawn()).toEqual({ sheet: '1', rise: 'none', backdrop: '1' });
    // Nothing plays afterwards either.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(drawn()).toEqual({ sheet: '1', rise: 'none', backdrop: '1' });
  });

  it('still fades the backdrop in and lifts the sheet when motion is allowed', async () => {
    render(overlay(true));

    expect(drawn()).toEqual({ sheet: '0', rise: 'translateY(24px)', backdrop: '0' });
    await waitFor(() => expect(drawn()).toMatchObject({ sheet: '1', backdrop: '1' }));
  });

  it('reads the setting at each opening, so a change between openings takes effect', () => {
    const { rerender } = render(overlay(true));
    expect(drawn().sheet).toBe('0');

    rerender(overlay(false));
    motionSetting.set(true);
    rerender(overlay(true));

    expect(drawn()).toEqual({ sheet: '1', rise: 'none', backdrop: '1' });
  });
});
