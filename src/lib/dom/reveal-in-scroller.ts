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
 * @file Brings an element into view inside a sideways scroller, and only there: the current chip
 * of a FilterBar chip row that scrolls sideways, which a shared link can place past the row's
 * edge. Moved from /certifications so every filter page shares it. Unlike
 * scrollIntoView it never scrolls the page, and it moves at once (no smooth scroll to sit through,
 * or to turn off for reduced motion).
 */

/** Scrolls `scroller` sideways so `target` sits inside its padding; a no-op when already there. */
export function revealInScroller(scroller: HTMLElement, target: HTMLElement): void {
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const view = scroller.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const start = view.left + (Number.parseFloat(style.paddingLeft) || 0);
  const end = view.right - (Number.parseFloat(style.paddingRight) || 0);
  if (box.left < start) scroller.scrollLeft += box.left - start;
  else if (box.right > end) scroller.scrollLeft += box.right - end;
}
