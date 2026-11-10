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
 * @file Whether the visitor points with a mouse or trackpad (hover and a fine pointer). False on
 * the server and with touch only, so anything that depends on it (the /projects hover preview)
 * starts in its touch form and adds nothing on a phone.
 */

import { useSyncExternalStore } from 'react';

export const FINE_POINTER = '(hover: hover) and (pointer: fine)';

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const browserSnapshot = (): boolean => window.matchMedia(FINE_POINTER).matches;
const serverSnapshot = (): boolean => false;

/** True with a mouse or trackpad; false on the server and with touch only. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
