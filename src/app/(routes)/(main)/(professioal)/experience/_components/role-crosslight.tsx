'use client';

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
 * @file The cross-lighting island of /experience, the page's one client part. Pointing at a
 * role (its stop on the rail, or its capsule on "The path so far": anything marked
 * data-light-role) with a mouse, or focusing it with the keyboard, lights that role's capsule on
 * the path and dims the rest. Decorative: the page is complete without it.
 *
 * It renders one hidden marker and adds no element: it only sets data-lit on the capsules
 * (role-path.tsx styles "on" and "off"), so nothing shifts when it hydrates. Touch never
 * triggers it, and it does nothing under reduced motion.
 *
 * It also attaches the page's one other piece of browser code: role-jumps.ts, which keeps the
 * list's history entries whole between the browser and the router (the rim on the row a link
 * landed on, Back after a jump, the scroll and the open rows on the way back).
 */

import { type ReactElement, useEffect, useLayoutEffect, useRef } from 'react';

import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';
import { attachJumps, prepareEntry } from './role-jumps';

const ROOT = '[data-role-clock]';
const SOURCE = '[data-light-role]';
const CELLS = '[data-role-path] [data-r]';

/** The role a pointed-at or focused element stands for, if any. */
function roleAt(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(SOURCE)?.dataset.lightRole ?? null;
}

const matches = (query: string): boolean => window.matchMedia(query).matches;

/**
 * Whether focus came from the keyboard. An engine that cannot answer (no :focus-visible) is
 * taken at its word that the element is focused.
 */
function isKeyboardFocus(target: Element): boolean {
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Lights `id`'s capsule on the path and dims the others; null puts every one back. */
function light(root: HTMLElement, id: string | null): void {
  for (const cell of root.querySelectorAll<HTMLElement>(CELLS)) {
    if (id === null) cell.removeAttribute('data-lit');
    else cell.setAttribute('data-lit', cell.dataset.r === id ? 'on' : 'off');
  }
}

/**
 * The role a mouse already rests on, if any: the innermost hovered element that stands for one.
 * Only asked on a device with no touch screen. A touch leaves :hover behind and there is no
 * event here to tell its pointer type, so a device that has one is left to its events.
 */
function restingRole(root: HTMLElement): string | null {
  if (!matches(FINE_POINTER) || navigator.maxTouchPoints > 0) return null;
  const hovered = Array.from(root.querySelectorAll<HTMLElement>(`${SOURCE}:hover`));
  return hovered.at(-1)?.dataset.lightRole ?? null;
}

/**
 * Listens on the root for a mouse or keyboard focus on a role; returns how to stop. A mouse
 * that came to rest on a role before this ran sends no pointerover until it moves off, so the
 * role under it is lit once here.
 */
function attach(root: HTMLElement): () => void {
  const idle = (): boolean => matches(REDUCED_MOTION_QUERY);
  const onOver = (event: PointerEvent): void => {
    if (idle() || event.pointerType === 'touch' || !matches(FINE_POINTER)) return;
    light(root, roleAt(event.target));
  };
  const onLeave = (): void => light(root, null);
  const onFocus = (event: FocusEvent): void => {
    const { target } = event;
    if (idle() || !(target instanceof Element) || !isKeyboardFocus(target)) return;
    light(root, roleAt(target));
  };
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', onLeave);
  const resting = idle() ? null : restingRole(root);
  if (resting !== null) light(root, resting);
  return () => {
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', onLeave);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('focusout', onLeave);
    light(root, null);
  };
}

/** Mount once inside the element marked data-role-clock that holds the path and the roles. */
export function RoleCrosslight(): ReactElement {
  const marker = useRef<HTMLSpanElement>(null);
  // Before the browser lays the list out: the rows open on this history entry, and the scroll
  // the browser restores on a Back or Forward (role-jumps.ts).
  useLayoutEffect(() => {
    const root = marker.current?.closest<HTMLElement>(ROOT);
    return root ? prepareEntry(root) : undefined;
  }, []);
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>(ROOT);
    if (!root) return undefined;
    const stopLighting = attach(root);
    const stopJumps = attachJumps(root);
    return () => {
      stopLighting();
      stopJumps();
    };
  }, []);
  return <span ref={marker} hidden data-role-crosslight="" />;
}
