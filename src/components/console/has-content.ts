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
 * @file Whether an optional slot was given anything to show. No directive: server components
 * call it while rendering.
 */

import type { ReactNode } from 'react';

/**
 * False for what React renders as nothing (null, undefined, a boolean) and for ''. Use it, not
 * `slot && ...`, to decide whether a slot gets its wrapper: React prints a falsy 0, so `0 && ...`
 * leaves a bare '0' where the wrapper should have been.
 */
export const hasContent = (slot: ReactNode): boolean =>
  slot !== null && slot !== undefined && typeof slot !== 'boolean' && slot !== '';
