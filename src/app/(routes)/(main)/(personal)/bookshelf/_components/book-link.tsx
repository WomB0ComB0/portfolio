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

'use client';

/**
 * @file A link to a book's own page, /bookshelf/<slug>, that opens the book in place on a plain
 * left click (Enter on a link is one): the main button, no modifier key, and nothing else has
 * handled the click. Every other click is the browser's, so a middle click or a Cmd- or
 * Ctrl-click opens the book's page in a new tab, and Copy link copies the address worth sharing.
 * The stage's Open notes, the reading map's Open stage and the detail's Previous and Next use it
 * in place. A plain <a>, not next/link: the page it names is never fetched for the click it
 * takes over. Guarded by tests/unit/bookshelf/book-link.test.tsx.
 */

import type { ComponentPropsWithRef, MouseEvent, ReactElement } from 'react';
import { bookPath } from '../_lib/book-address';

export interface BookLinkProps extends Omit<ComponentPropsWithRef<'a'>, 'href' | 'onClick'> {
  /** The book whose page the link names. */
  readonly slug: string;
  /** Opens the book in place: called on a plain left click instead of following the link. */
  readonly onOpen: () => void;
}

/** A click the page may take over: the main button, no modifier key, not handled already. */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** A link to `slug`'s page that opens the book in place on a plain left click. */
export function BookLink({ slug, onOpen, children, ...anchor }: BookLinkProps): ReactElement {
  return (
    <a
      {...anchor}
      href={bookPath(slug)}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        onOpen();
      }}
    >
      {children}
    </a>
  );
}
