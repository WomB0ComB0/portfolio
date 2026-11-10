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
 * @file The open view of a photo (the lazily loaded Radix dialog): titled by its place, the whole
 * photo at every width (never the lab's 4:3 crop), focus starting on Close (Done on a phone) and
 * going back to the opener, Escape closing it, an "Open place" link, and the card's own image as
 * the placeholder, always a same-origin /_next/image URL. On a wide screen the photo flies from
 * its card by transform and clip-path; on a phone or under reduced motion only opacity changes,
 * opening and closing, even with real boxes to fly between. When the window crosses the phone
 * layout while open (a phone rotated, a window zoomed), focus moves to the button now shown
 * instead of falling out of the dialog, and the close is a crossfade.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('motion/react')>();
  const done = () => Object.assign(Promise.resolve(), { stop: () => undefined });
  return { ...real, animate: vi.fn(done) };
});

import { animate } from 'motion/react';
import { LivePhotoDialog } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-dialog-live';
import type { OpenRequest } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-types';
import { photoData, sourceOf, stubDevice } from './photo-fixtures';

const { places, photos } = photoData(3, 4);
const PHOTO = photos[0];
const PLACE = places[0];
if (!PHOTO || !PLACE) throw new Error('fixtures');

const CARD_SRC = '/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fcard.jpg&w=640&q=75';

/** Opens the dialog from a button holding a card image, and closes it as the view does. */
function Harness({ request }: { readonly request: (opener: HTMLElement) => OpenRequest }) {
  const [opened, setOpened] = useState<OpenRequest | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={(event) => setOpened(request(event.currentTarget))}
        data-testid="opener"
      >
        <span data-grid-frame="">
          {/* biome-ignore lint/performance/noImgElement: a stand-in for the card's next/image. */}
          <img src={CARD_SRC} alt="" />
        </span>
        open
      </button>
      {opened ? <LivePhotoDialog opened={opened} onClosed={() => setOpened(null)} /> : null}
    </>
  );
}

const requestFor = (opener: HTMLElement): OpenRequest => ({
  photo: PHOTO,
  place: PLACE,
  source: opener.querySelector('[data-grid-frame]'),
  placeholder: CARD_SRC,
  returnFocus: opener,
});

const open = (element: ReactElement = <Harness request={requestFor} />) => {
  render(element);
  fireEvent.click(screen.getByTestId('opener'));
  return screen.getByRole('dialog');
};

/** The keys of every animate() call's target. */
const animatedKeys = (): string[] =>
  vi
    .mocked(animate)
    .mock.calls.flatMap(([, keyframes]) =>
      keyframes && typeof keyframes === 'object' ? Object.keys(keyframes) : [],
    );

/** What only a flight animates: never under reduced motion or on a phone. */
const FLIGHT_KEYS = ['x', 'y', 'scale', 'clipPath'];

/** Gives the open frame and the card real boxes (jsdom's are 0 x 0, which never fly). */
const stubBoxes = () =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const box = this.hasAttribute('data-photo-frame')
      ? { left: 200, top: 100, width: 800, height: 600 }
      : { left: 40, top: 300, width: 240, height: 180 };
    return { ...box, x: box.left, y: box.top, right: 0, bottom: 0, toJSON: () => box };
  });

/** Presses Escape in the dialog, letting the close run. */
const pressEscape = async (dialog: HTMLElement) => {
  await act(async () => {
    fireEvent.keyDown(dialog, { key: 'Escape' });
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(animate).mockClear();
  vi.restoreAllMocks();
});

describe('LivePhotoDialog', () => {
  it("is titled by the photo's place, with its category, caption and an Open place link", () => {
    stubDevice({ fine: true });
    const dialog = open();

    expect(dialog).toHaveAccessibleName(PLACE.name);
    expect(dialog).toHaveTextContent(PHOTO.caption ?? '');
    expect(screen.getByRole('link', { name: 'Open place' })).toHaveAttribute(
      'href',
      `/places/${PLACE.id}`,
    );
  });

  it('starts on Close on a wide screen, and on Done on a phone', () => {
    stubDevice({ fine: true });
    open();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    cleanup();

    stubDevice({ compact: true });
    open();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
  });

  it('closes on Escape and hands focus back to the opener', async () => {
    stubDevice({ fine: true });
    const dialog = open();

    await pressEscape(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByTestId('opener'));
  });

  it("shows the card's own image under the photo, only a same-origin /_next/image URL", () => {
    stubDevice({ fine: true });
    const dialog = open();
    const images = Array.from(dialog.querySelectorAll('img'));
    const placeholder = images.find((img) => img.getAttribute('src') === CARD_SRC);
    const full = images.find((img) => sourceOf(img.getAttribute('src')) === PHOTO.full);

    expect(placeholder?.getAttribute('src')).toMatch(/^\/_next\/image\?/);
    expect(full).toHaveAttribute('sizes', '(max-width: 639px) calc(-2rem + 100vw), 52rem');
    expect(full).toHaveAttribute('loading', 'eager');
    expect(full).toHaveAttribute('alt', PHOTO.caption);
  });

  it('drops a placeholder that is not a /_next/image URL', () => {
    stubDevice({ fine: true });
    const dialog = open(
      <Harness
        request={(opener) => ({
          ...requestFor(opener),
          placeholder: 'https://cdn.sanity.io/x.jpg',
        })}
      />,
    );

    const srcs = Array.from(dialog.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(srcs.some((src) => src?.startsWith('https://'))).toBe(false);
  });

  it('flies from the card by transform and clip-path on a wide screen, and back', async () => {
    stubDevice({ fine: true });
    stubBoxes();
    const dialog = open();

    expect(animatedKeys()).toEqual(expect.arrayContaining(FLIGHT_KEYS));
    vi.mocked(animate).mockClear();
    await pressEscape(dialog);
    expect(animatedKeys()).toEqual(expect.arrayContaining(FLIGHT_KEYS));
  });

  it.each([
    ['a phone', { compact: true }],
    ['reduced motion', { fine: true, reduced: true }],
  ])(
    'only crossfades on %s, opening and closing, with real boxes to fly between',
    async (_name, device) => {
      stubDevice(device);
      stubBoxes();
      const dialog = open();

      expect(animatedKeys().length).toBeGreaterThan(0);
      expect(new Set(animatedKeys())).toEqual(new Set(['opacity']));
      vi.mocked(animate).mockClear();
      await pressEscape(dialog);
      expect(animatedKeys().length).toBeGreaterThan(0);
      expect(animatedKeys().filter((key) => FLIGHT_KEYS.includes(key))).toEqual([]);
    },
  );
});

describe('LivePhotoDialog across the phone breakpoint', () => {
  it('moves focus to Done when the window becomes a phone, and back to Close', () => {
    const device = stubDevice({ fine: true });
    const dialog = open();
    const close = screen.getByRole('button', { name: 'Close' });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(document.activeElement).toBe(close);

    act(() => device.become({ fine: true, compact: true }));
    expect(document.activeElement).toBe(done);
    expect(dialog).toHaveAttribute('data-compact', 'true');

    act(() => device.become({ fine: true }));
    expect(document.activeElement).toBe(close);
    expect(dialog).not.toHaveAttribute('data-compact');
  });

  it('takes focus back from the page when the hidden button dropped it', () => {
    const device = stubDevice({ compact: true });
    open();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    act(() => device.become({ fine: true }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('leaves focus where it is when it is on a part both layouts show', () => {
    const device = stubDevice({ fine: true });
    open();
    const link = screen.getByRole('link', { name: 'Open place' });
    link.focus();

    act(() => device.become({ fine: true, compact: true }));
    expect(document.activeElement).toBe(link);
  });

  it('crossfades back once the window has become a phone, as the layout changed', async () => {
    const device = stubDevice({ fine: true });
    stubBoxes();
    const dialog = open();
    act(() => device.become({ fine: true, compact: true }));
    vi.mocked(animate).mockClear();

    await pressEscape(dialog);
    expect(animatedKeys().length).toBeGreaterThan(0);
    expect(animatedKeys().filter((key) => FLIGHT_KEYS.includes(key))).toEqual([]);
  });
});
