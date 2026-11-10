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
 * @file The /projects hover preview (the owner's "Keep A + no lean"): with a fine pointer, a
 * card follows the pointer beside the hovered row, showing that row's cover or its typographic
 * card; keyboard focus (on any link in a row) and reduced motion pin it outside the row with a
 * fade only; touch adds nothing, not even a request for a cover or the preview's own code (it
 * loads lazily, on a fine pointer only); any filter or URL change hides it at once. Escape
 * dismisses it until the pointer or focus moves to another row (WCAG 1.4.13); a pinned row that
 * scrolls under the stuck bar hides it, and a window with no room beside the row never shows it
 * (WCAG 2.4.11). It never leans, and it promotes no layer at rest.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectPreview } from '@/app/(routes)/(main)/(professioal)/projects/_components/project-preview';
import type { PreviewItem } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-index';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';

const ITEMS: Readonly<Record<string, PreviewItem>> = {
  a: { title: 'Alpha', kind: 'Web Development', cover: 'https://cdn.sanity.io/images/t/t/a.jpg' },
  b: { title: 'Beta', kind: 'AI/ML', cover: null },
};

/** Row boxes by preview id: two 64px rows across a 1024px window. Mutable per test (a scroll). */
let rowTop: Record<string, number> = { a: 200, b: 264 };
/** The stuck filter bar's bottom edge; the preview keeps the card under it. */
const BAR_BOTTOM = 68;

function stubMedia({ fine, reduced }: { fine: boolean; reduced: boolean }): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: (query === FINE_POINTER && fine) || (query === REDUCED_MOTION_QUERY && reduced),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  rowTop = { a: 200, b: 264 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function box(
    this: HTMLElement,
  ) {
    if (this.dataset.filterPart === 'bar') {
      return { top: 0, bottom: BAR_BOTTOM, left: 64, right: 1000, height: BAR_BOTTOM } as DOMRect;
    }
    const top = rowTop[this.dataset.previewId ?? ''] ?? 0;
    return {
      top,
      bottom: top + 64,
      left: 64,
      right: 1000,
      height: 64,
      width: 936,
      x: 64,
      y: top,
    } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The rows inside the preview, under a stuck filter bar in the same filter scope. */
function Rows({ resetOn = 'a b' }: { readonly resetOn?: string }): ReactElement {
  return (
    <div data-filter-scope="">
      <search data-filter-part="bar" />
      <ProjectPreview items={ITEMS} resetOn={resetOn}>
        <table>
          <tbody>
            {Object.keys(ITEMS).map((id) => (
              <tr key={id} data-preview-id={id}>
                <td>
                  <a href={`/projects/${id}`}>{ITEMS[id]?.title}</a>
                  <a href={`https://example.com/${id}`}>Code</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProjectPreview>
    </div>
  );
}

const card = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-preview-card]');

/** Renders the rows and waits for the lazily loaded card (a fine pointer only). */
async function renderLive(element: ReactElement = <Rows />): Promise<ReturnType<typeof render>> {
  const view = render(element);
  await waitFor(() => expect(card()).not.toBeNull());
  return view;
}

/**
 * Answers ':focus-visible' as a browser would after keyboard focus: true for the element that
 * received it (`focused`, set by focusBy), false for every other element, the row included.
 */
function stubFocusVisible(): { focusBy: (target: HTMLElement | null, keyboard: boolean) => void } {
  const matches = Element.prototype.matches;
  let focused: Element | null = null;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function focusVisible(
    this: Element,
    selector: string,
  ) {
    return selector === ':focus-visible' ? this === focused : matches.call(this, selector);
  });
  return {
    focusBy: (target, keyboard) => {
      focused = keyboard ? target : null;
      if (target) fireEvent.focusIn(target);
    },
  };
}

/** Scrolls the window: the rows' boxes move by `dy`, then a frame passes. */
async function scrollBy(dy: number): Promise<void> {
  rowTop = Object.fromEntries(Object.entries(rowTop).map(([id, top]) => [id, top - dy]));
  fireEvent.scroll(window);
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
}

const codeLinkOf = (index: number): HTMLElement =>
  screen.getAllByRole('link', { name: 'Code' })[index] as HTMLElement;
const linkOf = (name: string): HTMLElement => screen.getByRole('link', { name });
const point = (target: HTMLElement, clientX: number, pointerType = 'mouse'): void => {
  fireEvent.pointerMove(target, { pointerType, clientX, clientY: 220, bubbles: true });
};

describe('on a coarse pointer (a phone)', () => {
  it('adds nothing: no card, no cover, no listeners', async () => {
    stubMedia({ fine: false, reduced: false });
    render(<Rows />);

    point(linkOf('Alpha'), 300);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.querySelector('[data-hover-preview]')).toHaveAttribute(
      'data-hover-preview',
      'off',
    );
    expect(card()).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('with a fine pointer', () => {
  beforeEach(() => stubMedia({ fine: true, reduced: false }));

  it('first shows the card 8px under the row and 24px right of the pointer (variant A)', async () => {
    await renderLive();

    point(linkOf('Alpha'), 300);

    await waitFor(() => expect(card()?.style.transform).toContain('translateX(324px)'));
    expect(card()?.style.transform).toContain('translateY(272px)');
  });

  it('shows the hovered row’s card, portalled out of the table and hidden from screen readers', async () => {
    await renderLive();

    point(linkOf('Alpha'), 300);

    expect(document.querySelector('[data-hover-preview]')).toHaveAttribute(
      'data-hover-preview',
      'on',
    );
    expect(card()).toHaveAttribute('data-shown', 'a');
    expect(card()).toHaveAttribute('aria-hidden', 'true');
    expect(card()?.closest('table')).toBeNull();
    expect(card()?.querySelector('[data-state="shown"]')).toHaveTextContent('Alpha');
    expect(card()?.querySelector('img')).not.toBeNull();
  });

  it('shows the typographic card for a row without a cover', async () => {
    await renderLive();

    point(linkOf('Beta'), 300);

    const layer = card()?.querySelector('[data-state="shown"]');
    expect(layer).toHaveTextContent('AI/ML');
    expect(layer).toHaveTextContent('Beta');
    expect(layer?.querySelector('img')).toBeNull();
  });

  it('ignores a touch on a hybrid device', async () => {
    await renderLive();

    point(linkOf('Alpha'), 300, 'touch');

    expect(card()).toHaveAttribute('data-shown', '');
    expect(document.querySelector('img')).toBeNull();
  });

  it('pins to the row on keyboard focus of any link in it (the link, not the row, is focus-visible), but not on mouse focus', async () => {
    const { focusBy } = stubFocusVisible();
    await renderLive();

    focusBy(linkOf('Alpha'), false);
    expect(card()).toHaveAttribute('data-shown', '');

    focusBy(codeLinkOf(1), true);
    expect(card()).toHaveAttribute('data-shown', 'b');
  });

  it('pins to a row whose link had keyboard focus before the preview’s code arrived', async () => {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function focusVisible(
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible'
        ? this === document.activeElement
        : matches.call(this, selector);
    });
    // Focus lands before the lazily loaded half has mounted (here: before the pointer reads fine).
    stubMedia({ fine: false, reduced: false });
    const { rerender } = render(<Rows />);
    codeLinkOf(1).focus();
    expect(card()).toBeNull();

    stubMedia({ fine: true, reduced: false });
    rerender(<Rows />);

    await waitFor(() => expect(card()).toHaveAttribute('data-shown', 'b'));
  });

  it('hides when a keyboard-pinned row scrolls under the stuck bar, never painting over it', async () => {
    const { focusBy } = stubFocusVisible();
    await renderLive();
    focusBy(codeLinkOf(0), true);
    expect(card()).toHaveAttribute('data-shown', 'a');

    // Row a (200 to 264) moves up to -44 to 20: under the bar, whose bottom is at 68.
    await scrollBy(244);

    expect(card()).toHaveAttribute('data-shown', '');
    const top = Number(/translateY\((-?[\d.]+)px\)/.exec(card()?.style.transform ?? '')?.[1]);
    expect(top).toBeGreaterThanOrEqual(BAR_BOTTOM + 8);
  });

  it('never shows the card where the window has no room for it beside the row (400% zoom)', async () => {
    vi.stubGlobal('innerWidth', 360);
    vi.stubGlobal('innerHeight', 225);
    const { focusBy } = stubFocusVisible();
    rowTop = { a: 100, b: 160 };
    await renderLive();

    focusBy(codeLinkOf(0), true);
    point(linkOf('Beta'), 100);

    expect(card()).toHaveAttribute('data-shown', '');
  });

  it('hides on Escape, and stays hidden on that row until the pointer or focus reaches another', async () => {
    const { focusBy } = stubFocusVisible();
    await renderLive();
    point(linkOf('Alpha'), 300);
    expect(card()).toHaveAttribute('data-shown', 'a');

    const escapeKey = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(escapeKey);
    });

    expect(card()).toHaveAttribute('data-shown', '');
    expect(escapeKey.defaultPrevented).toBe(false);
    point(linkOf('Alpha'), 320);
    focusBy(codeLinkOf(0), true);
    expect(card()).toHaveAttribute('data-shown', '');

    point(linkOf('Beta'), 320);
    expect(card()).toHaveAttribute('data-shown', 'b');
  });

  it('after Escape, keyboard focus on another row shows the card again', async () => {
    const { focusBy } = stubFocusVisible();
    await renderLive();
    focusBy(codeLinkOf(0), true);
    expect(card()).toHaveAttribute('data-shown', 'a');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(card()).toHaveAttribute('data-shown', '');
    focusBy(linkOf('Alpha'), true);
    expect(card()).toHaveAttribute('data-shown', '');

    focusBy(codeLinkOf(1), true);
    expect(card()).toHaveAttribute('data-shown', 'b');
  });

  it('hides at once when the rows change under it (a filter or URL change)', async () => {
    const { rerender } = await renderLive(<Rows resetOn="a b" />);
    point(linkOf('Alpha'), 300);
    expect(card()).toHaveAttribute('data-shown', 'a');

    rerender(<Rows resetOn="b" />);

    expect(card()).toHaveAttribute('data-shown', '');
  });

  it('never leans, and promotes a layer only while shown', async () => {
    await renderLive();
    expect(card()).not.toHaveAttribute('data-active');
    expect(card()?.style.willChange ?? '').toBe('');

    point(linkOf('Alpha'), 300);
    point(linkOf('Alpha'), 900);

    expect(card()).toHaveAttribute('data-active');
    expect(card()?.style.transform ?? '').not.toMatch(/rotate/);
    expect(card()?.style.rotate ?? '').toBe('');
  });

  it('marks a cover loaded through React state, not a DOM write', async () => {
    await renderLive();
    point(linkOf('Alpha'), 300);
    const image = card()?.querySelector('img');
    if (!image) throw new Error('no cover');

    expect(image).not.toHaveAttribute('data-loaded');
    act(() => {
      fireEvent.load(image);
    });

    await waitFor(() => expect(image).toHaveAttribute('data-loaded', 'true'));
  });
});

describe('with reduced motion', () => {
  it('pins the card to the row instead of following the pointer, fading only', async () => {
    stubMedia({ fine: true, reduced: true });
    await renderLive();

    point(linkOf('Alpha'), 200);
    // Pinned under the row's right end: 1000 - 288 across, 8px under the row's bottom (264).
    await waitFor(() => expect(card()?.style.transform).toContain('translateX(712px)'));
    point(linkOf('Alpha'), 900);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(card()).toHaveAttribute('data-shown', 'a');
    expect(card()?.style.transform).toContain('translateX(712px)');
    expect(card()?.style.transform).toContain('translateY(272px)');
    expect(card()?.style.transform ?? '').not.toMatch(/scale\(0\.96\)/);
  });
});

describe('its stylesheet', () => {
  it('sets will-change only on the shown card, never at rest', () => {
    const css = readFileSync(
      path.resolve(
        __dirname,
        '../../../src/app/(routes)/(main)/(professioal)/projects/_components/project-preview.module.css',
      ),
      'utf8',
    );
    const rules = css.replaceAll(/\/\*[\s\S]*?\*\//g, '').split('}');
    const withWillChange = rules.filter((rule) => rule.includes('will-change'));

    expect(withWillChange.length).toBeGreaterThan(0);
    for (const rule of withWillChange) expect(rule.split('{')[0]).toContain('[data-active]');
  });
});
