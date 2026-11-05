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

import { cn } from '@/lib/utils';
import type { PageMainProps } from './page-transition.types';

export type { PageMainProps } from './page-transition.types';

/** The id of the page's `<main>`, which the shell's skip link targets. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * The site's one `<main>` landmark. The shell (src/components/layout/layout.tsx) puts it around
 * the page content only, so the navs and the footer stay outside it, and `tabIndex={-1}` lets the
 * skip link move focus here.
 *
 * It is a plain element: the shell mounts once and stays mounted across client navigations, so
 * a mount animation here would never replay. The per-page fade is PageEnter's, inside it.
 */
export const PageMain = ({ children, className }: PageMainProps) => (
  <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn('outline-none', className)}>
    {children}
  </main>
);
PageMain.displayName = 'PageMain';
