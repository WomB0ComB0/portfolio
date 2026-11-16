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
 * @file The shared photo viewer (photo-viewer.tsx and its lazy open view): each image's link is a
 * plain link to the whole image, so it opens without JavaScript; a plain click opens the viewer
 * at that image instead, titled and captioned ('Fig. 2 of 3' and Studio's words), with focus on
 * Close; the arrows and the thumbnails move round the set, and the shown thumbnail is kept in
 * view (at once on opening and under reduced motion); inside a tall capture's scroll area Home,
 * End and the up and down keys are left to the browser to scroll it, while Left and Right still
 * step; the panel is sized once for the whole set, so stepping never moves Previous and Next, and
 * a set of one is marked so it is centred with no room kept for thumbnails; Escape closes it and
 * focus goes back to the link that opened it; a click asking for a new tab is left to the browser.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Vite cannot load the repo's PostCSS config, so the viewer's CSS module is stood in for, as
// tests/setup/vitest.setup.ts does for others: each class `name` is `name`.
vi.mock('@/components/console/photo/photo-viewer.module.css', () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? name : undefined),
  }),
}));

import { PhotoViewerLink, PhotoViewerRoot } from '@/components/console/photo/photo-viewer';
import type { ViewerItem } from '@/components/console/photo/photo-viewer-step';

const item = (n: number, words: string | null): ViewerItem => ({
  key: `screen-${n}`,
  src: `https://cdn.sanity.io/images/test/test/screen-${n}-1600x900.png?w=1600`,
  thumb: `https://cdn.sanity.io/images/test/test/screen-${n}-1600x900.png?w=240&h=180`,
  width: 1600,
  height: 900,
  words,
});

const ITEMS = [item(1, 'Home page'), item(2, 'Sponsor tiers'), item(3, null)];
/** The second is a full-page capture, taller than a phone, which the viewer scrolls. */
const WITH_TALL = [item(1, 'Home page'), { ...item(2, 'Whole page'), height: 4000 }, item(3, null)];

function Page({ items = ITEMS }: { readonly items?: readonly ViewerItem[] }) {
  return (
    <PhotoViewerRoot items={items} title="Example" noun={{ one: 'screen', many: 'screens' }}>
      {items.map((each, index) => (
        <PhotoViewerLink
          key={each.key}
          index={index}
          href={each.src}
          aria-label={`Open screen ${index + 1} of 3`}
        >
          picture {index + 1}
        </PhotoViewerLink>
      ))}
    </PhotoViewerRoot>
  );
}

const linkTo = (n: number) => screen.getByRole('link', { name: `Open screen ${n} of 3` });

type ScrollCall = readonly [string | null, ScrollIntoViewOptions | boolean | undefined];

/** Records each scrollIntoView (jsdom has none): which thumbnail, and how. */
function recordScrolls(): ScrollCall[] {
  const calls: ScrollCall[] = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: HTMLElement, options?: ScrollIntoViewOptions | boolean) {
      calls.push([this.getAttribute('aria-label'), options]);
    },
  });
  return calls;
}

/** Clicks a link and waits for the lazily loaded open view. */
async function openFrom(n: number): Promise<HTMLElement> {
  fireEvent.click(linkTo(n));
  return screen.findByRole('dialog');
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
});

describe('the links', () => {
  it('are plain links to the whole image, so every image opens without JavaScript', () => {
    render(<Page />);

    expect(linkTo(2)).toHaveAttribute('href', ITEMS[1]?.src);
    expect(linkTo(2)).not.toHaveAttribute('target');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leave a click that asks for a new tab to the browser', () => {
    render(<Page />);

    const notCancelled = fireEvent.click(linkTo(1), { metaKey: true });

    expect(notCancelled).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the open view', () => {
  it('opens at the image clicked, titled and captioned, with focus on Close', async () => {
    render(<Page />);

    const dialog = await openFrom(2);

    expect(within(dialog).getByRole('heading', { name: 'Example' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Fig. 2 of 3 Sponsor tiers');
    expect(within(dialog).getByRole('img', { name: 'Sponsor tiers' })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus(),
    );
  });

  it('moves round the set with the arrows, the buttons and the thumbnails', async () => {
    render(<Page />);
    const dialog = await openFrom(3);

    expect(dialog).toHaveTextContent('Fig. 3 of 3');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(dialog).toHaveTextContent('Fig. 1 of 3 Home page');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous screen' }));
    expect(dialog).toHaveTextContent('Fig. 3 of 3');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Screen 2 of 3' }));
    expect(dialog).toHaveTextContent('Fig. 2 of 3 Sponsor tiers');
    expect(within(dialog).getByRole('button', { name: 'Screen 2 of 3' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.keyDown(dialog, { key: 'End' });
    expect(dialog).toHaveTextContent('Fig. 3 of 3');
  });

  it('writes no words for an image Studio has none for', async () => {
    render(<Page />);
    const dialog = await openFrom(3);

    expect(within(dialog).getByText('Fig. 3 of 3').parentElement).toHaveTextContent(
      /^Fig\. 3 of 3$/,
    );
  });

  it('closes on Escape and gives focus back to the link that opened it', async () => {
    render(<Page />);
    const dialog = await openFrom(2);

    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(linkTo(2)).toHaveFocus();
  });
});

describe('the row of thumbnails', () => {
  const NEAREST = { block: 'nearest', inline: 'nearest' } as const;

  it('keeps the shown one in view: at once on opening, gliding as the image changes', async () => {
    const calls = recordScrolls();
    render(<Page />);
    const dialog = await openFrom(2);

    expect(calls.at(-1)).toEqual(['Screen 2 of 3', { ...NEAREST, behavior: 'instant' }]);
    fireEvent.keyDown(dialog, { key: 'End' });
    expect(calls.at(-1)).toEqual(['Screen 3 of 3', { ...NEAREST, behavior: 'smooth' }]);
  });

  it('moves at once under reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const calls = recordScrolls();
    render(<Page />);
    const dialog = await openFrom(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Next screen' }));
    expect(calls.at(-1)).toEqual(['Screen 2 of 3', { ...NEAREST, behavior: 'instant' }]);
  });
});

describe('a tall capture', () => {
  const areaIn = (dialog: HTMLElement): HTMLElement =>
    within(dialog).getByRole('region', { name: 'The whole screen: scroll to see all of it' });

  it('leaves Home, End and the up and down keys to its scroll area, to scroll it', async () => {
    render(<Page items={WITH_TALL} />);
    const dialog = await openFrom(2);

    for (const key of ['End', 'Home', 'ArrowDown', 'ArrowUp', 'PageDown']) {
      const notCancelled = fireEvent.keyDown(areaIn(dialog), { key });
      expect(notCancelled).toBe(true);
      expect(dialog).toHaveTextContent('Fig. 2 of 3 Whole page');
    }
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Close' }), { key: 'End' });
    expect(dialog).toHaveTextContent('Fig. 3 of 3');
  });

  it('still steps with Left and Right from inside its scroll area', async () => {
    render(<Page items={WITH_TALL} />);
    const dialog = await openFrom(2);

    expect(fireEvent.keyDown(areaIn(dialog), { key: 'ArrowRight' })).toBe(false);
    expect(dialog).toHaveTextContent('Fig. 3 of 3');
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(fireEvent.keyDown(areaIn(dialog), { key: 'ArrowLeft' })).toBe(false);
    expect(dialog).toHaveTextContent('Fig. 1 of 3 Home page');
  });
});

describe('the panel', () => {
  /** A portrait phone screenshot, a landscape page and a square logo: three shapes in one set. */
  const MIXED = [
    { ...item(1, 'Phone'), width: 780, height: 1688 },
    { ...item(2, 'Wide'), width: 1600, height: 900 },
    { ...item(3, 'Square'), width: 800, height: 800 },
  ];
  const sizing = (dialog: HTMLElement) => ({
    wide: dialog.style.getPropertyValue('--ratio-wide'),
    narrow: dialog.style.getPropertyValue('--ratio-narrow'),
    tall: dialog.hasAttribute('data-set-tall'),
  });

  it('is sized once for the whole set, so stepping never moves Previous and Next', async () => {
    render(<Page items={MIXED} />);
    const dialog = await openFrom(1);
    const first = sizing(dialog);

    expect(Number(first.wide)).toBeCloseTo(16 / 9);
    expect(Number(first.narrow)).toBeCloseTo(780 / 1688);
    expect(first.tall).toBe(false);
    for (const _ of MIXED) {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Next screen' }));
      expect(sizing(dialog)).toEqual(first);
    }
  });

  it('makes room for a tall capture in the set from the first image', async () => {
    render(<Page items={WITH_TALL} />);
    const dialog = await openFrom(1);

    expect(sizing(dialog).tall).toBe(true);
    expect(Number(sizing(dialog).wide)).toBeCloseTo(16 / 9);
  });

  it('marks a set of one, which has no thumbnails, so it is centred without room for them', async () => {
    render(<Page items={ITEMS.slice(0, 1)} />);
    const single = await openFrom(1);

    expect(single).toHaveAttribute('data-set-single');
    expect(within(single).queryByRole('list', { name: 'All screens' })).toBeNull();
    cleanup();

    render(<Page />);
    expect(await openFrom(1)).not.toHaveAttribute('data-set-single');
  });
});
