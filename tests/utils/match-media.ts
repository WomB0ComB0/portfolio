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
 * @file A window.matchMedia (jsdom has none; the setup file's never matches) where one media query
 * matches as a test says, and changes as a browser's would, telling its listeners. Every other
 * query never matches. Undo it with vi.unstubAllGlobals(). Not a test file.
 *
 * @example
 * const setTouchScreen = stubMediaQuery('(pointer: coarse)', true);
 * act(() => setTouchScreen(false));
 */

import { vi } from 'vitest';

/** Stubs matchMedia so `query` matches when `initial` is true; returns a setter for later. */
export function stubMediaQuery(query: string, initial: boolean): (matches: boolean) => void {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (asked: string) => ({
    get matches() {
      return asked === query && matches;
    },
    media: asked,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  }));
  return (next) => {
    matches = next;
    for (const listener of listeners) listener();
  };
}
