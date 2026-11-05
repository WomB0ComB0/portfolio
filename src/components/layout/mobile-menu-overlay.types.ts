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

import type { useKBar } from 'kbar';
import type { RefObject } from 'react';

export interface MobileMenuOverlayProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly pathname: string;
  readonly query: ReturnType<typeof useKBar>['query'];
  /** The button that opened the menu. Focus goes back to it when the menu closes. */
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
}
