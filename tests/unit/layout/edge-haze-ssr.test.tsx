// @vitest-environment node

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
 * @file The edge haze renders on the server as plain markup: importing and rendering it touches
 * no browser global (window, document, CSS, requestAnimationFrame), so the shell's server HTML
 * holds the bands and the scroll-driven CSS can fade them before any script runs.
 */

import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touched = (name: string) => () => {
  throw new Error(`${name} was called on the server`);
};

// The setup file's ResizeObserver is writable but not configurable: assign, then restore.
const SETUP_RESIZE_OBSERVER = globalThis.ResizeObserver;

beforeEach(() => {
  // jest-dom's css.escape polyfill leaves a bare CSS object here: give it a supports() that fails.
  vi.stubGlobal('CSS', { ...globalThis.CSS, supports: touched('CSS.supports') });
  vi.stubGlobal('requestAnimationFrame', touched('requestAnimationFrame'));
  globalThis.ResizeObserver = touched('ResizeObserver') as unknown as typeof ResizeObserver;
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.ResizeObserver = SETUP_RESIZE_OBSERVER;
});

describe('EdgeHaze on the server', () => {
  it('runs in an environment without a window or a document', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('imports and renders without touching a browser API', async () => {
    const { EdgeHaze } = await import('@/components/layout/edge-haze');
    const html = renderToString(<EdgeHaze path="/" />);

    expect(html).toMatch(/^<div class="edge-haze" aria-hidden="true">/);
    expect(html.match(/<i class="l"><\/i>/g)).toHaveLength(16);
    expect(html.match(/<i class="tn"><\/i>/g)).toHaveLength(2);
    expect(html.match(/<i class="cap"><\/i>/g)).toHaveLength(1);
    expect(html).not.toMatch(/style=/);
  });
});
