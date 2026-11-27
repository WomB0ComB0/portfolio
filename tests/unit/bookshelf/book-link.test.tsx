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
 * @file The link to a book's page (book-link.tsx). Its href is the book's own page, so it can be
 * copied, opened in a new tab and crawled. A plain left click opens the book in place instead of
 * following the link (Enter on a link is such a click); a click with a modifier key, with another
 * button, or one something else already handled is left to the browser.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookLink } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-link';

const SLUG = 'agents-in-practice';

/** Renders the link with a spy for opening the book in place. */
function renderLink() {
  const onOpen = vi.fn();
  render(
    <BookLink slug={SLUG} onOpen={onOpen} className="notes-link">
      Open notes (4 topics)
    </BookLink>,
  );
  return { onOpen, link: screen.getByRole('link', { name: 'Open notes (4 topics)' }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BookLink', () => {
  it("links to the book's own page, with the classes it is given", () => {
    const { link } = renderLink();

    expect(link).toHaveAttribute('href', `/bookshelf/${SLUG}`);
    expect(link).toHaveClass('notes-link');
  });

  it('opens the book in place on a plain left click, instead of following the link', () => {
    const { link, onOpen } = renderLink();

    const followed = fireEvent.click(link);

    expect(followed).toBe(false);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)(
    'leaves a click with %s to the browser (a new tab or window)',
    (modifier) => {
      const { link, onOpen } = renderLink();

      const followed = fireEvent.click(link, { [modifier]: true });

      expect(followed).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    },
  );

  it('leaves a click with another button than the main one to the browser', () => {
    const { link, onOpen } = renderLink();

    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('leaves a click something else already handled alone', () => {
    const { link, onOpen } = renderLink();
    const handledFirst = (event: Event): void => event.preventDefault();
    document.addEventListener('click', handledFirst, { capture: true });

    try {
      fireEvent.click(link);
    } finally {
      document.removeEventListener('click', handledFirst, { capture: true });
    }

    expect(onOpen).not.toHaveBeenCalled();
  });
});
