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
 * @file The /stats age's Pause across the strip's skeleton and the loaded strip (audit 2026-11-20
 * leftover, WCAG 2.2.2 and 2.4.3). While the strip's sources load, a skeleton strip stands in a
 * Suspense boundary, and the loaded strip replaces it. Two things went wrong:
 * - On a full page load a Pause pressed on the skeleton did nothing. React never hydrates the
 *   server's HTML for a Suspense fallback (it waits for the content that replaces it), so the
 *   button sent there was dead. The skeleton's toggle (LiveAgePause `skeleton`) is now a
 *   placeholder of its size in the server's HTML, no control at all, and a working toggle wherever
 *   React renders it in the browser (a fallback shown on a client navigation).
 * - When the loaded strip replaced the skeleton, focus on the skeleton's Pause fell to the page.
 *   It now moves to the loaded strip's Pause.
 * A Pause pressed on a working skeleton toggle holds through the swap, as both share one
 * LiveAgeProvider around the boundary.
 *
 * Only Date is faked: React reveals the loaded strip on its own timers, and the age, paused or
 * not, then shows digits for a clock that moves only when a test moves it. Under act React waits
 * on a suspended component before it shows a fallback, so whatever renders while the figures are
 * on their way (the first render, a press on the skeleton) goes in an awaited act.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactElement, Suspense, use } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LiveAge,
  LiveAgePause,
  LiveAgeProvider,
} from '@/app/(routes)/(dev)/stats/_components/console/live-age';
import { pendingStripItems, stripItems } from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { StatStrip } from '@/components/console/stat-strip';
import { consoleFixture } from './console-fixture';

/** The server's moment: '22.65753424 years old'. */
const AT = Date.parse('2026-11-19T00:00:00Z');
/** A minute on, 190 steps of the last decimal: what a running age would show by then. */
const MINUTE = 60_000;
const PAUSE = 'Pause age counter';

const never = new Promise<never>(() => {});

/** The skeleton strip, as stats-console.tsx renders it while the figures are on their way. */
const SkeletonStrip = (): ReactElement => (
  <StatStrip
    aria-label="At a glance"
    items={pendingStripItems(new Date(AT), <LiveAge at={AT} />, <LiveAgePause skeleton />)}
    sizing="container"
  />
);

/** The loaded strip, once `landed` has: rendered by the server a second after the skeleton. */
function LoadedStrip({ landed }: { readonly landed: Promise<unknown> }): ReactElement {
  use(landed);
  return (
    <StatStrip
      aria-label="At a glance"
      items={stripItems(
        consoleFixture(),
        new Date(AT + 1_000),
        <LiveAge at={AT + 1_000} />,
        <LiveAgePause />,
      )}
      sizing="container"
    />
  );
}

/** The strip's slot as ConsoleFrame sets it: one provider around the boundary. */
const slot = (landed: Promise<unknown>): ReactElement => (
  <LiveAgeProvider>
    <Suspense fallback={<SkeletonStrip />}>
      <LoadedStrip landed={landed} />
    </Suspense>
  </LiveAgeProvider>
);

/** The strip, skeleton or loaded. */
const strip = (): HTMLElement => {
  const list = document.querySelector<HTMLElement>('dl[aria-label="At a glance"]');
  if (!list) throw new Error('no strip rendered');
  return list;
};
const pauseButton = (): HTMLElement => screen.getByRole('button', { name: PAUSE });
const digits = (): string => document.querySelector('[data-digits]')?.textContent ?? '';

/**
 * The slot rendered in the browser with its figures still on their way, as a client navigation to
 * /stats shows it; `land` brings the figures and waits for the loaded strip.
 */
async function renderSlot(before: ReactElement | null = null) {
  let resolve: (value: unknown) => void = () => {};
  const landed = new Promise((settle) => {
    resolve = settle;
  });
  await act(async () => {
    render(
      <>
        {before}
        {slot(landed)}
      </>,
    );
  });
  const land = async (): Promise<void> => {
    await act(async () => resolve(undefined));
    await waitFor(() => expect(strip()).not.toHaveAttribute('aria-busy'));
  };
  return { land };
}

/** A press on the skeleton's toggle, which re-renders the boundary still waiting on its figures. */
const press = async (button: HTMLElement): Promise<void> => {
  await act(async () => {
    fireEvent.click(button);
  });
};

/**
 * Server HTML put in the page, hydrated with `tree`; `done` unmounts it and takes it out again.
 * A recoverable error (a mismatch) fails the test.
 */
async function hydrated(markup: string, tree: ReactElement) {
  const container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  const recoverable = vi.fn();
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: recoverable });
  });
  const done = (): void => {
    act(() => root?.unmount());
    container.remove();
  };
  return { container, recoverable, done };
}

beforeEach(() => {
  vi.useFakeTimers({ now: AT, toFake: ['Date'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the skeleton’s Pause in the server’s HTML', () => {
  const html = (node: ReactElement): HTMLElement => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(node);
    return root;
  };

  it('is a placeholder of the toggle’s size, not a control nobody can use', () => {
    const skeleton = html(
      <LiveAgeProvider>
        <LiveAgePause skeleton />
      </LiveAgeProvider>,
    );
    const loaded = html(
      <LiveAgeProvider>
        <LiveAgePause />
      </LiveAgeProvider>,
    );
    const cell = skeleton.querySelector('dd');
    const placeholder = cell?.querySelector('[data-pause-placeholder]');
    const button = loaded.querySelector('button');
    const keyCap = ['inline-flex', 'h-6', 'gap-1', 'border', 'px-1.5', 'mono-token'];

    // Nothing to press or to Tab to, and nothing for a screen reader in the cell.
    expect(skeleton.querySelector('button, a, input, [tabindex]')).toBeNull();
    expect(cell).toHaveAttribute('aria-hidden', 'true');
    // The toggle's own cell, and its key cap's box (its contents there, unseen), so the loaded
    // toggle lands in exactly this room at every width.
    expect(cell?.className).toBe(loaded.querySelector('dd')?.className);
    expect(placeholder).toHaveClass(...keyCap);
    expect(button).toHaveClass(...keyCap);
    expect(placeholder?.querySelector('svg')).toHaveClass('invisible', 'size-3');
    const word = Array.from(placeholder?.querySelectorAll('span') ?? []).find(
      (span) => span.textContent === 'Pause',
    );
    expect(word).toHaveClass('invisible');
    expect(word?.className.replace('invisible', '').trim()).toBe(
      button?.querySelector('span')?.className,
    );
    // Drawn as the strip's other placeholder bars are: pulsing only where motion is welcome.
    expect(placeholder).toHaveClass(
      'bg-surface-3',
      'border-transparent',
      'motion-safe:animate-pulse',
    );
  });

  it('stays a placeholder on a full page load, as React leaves a waiting fallback unhydrated', async () => {
    const pressed = vi.fn();
    const fallback = (
      <>
        <SkeletonStrip />
        <button type="button" onClick={pressed}>
          A button sent in the fallback
        </button>
      </>
    );
    // The page's first flush, with the figures still on their way: the boundary's fallback between
    // the markers React's streaming renderer writes for a boundary still waiting (Fizz's
    // '<!--$?--><template id="B:0"></template>' and '<!--/$-->'). The provider adds no markup.
    // The response is still streaming, so the document is still loading: React then waits for the
    // boundary's content (once the document has loaded, it would give up and render it itself).
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const firstFlush = `<!--$?--><template id="B:0"></template>${renderToString(
      <LiveAgeProvider>{fallback}</LiveAgeProvider>,
    )}<!--/$-->`;
    const page = hydrated(
      firstFlush,
      <LiveAgeProvider>
        <Suspense fallback={fallback}>
          <LoadedStrip landed={never} />
        </Suspense>
      </LiveAgeProvider>,
    );
    const { container, recoverable, done } = await page;

    try {
      expect(recoverable).not.toHaveBeenCalled();
      // React has not touched the fallback: a button there does nothing when pressed...
      fireEvent.click(screen.getByRole('button', { name: 'A button sent in the fallback' }));
      expect(pressed).not.toHaveBeenCalled();
      // ...so the age's Pause is not sent as one: its placeholder holds the room, out of reach.
      expect(screen.queryByRole('button', { name: PAUSE })).toBeNull();
      expect(container.querySelector('[data-pause-placeholder]')).not.toBeNull();
    } finally {
      done();
    }
  });

  it('becomes the working toggle wherever React hydrates it, with no mismatch', async () => {
    const tree = (
      <LiveAgeProvider>
        <LiveAge at={AT} />
        <LiveAgePause skeleton />
      </LiveAgeProvider>
    );
    const errors = vi.spyOn(console, 'error');
    const { container, recoverable, done } = await hydrated(renderToString(tree), tree);

    try {
      expect(errors).not.toHaveBeenCalled();
      expect(recoverable).not.toHaveBeenCalled();
      expect(container.querySelector('[data-pause-placeholder]')).toBeNull();
      fireEvent.click(pauseButton());
      expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    } finally {
      done();
    }
  });
});

describe('the skeleton’s Pause rendered in the browser (a client navigation)', () => {
  it('is a working toggle while the figures are on their way', async () => {
    await renderSlot();

    expect(strip()).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('[data-pause-placeholder]')).toBeNull();
    await press(pauseButton());
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('holds a pause pressed on the skeleton once the loaded strip replaces it', async () => {
    const { land } = await renderSlot();
    const skeletonPause = pauseButton();
    await press(skeletonPause);
    const frozen = digits();

    // A minute goes by before the figures land: a running age would have moved on.
    vi.setSystemTime(AT + MINUTE);
    await land();

    expect(skeletonPause.isConnected).toBe(false);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    expect(digits()).toBe(frozen);
    // Pressed again, the loaded age catches up at once.
    fireEvent.click(pauseButton());
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
    expect(digits()).not.toBe(frozen);
  });

  it('lets the age run on when nobody paused it', async () => {
    const { land } = await renderSlot();
    const shown = digits();

    vi.setSystemTime(AT + MINUTE);
    await land();

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
    expect(digits()).not.toBe(shown);
  });

  it('moves focus from the skeleton’s Pause to the loaded strip’s', async () => {
    const { land } = await renderSlot();
    const skeletonPause = pauseButton();
    act(() => skeletonPause.focus());

    await land();

    expect(skeletonPause.isConnected).toBe(false);
    expect(pauseButton()).toHaveFocus();
  });

  it('keeps a pause and the focus together across the swap', async () => {
    const { land } = await renderSlot();
    act(() => pauseButton().focus());
    await press(pauseButton());

    await land();

    expect(pauseButton()).toHaveFocus();
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('takes no focus that was elsewhere when the strip lands', async () => {
    const { land } = await renderSlot(<button type="button">Elsewhere</button>);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => elsewhere.focus());

    await land();

    expect(elsewhere).toHaveFocus();
    expect(pauseButton()).not.toHaveFocus();
  });

  it('takes no focus it was not handed in the same swap', async () => {
    const toggle = (key: string | null) => (
      <LiveAgeProvider>{key ? <LiveAgePause key={key} /> : null}</LiveAgeProvider>
    );
    const view = render(toggle('first'));
    act(() => pauseButton().focus());

    // The focused toggle goes with nothing in its place; focus falls to the page...
    view.rerender(toggle(null));
    await act(async () => {});
    // ...and a toggle mounted later leaves it there.
    view.rerender(toggle('later'));

    expect(pauseButton()).not.toHaveFocus();
  });
});
