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
 * @file The photo strip under the place viewer (the owner's pick B from the Aceternity lab): a
 * toolbar of thumbnails with ONE Tab stop, the photo shown. Left and Right (and Home and End) move
 * the focus without changing the photo; a click (or Enter or Space, which click a native button)
 * shows it. Every thumbnail is a button named "Photo n of N" plus its caption, the shown one is
 * aria-current, and the script scrolls only the strip, never the page, to keep the shown or
 * focused thumbnail in its middle. The look is CSS (photo-strip-css.test.ts).
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoStrip } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/photo-strip';

interface StripPhoto {
  readonly thumb: string;
  readonly caption?: string;
}

const thumbUrl = (n: number): string =>
  `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?rect=0,0,1600,1200&w=320&h=240&fit=crop&auto=format`;

const PHOTOS: readonly StripPhoto[] = Array.from({ length: 7 }, (_, index) => ({
  thumb: thumbUrl(index + 1),
  ...(index === 2 && { caption: 'The stage before the keynote' }),
}));

const LABEL = 'Photos of Photographed Place';

const strip = (): HTMLElement => screen.getByRole('toolbar', { name: LABEL });
const thumbs = (): HTMLElement[] => within(strip()).getAllByRole('button');
const thumb = (index: number): HTMLElement => {
  const found = thumbs()[index];
  if (!found) throw new Error(`no thumbnail ${index}`);
  return found;
};
const tabStops = (): number[] =>
  thumbs()
    .map((button, index) => (button.tabIndex === 0 ? index : -1))
    .filter((index) => index >= 0);

function renderStrip(index = 0, photos: readonly StripPhoto[] = PHOTOS) {
  const onPick = vi.fn<(index: number) => void>();
  const view = render(<PhotoStrip photos={photos} index={index} onPick={onPick} label={LABEL} />);
  const rerender = (next: number) =>
    view.rerender(<PhotoStrip photos={photos} index={next} onPick={onPick} label={LABEL} />);
  return { onPick, rerender };
}

/** Makes the strip overflow as a scroller would, and records its sideways scrolls. */
function overflowing(element: HTMLElement, { scrollWidth = 1400, clientWidth = 360 } = {}) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
  const scrollBy = vi.fn();
  Object.defineProperty(element, 'scrollBy', { configurable: true, value: scrollBy });
  return scrollBy;
}

/** A box at `left` with `width`, as getBoundingClientRect returns it. */
function placeAt(element: HTMLElement, left: number, width: number): void {
  element.getBoundingClientRect = () =>
    ({
      left,
      width,
      right: left + width,
      top: 0,
      bottom: 78,
      height: 78,
      x: left,
      y: 0,
    }) as DOMRect;
}

/** Any scroll of the page (window.scrollBy or scrollTo), which the strip must never make. */
let pageScroll: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  pageScroll = vi.fn<() => void>();
  vi.spyOn(window, 'scrollBy').mockImplementation(pageScroll);
  vi.spyOn(window, 'scrollTo').mockImplementation(pageScroll);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('PhotoStrip: what it says', () => {
  it('is a horizontal toolbar named by its label, with a plain button per photo', () => {
    renderStrip();

    expect(strip()).toHaveAttribute('aria-orientation', 'horizontal');
    expect(thumbs()).toHaveLength(PHOTOS.length);
    for (const button of thumbs()) expect(button).toHaveAttribute('type', 'button');
  });

  it('names each button "Photo n of N", with the caption when the photo has one', () => {
    renderStrip();

    expect(thumbs().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Photo 1 of 7',
      'Photo 2 of 7',
      'Photo 3 of 7: The stage before the keynote',
      'Photo 4 of 7',
      'Photo 5 of 7',
      'Photo 6 of 7',
      'Photo 7 of 7',
    ]);
  });

  it('marks only the photo shown as current', () => {
    renderStrip(3);

    expect(thumb(3)).toHaveAttribute('aria-current', 'true');
    expect(thumbs().filter((button) => button.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it("draws each photo's thumbnail as decoration, at a fixed 4:3 size", () => {
    renderStrip();

    thumbs().forEach((button, index) => {
      // The button carries the name; the image adds nothing for a screen reader.
      const image = button.querySelector('img');
      expect(image).toHaveAttribute('alt', '');
      expect(decodeURIComponent(image?.getAttribute('src') ?? '')).toContain(
        `/p${index + 1}-1600x1200.jpg`,
      );
      expect(image).toHaveAttribute('width', '160');
      expect(image).toHaveAttribute('height', '120');
      expect(image).toHaveAttribute('draggable', 'false');
    });
  });

  it('tells the CSS how many photos share the row', () => {
    renderStrip();

    expect(strip().style.getPropertyValue('--n')).toBe(String(PHOTOS.length));
  });
});

describe('PhotoStrip: one Tab stop', () => {
  it('is the photo shown', () => {
    renderStrip(4);

    expect(tabStops()).toEqual([4]);
  });

  it('follows the photo shown when it changes', () => {
    const { rerender } = renderStrip(0);

    rerender(5);

    expect(tabStops()).toEqual([5]);
  });

  it('moves with Right and Left, without changing the photo', () => {
    const { onPick } = renderStrip(2);
    thumb(2).focus();

    fireEvent.keyDown(thumb(2), { key: 'ArrowRight' });
    fireEvent.keyDown(thumb(3), { key: 'ArrowRight' });

    expect(document.activeElement).toBe(thumb(4));
    expect(tabStops()).toEqual([4]);
    expect(thumb(2)).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(thumb(4), { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(thumb(3));
    expect(tabStops()).toEqual([3]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('jumps to the ends with Home and End, and stops there', () => {
    renderStrip(3);
    thumb(3).focus();

    fireEvent.keyDown(thumb(3), { key: 'End' });
    expect(document.activeElement).toBe(thumb(6));
    fireEvent.keyDown(thumb(6), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(thumb(6));

    fireEvent.keyDown(thumb(6), { key: 'Home' });
    expect(document.activeElement).toBe(thumb(0));
    fireEvent.keyDown(thumb(0), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(thumb(0));
    expect(tabStops()).toEqual([0]);
  });

  it('claims only its own keys', () => {
    renderStrip(1);
    thumb(1).focus();

    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(fireEvent.keyDown(document.activeElement as Element, { key })).toBe(false);
    }
    // Tab, the vertical arrows and the activation keys keep their own meaning.
    for (const key of ['Tab', 'ArrowUp', 'ArrowDown', 'Enter', ' ']) {
      expect(fireEvent.keyDown(document.activeElement as Element, { key })).toBe(true);
    }
  });

  it('leaves arrows held with a modifier to the browser (Alt+Left is back)', () => {
    renderStrip(3);
    thumb(3).focus();

    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        expect(fireEvent.keyDown(thumb(3), { key, [modifier]: true })).toBe(true);
      }
    }
    expect(document.activeElement).toBe(thumb(3));
    expect(tabStops()).toEqual([3]);
  });

  it('goes back to the photo shown when the focus leaves the strip', () => {
    renderStrip(2);
    const outside = document.createElement('button');
    document.body.append(outside);
    thumb(2).focus();
    fireEvent.keyDown(thumb(2), { key: 'ArrowRight' });
    expect(tabStops()).toEqual([3]);

    // Moving inside the strip keeps it.
    fireEvent.blur(thumb(3), { relatedTarget: thumb(4) });
    expect(tabStops()).toEqual([3]);

    act(() => outside.focus());
    fireEvent.blur(thumb(3), { relatedTarget: outside });

    expect(tabStops()).toEqual([2]);
  });
});

describe('PhotoStrip: picking a photo', () => {
  it('reports the thumbnail clicked (Enter and Space click a native button)', () => {
    const { onPick } = renderStrip(0);

    fireEvent.click(thumb(5));

    expect(onPick).toHaveBeenCalledWith(5);
  });

  it('hands the Tab stop back to the photo shown after a click', () => {
    const { onPick, rerender } = renderStrip(0);
    thumb(0).focus();
    fireEvent.keyDown(thumb(0), { key: 'ArrowRight' });
    fireEvent.keyDown(thumb(1), { key: 'ArrowRight' });

    fireEvent.click(thumb(2));
    rerender(onPick.mock.calls.at(-1)?.[0] ?? 0);

    expect(tabStops()).toEqual([2]);
    expect(thumb(2)).toHaveAttribute('aria-current', 'true');
  });
});

describe('PhotoStrip: keeping the thumbnail in view', () => {
  it('leaves the strip where it is on the first render', () => {
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });
    try {
      renderStrip(4);
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollBy');
    }
  });

  it('scrolls the strip, not the page, to centre the photo shown when it changes', () => {
    const { rerender } = renderStrip(0);
    const scrollBy = overflowing(strip());
    placeAt(strip(), 16, 360);
    placeAt(thumb(5), 616, 104);

    rerender(5);

    // The thumbnail's centre (668) moves to the strip's (196).
    expect(scrollBy).toHaveBeenCalledWith({ left: 472, behavior: 'smooth' });
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it('jumps without a smooth scroll under reduced motion', () => {
    vi.spyOn(globalThis, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const { rerender } = renderStrip(0);
    const scrollBy = overflowing(strip());
    placeAt(strip(), 16, 360);
    placeAt(thumb(5), 616, 104);

    rerender(5);

    expect(scrollBy).toHaveBeenCalledWith({ left: 472, behavior: 'auto' });
  });

  it('does not scroll a strip that has room for every thumbnail', () => {
    const { rerender } = renderStrip(0);
    const scrollBy = overflowing(strip(), { scrollWidth: 1086, clientWidth: 1086 });

    rerender(5);

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('centres the thumbnail the keyboard moves to, focusing it without scrolling the page', () => {
    renderStrip(0);
    const scrollBy = overflowing(strip());
    placeAt(strip(), 16, 360);
    placeAt(thumb(1), 136, 104);
    const focus = vi.spyOn(thumb(1), 'focus');
    thumb(0).focus();

    fireEvent.keyDown(thumb(0), { key: 'ArrowRight' });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    // Centre 188 to the strip's 196.
    expect(scrollBy).toHaveBeenCalledWith({ left: -8, behavior: 'smooth' });
    expect(pageScroll).not.toHaveBeenCalled();
  });
});
