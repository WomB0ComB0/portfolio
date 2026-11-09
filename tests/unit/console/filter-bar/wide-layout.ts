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
 * @file The FilterBar's wide layout (a page of 48rem and up), which jsdom cannot compute: it
 * evaluates no container queries and hides every popover (its UA stylesheet's
 * `[popover]:not(:popover-open)` rule, with no showPopover to open one). From 48rem the phone
 * sheet is `display: contents`, so its chips sit in the bar; the picker's panel is drawn open.
 * jsdom ranks its UA rule by specificity alone, so these need !important to win. Not a test file.
 */

/** Lays the facets out as from a 48rem page; returns the undo. */
export function wideLayout(): () => void {
  const style = document.createElement('style');
  style.dataset.testLayout = 'wide';
  style.textContent =
    '[data-filter-part="sheet"]{display:contents!important}[data-filter-part="picker"]{display:flex!important}';
  document.head.append(style);
  return () => style.remove();
}
