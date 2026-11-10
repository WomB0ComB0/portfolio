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
 * @file useFinePointer: true with a mouse or trackpad (hover and a fine pointer), false on the
 * server and with touch only, and it follows the media query as it changes (a tablet gaining a
 * trackpad).
 */

import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FINE_POINTER, useFinePointer } from '@/hooks/use-fine-pointer';

/** A matchMedia whose FINE_POINTER answer a test can flip, telling its listeners. */
function stubMatchMedia(initial: boolean): (next: boolean) => void {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === FINE_POINTER ? matches : false;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return (next) => {
    matches = next;
    for (const listener of listeners) listener();
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe(): string {
  return useFinePointer() ? 'fine' : 'coarse';
}

describe('useFinePointer', () => {
  it('asks for hover and a fine pointer', () => {
    expect(FINE_POINTER).toBe('(hover: hover) and (pointer: fine)');
  });

  it('is false on the server, whatever the device', () => {
    stubMatchMedia(true);

    expect(renderToString(createElement(Probe))).toBe('coarse');
  });

  it('reads the query in the browser and follows its changes', () => {
    const flip = stubMatchMedia(false);
    const { result } = renderHook(() => useFinePointer());

    expect(result.current).toBe(false);
    act(() => flip(true));
    expect(result.current).toBe(true);
    act(() => flip(false));
    expect(result.current).toBe(false);
  });
});
