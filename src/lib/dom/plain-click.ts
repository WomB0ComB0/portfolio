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
 * @file Links that act in place on a plain click and stay links for everything else: a chip, a
 * token or Clear filters in place with JavaScript, while a modified click (a new tab, a new
 * window, a download) and every visit without JavaScript follow the href. Moved from the
 * /certifications toolbar so every filter page shares it.
 */

import type { MouseEvent } from 'react';

type ClickFlags = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** A plain primary click; anything else (a new tab, a download) is the browser's. */
export const isPlainClick = (event: ClickFlags): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Calls `handle` instead of following the link, for a plain click only. */
export const onPlainClick =
  (handle: () => void) =>
  (event: MouseEvent): void => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    handle();
  };
