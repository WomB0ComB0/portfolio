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
 * @file SpotlightRoot's one document listener moves the spotlight of the [data-spotlight] element
 * under the mouse, once per animation frame, ignores touch and pen and every other element, and
 * cleans up after itself.
 *
 * requestAnimationFrame is replaced by a queue the tests flush by hand. jsdom has no PointerEvent,
 * so pointer moves are MouseEvents named 'pointermove', with pointerType added when a test needs
 * one; jsdom has no layout either, so the host's box is stubbed.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotlightRoot } from '@/components/console/spotlight-root';

const HOST_LEFT = 10;
const HOST_TOP = 20;
const HOST_WIDTH = 200;
const HOST_HEIGHT = 100;

let frames: FrameRequestCallback[] = [];
const requestFrame = vi.fn((callback: FrameRequestCallback): number => frames.push(callback));
const cancelFrame = vi.fn();

/** Runs every queued animation frame, as the browser would before the next paint. */
function runFrames(): void {
  const due = frames;
  frames = [];
  for (const callback of due) callback(0);
}

interface Move {
  clientX: number;
  clientY: number;
  pointerType?: string;
}

function pointerMove(target: Element, { clientX, clientY, pointerType }: Move): void {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX, clientY });
  if (pointerType) Object.defineProperty(event, 'pointerType', { value: pointerType });
  target.dispatchEvent(event);
}

function stubBox(element: HTMLElement): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: HOST_LEFT,
    y: HOST_TOP,
    left: HOST_LEFT,
    top: HOST_TOP,
    width: HOST_WIDTH,
    height: HOST_HEIGHT,
    right: HOST_LEFT + HOST_WIDTH,
    bottom: HOST_TOP + HOST_HEIGHT,
    toJSON: () => ({}),
  });
}

interface Page {
  host: HTMLElement;
  inner: HTMLElement;
  plain: HTMLElement;
  unmount: () => void;
}

function renderPage(): Page {
  const { unmount } = render(
    <>
      <SpotlightRoot />
      <div data-spotlight="" data-testid="host">
        <span data-testid="inner">Tile text</span>
      </div>
      <div data-testid="plain">Not a tile</div>
    </>,
  );
  const host = screen.getByTestId('host');
  stubBox(host);
  return { host, inner: screen.getByTestId('inner'), plain: screen.getByTestId('plain'), unmount };
}

const spot = (element: HTMLElement): [string, string] => [
  element.style.getPropertyValue('--spot-x'),
  element.style.getPropertyValue('--spot-y'),
];

beforeEach(() => {
  frames = [];
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SpotlightRoot', () => {
  it('renders nothing', () => {
    const { container } = render(<SpotlightRoot />);

    expect(container).toBeEmptyDOMElement();
  });

  it('moves the spotlight of the tile under the mouse, relative to its box, on the next frame', () => {
    const { host, inner } = renderPage();

    pointerMove(inner, { clientX: 110, clientY: 70 });
    expect(spot(host)).toEqual(['', '']);

    runFrames();
    expect(spot(host)).toEqual(['100px', '50px']);
  });

  it('treats an explicit mouse pointerType like the jsdom default', () => {
    const { host, inner } = renderPage();

    pointerMove(inner, { clientX: 30, clientY: 40, pointerType: 'mouse' });
    runFrames();

    expect(spot(host)).toEqual(['20px', '20px']);
  });

  it('batches moves within a frame into one write at the latest position', () => {
    const { host, inner } = renderPage();

    pointerMove(inner, { clientX: 50, clientY: 50 });
    pointerMove(inner, { clientX: 60, clientY: 80 });
    expect(requestFrame).toHaveBeenCalledTimes(1);

    runFrames();
    expect(spot(host)).toEqual(['50px', '60px']);
  });

  it.each(['touch', 'pen'])('ignores %s pointers', (pointerType) => {
    const { host, inner } = renderPage();

    pointerMove(inner, { clientX: 110, clientY: 70, pointerType });
    runFrames();

    expect(requestFrame).not.toHaveBeenCalled();
    expect(spot(host)).toEqual(['', '']);
  });

  it('leaves elements without data-spotlight untouched', () => {
    const { plain } = renderPage();

    pointerMove(plain, { clientX: 110, clientY: 70 });
    runFrames();

    expect(requestFrame).not.toHaveBeenCalled();
    expect(spot(plain)).toEqual(['', '']);
  });

  it('removes its passive document listener on unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderPage();
    const added = add.mock.calls.find(([type]) => type === 'pointermove');
    expect(added?.[2]).toEqual({ passive: true });

    unmount();
    expect(remove).toHaveBeenCalledWith('pointermove', added?.[1]);

    // A tile still on the page after unmount gets no spotlight.
    const survivor = document.createElement('div');
    survivor.dataset.spotlight = '';
    document.body.append(survivor);
    pointerMove(survivor, { clientX: 110, clientY: 70 });
    runFrames();
    expect(requestFrame).not.toHaveBeenCalled();
    survivor.remove();
  });

  it('cancels a pending frame on unmount', () => {
    const { inner, unmount } = renderPage();

    pointerMove(inner, { clientX: 110, clientY: 70 });
    const frameId = requestFrame.mock.results[0]?.value;
    unmount();

    expect(frameId).toBe(1);
    expect(cancelFrame).toHaveBeenCalledWith(frameId);
  });
});
