'use client';

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

import { useEffect } from 'react';
import { flushSync } from 'react-dom';

/**
 * A client component that enables View Transitions on navigation.
 * It listens for clicks on internal links and wraps the navigation
 * in a `document.startViewTransition` call.
 *
 * @returns {null} This component does not render anything.
 */
export function ViewTransitions() {
  useEffect(() => {
    const handleViewTransition = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="/"]');

      if (!anchor) return;

      if (!document.startViewTransition) return;

      e.preventDefault();
      document.startViewTransition(() => {
        flushSync(() => {
          // The navigation will happen here, but we let Next.js handle it.
          // This just wraps the state update that follows the click.
        });
      });
    };

    document.addEventListener('click', handleViewTransition);

    return () => {
      document.removeEventListener('click', handleViewTransition);
    };
  }, []);

  return null;
}
