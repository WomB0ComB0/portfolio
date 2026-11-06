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

import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught the Live Console theme from src/styles/globals.css. Without it, an unknown
 * `text-*` reads as a colour (so `text-stat` would knock out `text-foreground`) and `shadow-raised`
 * as a shadow colour. Keep these lists in step with the `@theme static` names.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['label', 'meta', 'body-sm', 'body', 'title', 'heading', 'stat', 'display', 'hero'],
      tracking: ['display', 'stat', 'label'],
      radius: ['tile'],
      shadow: ['tile', 'raised', 'lift'],
      ease: ['out-expo', 'standard'],
      container: ['shell'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
